import moment from "moment";
import processSingleReminder from "./processSingleReminder";
const scheduledTimers = new Map<number, NodeJS.Timeout>();

export function scheduleReminder(reminder: any) {
      if (!reminder?.id) return;
  // Avoid duplicate timers
  if (scheduledTimers.has(reminder.id)) return;
console.log("schedule reminderrrrr")
  const now = moment().tz("Asia/Kolkata");
  const fireAt = moment(reminder.fireAt).tz("Asia/Kolkata");
  const delay = fireAt.diff(now);

  // If fire time already passed → execute immediately
  const safeDelay = delay > 0 ? delay : 1000;

  const timer = setTimeout(async () => {
    try {
      await processSingleReminder(reminder.id);
    } finally {
      scheduledTimers.delete(reminder.id);
    }
  }, safeDelay);

  scheduledTimers.set(reminder.id, timer);
}

