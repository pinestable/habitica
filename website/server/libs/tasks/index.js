import moment from 'moment';
import cloneDeep from 'lodash/cloneDeep';
import compact from 'lodash/compact';
import forEach from 'lodash/forEach';
import remove from 'lodash/remove';
import validator from 'validator';
import {
  setNextDue,
  validateTaskAlias,
} from './utils';
import * as Tasks from '../../models/task';
import {
  BadRequest,
  NotFound,
  NotAuthorized,
} from '../errors';
import shared from '../../../common';
import { taskScoredWebhook } from '../webhook';

/**
 * Creates tasks for a user.
 */
async function createTasks (req, res, options = {}) {
  const { user } = options;

  let toSave = Array.isArray(req.body) ? req.body : [req.body];
  if (toSave.length === 0) return [];

  const taskOrderToAdd = {};

  toSave = toSave.map(taskData => {
    if (!taskData || Tasks.tasksTypes.indexOf(taskData.type) === -1) {
      throw new BadRequest(res.t('invalidTaskType'));
    }

    const taskType = taskData.type;
    const newTask = new Tasks[taskType](Tasks.Task.sanitize(taskData));
    newTask.userId = user._id;

    if (taskType === 'daily') {
      const awareStartDate = moment(newTask.startDate).utcOffset(-user.preferences.timezoneOffset);
      if (awareStartDate.format('HMsS') !== '0000') {
        awareStartDate.startOf('day');
        newTask.startDate = awareStartDate.toDate();
      }
    }

    setNextDue(newTask, user);

    // validateSync() is a no-op on Prisma tasks; kept for API compatibility
    const validationErrors = newTask.validateSync();
    if (validationErrors) throw validationErrors;

    if (!taskOrderToAdd[`${taskType}s`]) taskOrderToAdd[`${taskType}s`] = [];
    if (!user.tasksOrder[`${taskType}s`].includes(newTask._id)) {
      taskOrderToAdd[`${taskType}s`].unshift(newTask._id);
    }

    return newTask;
  });

  // Validate aliases asynchronously
  await validateTaskAlias(toSave, res);

  // Persist tasks then update user tasksOrder
  await Promise.all(toSave.map(task => task.save()));

  for (const [key, ids] of Object.entries(taskOrderToAdd)) {
    user.tasksOrder[key].unshift(...ids);
  }
  await user.save();

  return toSave;
}

/**
 * Gets tasks for a user, ordered according to tasksOrder.
 */
async function getTasks (req, res, options = {}) {
  const { user, dueDate } = options;
  const { type } = req.query;

  let tasks;

  if (type === 'completedTodos' || type === '_allCompletedTodos') {
    tasks = await Tasks.Task.find({ userId: user._id, type: 'todo', completed: true });
    tasks.sort((a, b) => new Date(b.dateCompleted) - new Date(a.dateCompleted));
    tasks.forEach(task => { task.id = task._id; });
    return tasks;
  }

  if (type) {
    const singleType = type.slice(0, -1); // 'habits' → 'habit'
    const query = { userId: user._id, type: singleType };
    if (singleType === 'todo') query.completed = false;
    tasks = await Tasks.Task.find(query);
  } else {
    // All active tasks — exclude completed todos
    const [habitsAndDailys, activeTodos] = await Promise.all([
      Tasks.Task.find({ userId: user._id, type: { $in: ['habit', 'daily'] } }),
      Tasks.Task.find({ userId: user._id, type: 'todo', completed: false }),
    ]);
    tasks = [...habitsAndDailys, ...activeTodos];
  }

  tasks.forEach(task => { task.id = task._id; });

  if (dueDate) {
    tasks.forEach(task => setNextDue(task, user, dueDate));
  }

  let ownerDirty = false;

  // Prune nonexistent tasks from tasksOrder
  forEach(user.tasksOrder, (taskOrder, key) => {
    if (type && key !== type) return;
    const preLength = taskOrder.length;
    remove(taskOrder, taskId => tasks.findIndex(task => task._id === taskId) === -1);
    if (preLength !== taskOrder.length) {
      user.tasksOrder[key] = taskOrder;
      user.markModified('tasksOrder');
      ownerDirty = true;
    }
  });

  // Order tasks
  let order = [];
  if (type) {
    order = user.tasksOrder[type] || [];
  } else {
    Object.values(user.tasksOrder).forEach(taskOrder => { order = order.concat(taskOrder); });
  }

  let orderedTasks = new Array(tasks.length);
  const unorderedTasks = [];

  tasks.forEach((task, index) => {
    const taskId = task._id;
    const i = order[index] === taskId ? index : order.indexOf(taskId);
    if (i === -1) {
      unorderedTasks.push(task);
      const typeKey = `${task.type}s`;
      if (!user.tasksOrder[typeKey].includes(taskId)) {
        user.tasksOrder[typeKey].push(taskId);
        ownerDirty = true;
      }
    } else {
      orderedTasks[i] = task;
    }
  });

  if (ownerDirty) await user.save();

  orderedTasks = compact(orderedTasks).concat(unorderedTasks);
  return orderedTasks;
}

// eslint-disable-next-line no-unused-vars
function verifyTaskModification (task, user, group, challenge, res) {
  if (!task) {
    throw new NotFound(res.t('messageTaskNotFound'));
  }
  if (task.userId !== user._id) {
    throw new NotFound(res.t('messageTaskNotFound'));
  }
}

/**
 * Scores a single task and returns data for the response.
 */
async function scoreTask (user, task, direction, req, res) {
  if (task.type === 'daily' || task.type === 'todo') {
    if (task.completed && direction === 'up') {
      throw new NotAuthorized(res.t('sessionOutdated'));
    } else if (!task.completed && direction === 'down') {
      throw new NotAuthorized(res.t('sessionOutdated'));
    }
  }

  const wasCompleted = task.completed;
  const delta = shared.ops.scoreTask({ task, user, direction }, req);

  let pullTask;
  let pushTask;
  if (task.type === 'todo') {
    if (!wasCompleted && task.completed) {
      pullTask = task._id;
    } else if (
      wasCompleted
      && !task.completed
      && user.tasksOrder.todos.indexOf(task._id) === -1
    ) {
      pushTask = task._id;
    }
  }

  setNextDue(task, user);

  taskScoredWebhook.send(user, {
    task, direction, delta, user,
  });

  return {
    task,
    delta,
    direction,
    pullTask,
    pushTask,
    _tmp: cloneDeep(user._tmp),
  };
}

export async function scoreTasks (user, taskScorings, req, res) {
  if (!taskScorings || !Array.isArray(taskScorings) || taskScorings.length < 1) {
    throw new BadRequest(res.t('invalidTaskScorings'));
  }

  taskScorings.forEach(({ id, direction }) => {
    if (!['up', 'down'].includes(direction)) throw new BadRequest(res.t('directionUpDown'));
    if (typeof id !== 'string') throw new BadRequest(res.t('invalidTaskIdentifier'));
  });

  const taskIds = taskScorings.map(s => s.id);
  const taskList = await Tasks.Task.findMultipleByIdOrAlias(taskIds, user._id);

  const tasks = {};
  taskList.forEach(task => {
    tasks[task._id] = task;
    if (task.alias) tasks[task.alias] = task;
  });

  if (Object.keys(tasks).length === 0) throw new NotFound(res.t('messageTaskNotFound'));

  const returnDatas = [];
  for (const scoring of taskScorings) {
    const task = tasks[scoring.id];
    if (task) {
      // eslint-disable-next-line no-await-in-loop
      returnDatas.push(await scoreTask(user, task, scoring.direction, req, res));
    }
  }

  const pullIDs = [];
  const pushIDs = [];
  returnDatas.forEach(d => {
    if (d.pushTask) pushIDs.push(d.pushTask);
    if (d.pullTask) pullIDs.push(d.pullTask);
  });

  if (pullIDs.length > 0) {
    user.tasksOrder.todos = user.tasksOrder.todos.filter(id => !pullIDs.includes(id));
  }
  if (pushIDs.length > 0) {
    user.tasksOrder.todos.push(...pushIDs);
  }

  // Save user and all scored tasks
  const savePromises = [user.save()];
  const seen = new Set();
  Object.entries(tasks).forEach(([identifier, task]) => {
    // Save each unique task (by UUID key) that was scored — value/counters changed in memory
    if (validator.isUUID(String(identifier)) && !seen.has(task._id)) {
      seen.add(task._id);
      savePromises.push(task.save());
    }
  });

  await Promise.all(savePromises);

  return returnDatas.map(d => ({ id: d.task._id, delta: d.delta, _tmp: d._tmp }));
}

export {
  createTasks,
  getTasks,
  scoreTask,
  verifyTaskModification,
};
