import moment from 'moment';
import { model as UserModel } from '../models/user';
import { Task } from '../models/task';
import { prisma } from './prisma';
import common from '../../common';
import { preenUserHistory } from './preening';

const {
  shouldDo,
} = common;
const { scoreTask } = common.ops;

function setIsDueNextDue (task, user, now) {
  const optionsForShouldDo = {
    dayStart: user.preferences.dayStart,
    timezoneOffset: user.preferences.timezoneOffset,
  };
  task.isDue = common.shouldDo(now, task, optionsForShouldDo);
  optionsForShouldDo.nextDue = true;
  const nextDue = common.shouldDo(now, task, optionsForShouldDo);
  if (nextDue && nextDue.length > 0) {
    task.nextDue = nextDue.map(dueDate => dueDate.toISOString());
  }
}

function processHabits (user, habits, now, daysMissed) {
  const nowMoment = moment(now)
    .utcOffset(user.getUtcOffset() - user.preferences.dayStart * 60);
  const thatDay = nowMoment.clone().subtract({ days: daysMissed });
  const resetWeekly = nowMoment.isoWeek() !== thatDay.isoWeek();
  const resetMonthly = nowMoment.month() !== thatDay.month();

  habits.forEach(task => {
    let reset = false;
    if (task.frequency === 'daily') {
      reset = true;
    } else if (task.frequency === 'weekly' && resetWeekly) {
      reset = true;
    } else if (task.frequency === 'monthly' && resetMonthly) {
      reset = true;
    }
    if (reset) {
      task.counterUp = 0;
      task.counterDown = 0;
    }

    // Slowly reset singleton habits towards yellow
    if (task.up === false || task.down === false) {
      task.value = Math.abs(task.value) < 0.1 ? 0 : task.value /= 2;
    }
  });
}

// Perform various beginning-of-day reset actions.
export async function cron (options = {}) {
  const {
    user, tasksByType, now = new Date(), daysMissed, timezoneUtcOffsetFromUserPrefs,
  } = options;

  user.preferences.timezoneOffsetAtLastCron = -timezoneUtcOffsetFromUserPrefs;

  const multiDaysCountAsOneDay = true;

  // Make uncompleted To-Dos redder
  tasksByType.todos.forEach(task => {
    if (task.completed) return;
    scoreTask({
      task,
      user,
      direction: 'down',
      cron: true,
      times: multiDaysCountAsOneDay ? 1 : daysMissed,
    });
  });

  // For incomplete Dailies, track streaks and history
  tasksByType.dailys.forEach(task => {
    const { completed } = task;
    let scheduleMisses = 0;

    if (!completed) {
      for (let i = 0; i < daysMissed; i += 1) {
        const thatDay = moment(now).subtract({ days: i + 1 });
        if (shouldDo(thatDay.toDate(), task, user.preferences)) {
          scheduleMisses += 1;
        }
        if (multiDaysCountAsOneDay) break;
      }

      if (scheduleMisses > 0 && !user.preferences.sleep) {
        scoreTask({
          user,
          task,
          direction: 'down',
          times: multiDaysCountAsOneDay ? 1 : scheduleMisses,
          cron: true,
        });
      }

      // Add history entry for missed daily
      task.history.push({
        date: Number(new Date()),
        value: task.value,
        isDue: task.isDue,
        completed: false,
      });
    }

    task.completed = false;
    setIsDueNextDue(task, user, now);

    if (completed || scheduleMisses > 0) {
      if (task.checklist) {
        task.checklist.forEach(i => { i.completed = false; });
      }
    }
  });

  processHabits(user, tasksByType.habits, now, daysMissed);

  // Prune completed todos from tasksOrder
  const incompleteTodoIds = tasksByType.todos
    .filter(task => !task.completed)
    .map(task => task._id);
  user.tasksOrder.todos = user.tasksOrder.todos
    .filter(id => incompleteTodoIds.includes(id));

  // Prune history so it doesn't grow unbounded
  preenUserHistory(user, tasksByType);

  user.cronCount += 1;
}

async function unlockUser (userId) {
  await UserModel.updateOne({ _id: userId }, { cronSignature: 'NOT_RUNNING' });
}

// Wait 5 minutes before retrying an in-progress cron
const CRON_TIMEOUT_WAIT = 5 * 60 * 1000;

async function acquireCronLock (user) {
  const now = Date.now();
  const cronRetryTime = now - CRON_TIMEOUT_WAIT;

  // Only proceed if cron is NOT_RUNNING or timed out
  const current = await prisma.user.findUnique({ where: { id: user.id } });
  const sig = current && current.cronSignature;
  const alreadyRunning = sig !== 'NOT_RUNNING' && Number(sig) > cronRetryTime;
  if (alreadyRunning) throw new Error('CRON_ALREADY_RUNNING');

  await prisma.user.update({
    where: { id: user.id },
    data: { cronSignature: String(now) },
  });
}

export async function cronWrapper (req, res) {
  const { user } = res.locals;
  if (!user) return null;

  const now = new Date();

  try {
    await acquireCronLock(user);

    const { daysMissed, timezoneUtcOffsetFromUserPrefs } = user.daysUserHasMissed(now, req);

    if (daysMissed <= 0) {
      if (user.isModified()) {
        user.cronSignature = 'NOT_RUNNING';
        await user.save();
      } else {
        await unlockUser(user.id);
      }
      return null;
    }

    // Delete completed todos older than 30 days
    await Task.deleteMany({
      userId: user._id,
      type: 'todo',
      completed: true,
      dateCompleted: { $lt: moment(now).subtract(30, 'days').toDate() },
    });

    // Load active tasks
    const tasks = await Task.find({
      userId: user._id,
      $or: [
        { type: 'todo', completed: false },
        { type: { $in: ['habit', 'daily'] } },
      ],
    });

    const tasksByType = { habits: [], dailys: [], todos: [] };
    tasks.forEach(task => tasksByType[`${task.type}s`].push(task));

    await cron({
      user,
      tasksByType,
      now,
      daysMissed,
      timezoneUtcOffsetFromUserPrefs,
    });

    user.cronSignature = 'NOT_RUNNING';
    user.loggedInAt = now;
    user.lastCron = now;
    user.markModified('cronSignature');

    // Save user and all modified tasks in parallel
    await Promise.all([
      user.save(),
      ...tasks.filter(t => t.isModified()).map(t => t.save()),
    ]);

    // Reload the user so res.locals is fresh
    res.locals.user = await UserModel.findById(user.id);
    return null;
  } catch (err) {
    if (err.message !== 'CRON_ALREADY_RUNNING') {
      await unlockUser(user.id).catch(() => {});
    }
    throw err;
  }
}
