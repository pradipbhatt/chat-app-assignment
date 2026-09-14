import mongoose from 'mongoose';
import { THEME_TOKENS } from '../utils/validate.js';

const themeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 32 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    mode: { type: String, required: true, enum: ['light', 'dark'] },
    colors: {
      type: Map,
      of: String,
      required: true,
    },
    shadowTint: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

themeSchema.methods.toClient = function toClient() {
  const colors = {};
  for (const token of THEME_TOKENS) {
    const value = this.colors.get(token);
    if (value) colors[token] = value;
  }

  return {
    id: this._id.toString(),
    slug: this.slug,
    name: this.name,
    mode: this.mode,
    colors,
    shadowTint: this.shadowTint,
    createdBy: this.createdBy,
    updatedAt: this.updatedAt ? this.updatedAt.getTime() : null,
  };
};

export const Theme = mongoose.model('Theme', themeSchema);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

async function uniqueSlug(base, ignoreId = null) {
  const root = base || 'theme';
  let candidate = root;
  let suffix = 2;

  while (suffix < 60) {
    const existing = await Theme.findOne({ slug: candidate }).exec();
    if (!existing || (ignoreId && existing._id.toString() === ignoreId)) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return `${root}-${Date.now().toString(36)}`;
}

export async function listThemes() {
  const themes = await Theme.find({}).sort({ createdAt: 1 }).limit(40).exec();
  return themes.map((theme) => theme.toClient());
}

export async function countThemes() {
  return Theme.countDocuments();
}

export async function createTheme(payload, actor) {
  const slug = await uniqueSlug(slugify(payload.name));
  const theme = await Theme.create({ ...payload, slug, createdBy: actor });
  return theme.toClient();
}

export async function updateTheme(id, payload) {
  const theme = await Theme.findById(id).exec();
  if (!theme) return null;

  theme.name = payload.name;
  theme.mode = payload.mode;
  theme.colors = payload.colors;
  theme.shadowTint = payload.shadowTint;
  theme.slug = await uniqueSlug(slugify(payload.name), id);

  await theme.save();
  return theme.toClient();
}

export async function deleteTheme(id) {
  const result = await Theme.findByIdAndDelete(id).exec();
  return Boolean(result);
}
