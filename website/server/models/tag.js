import { v4 as uuid } from 'uuid';
import { prisma } from '../libs/prisma';

// Thin Prisma wrapper for tags

export class TagDocument {
  constructor (data) {
    this.id = data.id;
    this._id = data.id;
    this.name = data.name;
    this.userId = data.userId;
  }

  toJSON () {
    return {
      id: this.id, _id: this.id, name: this.name, userId: this.userId,
    };
  }
}

export const model = {
  async find (where = {}) {
    const rows = await prisma.tag.findMany({ where });
    return rows.map(r => new TagDocument(r));
  },

  async findOne (where) {
    const row = await prisma.tag.findFirst({ where });
    return row ? new TagDocument(row) : null;
  },

  async create (data) {
    const row = await prisma.tag.create({ data: { id: data.id || uuid(), ...data } });
    return new TagDocument(row);
  },

  async deleteOne (where) {
    await prisma.tag.deleteMany({ where });
  },

  async updateOne (where, data) {
    await prisma.tag.updateMany({ where, data });
  },

  // Sanitise: only allow name on create/update
  sanitize (obj) {
    const out = {};
    if (obj.name !== undefined) out.name = obj.name;
    if (obj.id !== undefined) out.id = obj.id;
    return out;
  },

  sanitizeUpdate (obj) {
    const out = {};
    if (obj.name !== undefined) out.name = obj.name;
    return out;
  },
};

// For backward-compat with `import { schema } from '../tag'`
export const schema = { paths: {} };
