import { Router } from 'express';
import { User } from '../models/User.js';
import { signToken } from '../utils/token.js';
import { attachUser } from '../middleware/auth.js';

const router = Router();

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

router.post('/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ code: 'CREDENTIALS_REQUIRED', message: 'Username and password are required.' });
  }

  if (tooManyAttempts(req.ip || username)) {
    return res.status(429).json({ code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again later.' });
  }

  try {
    const user = await User.findOne({ username }).exec();
    const valid = user ? await user.verifyPassword(password) : false;

    if (!user || !valid) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password.' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const account = user.toClient();
    return res.json({ token: signToken(account), user: account });
  } catch (error) {
    console.error('[auth] login failed', error);
    return res.status(500).json({ code: 'LOGIN_FAILED', message: 'Could not sign in.' });
  }
});

router.get('/auth/me', attachUser, (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Sign in to continue.' });
  }
  return res.json({ user: req.auth });
});

export default router;
