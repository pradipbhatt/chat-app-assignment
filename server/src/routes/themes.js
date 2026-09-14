import { Router } from 'express';
import { listThemes, createTheme, updateTheme, deleteTheme, countThemes } from '../models/Theme.js';
import { validateTheme } from '../utils/validate.js';
import { attachUser, requireAdmin } from '../middleware/auth.js';
import { getIo } from '../socket/ioRef.js';

const router = Router();

const MAX_THEMES = 20;

const announce = () => {
  const io = getIo();
  if (io) io.emit('themes:updated');
};

router.get('/themes', async (_req, res) => {
  try {
    return res.json({ themes: await listThemes() });
  } catch (error) {
    console.error('[themes] failed to list', error);
    return res.status(500).json({ code: 'THEMES_FAILED', message: 'Could not load themes.' });
  }
});

router.use('/themes', attachUser, requireAdmin);

router.post('/themes', async (req, res) => {
  const theme = validateTheme(req.body);
  if (!theme.ok) return res.status(400).json({ code: theme.code, message: theme.message });

  try {
    if ((await countThemes()) >= MAX_THEMES) {
      return res.status(400).json({
        code: 'THEME_LIMIT',
        message: `Delete a theme first — ${MAX_THEMES} is the limit.`,
      });
    }

    const created = await createTheme(theme.value, req.auth.username);
    announce();
    return res.status(201).json({ ok: true, theme: created });
  } catch (error) {
    console.error('[themes] failed to create', error);
    return res.status(500).json({ code: 'THEME_CREATE_FAILED', message: 'Could not save that theme.' });
  }
});

router.put('/themes/:id', async (req, res) => {
  const theme = validateTheme(req.body);
  if (!theme.ok) return res.status(400).json({ code: theme.code, message: theme.message });

  try {
    const updated = await updateTheme(req.params.id, theme.value);
    if (!updated) return res.status(404).json({ code: 'NOT_FOUND', message: 'That theme is gone.' });
    announce();
    return res.json({ ok: true, theme: updated });
  } catch (error) {
    console.error('[themes] failed to update', error);
    return res.status(400).json({ code: 'THEME_UPDATE_FAILED', message: 'Could not update that theme.' });
  }
});

router.delete('/themes/:id', async (req, res) => {
  try {
    const removed = await deleteTheme(req.params.id);
    if (!removed) return res.status(404).json({ code: 'NOT_FOUND', message: 'That theme is gone.' });
    announce();
    return res.json({ ok: true });
  } catch (error) {
    console.error('[themes] failed to delete', error);
    return res.status(400).json({ code: 'THEME_DELETE_FAILED', message: 'Could not delete that theme.' });
  }
});

export default router;
