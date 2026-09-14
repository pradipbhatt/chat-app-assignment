import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

export const ROLES = { ADMIN: 'admin', USER: 'user' };

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.ADMIN },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toClient = function toClient() {
  return { id: this._id.toString(), username: this.username, role: this.role };
};

export const User = mongoose.model('User', userSchema);

const reservedUsernames = new Set();

export async function loadReservedUsernames() {
  const accounts = await User.find({}, { username: 1 }).exec();
  reservedUsernames.clear();
  for (const account of accounts) reservedUsernames.add(account.username.toLowerCase());
  return [...reservedUsernames];
}

export function isReservedUsername(username) {
  return reservedUsernames.has(String(username).trim().toLowerCase());
}

export async function seedAdmin() {
  if (!config.admin.username || !config.admin.password) {
    console.warn('[auth] ADMIN_USERNAME or ADMIN_PASSWORD missing, admin account not seeded');
    return null;
  }

  const username = config.admin.username.toLowerCase();
  const passwordHash = await bcrypt.hash(config.admin.password, 12);

  const existing = await User.findOne({ username }).exec();
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = ROLES.ADMIN;
    await existing.save();
    console.log(`[auth] admin account "${username}" refreshed`);
    return existing;
  }

  const created = await User.create({ username, passwordHash, role: ROLES.ADMIN });
  console.log(`[auth] admin account "${username}" created`);
  return created;
}
