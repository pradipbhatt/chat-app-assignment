import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, trim: true, lowercase: true, index: true },
    username: { type: String, required: true, trim: true, maxlength: 24 },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

messageSchema.index({ room: 1, createdAt: -1 });

messageSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    username: this.username,
    text: this.text,
    ts: this.createdAt.getTime(),
    system: false,
  };
};

export const Message = mongoose.model('Message', messageSchema);

export async function saveMessage({ room, username, text }) {
  const doc = await Message.create({ room, username, text });
  return doc.toClient();
}

export async function getRecentMessages(room, limit, before = null) {
  const query = { room };

  if (before !== null && before !== undefined && before !== '') {
    const cutoff = new Date(Number.isFinite(Number(before)) ? Number(before) : before);
    if (Number.isNaN(cutoff.getTime())) {
      return { messages: [], hasMore: false, invalidCursor: true };
    }
    query.createdAt = { $lt: cutoff };
  }

  const docs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .exec();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;

  return { messages: page.reverse().map((doc) => doc.toClient()), hasMore, invalidCursor: false };
}

export async function getRoomsWithHistory() {
  return Message.distinct('room');
}
