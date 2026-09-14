import mongoose from 'mongoose';

const escrowSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true, default: 'admin' },
    publicKeyJwk: { type: Object, required: true },
    wrappedPrivateKey: { type: String, required: true },
    salt: { type: String, required: true },
    iv: { type: String, required: true },
    iterations: { type: Number, required: true },
    sealedBy: { type: String, enum: ['passphrase', 'server'], default: 'passphrase' },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const Escrow = mongoose.model('Escrow', escrowSchema);

export async function readEscrow() {
  return Escrow.findOne({ label: 'admin' }).exec();
}

export async function publicEscrowKey() {
  const escrow = await readEscrow();
  return escrow ? { publicKeyJwk: escrow.publicKeyJwk, updatedAt: escrow.updatedAt.getTime() } : null;
}

export async function saveEscrow(payload, actor) {
  const existing = await readEscrow();

  if (existing) {
    existing.publicKeyJwk = payload.publicKeyJwk;
    existing.wrappedPrivateKey = payload.wrappedPrivateKey;
    existing.salt = payload.salt;
    existing.iv = payload.iv;
    existing.iterations = payload.iterations;
    existing.createdBy = actor;
    await existing.save();
    return existing;
  }

  return Escrow.create({ label: 'admin', ...payload, createdBy: actor });
}
