import moment from 'moment';
import { prisma } from './prisma';
import { resend, fromEmail } from './resendClient';
import logger from './logger';
import { shouldDo } from '../../common/script/cron';

// In-memory map to track sent reminders: key = `${reminderId}-${YYYY-MM-DD}`
const sentReminders = new Map();

function cleanupSentReminders () {
  const twoDaysAgo = moment().subtract(2, 'days').format('YYYY-MM-DD');
  for (const [key] of sentReminders) {
    const datepart = key.split('-').slice(-3).join('-'); // extract YYYY-MM-DD from end
    if (datepart < twoDaysAgo) {
      sentReminders.delete(key);
    }
  }
}

function getSentKey (reminderId, dateStr) {
  return `${reminderId}-${dateStr}`;
}

async function checkReminders () {
  try {
    cleanupSentReminders();

    // Query all tasks that have non-empty reminders JSON
    const tasks = await prisma.task.findMany({
      where: {
        reminders: {
          not: '[]',
        },
      },
      include: {
        user: true,
      },
    });

    for (const task of tasks) {
      let reminders;
      try {
        reminders = JSON.parse(task.reminders);
      } catch (e) {
        continue; // eslint-disable-line no-continue
      }

      if (!Array.isArray(reminders) || reminders.length === 0) {
        continue; // eslint-disable-line no-continue
      }

      const { user } = task;
      if (!user || !user.email) {
        continue; // eslint-disable-line no-continue
      }

      // Calculate user's current time using their timezoneOffset
      // timezoneOffset is stored as minutes offset (like JS getTimezoneOffset())
      // which is the negative of UTC offset
      const userUtcOffset = -(user.timezoneOffset || 0);
      const userNow = moment().utcOffset(userUtcOffset);
      const todayStr = userNow.format('YYYY-MM-DD');

      for (const reminder of reminders) {
        if (!reminder || !reminder.id || !reminder.time) {
          continue; // eslint-disable-line no-continue
        }

        const sentKey = getSentKey(reminder.id, todayStr);
        if (sentReminders.has(sentKey)) {
          continue; // eslint-disable-line no-continue
        }

        // Parse the reminder time and set it to today in the user's timezone
        const reminderTime = moment(reminder.time).utcOffset(userUtcOffset);
        const reminderToday = userNow.clone()
          .hours(reminderTime.hours())
          .minutes(reminderTime.minutes())
          .seconds(0);

        // Check if the reminder time has passed for today
        if (userNow.isBefore(reminderToday)) {
          continue; // eslint-disable-line no-continue
        }

        // For dailies, check if the daily is actually due today using shouldDo
        if (task.type === 'daily') {
          let repeat;
          try {
            repeat = JSON.parse(task.repeat);
          } catch (e) {
            repeat = {};
          }

          const isDueToday = shouldDo(userNow.toDate(), {
            ...task,
            startDate: task.startDate,
            repeat,
          }, {
            timezoneOffset: user.timezoneOffset || 0,
            dayStart: user.dayStart || 0,
          });

          if (!isDueToday) {
            continue; // eslint-disable-line no-continue
          }
        }

        // For todos, only fire if not completed
        if (task.type === 'todo' && task.completed) {
          continue; // eslint-disable-line no-continue
        }

        // Mark as sent before sending to avoid duplicates on retry
        sentReminders.set(sentKey, true);

        // Send the email
        try {
          await resend.emails.send({ // eslint-disable-line no-await-in-loop
            from: fromEmail,
            to: user.email,
            subject: `Reminder: ${task.text}`,
            html: `<p>This is a reminder for your ${task.type}: <strong>${task.text}</strong></p>`
              + `<p>${task.notes || ''}</p>`,
          });
        } catch (emailErr) {
          logger.error(emailErr, { context: 'reminders.sendEmail', taskId: task.id });
        }
      }
    }
  } catch (err) {
    logger.error(err, { context: 'reminders.checkReminders' });
  }
}

export function startReminderChecker () {
  if (!resend) {
    logger.info('RESEND_API_KEY is not set — email reminders are disabled.');
    return;
  }

  logger.info('Starting email reminder checker (60s interval).');
  checkReminders();
  setInterval(checkReminders, 60000);
}
