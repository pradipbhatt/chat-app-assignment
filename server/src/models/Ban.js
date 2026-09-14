import mongoose from 'mongoose';

const banSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true },
    room: { type: String, default: null, trim: true, lowercase: true },
    reason: { type: String, default: '', trim: true, maxlength: 200 },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

banSchema.index({ username: 1, room: 1 });

banSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    username: this.username,
    room: this.room,
    reason: this.reason,
    createdBy: this.createdBy,
    expiresAt: this.expiresAt ? this.expiresAt.getTime() : null,
    createdAt: this.createdAt.getTime(),
  };
};

export const Ban = mongoose.model('Ban', banSchema);

export async function findActiveBan(username, room) {
  const now = new Date();
  const ban = await Ban.findOne({
    username: username.toLowerCase(),
    $or: [{ room: null }, { room: room.toLowerCase() }],
    $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }],
  }).exec();
  return ban;
}

export async function listBans() {
  const bans = await Ban.find({}).sort({ createdAt: -1 }).limit(200).exec();
  return bans.map((ban) => ban.toClient());
}

export async function createBan({ username, room, reason, createdBy, minutes }) {
  const expiresAt = minutes ? new Date(Date.now() + minutes * 60 * 1000) : null;
  const ban = await Ban.create({
    username: username.toLowerCase(),
    room: room ? room.toLowerCase() : null,
    reason,
    createdBy,
    expiresAt,
  });
  return ban.toClient();
}

export async function removeBan(id) {
  const result = await Ban.findByIdAndDelete(id).exec();
  return Boolean(result);
}
