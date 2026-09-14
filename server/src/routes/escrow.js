import { Router } from 'express';
import { publicEscrowKey } from '../models/Escrow.js';
import { listRecordedRooms, readRoomKey } from '../models/RoomKey.js';
import { Message } from '../models/Message.js';
import { attachUser, requireAdmin } from '../middleware/auth.js';
import { validateRoom } from '../utils/validate.js';
import { unwrapRoomKey as serverUnwrap, decryptEnvelope } from '../utils/escrowServer.js';

const router = Router();

router.get('/escrow/public-key', async (_req, res) => {
  try {
    const key = await publicEscrowKey();
    return res.json({ ok: true, escrow: key });
  } catch (error) {
    console.error('[escrow] failed to read the public key', error);
    return res.status(500).json({ code: 'ESCROW_FAILED', message: 'Could not read the key.' });
  }
});

router.use('/admin/private-rooms', attachUser, requireAdmin);

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
    const stored = await Message.find({ room: room.value }).sort({ createdAt: 1 }).limit(500).exec();

    const roomKey = await serverUnwrap(wrappedKey);
    const messages = stored.map((message) => {
      const entry = message.toClient();
      if (!roomKey) return entry;
      const plain = decryptEnvelope(roomKey, entry.text);
      return plain === null ? entry : { ...entry, text: plain, decrypted: true };
    });

    return res.json({
      ok: true,
      room: room.value,
      wrappedKey,
      readable: Boolean(roomKey),
      messages,
    });
  } catch (error) {
    console.error('[escrow] failed to read a private room', error);
    return res.status(500).json({ code: 'READ_FAILED', message: 'Could not read that room.' });
  }
});

export default router;
