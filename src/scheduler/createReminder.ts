import moment from "moment-timezone";
import  ActivityStartReminders  from "../database/models/activityStartReminder";
import { scheduleReminder } from "./scheduleReminder";

const AREA_REMINDER_CONFIG: any = {
  CITY: [1, 3, 4],
  HIGHWAY: [2, 4, 6],
  HILLY: [3, 6, 9],
};

const BREAKDOWN_LOCATION_MAP: any = {
  730: "CITY",
  731: "HIGHWAY",
  732: "HILLY",
};

export async function createAspStartReminders(activity: any) {
  const locationTypeId = activity.caseDetail.breakdownLocationTypeId;
   const agentId =
    activity.caseDetail?.agentId;
console.log("agent idddd",agentId,activity.caseDetail,"activityyyyyyyyy")
  const areaType = BREAKDOWN_LOCATION_MAP[locationTypeId];
  console.log("areaType", areaType);

  if (!areaType) return;

  const timings = AREA_REMINDER_CONFIG[areaType];
  if (!timings) return;

  const baseTime = moment(activity.aspServiceAcceptedAt).tz("Asia/Kolkata");

  const records = timings.map((mins: number, index: number) => ({
    caseDetailId: activity.caseDetailId,
    activityId: activity.id,
    activityNumber: activity.activityNumber,
    reminderNo: index + 1,
    areaType,
    fireAt: baseTime.clone().add(mins, "minutes").toDate(),
     notifyUserId: agentId, 
    status: "PENDING",
  }));

  const createdReminders = await ActivityStartReminders.bulkCreate(records);

  createdReminders.forEach((reminder: any) => {
    scheduleReminder(reminder);
  });
}

