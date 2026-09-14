import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function signToken(user) {
  if (!config.jwtSecret) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  if (!config.jwtSecret || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (!payload?.role || !payload?.username) return null;
    return { id: payload.sub, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export function readBearer(header) {
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim();
}
