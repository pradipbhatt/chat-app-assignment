import { Router } from 'express';
import { attachUser, requireAdmin } from '../middleware/auth.js';
import {
  overview,
  kickUser,
  banUser,
  unbanUser,
  bans,
  deleteMessage,
  clearRoom,
} from '../services/moderation.js';

const router = Router();

router.use('/admin', attachUser, requireAdmin);

const respond = (res, result) => {
  if (result.ok) return res.json(result);
  const status = result.code === 'NOT_FOUND' ? 404 : 400;
  return res.status(status).json(result);
};

router.get('/admin/overview', (_req, res) => res.json({ ok: true, ...overview() }));

router.get('/admin/bans', async (_req, res) => {
  try {
    return res.json(await bans());
  } catch (error) {
    console.error('[admin] failed to list bans', error);
    return res.status(500).json({ code: 'BANS_FAILED', message: 'Could not load bans.' });
  }
});

router.post('/admin/kick', async (req, res) => {
  try {
    const result = await kickUser({
      username: req.body?.username,
      room: req.body?.room,
      reason: req.body?.reason,
      actor: req.auth.username,
    });
    return respond(res, result);
  } catch (error) {
    console.error('[admin] kick failed', error);
    return res.status(500).json({ code: 'KICK_FAILED', message: 'Could not remove that user.' });
  }
});

router.post('/admin/ban', async (req, res) => {
  try {
    const result = await banUser({
      username: req.body?.username,
      room: req.body?.room,
      reason: req.body?.reason,
      minutes: Number(req.body?.minutes) || null,
      actor: req.auth.username,
    });
    return respond(res, result);
  } catch (error) {
    console.error('[admin] ban failed', error);
    return res.status(500).json({ code: 'BAN_FAILED', message: 'Could not ban that user.' });
  }
});

router.delete('/admin/bans/:id', async (req, res) => {
  try {
    return respond(res, await unbanUser(req.params.id));
  } catch (error) {
    console.error('[admin] unban failed', error);
    return res.status(400).json({ code: 'UNBAN_FAILED', message: 'Could not lift that ban.' });
  }
});

router.delete('/admin/messages/:id', async (req, res) => {
  try {
    return respond(
      res,
      await deleteMessage({ id: req.params.id, room: req.body?.room ?? null, actor: req.auth.username }),
    );
  } catch (error) {
    console.error('[admin] delete message failed', error);
    return res.status(400).json({ code: 'DELETE_FAILED', message: 'Could not delete that message.' });
  }
});

router.post('/admin/rooms/:room/clear', async (req, res) => {
  try {
    return respond(res, await clearRoom({ room: req.params.room, actor: req.auth.username }));
  } catch (error) {
    console.error('[admin] clear room failed', error);
    return res.status(500).json({ code: 'CLEAR_FAILED', message: 'Could not clear that room.' });
  }
});

export default router;
