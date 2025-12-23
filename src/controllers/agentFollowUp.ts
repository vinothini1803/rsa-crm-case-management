import { Op } from "sequelize";
import moment from "moment-timezone";
import axios from "axios";

import { caseInfoController } from "./caseInfoController";
import {
  Reminder,
  CaseDetails,
  CaseInformation,
} from "../database/models/index";
const config = require("../config/config.json");

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

// Automatically assign a new agent to reminders that are overdue (10 minutes past scheduled time)
// and have not been followed up by the original agent.
export const agentFollowUp = async (req: any, res: any) => {
  try {
    const tenMinutesAgo = moment()
      .tz("Asia/Kolkata")
      .subtract(10, "minutes")
      .format("YYYY-MM-DD HH:mm:ss"); // 10 minutes ago
    let reminders: any = await Reminder.findAll({
      where: {
        scheduleTime: {
          [Op.lt]: tenMinutesAgo,
        },
        dismiss: false,
      },
      include: [
        {
          model: CaseDetails,
          required: true,
          attributes: ["id", "clientId", "agentId", "agentAssignedAt"],
          include: [
            {
              model: CaseInformation,
              attributes: ["contactLanguageId", "breakdownAreaId"],
            },
          ],
          where: {
            statusId: {
              [Op.in]: [1, 2], //OPEN || INPROGRESS
            },
            typeId: 31, //CRM
            agentId: {
              [Op.ne]: null,
            },
            agentAssignedAt: {
              [Op.ne]: null,
            },
          },
        },
      ],
    });

    // Take only one reminder created by the agent of the case
    let remindersToBeProcessed: any = [];
    for (let reminder of reminders) {
      const exists = remindersToBeProcessed.some(
        (r: any) => r.caseDetailId === reminder.caseDetailId
      );
      if (reminder.createdById == reminder.caseDetail.agentId && !exists) {
        remindersToBeProcessed.push(reminder);
      }
    }
    for (let rem of remindersToBeProcessed) {
      // console.log(
      //   "calling agent auto allocation from agent follow up ***",
      //   rem.caseDetail.id,
      //   rem.caseDetail.caseInformation.contactLanguageId,
      //   rem.caseDetail.clientId,
      //   rem.caseDetail.caseInformation.breakdownAreaId
      // );
      let agentResult: any = await caseInfoController.agentAutoAllocation({
        caseDetailId: rem.caseDetail.id,
        languageId: rem.caseDetail.caseInformation.contactLanguageId,
        clientId: rem.caseDetail.clientId,
        breakDownId: rem.caseDetail.caseInformation.breakdownAreaId,
        restrictSecondaryLanguageProcess: true,
      });
      if (agentResult.success === true) {
        await Promise.all([
          // update old agent in user login
          axios.put(
            `${userServiceUrl}/${userServiceEndpoint.updateUserLogin}`,
            {
              userId: rem.caseDetail.agentId,
              pendingCaseCount: -1,
              assignedCasesCount: -1,
              nullLastAllocatedCaseTime: true,
            }
          ),
          caseInfoController.agentActivityUpdate(agentResult, rem.caseDetailId),
          Reminder.update(
            { dismiss: true },
            {
              where: {
                createdById: rem.createdById,
                caseDetailId: rem.caseDetailId,
              },
            }
          ),
        ]);
      }
    }
    return res.status(200).json({
      success: true,
      message: "Agent follow up Success",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
