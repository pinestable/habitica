import { v4 as uuid } from 'uuid';
import { prisma } from '../libs/prisma';

export const tasksTypes = ['habit', 'daily', 'todo'];

const JSON_FIELDS = ['checklist', 'tags', 'history', 'repeat', 'daysOfMonth', 'weeksOfMonth', 'nextDue', 'reminders'];

const TASK_PRISMA_FIELDS = [
  'id', 'type', 'text', 'notes', 'alias', 'value', 'priority', 'tags',
  'checklist', 'collapseChecklist', 'up', 'down', 'counterUp', 'counterDown',
  'frequency', 'everyX', 'startDate', 'repeat', 'daysOfMonth', 'weeksOfMonth',
  'streak', 'completed', 'isDue', 'nextDue', 'yesterDaily', 'dueDate',
  'dateCompleted', 'history', 'reminders', 'byHabitica', 'createdAt', 'updatedAt', 'userId',
];

// Fields that callers cannot set via sanitize()
const NO_SET_FIELDS = ['id', 'createdAt', 'updatedAt', 'userId', 'history'];

function parseJsonFields (data) {
  const out = { ...data };
  for (const f of JSON_FIELDS) {
    if (typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f]); } catch (_) { out[f] = f === 'repeat' ? {} : []; }
    } else if (out[f] == null) {
      out[f] = f === 'repeat' ? {} : [];
    }
  }
  return out;
}

function encodeJsonFields (data) {
  const out = { ...data };
  for (const f of JSON_FIELDS) {
    if (typeof out[f] !== 'string') {
      const fallback = f === 'repeat' ? {} : [];
      out[f] = JSON.stringify(out[f] != null ? out[f] : fallback);
    }
  }
  return out;
}

export class TaskDocument {
  constructor (data) {
    const parsed = parseJsonFields(data);
    TASK_PRISMA_FIELDS.forEach(f => { this[f] = parsed[f]; });
    this._id = this.id;
    this._dirty = new Set();

    // Apply Prisma-schema defaults for fields that were not provided
    if (this.notes == null) this.notes = '';
    if (this.value == null) this.value = 0;
    if (this.priority == null) this.priority = 1;
    if (this.collapseChecklist == null) this.collapseChecklist = false;
    if (this.up == null) this.up = true;
    if (this.down == null) this.down = true;
    if (this.counterUp == null) this.counterUp = 0;
    if (this.counterDown == null) this.counterDown = 0;
    if (this.frequency == null) this.frequency = 'daily';
    if (this.everyX == null) this.everyX = 1;
    if (this.streak == null) this.streak = 0;
    if (this.completed == null) this.completed = false;
    if (this.isDue == null) this.isDue = false;
    if (this.yesterDaily == null) this.yesterDaily = true;
    if (this.byHabitica == null) this.byHabitica = false;

    // Stubs for stripped group/challenge features — prevents crashes on guard checks
    this.group = this.group || { id: null, assignedDate: null, assignedUsers: [] };
    this.challenge = this.challenge || { id: null, broken: null };
  }

  isModified (path) {
    if (!path) return this._dirty.size > 0;
    return this._dirty.has(path);
  }

  markModified (path) {
    this._dirty.add(path || '*');
  }

  // No-op: Prisma validates at the DB level; alias uniqueness checked separately
  // eslint-disable-next-line class-methods-use-this
  validateSync () { return null; }

  async save () {
    const data = encodeJsonFields(
      Object.fromEntries(
        TASK_PRISMA_FIELDS
          .filter(f => f !== 'id' && f !== 'createdAt')
          .map(f => [f, this[f]]),
      ),
    );
    await prisma.task.upsert({
      where: { id: this.id },
      update: data,
      create: { id: this.id, ...data },
    });
    this._dirty.clear();
    return this;
  }

  async deleteOne () {
    await prisma.task.delete({ where: { id: this.id } }).catch(() => {});
  }

  toJSON () {
    const obj = {};
    TASK_PRISMA_FIELDS.forEach(f => { obj[f] = this[f]; });
    obj._id = obj.id;
    return obj;
  }

  toObject () {
    return this.toJSON();
  }

  // Async version of validateSync — resolves to null (no validation errors)
  // eslint-disable-next-line class-methods-use-this
  async validate () { return Promise.resolve(null); }
}

// Per-type factory functions — tasks/index.js uses `new Tasks[type](data)`.
// When a constructor function returns an object, `new` uses that object — so
// calling `new habit(data)` yields a TaskDocument instance.
function makeTaskFactory (type) {
  return function TaskFactory (data) {
    return new TaskDocument({ id: uuid(), type, ...data });
  };
}
export const habit = makeTaskFactory('habit');
export const daily = makeTaskFactory('daily');
export const todo = makeTaskFactory('todo');

// Convert Mongoose-style where clause to Prisma where object
function toWhere (query) {
  if (!query) return {};
  const q = {};
  for (const [k, v] of Object.entries(query)) {
    if (k === '_id') {
      q.id = v;
    } else if (k === '$or') {
      q.OR = v.map(toWhere);
    } else if (k === '$and') {
      q.AND = v.map(toWhere);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.$in !== undefined) {
        q[k] = { in: v.$in };
      } else if (v.$lt !== undefined) {
        q[k] = { lt: v.$lt };
      } else if (v.$gt !== undefined) {
        q[k] = { gt: v.$gt };
      } else if (v.$exists === undefined) {
        // non-$exists object values (e.g. nested) — pass through
        q[k] = v;
      }
      // $exists is skipped — all fields always exist on the flat SQLite schema
    } else {
      q[k] = v;
    }
  }
  return q;
}

export const Task = {
  // Strip read-only fields before creating a task
  sanitize (data) {
    if (!data) return {};
    const out = { ...data };
    NO_SET_FIELDS.forEach(f => delete out[f]);
    return out;
  },

  async find (query) {
    const where = toWhere(query);
    const rows = await prisma.task.findMany({ where });
    return rows.map(r => new TaskDocument(r));
  },

  async findOne (query) {
    const where = toWhere(query);
    const row = await prisma.task.findFirst({ where });
    return row ? new TaskDocument(row) : null;
  },

  async findById (id) {
    if (!id) return null;
    const row = await prisma.task.findUnique({ where: { id } });
    return row ? new TaskDocument(row) : null;
  },

  async findByIdOrAlias (identifier, userId, extraQuery) {
    if (!identifier) return null;
    const where = {
      OR: [
        { id: identifier },
        { alias: identifier, userId },
      ],
    };
    if (extraQuery) {
      Object.entries(extraQuery).forEach(([k, v]) => {
        if (k === 'userId') {
          // already scoped above for alias; add for id too
          where.OR[0].userId = v;
        }
      });
    }
    const row = await prisma.task.findFirst({ where });
    return row ? new TaskDocument(row) : null;
  },

  async findMultipleByIdOrAlias (identifiers, userId) {
    const ids = identifiers.filter(i => i);
    if (!ids.length) return [];
    const rows = await prisma.task.findMany({
      where: {
        userId,
        OR: [
          { id: { in: ids } },
          { alias: { in: ids } },
        ],
      },
    });
    return rows.map(r => new TaskDocument(r));
  },

  async deleteMany (query) {
    const where = toWhere(query);
    await prisma.task.deleteMany({ where });
  },

  async updateMany (query, update) {
    const where = toWhere(query);
    // Only support plain data updates (not $pull/$push Mongo operators)
    const data = {};
    for (const [k, v] of Object.entries(update)) {
      if (!k.startsWith('$')) data[k] = v;
    }
    const p = prisma.task.updateMany({ where, data });
    p.exec = () => p;
    return p;
  },

  async create (data) {
    const encoded = encodeJsonFields(data);
    const row = await prisma.task.create({ data: encoded });
    return new TaskDocument(row);
  },
};
