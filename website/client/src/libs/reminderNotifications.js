// Browser notification service for task reminders
// Checks every 30 seconds for due reminders and shows Notification API alerts

const POLL_INTERVAL = 30 * 1000; // 30 seconds
const sentReminders = new Set(); // track sent: "reminderId-YYYY-MM-DD"

function getTodayKey (reminderId) {
  const today = new Date().toISOString().slice(0, 10);
  return `${reminderId}-${today}`;
}

function isReminderDue (reminder) {
  if (!reminder || !reminder.time) return false;
  const now = new Date();
  const reminderTime = new Date(reminder.time);

  // Compare time-of-day: build today's reminder time
  const todayReminder = new Date(now);
  todayReminder.setHours(reminderTime.getHours(), reminderTime.getMinutes(), 0, 0);

  // Due if we've passed the reminder time today
  return now >= todayReminder;
}

function showNotification (task, reminder) {
  const key = getTodayKey(reminder.id);
  if (sentReminders.has(key)) return;
  sentReminders.add(key);

  // Also persist to localStorage so page refreshes don't re-fire
  try {
    const stored = JSON.parse(localStorage.getItem('sentReminders') || '{}');
    stored[key] = true;
    localStorage.setItem('sentReminders', JSON.stringify(stored));
  } catch (e) { /* ignore */ }

  if (Notification.permission === 'granted') {
    new Notification(`Reminder: ${task.text}`, {
      body: task.notes || `Your ${task.type} "${task.text}" is due`,
      icon: '/favicon.ico',
      tag: key, // prevents duplicate OS notifications
    });
  }
}

function loadSentFromStorage () {
  try {
    const stored = JSON.parse(localStorage.getItem('sentReminders') || '{}');
    const today = new Date().toISOString().slice(0, 10);
    // Only keep today's entries
    const cleaned = {};
    for (const [key, val] of Object.entries(stored)) {
      if (key.endsWith(today)) {
        sentReminders.add(key);
        cleaned[key] = val;
      }
    }
    localStorage.setItem('sentReminders', JSON.stringify(cleaned));
  } catch (e) { /* ignore */ }
}

let intervalId = null;
let getTasksFn = null;

function checkReminders () {
  if (!getTasksFn) return;
  const tasks = getTasksFn();
  if (!tasks || !Array.isArray(tasks)) return;

  for (const task of tasks) {
    if (!task.reminders || !task.reminders.length) continue;
    if (task.type === 'todo' && task.completed) continue;

    for (const reminder of task.reminders) {
      if (isReminderDue(reminder)) {
        showNotification(task, reminder);
      }
    }
  }
}

export async function requestPermission () {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Start the reminder checker
// getTasksCallback: () => Array<Task> — function that returns current tasks from the store
export function startReminderNotifications (getTasksCallback) {
  getTasksFn = getTasksCallback;
  loadSentFromStorage();
  requestPermission();

  // Check immediately, then every 30s
  checkReminders();
  intervalId = setInterval(checkReminders, POLL_INTERVAL);
}

export function stopReminderNotifications () {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
