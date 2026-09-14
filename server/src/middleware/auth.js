import { verifyToken, readBearer } from '../utils/token.js';
import { ROLES } from '../models/User.js';

export function attachUser(req, _res, next) {
  req.auth = verifyToken(readBearer(req.headers.authorization));
  next();
}

export function requireRole(role) {
  return function guard(req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Sign in to continue.' });
    }
    if (req.auth.role !== role) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access to this.' });
    }
    return next();
  };
}

export const requireAdmin = requireRole(ROLES.ADMIN);
