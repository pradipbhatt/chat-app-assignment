import mongoose from 'mongoose';

const roomKeySchema = new mongoose.Schema(
  {
    room: { type: String, required: true, unique: true, trim: true, lowercase: true },
    wrappedKey: { type: String, required: true },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const RoomKey = mongoose.model('RoomKey', roomKeySchema);

export async function storeRoomKey({ room, wrappedKey, createdBy, expiresAt }) {
  return RoomKey.findOneAndUpdate(
    { room },
    { room, wrappedKey, createdBy, expiresAt: expiresAt ? new Date(expiresAt) : null },
    { upsert: true, returnDocument: 'after' },
  ).exec();
}

export async function readRoomKey(room) {
  const record = await RoomKey.findOne({ room }).exec();
  return record ? record.wrappedKey : null;
}

export async function listRecordedRooms() {
  const records = await RoomKey.find({}).sort({ createdAt: -1 }).limit(100).exec();
  return records.map((record) => ({
    room: record.room,
    createdBy: record.createdBy,
    createdAt: record.createdAt.getTime(),
    expiresAt: record.expiresAt ? record.expiresAt.getTime() : null,
    hasKey: Boolean(record.wrappedKey),
  }));
}
