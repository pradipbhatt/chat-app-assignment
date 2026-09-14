import { Router } from 'express';
import { readEscrow, publicEscrowKey, saveEscrow } from '../models/Escrow.js';
import { listRecordedRooms, readRoomKey } from '../models/RoomKey.js';
import { Message } from '../models/Message.js';
import { attachUser, requireAdmin } from '../middleware/auth.js';
import { validateRoom } from '../utils/validate.js';

const router = Router();

const isBase64 = (value) => typeof value === 'string' && /^[A-Za-z0-9+/_-]+={0,2}$/.test(value);

router.get('/escrow/public-key', async (_req, res) => {
  try {
    const key = await publicEscrowKey();
    return res.json({ ok: true, escrow: key });
  } catch (error) {
    console.error('[escrow] failed to read the public key', error);
    return res.status(500).json({ code: 'ESCROW_FAILED', message: 'Could not read the key.' });
  }
});

router.use('/escrow/vault', attachUser, requireAdmin);
router.use('/admin/private-rooms', attachUser, requireAdmin);

router.get('/escrow/vault', async (_req, res) => {
  const escrow = await readEscrow();
  if (!escrow) return res.status(404).json({ code: 'NO_ESCROW', message: 'No escrow key is set up.' });

  return res.json({
    ok: true,
    vault: {
      wrappedPrivateKey: escrow.wrappedPrivateKey,
      salt: escrow.salt,
      iv: escrow.iv,
      iterations: escrow.iterations,
    },
  });
});

router.post('/escrow/vault', async (req, res) => {
  const { publicKeyJwk, wrappedPrivateKey, salt, iv, iterations } = req.body ?? {};

  if (!publicKeyJwk || typeof publicKeyJwk !== 'object' || publicKeyJwk.kty !== 'RSA') {
    return res.status(400).json({ code: 'ESCROW_KEY_INVALID', message: 'The public key is not usable.' });
  }

  if (![wrappedPrivateKey, salt, iv].every(isBase64)) {
    return res.status(400).json({ code: 'ESCROW_BLOB_INVALID', message: 'The sealed key is not usable.' });
  }

  const rounds = Number(iterations);
  if (!Number.isFinite(rounds) || rounds < 100000 || rounds > 1000000) {
    return res.status(400).json({ code: 'ESCROW_ROUNDS_INVALID', message: 'Unsafe key strengthening.' });
  }

  try {
    await saveEscrow(
      { publicKeyJwk, wrappedPrivateKey, salt, iv, iterations: rounds },
      req.auth.username,
    );
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('[escrow] failed to save', error);
    return res.status(500).json({ code: 'ESCROW_SAVE_FAILED', message: 'Could not save the key.' });
  }
});

router.get('/admin/private-rooms', async (_req, res) => {
  try {
    const rooms = await listRecordedRooms();
    const counts = await Message.aggregate([
      { $match: { room: { $in: rooms.map((entry) => entry.room) } } },
      { $group: { _id: '$room', count: { $sum: 1 } } },
    ]);
    const byRoom = new Map(counts.map((entry) => [entry._id, entry.count]));

    return res.json({
      ok: true,
      rooms: rooms.map((entry) => ({ ...entry, messages: byRoom.get(entry.room) ?? 0 })),
    });
  } catch (error) {
    console.error('[escrow] failed to list private rooms', error);
    return res.status(500).json({ code: 'LIST_FAILED', message: 'Could not list rooms.' });
  }
});

router.get('/admin/private-rooms/:room', async (req, res) => {
  const room = validateRoom(req.params.room);
  if (!room.ok) return res.status(400).json({ code: room.code, message: room.message });

  try {
    const wrappedKey = await readRoomKey(room.value);
    const messages = await Message.find({ room: room.value })
      .sort({ createdAt: 1 })
      .limit(500)
      .exec();

    return res.json({
      ok: true,
      room: room.value,
      wrappedKey,
      messages: messages.map((message) => message.toClient()),
    });
  } catch (error) {
    console.error('[escrow] failed to read a private room', error);
    return res.status(500).json({ code: 'READ_FAILED', message: 'Could not read that room.' });
  }
});

export default router;
