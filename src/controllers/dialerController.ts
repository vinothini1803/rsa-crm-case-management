import { DialerLogs, CaseDetails } from "../database/models/index";
import sequelize from "../database/connection";

import { ActivityLogs } from "../database/models/index";

export namespace dialerController {
  export async function save(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      // console.log('dialer log', req.body);
      const payload = req.body;
      let dialer: any = {
        agentId: payload[0].AgentID,
        agentName: payload[0].AgentName,
        agentPhoneNumber: payload[0].AgentPhoneNumber,
        agentStatus: payload[0].AgentStatus,
        agentUniqueId: payload[0].AgentUniqueID,
        apikey: payload[0].Apikey,
        audioFile: payload[0].AudioFile,
        callerId: payload[0].CallerID,
        campaignName: payload[0].CampaignName,
        campaignStatus: payload[0].CampaignStatus,
        customerStatus: payload[0].CustomerStatus,
        did: payload[0].Did,
        duration: payload[0].Duration,
        startTime: payload[0].StartTime,
        endTime: payload[0].EndTime,
        type: payload[0].Type,
        userName: payload[0].UserName,
        callMonitorUCID: payload[0].monitorUCID,
        disposition: payload[0].Disposition
      };
      let activityLog: any = {};
      if (payload[0].UUI) {
        dialer.caseDetailId = payload[0].UUI;
        activityLog.title = "Outbound Call";
        if (payload && payload[1]) activityLog.title = "Outbound Conference Call";
      }
      else {
        let caseDetail: any = await CaseDetails.findOne({ where: { inboundCallMonitorUCID: payload[0].monitorUCID }, transaction });
        if (caseDetail) {
          dialer.caseDetailId = caseDetail.id;
          activityLog.title = "Inbound Call";
          if (payload && payload[1]) activityLog.title = "Inbound Conference Call";
        }
      }
      activityLog.description = `Call connected from ${dialer.agentId} to ${dialer.callerId}`;
      if (payload && payload.length > 1) {
        dialer.participants = payload.map((p: any) => p.ParticipantNumber).filter((num: any) => num !== undefined);
        // console.log('participants ***', dialer.participants);
        if (dialer.participants && dialer.participants.length > 0) {
          dialer.participants = dialer.participants.join(",");
          activityLog.description = `Conference Call connected from ${dialer.agentId} to ${dialer.callerId} and the participants are ${dialer.participants}`;
        }
      }
      if (dialer.caseDetailId) {
        activityLog.caseDetailId = dialer.caseDetailId
      }
      let activityLogCreated: any = await ActivityLogs.create({
        typeId: 245,
        ...activityLog
      }, { transaction });
      // console.log('Activity log', activityLogCreated);
      dialer.activityLogId = activityLogCreated.id;
      await DialerLogs.create(dialer, { transaction });
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Dialer log saved successfully",
      });
    } catch (error: any) {
      console.log('Error while saving the callback details', error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default dialerController;
