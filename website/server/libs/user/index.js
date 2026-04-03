import _ from 'lodash';
import * as Tasks from '../../models/task';
import {
  BadRequest,
  NotAuthorized,
} from '../errors';

export async function get (req, res, { isV3 = false }) {
  const { user } = res.locals;
  let userToJSON;

  if (isV3) {
    userToJSON = await user.toJSONWithInbox();
  } else {
    userToJSON = user.toJSON();
  }

  // Remove apiToken from response TODO make it private at the user level? returned in signup/login
  delete userToJSON.apiToken;

  if (!req.query.userFields) {
    const { daysMissed } = user.daysUserHasMissed(new Date(), req);
    userToJSON.needsCron = false;
    if (daysMissed > 0) userToJSON.needsCron = true;
  }

  return res.respond(200, userToJSON);
}

const updatablePaths = [
  '_ABtests.counter',

  'flags.customizationsNotification',
  'flags.showTour',
  'flags.tour',
  'flags.tutorial',
  'flags.communityGuidelinesAccepted',
  'flags.welcomed',
  'flags.cardReceived',
  'flags.warnedLowHealth',

  'achievements',

  'party.order',
  'party.orderAscending',
  'party.quest.completed',
  'party.quest.RSVPNeeded',
  'party.seeking',

  'preferences',
  'profile',
  'stats',
  'inbox.optOut',
];

// This tells us for which paths users can call `PUT /user`.
// With the flat Prisma model the schema no longer enumerates every leaf path,
// so we accept any key that starts with one of the updatable root prefixes.
function isAcceptablePUTPath (key) {
  return updatablePaths.some(root => key.indexOf(root) === 0);
}
// Keep the object form for backward-compat with code that checks `acceptablePUTPaths[key]`
const acceptablePUTPaths = new Proxy({}, {
  get (target, key) { return isAcceptablePUTPath(key) ? true : undefined; },
});

const restrictedPUTSubPaths = [
  'stats.class',

  'preferences.disableClasses',
  'preferences.sleep',
  'preferences.webhooks',
];

_.each(restrictedPUTSubPaths, removePath => {
  delete acceptablePUTPaths[removePath];
});

// Gamification removed — no purchase-gated preferences

export async function update (req, res, { isV3 = false }) {
  const { user } = res.locals;

  _.each(req.body, (val, key) => {
    if (key === 'tags') {
      if (!Array.isArray(val)) throw new BadRequest('Tag list must be an array.');
      user.tags = val;
    } else if (acceptablePUTPaths[key]) {
      _.set(user, key, val);
    } else {
      throw new NotAuthorized(res.t('messageUserOperationProtected', { operation: key }));
    }
  });

  await user.save();

  let userToJSON = user;

  if (isV3) userToJSON = await user.toJSONWithInbox();

  return res.respond(200, userToJSON);
}

// Gamification removed — reset deletes all tasks and clears tasksOrder
export async function reset (req, res, { isV3 = false }) {
  const { user } = res.locals;

  await Tasks.Task.deleteMany({ userId: user._id });

  user.tasksOrder.habits = [];
  user.tasksOrder.dailys = [];
  user.tasksOrder.todos = [];
  await user.save();

  let userToJSON = user;
  if (isV3) userToJSON = await user.toJSONWithInbox();

  res.respond(200, { user: userToJSON, tasksToRemove: [] });
}

// Gamification removed — reroll resets all task values to 0
export async function reroll (req, res, { isV3 = false }) {
  const { user } = res.locals;
  const tasks = await Tasks.Task.find({ userId: user._id, type: { $in: ['daily', 'habit', 'todo'] } });

  for (const task of tasks) {
    task.value = 0;
  }

  const promises = tasks.map(task => task.save());
  promises.push(user.save());
  await Promise.all(promises);

  let userToJSON = user;
  if (isV3) userToJSON = await user.toJSONWithInbox();

  res.respond(200, { user: userToJSON, tasks });
}

// Gamification removed — rebirth is the same as reroll
export async function rebirth (req, res, { isV3 = false }) {
  await reroll(req, res, { isV3 });
}
