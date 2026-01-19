import { Op } from "sequelize";
import moment from "moment-timezone";
import { Activities,  CaseDetails } from "../database/models";
// import { getIO } from "../socket";
import ActivityStartReminders from "../database/models/activityStartReminder";
import { scheduleReminder } from "./scheduleReminder";

const scheduledTimers = new Map<number, NodeJS.Timeout>();

export async function initScheduler() {
  console.log("🕒 Initializing ASP start reminder scheduler...");

  const reminders = await ActivityStartReminders.findAll({
    where: {
      status: "PENDING",
    },
  });

  for (const reminder of reminders) {
    scheduleReminder(reminder);
  }
}
