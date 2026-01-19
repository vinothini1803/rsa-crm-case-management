import { getIO } from "../config/socket";
import { Activities, CaseDetails } from "../database/models";
import ActivityStartReminders from "../database/models/activityStartReminder";
import { Op } from "sequelize";
import caseDetails from "../database/models/caseDetails";

async function processSingleReminder(reminderId: number) {
  const reminder: any = await ActivityStartReminders.findOne({
    where: {
      id: reminderId,
      status: "PENDING",
    },
  });

  if (!reminder) return;

  console.log("inside process single reminder", reminderId);

  const activity: any = await Activities.findOne({
    where: {
      id: reminder.activityId,
      aspStartedToBreakdownAt: null,
      aspStartedToPickupAt: null,
      aspStartedToDropAt: null,
      aspStartedToGarageAt: null,
      serviceStartDateTime: null,
    },
    include: [
      {
        model: CaseDetails,
         as: "caseDetail",
        attributes: ["agentId"],
      },
    ],
  });

  // Activity already started → SKIP
  if (!activity) {
    await reminder.update({ status: "SKIPPED" });
    return;
  }
const agentId = activity.caseDetail?.agentId || activity.CaseDetail?.agentId;
console.log(agentId, "agent id in single process reminder");


  if (!agentId) {
    console.log("❌ AgentId not found, skipping reminder");
    await reminder.update({ status: "SKIPPED" });
    return;
  }

  // ✅ Skip older reminders
  await ActivityStartReminders.update(
    { status: "SKIPPED" },
    {
      where: {
        activityId: reminder.activityId,
        id: { [Op.lt]: reminder.id },
        status: ["PENDING", "SENT"],
      },
    }
  );

  const io = getIO();

  io.to(`user_${agentId}`).emit("aspStartReminder", {
    title: `Reminder ${reminder.reminderNo}`,
    message: `ASP has not started the service yet for the Case : ${reminder.caseDetailId}`,
    activityId: activity.id,
    activityNumber: reminder.activityNumber,
    caseDetailId: reminder.caseDetailId,
    reminderNo: reminder.reminderNo,
    areaType: reminder.areaType,
    time: new Date().toISOString(),
  });

  await reminder.update({ status: "SENT" });
}

export default processSingleReminder;
