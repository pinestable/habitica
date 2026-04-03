import { defaults } from 'lodash';
import moment from 'moment';
import { prisma } from '../libs/prisma';
import common from '../../common';

const { daysSince } = common;

const USER_PRISMA_FIELDS = [
  'id', 'apiToken', 'email', 'username', 'lowerCaseUsername',
  'hashedPassword', 'salt', 'passwordHashMethod', 'passwordResetCode',
  'name', 'dayStart', 'timezoneOffset', 'timezoneOffsetAtLastCron',
  'sleep', 'language', 'dateFormat',
  'tasksOrderHabits', 'tasksOrderDailys', 'tasksOrderTodos',
  'lastCron', 'cronSignature', 'cronCount', 'isAdmin',
  'createdAt', 'updatedAt', 'loggedInAt',
];

export class UserDocument {
  constructor (data) {
    USER_PRISMA_FIELDS.forEach(f => { this[f] = data[f]; });
    this._id = this.id;
    this._dirty = new Set();

    // Mutable preferences object — synced to flat fields on save()
    this.preferences = {
      dayStart: this.dayStart,
      timezoneOffset: this.timezoneOffset,
      timezoneOffsetAtLastCron: this.timezoneOffsetAtLastCron,
      sleep: this.sleep,
      language: this.language,
      dateFormat: this.dateFormat,
    };
    this.preferences.toObject = function toObject () { return { ...this }; }.bind(this.preferences);

    // Mutable tasksOrder — synced to JSON flat fields on save()
    this.tasksOrder = {
      habits: JSON.parse(this.tasksOrderHabits || '[]'),
      dailys: JSON.parse(this.tasksOrderDailys || '[]'),
      todos: JSON.parse(this.tasksOrderTodos || '[]'),
    };

    // Notifications loaded via Prisma include
    this.notifications = (data.notifications || []).map(n => ({ ...n }));

    // Tags loaded via Prisma include
    this.tags = (data.tags || []).map(t => ({ ...t }));

    // Webhooks — not stored in SQLite; empty array prevents webhook.js crashes
    this.webhooks = [];

    // _tmp is used transiently by scoreTask to carry per-request data
    this._tmp = {};

    // stats stub — gamification removed, but some controllers still reference user.stats
    this.stats = { toJSON () { return {}; } };
  }

  // Backward-compat shim: exposes flat Prisma fields as auth.local.* with working setters.
  // Each call returns a new wrapper object but all setters close over `this` (the document).
  get auth () {
    const self = this;

    // Use Object.defineProperties so that assignments like user.auth.local.email = 'x'
    // actually write back to the flat UserDocument fields.
    const local = {};
    function defineProp (obj, key, getter, setter) {
      Object.defineProperty(obj, key, {
        get: getter, set: setter, enumerable: true, configurable: true,
      });
    }
    defineProp(local, 'email', () => self.email, v => { self.email = v; });
    defineProp(local, 'username', () => self.username, v => { self.username = v; });
    defineProp(local, 'lowerCaseUsername', () => self.lowerCaseUsername, v => { self.lowerCaseUsername = v; }); // eslint-disable-line max-len
    // eslint-disable-next-line camelcase
    defineProp(local, 'hashed_password', () => self.hashedPassword, v => { self.hashedPassword = v; });
    defineProp(local, 'passwordHashMethod', () => self.passwordHashMethod, v => { self.passwordHashMethod = v; }); // eslint-disable-line max-len
    defineProp(local, 'salt', () => self.salt, v => { self.salt = v; });
    defineProp(local, 'passwordResetCode', () => self.passwordResetCode, v => { self.passwordResetCode = v; }); // eslint-disable-line max-len

    const timestamps = {};
    defineProp(timestamps, 'loggedIn', () => self.loggedInAt, v => { self.loggedInAt = v; });
    defineProp(timestamps, 'updated', () => self.updatedAt, () => { /* managed by Prisma @updatedAt */ });

    return { blocked: false, local, timestamps };
  }

  // Helpers expected by common cron code
  getUtcOffset () {
    return -(this.preferences.timezoneOffset || 0);
  }

  isModified (path) {
    if (!path) return this._dirty.size > 0;
    return this._dirty.has(path);
  }

  markModified (path) {
    this._dirty.add(path || '*');
  }

  // Instance-level no-op for Mongoose $pull/$push/$set style updates.
  // Callers should mutate the document in memory and call save() instead.
  // eslint-disable-next-line class-methods-use-this
  updateOne () {
    const p = Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    p.exec = () => p;
    return p;
  }

  async save () {
    // Sync mutable preference object back to flat Prisma columns
    this.dayStart = this.preferences.dayStart;
    this.timezoneOffset = this.preferences.timezoneOffset;
    this.timezoneOffsetAtLastCron = this.preferences.timezoneOffsetAtLastCron;
    this.sleep = this.preferences.sleep;
    this.language = this.preferences.language;
    this.dateFormat = this.preferences.dateFormat;

    // Sync tasksOrder back to JSON columns
    this.tasksOrderHabits = JSON.stringify(this.tasksOrder.habits || []);
    this.tasksOrderDailys = JSON.stringify(this.tasksOrder.dailys || []);
    this.tasksOrderTodos = JSON.stringify(this.tasksOrder.todos || []);

    const data = {};
    USER_PRISMA_FIELDS.forEach(f => {
      if (f !== 'id' && f !== 'createdAt') data[f] = this[f];
    });

    await prisma.user.update({ where: { id: this.id }, data });
    this._dirty.clear();
    return this;
  }

  toJSON () {
    // Sync preference/order objects so the JSON is up to date
    const obj = {};
    USER_PRISMA_FIELDS.forEach(f => { obj[f] = this[f]; });
    obj._id = obj.id;
    obj.preferences = { ...this.preferences };
    obj.tasksOrder = { ...this.tasksOrder };
    obj.notifications = this.notifications;
    obj.tags = this.tags;
    delete obj.hashedPassword;
    delete obj.salt;
    delete obj.passwordResetCode;
    return obj;
  }

  // Inbox stripped — alias to toJSON for backward compat
  async toJSONWithInbox () { return this.toJSON(); }

  // Adapted from website/server/models/user/methods.js
  daysUserHasMissed (now, req = {}) {
    let timezoneUtcOffsetFromUserPrefs = this.getUtcOffset();
    const timezoneUtcOffsetAtLastCron = Number.isFinite(this.preferences.timezoneOffsetAtLastCron)
      ? -this.preferences.timezoneOffsetAtLastCron
      : timezoneUtcOffsetFromUserPrefs;

    if (!this.lastCron) {
      return { daysMissed: 0, timezoneUtcOffsetFromUserPrefs };
    }

    let timezoneUtcOffsetFromBrowser = typeof req.header === 'function'
      && -Number(req.header('x-user-timezoneoffset'));
    timezoneUtcOffsetFromBrowser = Number.isFinite(timezoneUtcOffsetFromBrowser)
      ? timezoneUtcOffsetFromBrowser
      : timezoneUtcOffsetFromUserPrefs;

    if (timezoneUtcOffsetFromBrowser !== timezoneUtcOffsetFromUserPrefs) {
      this.preferences.timezoneOffset = -timezoneUtcOffsetFromBrowser;
      timezoneUtcOffsetFromUserPrefs = timezoneUtcOffsetFromBrowser;
    }

    let lastCronTime = this.lastCron;
    if (this.loggedInAt && this.loggedInAt < lastCronTime) {
      lastCronTime = this.loggedInAt;
    }

    const userPrefs = {
      dayStart: this.preferences.dayStart,
      timezoneOffset: this.preferences.timezoneOffset,
    };
    let daysMissed = daysSince(lastCronTime, defaults({ now }, userPrefs));

    if (timezoneUtcOffsetAtLastCron !== timezoneUtcOffsetFromUserPrefs) {
      let adjustedNow = now;
      if (timezoneUtcOffsetAtLastCron > timezoneUtcOffsetFromUserPrefs) {
        const diff = timezoneUtcOffsetAtLastCron - timezoneUtcOffsetFromUserPrefs;
        adjustedNow = moment(now).subtract(diff, 'minutes');
      }

      const daysMissedNewZone = daysMissed;
      const daysMissedOldZone = daysSince(lastCronTime, defaults({
        now: adjustedNow,
        timezoneUtcOffsetOverride: timezoneUtcOffsetAtLastCron,
      }, userPrefs));

      if (timezoneUtcOffsetAtLastCron > timezoneUtcOffsetFromUserPrefs) {
        if (daysMissedOldZone > 0 && daysMissedNewZone > 0) {
          daysMissed = Math.min(daysMissedOldZone, daysMissedNewZone);
        } else if (daysMissedNewZone > 0) {
          daysMissed = 0;
          const tzDiff = timezoneUtcOffsetFromUserPrefs - timezoneUtcOffsetAtLastCron;
          this.lastCron = moment(lastCronTime).subtract(tzDiff, 'minutes');
          this.preferences.timezoneOffsetAtLastCron = -timezoneUtcOffsetAtLastCron;
        } else {
          daysMissed = 0;
        }
      } else {
        daysMissed = daysMissedNewZone;
      }
    }

    return { daysMissed, timezoneUtcOffsetFromUserPrefs };
  }
}

// Map Mongoose-style nested paths and _id to Prisma flat field names
const FIELD_MAP = {
  _id: 'id',
  'auth.local.email': 'email',
  'auth.local.username': 'username',
  'auth.local.lowerCaseUsername': 'lowerCaseUsername',
  'auth.local.passwordResetCode': 'passwordResetCode',
};

function mapId (where) {
  if (!where) return {};
  const q = {};
  for (const [k, v] of Object.entries(where)) {
    const mapped = FIELD_MAP[k] || k;
    const isObjectId = mapped === 'id' && v && typeof v === 'object' && !Array.isArray(v);
    if (!isObjectId) {
      if (k === '$or') {
        q.OR = v.map(mapId);
      } else {
        q[mapped] = v;
      }
    }
    // object-form _id (e.g. { $ne: '...' }) not needed in this stripped server — skip
  }
  return q;
}

// Wrap a promise so callers can do either `await model.findById(id)` OR
// the Mongoose pattern `await model.findById(id).exec()`.
function execable (promise) {
  promise.exec = () => promise;
  // Support partial Mongoose select/lean chains (return self unchanged)
  promise.select = () => promise;
  promise.lean = () => promise;
  return promise;
}

// Static helpers that mirror the Mongoose model API consumed by the rest of the server
export const model = {
  findById (id) {
    if (!id) return execable(Promise.resolve(null));
    return execable(
      prisma.user.findUnique({ where: { id }, include: { notifications: true, tags: true } })
        .then(data => (data ? new UserDocument(data) : null)),
    );
  },

  // Accepts { _id, apiToken, email, 'auth.local.email': ... }.  Maps to Prisma where.
  findOne (where) {
    const q = mapId(where);
    return execable(
      prisma.user.findFirst({ where: q, include: { notifications: true, tags: true } })
        .then(data => (data ? new UserDocument(data) : null)),
    );
  },

  // find returns execable promise resolving to array of UserDocument
  find (where) {
    const q = mapId(where);
    return execable(
      prisma.user.findMany({ where: q, include: { notifications: true, tags: true } })
        .then(rows => rows.map(data => new UserDocument(data))),
    );
  },

  async create (data) {
    const row = await prisma.user.create({ data });
    return new UserDocument(row);
  },

  // Thin wrapper — callers must use plain objects, not Mongoose $operators.
  async updateOne (where, update) {
    const q = mapId(where);
    await prisma.user.updateMany({ where: q, data: update });
    return { matchedCount: 1, modifiedCount: 1 };
  },
};

// Schema paths stub — the PUT /user handler iterates these to build
// the list of acceptable update paths.  Keys must use the dot-notation
// the client sends (e.g. "preferences.dayStart").
const schemaPaths = {};
[
  'preferences.dayStart', 'preferences.timezoneOffset',
  'preferences.timezoneOffsetAtLastCron', 'preferences.sleep',
  'preferences.language', 'preferences.dateFormat',
  'preferences.analyticsConsent', 'preferences.tasks',
  'preferences.toolbarCollapsed',
  'profile.name', 'profile.blurb', 'profile.imageUrl',
  'flags.customizationsNotification', 'flags.showTour',
  'flags.tour', 'flags.tutorial', 'flags.communityGuidelinesAccepted',
  'flags.welcomed', 'flags.cardReceived', 'flags.warnedLowHealth',
].forEach(p => { schemaPaths[p] = true; });
export const schema = { paths: schemaPaths, statics: {} };
export const publicFields = 'name username language timezoneOffset sleep dateFormat isAdmin';
export const nameFields = 'name username';
// mods list not used in stripped server; kept for import compatibility
export const mods = [];
