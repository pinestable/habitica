import reduce from 'lodash/reduce';
import getUtcOffset from '../fns/getUtcOffset';
import moment from 'moment';

const MAX_TASK_VALUE = 21.27;
const MIN_TASK_VALUE = -47.27;
const CLOSE_ENOUGH = 0.00001;

function _getTaskValue (taskValue) {
  if (taskValue < MIN_TASK_VALUE) return MIN_TASK_VALUE;
  if (taskValue > MAX_TASK_VALUE) return MAX_TASK_VALUE;
  return taskValue;
}

// Calculates the next task.value based on direction.
// Uses a capped inverse log y=0.9747^x
function _calculateDelta (task, direction, cron) {
  const currVal = _getTaskValue(task.value);
  let nextDelta = (0.9747 ** currVal) * (direction === 'down' ? -1 : 1);

  // Checklists
  if (task.checklist && task.checklist.length > 0) {
    // Daily: only dock a portion based on checklist completion during cron
    if (direction === 'down' && task.type === 'daily' && cron) {
      nextDelta *= 1 - reduce(
        task.checklist,
        (m, i) => m + (i.completed ? 1 : 0),
        0,
      ) / task.checklist.length;
    }
    // Todo: bonus per completed checklist item
    if (task.type === 'todo' && !cron) {
      nextDelta *= 1 + reduce(task.checklist, (m, i) => m + (i.completed ? 1 : 0), 0);
    }
  }

  return nextDelta;
}

// Approximates the reverse delta for unchecking a task
function _calculateReverseDelta (task, direction) {
  const currVal = _getTaskValue(task.value);
  let testVal = currVal + (0.9747 ** currVal) * (direction === 'down' ? -1 : 1);

  while (true) { // eslint-disable-line no-constant-condition
    const calc = testVal + (0.9747 ** testVal);
    const diff = currVal - calc;
    if (Math.abs(diff) < CLOSE_ENOUGH) break;
    if (diff > 0) { testVal -= diff; } else { testVal += diff; }
  }

  let nextDelta = testVal - currVal;
  if (task.checklist && task.checklist.length > 0 && task.type === 'todo') {
    nextDelta *= 1 + reduce(task.checklist, (m, i) => m + (i.completed ? 1 : 0), 0);
  }
  return nextDelta;
}

function _changeTaskValue (task, direction, times, cron) {
  let addToDelta = 0;
  for (let i = 0; i < times; i += 1) {
    const nextDelta = !cron && direction === 'down'
      ? _calculateReverseDelta(task, direction)
      : _calculateDelta(task, direction, cron);
    if (task.type !== 'reward') task.value += nextDelta;
    addToDelta += nextDelta;
  }
  return addToDelta;
}

function _updateCounter (task, direction, times) {
  if (direction === 'up') task.counterUp += times;
  else task.counterDown += times;
}

function _lastHistoryEntryWasToday (lastHistoryEntry, user) {
  if (!lastHistoryEntry || !lastHistoryEntry.date) return false;
  const timezoneUtcOffset = getUtcOffset(user);
  const { dayStart } = user.preferences;
  const dateWithTimeZone = moment(lastHistoryEntry.date).utcOffset(timezoneUtcOffset);
  if (dateWithTimeZone.hour() < dayStart) dateWithTimeZone.subtract(1, 'day');
  return moment().utcOffset(timezoneUtcOffset).isSame(dateWithTimeZone, 'day');
}

function _updateLastHistoryEntry (lastHistoryEntry, task, direction, times) {
  lastHistoryEntry.value = task.value;
  lastHistoryEntry.date = Number(new Date());
  lastHistoryEntry.scoredUp = lastHistoryEntry.scoredUp || 0;
  lastHistoryEntry.scoredDown = lastHistoryEntry.scoredDown || 0;
  if (direction === 'up') lastHistoryEntry.scoredUp += times;
  else lastHistoryEntry.scoredDown += times;
}

export default function scoreTask (options = {}, req = {}) { // eslint-disable-line no-unused-vars
  const {
    user, task, direction, times = 1, cron = false,
  } = options;

  let delta = 0;

  user._tmp = user._tmp || {};

  if (task.type === 'habit') {
    delta += _changeTaskValue(task, direction, times, cron);

    task.history = task.history || [];
    const lastHistoryEntry = task.history[task.history.length - 1];
    if (_lastHistoryEntryWasToday(lastHistoryEntry, user)) {
      _updateLastHistoryEntry(lastHistoryEntry, task, direction, times);
    } else {
      task.history.push({
        date: Number(new Date()),
        value: task.value,
        scoredUp: direction === 'up' ? 1 : 0,
        scoredDown: direction === 'down' ? 1 : 0,
      });
    }

    _updateCounter(task, direction, times);
  } else if (task.type === 'daily') {
    if (cron) {
      delta += _changeTaskValue(task, direction, times, cron);
      task.streak = 0;
    } else {
      delta += _changeTaskValue(task, direction, times, cron);

      if (direction === 'up') {
        task.streak += 1;
        task.completed = true;
        task.history = task.history || [];
        task.history.push({
          date: Number(new Date()),
          value: task.value,
          isDue: task.isDue,
          completed: true,
        });
      } else if (direction === 'down') {
        task.streak -= 1;
        task.completed = false;
        if (task.history && task.history.length > 0) {
          task.history.splice(-1, 1);
        }
      }
    }
  } else if (task.type === 'todo') {
    if (cron) {
      delta += _changeTaskValue(task, direction, times, cron);
    } else {
      if (direction === 'up') {
        task.dateCompleted = new Date();
        task.completed = true;
      } else if (direction === 'down') {
        task.completed = false;
        task.dateCompleted = undefined;
      }
      delta += _changeTaskValue(task, direction, times, cron);
    }
  }

  return delta;
}
