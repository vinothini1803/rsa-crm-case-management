import axios from "axios";
import moment from "moment-timezone";
// import _ from "lodash";
import { Op } from "sequelize";

import {
  Activities,
  CaseDetails,
  CaseInformation,
  CrmSla,
  Reminder,
} from "../database/models/index";
import { sendSLANotification, sendEmail } from "../services/notification";
import * as config from "../config/config.json";
import Utils from "../lib/utils";

const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

const createCrmSla = async (sla: any) => {
  try {
    return await CrmSla.create(sla);
  } catch (error: any) {
    throw error;
  }
};

const getCrmSla = async (sla: any) => {
  try {
    return await CrmSla.findOne({ where: sla });
  } catch (error: any) {
    throw error;
  }
};

const updateCrmSla = async (sla: any, id: any) => {
  try {
    return await CrmSla.update(sla, { where: { id: id } });
  } catch (error: any) {
    throw error;
  }
};

const getSlaSettingFromMaster = async () => {
  try {
    const response: any = await axios.get(
      `${masterService}/${endpointMaster.getSlaSettings}`
    );
    if (response && response.data && response.data.success) {
      return response.data.data;
    } else {
      return [];
    }
  } catch (error: any) {
    throw error;
  }
};

const sendEmailAndNotification = async (
  responseFromUser: any,
  title: any,
  body: any
) => {
  try {
    if (
      responseFromUser &&
      responseFromUser.data &&
      responseFromUser.data.success &&
      responseFromUser.data.data
    ) {
      if (
        responseFromUser.data.data.fcmToken &&
        responseFromUser.data.data.userId
      ) {
        await sendSLANotification({
          title: title,
          body: body,
          to: responseFromUser.data.data.fcmToken,
          userId: responseFromUser.data.data.userId,
        });
      }
      if (responseFromUser.data.data.email) {
        await sendEmail({
          to: responseFromUser.data.data.email,
          subject: title,
          text: body,
        });
      }
    }
  } catch (error: any) {
    console.error("Error while sending SLA email and notification ", error);
  }
};

const sendToSPOC = async (clientId: any, title: any, body: any) => {
  try {
    const getClientDetail: any = await axios.post(
      `${masterService}/${endpointMaster.getClientDetail}`,
      { clientId: clientId }
    );
    if (
      getClientDetail &&
      getClientDetail.data.success &&
      getClientDetail.data.data &&
      getClientDetail.data.data.spocUserId
    ) {
      const user: any = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getFCMTokenById}`,
        {
          id: getClientDetail.data.data.spocUserId,
        }
      );
      await sendEmailAndNotification(user, title, body);
    }
  } catch (error: any) {
    console.error("Error while sending SLA email notification to SPOC", error);
  }
};

const sendToCallCenterManager = async (
  callCenterId: any,
  title: any,
  body: any
) => {
  try {
    const getUserDetails = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.getUserFCMTokenByCallCenterId}`,
      {
        callCenterId: callCenterId,
      }
    );
    if (
      getUserDetails &&
      getUserDetails.data &&
      getUserDetails.data.success &&
      getUserDetails.data.data.fcmTokens &&
      getUserDetails.data.data.emails
    ) {
      // we will get many handle this
      for (let token of getUserDetails.data.data.fcmTokens) {
        await sendSLANotification({
          title: title,
          body: body,
          to: token.fcmToken,
          userId: token.userId,
        });
      }

      for (let email of getUserDetails.data.data.emails) {
        await sendEmail({
          to: email,
          subject: title,
          text: body,
        });
      }
    }
  } catch (error: any) {
    console.error(
      "Error while sending SLA email notification to Callcenter Manager",
      error
    );
  }
};

const sendToTL = async (agentId: any, title: any, body: any) => {
  try {
    const getUserDetails = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.getTLFCMTokenByAgentId}`,
      {
        agentId: agentId,
      }
    );
    return await sendEmailAndNotification(getUserDetails, title, body);
  } catch (error: any) {
    console.error("Error while sending SLA email notification to TL", error);
  }
};

const sendToAgent = async (agentId: any, title: any, body: any) => {
  try {
    const getAgentDetails = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.getFCMTokenById}`,
      {
        id: agentId,
      }
    );
    return await sendEmailAndNotification(getAgentDetails, title, body);
  } catch (error: any) {
    console.error("Error while sending SLA email notification to Agent", error);
  }
};

const sendToSME = async (agentId: any, title: any, body: any) => {
  try {
    const getSMEDetails = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.getSMEFCMTokenByAgentId}`,
      {
        agentId: agentId,
      }
    );
    return await sendEmailAndNotification(getSMEDetails, title, body);
  } catch (error: any) {
    console.error("Error while sending SLA email notification to SME", error);
  }
};

const sendToRM = async (breakdownAreaId: any, title: any, body: any) => {
  try {
    const getRMId = await axios.post(
      `${masterService}/${endpointMaster.getCityData}`,
      { cityId: breakdownAreaId }
    );
    if (
      getRMId &&
      getRMId.data &&
      getRMId.data.success &&
      getRMId.data.data &&
      getRMId.data.data.rmId
    ) {
      const getRmDetails = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getFCMTokenById}`,
        {
          id: getRMId.data.data.rmId,
        }
      );
      return await sendEmailAndNotification(getRmDetails, title, body);
    }
    return "";
  } catch (error: any) {
    console.error("Error while sending SLA email notification to RM", error);
  }
};

const sendToZM = async (breakdownAreaId: any, title: any, body: any) => {
  try {
    const getRMId = await axios.post(
      `${masterService}/${endpointMaster.getCityData}`,
      { cityId: breakdownAreaId }
    );
    if (
      getRMId &&
      getRMId.data &&
      getRMId.data.success &&
      getRMId.data.data &&
      getRMId.data.data.rmId
    ) {
      const getZMId = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: getRMId.data.data.rmId,
        }
      );
      if (
        getZMId &&
        getZMId.data &&
        getZMId.data.success &&
        getZMId.data.user &&
        getZMId.data.user.serviceZmId
      ) {
        const getZmDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getFCMTokenById}`,
          {
            id: getZMId.data.user.serviceZmId,
          }
        );
        await sendEmailAndNotification(getZmDetails, title, body);
      }
    }
  } catch (error: any) {
    console.error("Error while sending SLA email notification to ZM", error);
  }
};

const sendToNM = async (breakdownAreaId: any, title: any, body: any) => {
  try {
    const getRMId = await axios.post(
      `${masterService}/${endpointMaster.getCityData}`,
      { cityId: breakdownAreaId }
    );
    if (
      getRMId &&
      getRMId.data &&
      getRMId.data.success &&
      getRMId.data.data &&
      getRMId.data.data.rmId
    ) {
      const getZMId = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: getRMId.data.data.rmId,
        }
      );
      if (
        getZMId &&
        getZMId.data &&
        getZMId.data.success &&
        getZMId.data.user &&
        getZMId.data.user.serviceZmId
      ) {
        let nm = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUser}`,
          {
            id: getZMId.data.user.serviceZmId,
          }
        );
        if (
          nm &&
          nm.data &&
          nm.data.success &&
          nm.data.user &&
          nm.data.user.serviceNmId
        ) {
          const user = await axios.post(
            `${userServiceUrl}/${userServiceEndpoint.getFCMTokenById}`,
            {
              id: nm.data.user.serviceNmId,
            }
          );
          await sendEmailAndNotification(user, title, body);
        }
      }
    }
    return "";
  } catch (error: any) {
    console.error("Error while sending SLA email notification to NM", error);
  }
};

export const getSLATime = async (date: any, masterTime: any) => {
  try {
    let SLATime: any = new Date(date);
    SLATime.setSeconds(SLATime.getSeconds() + parseInt(masterTime));
    return SLATime.toISOString();
  } catch (error: any) {
    throw error;
  }
};

export const getComparisionDate = async (activity: any, caseDetail: any) => {
  try {
    //OLD LOGIC
    // if (activity.isInitiallyCreated && !activity.isImmediateService) {
    //   return activity.serviceInitiatingAt;
    // } else if (!activity.isInitiallyCreated) {
    //   return activity.createdAt;
    // } else {
    //   return caseDetail.createdAt;
    // }
    //NEW LOGIC
    //WHEN SERVICE IS INITIALLY CREATED AND NOT IMMEDIATE SERVICE, THEN USE SERVICE INITIATING AT ELSE USE CASE CREATED AT FOR BASE DATE
    if (activity.isInitiallyCreated && !activity.isImmediateService) {
      return activity.serviceInitiatingAt;
    } else {
      return caseDetail.createdAt;
    }
  } catch (error: any) {
    throw error;
  }
};

export const getTimeDifference = async (SLATime: any) => {
  // Difference between how much time left to achieve the sla
  try {
    let current: any = new Date();
    let sla: any = new Date(SLATime);
    let timeDiffMs = sla - current;
    // console.log('coming getTimeDifference', sla, current);
    // console.log('timeDiffMs', timeDiffMs);
    let timeDiffSec = Math.floor(timeDiffMs / 1000);
    // console.log('timeDiffMs', timeDiffSec);
    let minutes = Math.floor(timeDiffSec / 60);
    let seconds = timeDiffSec % 60;
    // console.log('minutes seconds', minutes, seconds);
    return `${minutes} min ${seconds} sec left`;
  } catch (error: any) {
    throw error;
  }
};

const l2AgentPickTimeSLA1 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  slaConfigId: any
) => {
  try {
    // console.log('l2AgentPickTimeSLA1');
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == slaConfigId
    );
    let crmSlaExists: any = await getCrmSla({
      caseDetailId: caseDetail.id,
      slaConfigId: masterSla.typeId,
      activityId: activity.id,
    });
    let updateData: any = {};
    if (!crmSlaExists) {
      let newCrmSla = {
        caseDetailId: caseDetail.id,
        slaConfigId: masterSla.typeId,
        activityId: activity.id,
      };
      crmSlaExists = await createCrmSla(newCrmSla);
    }
    // console.log('masterSla.time', masterSla.time, activity.agentPickedAt, new Date());
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      // console.log('sla time', SLATime);

      if (activity.agentPickedAt) {
        let agentPickedAt: any = new Date(activity.agentPickedAt).toISOString();
        // console.log('agentPickedAt', agentPickedAt);
        // Violation Check
        if (agentPickedAt > SLATime) {
          updateData.slaStatus = "SLA Violated";
          updateData.statusColor = "red";
        }
        // Achieved Check
        if (agentPickedAt <= SLATime) {
          updateData.slaStatus = "SLA Achieved";
          updateData.statusColor = "green";
        }
      }
      let currentTime: any = new Date().toISOString();
      // console.log('current time', currentTime, SLATime);
      // Inprogress check
      if (!activity.agentPickedAt && currentTime < SLATime) {
        updateData.slaStatus = await getTimeDifference(SLATime);
        updateData.statusColor = "orange";
      }

      // Violation check
      if (!activity.agentPickedAt && currentTime >= SLATime) {
        updateData.slaStatus = "SLA Violated";
        updateData.statusColor = "red";
      }
    }

    await updateCrmSla(updateData, crmSlaExists.id);
    if (updateData.slaStatus && updateData.slaStatus === "SLA Violated") {
      if (caseDetail.agentId) {
        let title = "AGENT PICK TIME SLA VIOLATION";
        let body = `The Agent Pick Time SLA for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
        // console.log('caseDetail.agentId', caseDetail.agentId)
        sendToTL(caseDetail.agentId, title, body);
      }
      return "";
    }
    return "";
  } catch (error: any) {
    throw error;
  }
};

const l2AgentPickTimeEscalation2 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  crmSla: any
) => {
  try {
    // console.log('l2AgentPickTimeEscalation2');
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == crmSla.escalationConfigId
    );
    let currentTime: any = new Date().toISOString();
    let updateData: any = {
      escalationConfigId: crmSla.escalationConfigId,
    };
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      if (activity.agentPickedAt) {
        let agentPickedAt: any = new Date(activity.agentPickedAt).toISOString();
        // Violation Check
        if (agentPickedAt > SLATime) {
          updateData.esclationStatus = "Violated";
        }
        // Achieved Check
        if (agentPickedAt <= SLATime) {
          updateData.esclationStatus = "Achieved";
        }
      }
      // Inprogress check
      if (!activity.agentPickedAt && currentTime < SLATime) {
        updateData.esclationStatus = "Inprogress";
      }
      // Violation check
      if (!activity.agentPickedAt && currentTime >= SLATime) {
        updateData.esclationStatus = "Violated";
      }
    }
    await updateCrmSla(updateData, crmSla.id);
    if (
      updateData.esclationStatus &&
      updateData.esclationStatus === "Violated"
    ) {
      if (caseDetail && caseDetail.callCenterId) {
        let title: any = "AGENT PICK TIME SLA VIOLATION";
        let body: any = `The Agent Pick Time SLA for RSA CRM Case Number - ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
        sendToCallCenterManager(caseDetail.callCenterId, title, body);
      }
    }
    return "";
  } catch (error: any) {
    throw error;
  }
};

const aspAutoAssignmentSLA1 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  slaConfigId: any
) => {
  try {
    if (!activity.agentPickedAt) {
      // Don't proceed, if the before sla value not available
      return "";
    }
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == slaConfigId
    );
    let currentTime: any = new Date().toISOString();
    let updateData: any = {};
    let crmSlaExists: any = await getCrmSla({
      caseDetailId: caseDetail.id,
      activityId: activity.id,
      slaConfigId: masterSla.typeId,
    });
    if (!crmSlaExists) {
      let newCrmSla = {
        caseDetailId: caseDetail.id,
        activityId: activity.id,
        slaConfigId: masterSla.typeId,
      };
      crmSlaExists = await createCrmSla(newCrmSla);
    }
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      if (activity.aspServiceAcceptedAt) {
        let aspServiceAcceptedAt: any = new Date(
          activity.aspServiceAcceptedAt
        ).toISOString();
        // Violation Check
        if (aspServiceAcceptedAt > SLATime) {
          updateData.slaStatus = "SLA Violated";
          updateData.statusColor = "red";
        }
        // Achieved Check
        if (aspServiceAcceptedAt <= SLATime) {
          updateData.slaStatus = "SLA Achieved";
          updateData.statusColor = "green";
        }
      }

      // Inprogress check
      if (!activity.aspServiceAcceptedAt && currentTime < SLATime) {
        updateData.slaStatus = await getTimeDifference(SLATime);
        updateData.statusColor = "orange";
      }

      // Violation Check
      if (!activity.aspServiceAcceptedAt && currentTime >= SLATime) {
        updateData.slaStatus = "SLA Violated";
        updateData.statusColor = "red";
      }
    }
    await updateCrmSla(updateData, crmSlaExists.id);
    if (updateData.slaStatus && updateData.slaStatus === "SLA Violated") {
      if (caseDetail.agentId) {
        let title = "ASP AUTO ASSIGNMENT ESCALATION";
        let body = `The asp auto assignement for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is escalated.`;
        sendToAgent(caseDetail.agentId, title, body);
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const aspManualAssignmentSLA1 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  crmSla: any
) => {
  try {
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == 866
    );
    let currentTime: any = new Date().toISOString();
    let updateData: any = {
      slaConfigId: masterSla.typeId,
      escalationConfigId: masterSla.typeId,
    };
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      if (activity.aspServiceAcceptedAt) {
        let aspServiceAcceptedAt: any = new Date(
          activity.aspServiceAcceptedAt
        ).toISOString();
        // Violation Check
        if (aspServiceAcceptedAt > SLATime) {
          updateData.slaStatus = "SLA Violated";
          updateData.statusColor = "red";
          updateData.esclationStatus = "Violated";
        }
        // Achieved Check
        if (aspServiceAcceptedAt <= SLATime) {
          updateData.slaStatus = "SLA Achieved";
          updateData.statusColor = "green";
          updateData.esclationStatus = "Achieved";
        }
      }

      // Inprogress check
      if (!activity.aspServiceAcceptedAt && currentTime < SLATime) {
        updateData.slaStatus = await getTimeDifference(SLATime);
        updateData.statusColor = "orange";
        updateData.esclationStatus = "Inprogress";
      }
      // Violation Check
      if (!activity.aspServiceAcceptedAt && currentTime >= SLATime) {
        updateData.slaStatus = "SLA Violated";
        updateData.statusColor = "red";
        updateData.esclationStatus = "Violated";
      }
    }
    await updateCrmSla(updateData, crmSla.id);
    if (updateData.slaStatus && updateData.slaStatus === "SLA Violated") {
      let title = "ASP MANUAL ASSIGNMENT SLA VIOLATION";
      let body = `The ASP Manual Assignment SLA for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
      // TL
      if (caseDetail.agentId) {
        sendToTL(caseDetail.agentId, title, body);
      }
      // RM
      if (
        caseDetail.caseInformation &&
        caseDetail.caseInformation.breakdownAreaId
      ) {
        sendToRM(caseDetail.caseInformation.breakdownAreaId, title, body);
      }
    }
    return "";
  } catch (error: any) {
    throw error;
  }
};

const aspManualAssignmentEscalation2 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  crmSla: any
) => {
  try {
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == crmSla.escalationConfigId
    );
    let currentTime: any = new Date().toISOString();
    let updateData: any = {
      escalationConfigId: crmSla.escalationConfigId,
    };
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      if (activity.aspServiceAcceptedAt) {
        let aspServiceAcceptedAt: any = new Date(
          activity.aspServiceAcceptedAt
        ).toISOString();
        // Violation Check
        if (aspServiceAcceptedAt > SLATime) {
          updateData.esclationStatus = "Violated";
        }
        // Achieved Check
        if (aspServiceAcceptedAt <= SLATime) {
          updateData.esclationStatus = "Achieved";
        }
      }

      // Inprogress check
      if (!activity.aspServiceAcceptedAt && currentTime < SLATime) {
        updateData.esclationStatus = "Inprogress";
      }
      // Violation Check
      if (!activity.aspServiceAcceptedAt && currentTime >= SLATime) {
        updateData.esclationStatus = "Violated";
      }
    }
    await updateCrmSla(updateData, crmSla.id);
    if (
      updateData.esclationStatus &&
      updateData.esclationStatus === "Violated"
    ) {
      let title = "ASP MANUAL ASSIGNMENT SLA VIOLATION";
      let body = `The ASP Manual Assignment SLA for RSA CRM ${caseDetail.caseNumber} is violated.`;
      // Call center manager
      if (caseDetail.callCenterId) {
        sendToCallCenterManager(caseDetail.callCenterId, title, body);
      }

      // ZM
      if (
        caseDetail.caseInformation &&
        caseDetail.caseInformation.breakdownAreaId
      ) {
        sendToZM(caseDetail.caseInformation.breakdownAreaId, title, body);
      }
    }
    return "";
  } catch (error: any) {
    throw error;
  }
};

const aspManualAssignmentEscalation3 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  crmSla: any
) => {
  try {
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == crmSla.escalationConfigId
    );
    let currentTime: any = new Date().toISOString();
    let updateData: any = {
      escalationConfigId: crmSla.escalationConfigId,
    };
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      if (activity.aspServiceAcceptedAt) {
        let aspServiceAcceptedAt: any = new Date(
          activity.aspServiceAcceptedAt
        ).toISOString();
        // Violation Check
        if (aspServiceAcceptedAt > SLATime) {
          updateData.esclationStatus = "Violated";
        }
        // Achieved Check
        if (aspServiceAcceptedAt <= SLATime) {
          updateData.esclationStatus = "Achieved";
        }
      }
      // Inprogress check
      if (!activity.aspServiceAcceptedAt && currentTime < SLATime) {
        updateData.esclationStatus = "Inprogress";
      }
      // Violation Check
      if (!activity.aspServiceAcceptedAt && currentTime >= SLATime) {
        updateData.esclationStatus = "Violated";
      }
    }
    await updateCrmSla(updateData, crmSla.id);
    if (
      updateData.esclationStatus &&
      updateData.esclationStatus === "Violated"
    ) {
      let title = "ASP MANUAL ASSIGNMENT SLA VIOLATION";
      let body = `The ASP Manual Assignment SLA for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
      // NM
      if (
        caseDetail.caseInformation &&
        caseDetail.caseInformation.breakdownAreaId
      ) {
        sendToNM(caseDetail.caseInformation.breakdownAreaId, title, body);
      }
      // SPOC
      if (caseDetail.clientId) {
        sendToSPOC(caseDetail.clientId, title, body);
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const remainderSettingSLA1 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  slaConfigId: any
) => {
  try {
    if (!activity.aspServiceAcceptedAt) {
      // Don't proceed, if the before sla value not available
      return "";
    }
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == slaConfigId
    );
    let reminder: any = await Reminder.findOne({
      where: { caseDetailId: caseDetail.id, activityId: activity.id },
    });
    let crmSlaExists: any = await getCrmSla({
      caseDetailId: caseDetail.id,
      activityId: activity.id,
      slaConfigId: masterSla.typeId,
    });
    let updateData: any = {};
    if (!crmSlaExists) {
      let newCrmSla = {
        caseDetailId: caseDetail.id,
        activityId: activity.id,
        slaConfigId: masterSla.typeId,
      };
      crmSlaExists = await createCrmSla(newCrmSla);
    }
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let reminderSLATime: any = await getSLATime(compareDate, masterSla.time);
      if (reminder) {
        let reminderCreatedAt: any = new Date(reminder.createdAt).toISOString();
        if (reminderCreatedAt <= reminderSLATime) {
          updateData.slaStatus = "SLA Achieved";
          updateData.statusColor = "green";
        } else if (reminderCreatedAt > reminderSLATime) {
          updateData.slaStatus = "SLA Violated";
          updateData.statusColor = "red";
        }
      } else {
        let currentTime: any = new Date().toISOString();
        if (currentTime > reminderSLATime) {
          updateData.slaStatus = "SLA Violated";
          updateData.statusColor = "red";
        } else if (currentTime < reminderSLATime) {
          updateData.slaStatus = await getTimeDifference(reminderSLATime);
          updateData.statusColor = "orange";
        }
      }
    }
    await updateCrmSla(updateData, crmSlaExists.id);
    if (updateData.slaStatus && updateData.slaStatus === "SLA Violated") {
      let title: any = "REMINDER SETTING SLA VIOLATION";
      let body: any = `The Reminder Setting SLA for RSA CRM case ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
      // SME
      if (caseDetail.agentId) {
        sendToSME(caseDetail.agentId, title, body);
      }
      // TL
      if (caseDetail.agentId) {
        sendToTL(caseDetail.agentId, title, body);
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const remainderSettingEscalation2 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  crmSla: any
) => {
  try {
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == crmSla.escalationConfigId
    );
    let reminder: any = await Reminder.findOne({
      where: { caseDetailId: caseDetail.id, activityId: activity.id },
    });
    let updateData: any = {
      escalationConfigId: crmSla.escalationConfigId,
    };
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (compareDate) {
      let reminderSLATime: any = await getSLATime(compareDate, masterSla.time);
      if (reminder) {
        let reminderCreatedAt: any = new Date(reminder.createdAt).toISOString();
        if (reminderCreatedAt <= reminderSLATime) {
          updateData.esclationStatus = "Achieved";
        } else if (reminderCreatedAt > reminderSLATime) {
          updateData.esclationStatus = "Violated";
        }
      } else {
        let currentTime: any = new Date().toISOString();
        if (currentTime >= reminderSLATime) {
          updateData.esclationStatus = "Violated";
        } else if (currentTime < reminderSLATime) {
          updateData.esclationStatus = "Inprogress";
        }
      }
    }
    await updateCrmSla(updateData, crmSla.id);
    if (
      updateData.esclationStatus &&
      updateData.esclationStatus === "Violated"
    ) {
      let title: any = "REMINDER SETTING SLA VIOLATION";
      let body: any = `The Reminder Setting SLA for RSA CRM case ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
      // SPOC
      if (caseDetail.clientId) {
        sendToSPOC(caseDetail.clientId, title, body);
      }
      // Call center manager
      if (caseDetail.callCenterId) {
        sendToCallCenterManager(caseDetail.callCenterId, title, body);
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const aspBreakdownReachTimeSLA1 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  slaConfigId: any
) => {
  try {
    let reminder: any = await Reminder.findOne({
      where: { caseDetailId: caseDetail.id, activityId: activity.id },
    });
    if (!reminder) {
      return "";
    }
    let cityData: any = await axios.post(
      `${masterService}/${endpointMaster.getCityData}`,
      { cityId: caseDetail.caseInformation.breakdownAreaId }
    );
    if (
      cityData &&
      cityData.data &&
      cityData.data.success &&
      cityData.data.data &&
      cityData.data.data.locationTypeId
    ) {
      let masterSla: any = await masterSlaSettings.find(
        (item: any) =>
          item.typeId == slaConfigId &&
          item.locationTypeId == cityData.data.data.locationTypeId
      );
      let updateData: any = {};
      let crmSlaExists: any = await getCrmSla({
        caseDetailId: caseDetail.id,
        activityId: activity.id,
        slaConfigId: masterSla.typeId,
      });
      if (!crmSlaExists) {
        let newCrmSla = {
          caseDetailId: caseDetail.id,
          activityId: activity.id,
          slaConfigId: masterSla.typeId,
        };
        crmSlaExists = await createCrmSla(newCrmSla);
      }
      let compareDate: any = await getComparisionDate(activity, caseDetail);
      if (compareDate) {
        let SLATime: any = await getSLATime(compareDate, masterSla.time);
        if (activity.aspReachedToBreakdownAt) {
          let aspReachedToBreakdownAt: any = new Date(
            activity.aspReachedToBreakdownAt
          ).toISOString();
          // Violation Check
          if (aspReachedToBreakdownAt > SLATime) {
            updateData.slaStatus = "SLA Violated";
            updateData.statusColor = "red";
          }
          // Achieved Check
          if (aspReachedToBreakdownAt <= SLATime) {
            updateData.slaStatus = "SLA Achieved";
            updateData.statusColor = "green";
          }
        }
        // Inprogress check
        let currentTime: any = new Date().toISOString();
        if (!activity.aspReachedToBreakdownAt && currentTime < SLATime) {
          updateData.slaStatus = await getTimeDifference(SLATime);
          updateData.statusColor = "orange";
        }
        // Violation Check
        if (!activity.aspReachedToBreakdownAt && currentTime >= SLATime) {
          updateData.slaStatus = "SLA Violated";
          updateData.statusColor = "red";
        }
      }
      await updateCrmSla(updateData, crmSlaExists.id);
      if (updateData.slaStatus && updateData.slaStatus === "SLA Violated") {
        let title = "ASP BREAKDOWN REACH TIME SLA";
        let body = `The ASP Breakdown Reach Time SLA for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
        // Agent
        if (caseDetail.agentId) {
          sendToAgent(caseDetail.agentId, title, body);
        }
        // RM
        if (
          caseDetail.caseInformation &&
          caseDetail.caseInformation.breakdownAreaId
        ) {
          sendToRM(caseDetail.caseInformation.breakdownAreaId, title, body);
        }
      }
    }
    return "";
  } catch (error: any) {
    throw error;
  }
};

const aspBreakdownReachTimeEscalation = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  crmSla: any
) => {
  try {
    let cityData: any = await axios.post(
      `${masterService}/${endpointMaster.getCityData}`,
      { cityId: caseDetail.caseInformation.breakdownAreaId }
    );
    if (
      cityData &&
      cityData.data &&
      cityData.data.success &&
      cityData.data.data &&
      cityData.data.data.locationTypeId
    ) {
      let masterSla: any = await masterSlaSettings.find(
        (item: any) =>
          item.typeId == crmSla.escalationConfigId &&
          item.locationTypeId == cityData.data.data.locationTypeId
      );

      let updateData: any = {
        escalationConfigId: crmSla.escalationConfigId,
      };
      let compareDate: any = await getComparisionDate(activity, caseDetail);
      if (compareDate) {
        let SLATime: any = await getSLATime(compareDate, masterSla.time);
        if (activity.aspReachedToBreakdownAt) {
          let aspReachedToBreakdownAt: any = new Date(
            activity.aspReachedToBreakdownAt
          ).toISOString();
          // Violation Check
          if (aspReachedToBreakdownAt > SLATime) {
            updateData.esclationStatus = "Violated";
          }
          // Achieved Check
          if (aspReachedToBreakdownAt <= SLATime) {
            updateData.esclationStatus = "Achieved";
          }
        }
        // Inprogress check
        let currentTime: any = new Date().toISOString();
        if (!activity.aspReachedToBreakdownAt && currentTime < SLATime) {
          updateData.esclationStatus = "Inprogress";
        }
        // Violation Check
        if (!activity.aspReachedToBreakdownAt && currentTime >= SLATime) {
          updateData.esclationStatus = "Violated";
        }
      }
      await updateCrmSla(updateData, crmSla.id);
      if (
        updateData.esclationStatus &&
        updateData.esclationStatus === "Violated"
      ) {
        let title = "ASP BREAKDOWN REACH TIME SLA";
        let body = `The ASP Breakdown Reach Time SLA for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
        if (crmSla.escalationConfigId == 871) {
          // TL
          if (caseDetail.agentId) {
            sendToTL(caseDetail.agentId, title, body);
          }
          // ZM
          if (
            caseDetail.caseInformation &&
            caseDetail.caseInformation.breakdownAreaId
          ) {
            sendToZM(caseDetail.caseInformation.breakdownAreaId, title, body);
          }
          // SME
          if (caseDetail.agentId) {
            sendToSME(caseDetail.agentId, title, body);
          }
        } else if (crmSla.escalationConfigId == 872) {
          // Call Center Manager
          if (caseDetail.callCenterId) {
            sendToCallCenterManager(caseDetail.callCenterId, title, body);
          }
          // NM
          if (
            caseDetail.caseInformation &&
            caseDetail.caseInformation.breakdownAreaId
          ) {
            sendToNM(caseDetail.caseInformation.breakdownAreaId, title, body);
          }
        } else if (crmSla.escalationConfigId == 873) {
          // SPOC
          if (caseDetail.clientId) {
            sendToSPOC(caseDetail.clientId, title, body);
          }
          // NM
          if (
            caseDetail.caseInformation &&
            caseDetail.caseInformation.breakdownAreaId
          ) {
            sendToNM(caseDetail.caseInformation.breakdownAreaId, title, body);
          }
        }
      }
    }
    return "";
  } catch (error: any) {
    throw error;
  }
};

const financialAndCaseClosureSLA1 = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  slaConfigId: any
) => {
  try {
    if (!activity.aspReachedToBreakdownAt) {
      return "";
    }
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == slaConfigId
    );
    let crmSlaExists: any = await getCrmSla({
      caseDetailId: caseDetail.id,
      slaConfigId: masterSla.typeId,
      activityId: activity.id,
    });
    let updateData: any = {};
    if (!crmSlaExists) {
      let newCrmSla = {
        caseDetailId: caseDetail.id,
        slaConfigId: masterSla.typeId,
        activityId: activity.id,
      };
      crmSlaExists = await createCrmSla(newCrmSla);
    }
    let currentTime: any = new Date().toISOString();
    let latestPositiveActivity: any = caseDetail.activities[0];
    let compareDate: any = await getComparisionDate(
      latestPositiveActivity,
      caseDetail
    );

    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      if (caseDetail.closedAt) {
        let caseClosedAt: any = new Date(caseDetail.closedAt).toISOString();
        // Violation Check
        if (caseClosedAt > SLATime) {
          updateData.slaStatus = "SLA Violated";
          updateData.statusColor = "red";
        }
        // Achieved Check
        if (caseClosedAt <= SLATime) {
          updateData.slaStatus = "SLA Achieved";
          updateData.statusColor = "green";
        }
      }

      // Inprogress check
      if (!caseDetail.closedAt && currentTime < SLATime) {
        updateData.slaStatus = await getTimeDifference(SLATime);
        updateData.statusColor = "orange";
      }
      // Violation Check
      if (!caseDetail.closedAt && currentTime >= SLATime) {
        updateData.slaStatus = "SLA Violated";
        updateData.statusColor = "red";
      }
    }
    await updateCrmSla(updateData, crmSlaExists.id);
    if (updateData.slaStatus && updateData.slaStatus === "SLA Violated") {
      let title: any = "FINANCIAL ENTRY AND CASE CLOSURE SLA";
      let body: any = `The Financial entry and case closure SLA for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;

      // TL
      if (caseDetail.agentId) {
        sendToTL(caseDetail.agentId, title, body);
      }
      // Call Center Manager
      if (caseDetail.callCenterId) {
        sendToCallCenterManager(caseDetail.callCenterId, title, body);
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const financialAndCaseClosureEscalation = async (
  caseDetail: any,
  activity: any,
  masterSlaSettings: any,
  crmSla: any
) => {
  try {
    let masterSla: any = await masterSlaSettings.find(
      (item: any) => item.typeId == crmSla.escalationConfigId
    );
    let updateData: any = {
      escalationConfigId: crmSla.escalationConfigId,
    };
    let currentTime: any = new Date().toISOString();
    let latestPositiveActivity: any = caseDetail.activities[0];
    let compareDate: any = await getComparisionDate(
      latestPositiveActivity,
      caseDetail
    );

    if (compareDate) {
      let SLATime: any = await getSLATime(compareDate, masterSla.time);
      if (caseDetail.closedAt) {
        let caseClosedAt: any = new Date(caseDetail.closedAt).toISOString();
        // Violation Check
        if (caseClosedAt > SLATime) {
          updateData.esclationStatus = "Violated";
        }
        // Achieved Check
        if (caseClosedAt <= SLATime) {
          updateData.esclationStatus = "Achieved";
        }
      }

      // Inprogress check
      if (!caseDetail.closedAt && currentTime < SLATime) {
        updateData.esclationStatus = "Inprogress";
      }
      // Violation Check
      if (!caseDetail.closedAt && currentTime >= SLATime) {
        updateData.esclationStatus = "Violated";
      }
    }
    await updateCrmSla(updateData, crmSla.id);
    if (
      updateData.esclationStatus &&
      updateData.esclationStatus === "Violated"
    ) {
      let title: any = "FINANCIAL ENTRY AND CASE CLOSURE SLA";
      let body: any = `The Financial entry and case closure SLA for RSA CRM ${caseDetail.caseNumber} of activity ${activity.activityNumber} is violated.`;
      if (crmSla.escalationConfigId == 875) {
        // SPOC
        if (caseDetail.clientId) {
          sendToSPOC(caseDetail.clientId, title, body);
        }
      } else if (crmSla.escalationConfigId == 876) {
        // Backend Manager
        const backOfficeHead: any = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUserFCMTokenByRoleId}`,
          {
            roleId: 27, // Back Office Head roleId
          }
        );
        sendEmailAndNotification(backOfficeHead, title, body);
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const violatedLevelStepCalculation = async (
  slaLevels: any,
  escalationSteps: any,
  crmSla: any
) => {
  try {
    let value: any = {
      escalation: null,
      sla: null,
    };
    let slaConfigId: any = crmSla.slaConfigId;
    if (crmSla.slaConfigId == 866) {
      slaConfigId = 368;
    }
    if (crmSla.esclationStatus === "Achieved") {
      // move to the next step in SLA
      let currentLevelIndex = slaLevels.findIndex(
        (level: any) => level === slaConfigId
      );
      value.sla = slaLevels[currentLevelIndex + 1];
    } else if (crmSla.esclationStatus === "Inprogress") {
      // continue with this step
      value.escalation = crmSla.escalationConfigId;
    } else if (crmSla.esclationStatus === "Violated") {
      // move to next step in esclation level, if not available, the move to next SLA level
      let currentLevelIndex = escalationSteps.findIndex((level: any) =>
        level.steps.includes(crmSla.escalationConfigId)
      );
      let currentLevel = escalationSteps[currentLevelIndex];
      let stepIndex = currentLevel.steps.indexOf(crmSla.escalationConfigId);
      let nextStep = currentLevel.steps[stepIndex + 1];
      if (nextStep) {
        value.escalation = nextStep;
      } else {
        let index: any = slaLevels.findIndex(
          (level: any) => level === slaConfigId
        );
        value.sla = slaLevels[index + 1];
      }
    } else if (crmSla.slaStatus === "SLA Violated") {
      let index: any = escalationSteps.findIndex(
        (step: any) => step.id == slaConfigId
      );
      value.escalation = escalationSteps[index].steps[0];
    }
    return value;
  } catch (error: any) {
    throw error;
  }
};

export namespace crmSlaController {
  export async function processCrmCases(req: any, res: any) {
    try {
      // console.log('process crm cases');
      // SLA Levels and Steps
      const slaLevels = [366, 368, 868, 870, 874];
      const escalationSteps = [
        {
          id: 366,
          steps: [367],
        },
        {
          id: 368,
          steps: [866, 867, 877],
        },
        {
          id: 868,
          steps: [869],
        },
        {
          id: 870,
          steps: [871, 872, 873],
        },
        {
          id: 874,
          steps: [875, 876],
        },
      ];
      const slaMethods: any = {
        366: l2AgentPickTimeSLA1,
        368: aspAutoAssignmentSLA1,
        868: remainderSettingSLA1,
        870: aspBreakdownReachTimeSLA1,
        874: financialAndCaseClosureSLA1,
      };
      const esclationMethods: any = {
        367: l2AgentPickTimeEscalation2,
        866: aspManualAssignmentSLA1,
        867: aspManualAssignmentEscalation2,
        877: aspManualAssignmentEscalation3,
        869: remainderSettingEscalation2,
        871: aspBreakdownReachTimeEscalation,
        872: aspBreakdownReachTimeEscalation,
        873: aspBreakdownReachTimeEscalation,
        875: financialAndCaseClosureEscalation,
        876: financialAndCaseClosureEscalation,
      };
      // get sla setting from master to compare
      const masterSlaSettings: any = await getSlaSettingFromMaster();
      // console.log('master **', masterSlaSettings);
      // get case details to process sla status
      let caseDetails: any = await CaseDetails.findAll({
        where: {
          statusId: {
            [Op.in]: [1, 2], //OPEN || INPROGRESS
          },
          typeId: 31, //CRM
        },
        attributes: [
          "id",
          "caseNumber",
          "agentId",
          "agentAssignedAt",
          "callCenterId",
          "clientId",
          "closedAt",
          "createdAt",
        ],
        order: [["id", "ASC"]],
        include: [
          {
            model: Activities,
            where: {
              activityStatusId: {
                [Op.notIn]: [4, 5, 8], // 4) Cancelled, 5) Failure, 8) Rejected
              },
            },
            attributes: [
              "id",
              "activityNumber",
              "caseDetailId",
              "aspServiceAcceptedAt",
              "agentPickedAt",
              "isInitiallyCreated",
              "isImmediateService",
              "serviceInitiatingAt",
              "aspReachedToBreakdownAt",
              "createdAt",
            ],
            order: [["createdAt", "DESC"]],
          },
          {
            model: CaseInformation,
            attributes: ["id", "caseDetailId", "breakdownAreaId"],
          },
        ],
      });
      // console.log('casedetails', JSON.stringify(caseDetails));

      for (let caseDetail of caseDetails) {
        for (let activity of caseDetail.activities) {
          let crmSla: any = await CrmSla.findOne({
            where: { caseDetailId: caseDetail.id, activityId: activity.id },
            order: [["createdAt", "DESC"]],
          });
          // console.log('crmSla', crmSla);
          if (!crmSla) {
            // console.log('process sla 1');
            // process SLA Level 1
            await l2AgentPickTimeSLA1(
              caseDetail,
              activity,
              masterSlaSettings,
              366
            );
          } else if (crmSla && crmSla.slaStatus.includes("left")) {
            // SLA Inprogress check
            // console.log('process in progress state');
            if (crmSla.slaConfigId == 866) {
              await aspManualAssignmentSLA1(
                caseDetail,
                activity,
                masterSlaSettings,
                crmSla
              );
            } else {
              // continue with the current SLA Level
              await slaMethods[crmSla.slaConfigId](
                caseDetail,
                activity,
                masterSlaSettings,
                crmSla.slaConfigId
              );
            }
          } else if (crmSla && crmSla.slaStatus === "SLA Achieved") {
            // console.log('slaachieved state ');
            if (crmSla.slaConfigId == 866) {
              await remainderSettingSLA1(
                caseDetail,
                activity,
                masterSlaSettings,
                868
              );
            } else {
              // move to next SLA Level
              let index: any = slaLevels.findIndex(
                (level: any) => level === crmSla.slaConfigId
              );
              let nextLevel: any = slaLevels[index + 1];
              await slaMethods[nextLevel](
                caseDetail,
                activity,
                masterSlaSettings,
                nextLevel
              );
            }
          } else if (crmSla && crmSla.slaStatus === "SLA Violated") {
            // console.log('sla violated state ');
            // check for Esclation Step and move accordingly to esclation or SLA Level
            let level: any = await violatedLevelStepCalculation(
              slaLevels,
              escalationSteps,
              crmSla
            );
            // console.log('level **', level);
            if (level.escalation) {
              crmSla.escalationConfigId = level.escalation;
              await esclationMethods[level.escalation](
                caseDetail,
                activity,
                masterSlaSettings,
                crmSla
              );
            } else if (level.sla) {
              await slaMethods[level.sla](
                caseDetail,
                activity,
                masterSlaSettings,
                level.sla
              );
            }
          }
        }
      }
      return res.status(200).json({
        success: true,
        message: "CRM SLA PROCESS COMPLETED",
      });
    } catch (error: any) {
      console.log("error in CRM SLA Process", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function processSlaViolateReason(payload: any) {
    try {
      //L2 Agent Pick time SLA - L1 or ASP Acceptance  SLA - Manual Assignment L1 or
      //ASP Breakdown Reach Time SLA - L1 or Financial entry and Case closure - L1
      if (
        payload.typeId == 366 ||
        payload.typeId == 866 ||
        payload.typeId == 870 ||
        payload.typeId == 874
      ) {
        const slaViolateReasonCheckResponse = await checkSlaViolateReason(
          payload
        );
        if (!slaViolateReasonCheckResponse.success) {
          return slaViolateReasonCheckResponse;
        }
      } else if (payload.typeId == 868) {
        //Remainder Setting SLA - No remainder set L1
        const activity: any = await Activities.findOne({
          attributes: ["id", "aspServiceAcceptedAt", "createdAt"],
          where: { id: payload.activityId },
        });
        if (!activity) {
          return {
            success: false,
            error: "Activity not found",
          };
        }

        if (activity.aspServiceAcceptedAt) {
          let reminder: any = await Reminder.findOne({
            where: {
              activityId: activity.id,
              createdAt: {
                [Op.gte]: activity.aspServiceAcceptedAt,
              },
            },
          });
          if (!reminder) {
            const slaViolateReasonCheckResponse = await checkSlaViolateReason(
              payload
            );
            if (!slaViolateReasonCheckResponse.success) {
              return slaViolateReasonCheckResponse;
            }
          }
        }
      }

      return {
        success: true,
        message: "SLA violate reason checked successfully",
      };
    } catch (error: any) {
      throw error;
    }
  }

  export async function checkSlaViolateReason(payload: any) {
    try {
      let activity: any = null;
      const activityAttributes: string[] = [
        "id",
        "caseDetailId",
        "isInitiallyCreated",
        "isImmediateService",
        "serviceInitiatingAt",
        "createdAt",
      ];
      const caseDetailsAttributes: string[] = ["id", "typeId", "createdAt"];
      const caseInformationAttributes: string[] =
        payload.typeId != 874 ? ["id", "breakdownAreaId"] : ["id"];
      const activityWhereClause: {} =
        payload.typeId != 874 //EXCEPT FINANCIAL ENTRY AND CASE CLOSURE - L1
          ? { id: payload.activityId }
          : {
            activityStatusId: {
              [Op.notIn]: [4, 8], // 4) Cancelled, 8) Rejected
            },
            caseDetailId: payload.caseDetailId,
          };
      const activityOptions: {} =
        payload.typeId != 874 //EXCEPT FINANCIAL ENTRY AND CASE CLOSURE - L1
          ? {}
          : {
            order: [["id", "DESC"]], //GET LATEST POSTIVE ACTIVITY
          };

      activity = await Activities.findOne({
        attributes:
          payload.typeId != 874
            ? [...activityAttributes, "aspServiceAcceptedAt"]
            : activityAttributes,
        where: activityWhereClause,
        include: [
          {
            model: CaseDetails,
            attributes: caseDetailsAttributes,
            required: true,
            include: [
              {
                model: CaseInformation,
                attributes: caseInformationAttributes,
                required: true,
              },
            ],
          },
        ],
        ...activityOptions,
      });

      if (activity) {
        //GET SLA SETTING BASED ON CASE TYPE, TYPE ID AND CASE BREAKDOWN AREA LOCATION TYPE
        const slaSettingResponse = await axios.post(
          `${masterService}/${endpointMaster.sla.getByCaseTypeAndTypeId}`,
          {
            caseTypeId: activity.caseDetail.typeId,
            typeId: payload.typeId,
            breakdownAreaId:
              payload.typeId == 870
                ? activity.caseDetail.caseInformation.breakdownAreaId
                : null, //BREAKDOWN AREA IS REQUIRED IF SLA TYPE IS ASP BREADOWN REACH TIME SLA - L1
          }
        );
        if (!slaSettingResponse.data.success) {
          return slaSettingResponse.data;
        }

        let baseDate: any = await getComparisionDate(
          activity,
          activity.caseDetail
        );
        if (baseDate) {
          const baseDatePlusSlaTime = moment
            .tz(baseDate, "Asia/Kolkata")
            .add(slaSettingResponse.data.data.time, "seconds")
            .format("YYYY-MM-DD HH:mm:ss");
          const date = payload.date;

          if (date > baseDatePlusSlaTime) {
            if (!payload.slaViolateReasonId) {
              return {
                success: false,
                error: "SLA violation reason is required",
              };
            }

            //L2 AGENT PICK TIME SLA - L1 OR REMINDER SETTING SLA - L1 & LOGGED USER IS NOT AN AGENT
            // if (
            //   (payload.typeId == 366 || payload.typeId == 868) &&
            //   ![3].includes(payload.authUserRoleId)
            // ) {

            if (
              payload.typeId == 868 &&
              !Utils.hasPermission(
                payload.authUserPermissions,
                "add-reminder-web"
              )
            ) {
              return {
                success: false,
                error: `Permission not found`,
              };
            }

            //L2 AGENT PICK TIME SLA - L1 & LOGGED USER IS NOT AN AGENT
            // if (payload.typeId == 366 && ![3].includes(payload.authUserRoleId)) {
            //   return {
            //     success: false,
            //     error: `Only agent can update the SLA violate reason`,
            //   };
            // }

            //L2 AGENT PICK TIME SLA - L1 & LOGGED USER IS NOT AN AGENT
            if (
              payload.typeId == 366 &&
              !Utils.hasPermission(
                payload.authUserPermissions,
                "pick-service-web"
              )
            ) {
              return {
                success: false,
                error: `Only agent can update the SLA violate reason`,
              };
            }

            //ASP ACCEPTANCE SLA - MANUAL ASSIGNMENT L1 OR ASP BREAKDOWN REACH TIME SLA - L1 & LOGGED USER IS NOT (AGENT/ASP/ASP MECHANIC)
            // if (
            //   (payload.typeId == 866 || payload.typeId == 870) &&
            //   ![3, 4, 5].includes(payload.authUserRoleId)
            // ) {
            //   return {
            //     success: false,
            //     error: `Only Agent or ASP or Mechanic can update the SLA violate reason`,
            //   };
            // }

            //ASP ACCEPTANCE SLA - MANUAL ASSIGNMENT L1 & LOGGED USER IS NOT (AGENT/ASP/ASP MECHANIC)
            if (
              payload.typeId == 866 &&
              ![3, 4, 5].includes(payload.authUserRoleId)
            ) {
              return {
                success: false,
                error: `Only Agent or ASP or Mechanic can update the SLA violate reason`,
              };
            }

            let activities: any = [];
            //EXCEPT FINANCIAL ENTRY AND CASE CLOSURE - L1
            if (payload.typeId != 874) {
              activities.push(activity);
            } else {
              // FINANCIAL ENTRY AND CASE CLOSURE - L1
              activities = await Activities.findAll({
                attributes: ["id", "caseDetailId"],
                where: {
                  caseDetailId: payload.caseDetailId,
                  activityStatusId: {
                    [Op.notIn]: [4, 8], // 4) Cancelled, 8) Rejected
                  },
                },
              });
            }

            for (const activity of activities) {
              const slaViolateReasonUpdateRequest = {
                caseDetailId: activity.caseDetailId,
                activityId: activity.id,
                slaConfigId: payload.typeId,
                slaStatus: "SLA Violated",
                statusColor: "red",
                userId: payload.authUserId,
                violateReasonId: payload.slaViolateReasonId,
                violateReasonComments: payload.slaViolateReasonComments,
                transaction: payload.transaction,
              };

              const slaViolateReasonUpdateResponse: any =
                await updateSlaViolateReason(slaViolateReasonUpdateRequest);
              if (!slaViolateReasonUpdateResponse.success) {
                return slaViolateReasonUpdateResponse;
              }
            }
          }
        }
      }

      return {
        success: true,
        error: "SLA violation reason checked successfully",
      };
    } catch (error: any) {
      throw error;
    }
  }

  export async function updateSlaViolateReason(inputRequest: any) {
    try {
      let { transaction, ...payload } = inputRequest;
      const where: any = {};
      where.caseDetailId = payload.caseDetailId;
      where.slaConfigId = payload.slaConfigId;
      if (payload.activityId) {
        where.activityId = payload.activityId;
      }

      const crmSlaExists: any = await CrmSla.findOne({
        attributes: ["id"],
        where,
      });
      if (crmSlaExists) {
        const updateCrmSla = {
          ...payload,
          updatedById: payload.userId,
        };

        await CrmSla.update(updateCrmSla, {
          where: { id: crmSlaExists.id },
          transaction: transaction ? transaction : undefined,
        });
      } else {
        await CrmSla.create(payload, {
          transaction: transaction ? transaction : undefined,
        });
      }

      return {
        success: true,
        message: "SLA violate reason updated successfully",
      };
    } catch (error: any) {
      throw error;
    }
  }
}
