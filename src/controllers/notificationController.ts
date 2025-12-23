import axios from "axios";
// import * as nodemailer from "nodemailer";
import * as config from "../config/config.json";
import {
  CaseDetails,
  NotifiyUserList,
  NotyLog,
} from "../database/models/index";
import admin from "firebase-admin";
import { getUserController } from "../lib/userDetail";
import notificationTemplates from "../database/models/notificationTemplates";
import crmNotificationTemplates from "../database/models/crmNotificationTemplates";
import caseDetails from "../database/models/caseDetails";
import { Request, Response } from "express";
import { DATE, Op, where } from "sequelize";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import sequelize from "../database/connection";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

export namespace NotificationController {
  // function for extracting template details and user details for notifications
  export async function sendNotification(details: any) {
    let caseDetailId = details.caseDetailId;
    // console.log("details: ", details);

    if (caseDetailId) {
      const templateId = details.templateId;
      let getNotificationTemplates: any = {};

      if (details?.notificationType == "CRM") {
        // CRM notification table
        getNotificationTemplates = await crmNotificationTemplates.findOne({
          where: { id: templateId },
          attributes: ["id", "title", "message", "columnNames"],
        });
      } else {
        // VDM notification table
        getNotificationTemplates = await notificationTemplates.findOne({
          where: { id: templateId },
          attributes: ["id", "title", "message", "columnNames"],
        });
      }
      // console.log("getNotificationTemplates", getNotificationTemplates);

      let extraDetail: any = {};

      if (details?.aspDetail) {
        extraDetail.aspDetail = details.aspDetail;
      }

      if (details?.mechanicDetail) {
        extraDetail.mechanicDetail = details.mechanicDetail;
      }

      if (details?.paidByDealerDetail) {
        extraDetail.paidByDealerDetail = details.paidByDealerDetail;
      }

      extraDetail.paidByDealerOnly = false;
      if (details?.paidByDealerOnly) {
        extraDetail.paidByDealerOnly = details.paidByDealerOnly;
      }

      if (details?.notificationType) {
        extraDetail.notificationType = details.notificationType;
      }

      // notification alert for agent, dealer, etc
      const userTokenDetails: any = await getNotificationUserDetails(
        caseDetailId,
        getNotificationTemplates.dataValues.id,
        getNotificationTemplates.dataValues.columnNames,
        extraDetail
      ); // function ge agent token details for agent, dealer, etc
      const notificationType = "FCM";
      const notificationtitle = getNotificationTemplates.dataValues.title;
      let notificationDataBody = getNotificationTemplates.dataValues.message;

      let getcaseNumber: any = ""; // Get case number
      if (details.caseDetailId) {
        getcaseNumber = await caseDetails.findOne({
          where: { id: details.caseDetailId },
          attributes: ["caseNumber"],
        });
      }

      const splitColumns: string[] =
        getNotificationTemplates.dataValues.columnNames.split(",");

      const replacements = [
        { "{{Case Number}}": getcaseNumber.caseNumber },
        { "{{Agent Name}}": details.agentName },
        { "{{Workshop Name}}": details.workshopName },
        { "{{Paid Dealer Name}}": details.paidDealerName },
        { "{{Cancelled Dealer Name}}": details.canceledDealerName },
        { "{{Dealer who paid advance}}": details.dealerWhoPaidAdvance },
        { "{{Balance Paid Dealer Name}}": details.balancePaidDealerName },
        { "{{Dealer Name}}": details.caseCanceledDealerName },
        { "{{OTP}}": details.otp },
        { "{{Customer Name}}": details.customerName },
        { "{{BD OR Pickup Reach ETA}}": details.breakdownOrPickupReachEta },
      ];

      replacements.forEach((replacement: any) => {
        const key = Object.keys(replacement)[0];
        const value = replacement[key];
        notificationDataBody = notificationDataBody.replace(key, value);
      });

      const notificationData: any = {
        type: notificationType,
        from: "",
        title: notificationtitle,
        body: notificationDataBody,
      };

      // notification alert to all TL
      if (splitColumns.indexOf("TL") != -1) {
        const tlTokenDetails: any = await getUserController.getUserDetails(7);
        const tlUserDetails: any = await getUserController.getUserIdsByRole(7);
        if (tlUserDetails?.success && tlUserDetails.details.success) {
          for (const tlIds of tlUserDetails.details.data) {
            const notificationData: any = {
              userId: tlIds.id,
              title: notificationtitle,
              body: notificationDataBody,
              sourceFrom: details.sourceFrom || 1,
            };
            let insertData = await NotifiyUserList.create(notificationData);
          }
        }
        for (const tlToken of tlTokenDetails.details.data) {
          if (tlToken.length > 0) {
            for (const token of tlToken) {
              notificationData["to"] = token.fcmtoken;
              notificationData["userId"] = token.userId;
              const notificationResponse = await NotificationController.newNoty(
                notificationData
              );
            }
          }
        }
      }

      if (
        getNotificationTemplates?.dataValues?.id != undefined &&
        getNotificationTemplates?.dataValues?.id == 1 &&
        getNotificationTemplates?.dataValues?.notificationType == "CRM"
      ) {
        // alerts to all agents
        const AgentTokenDetails: any = await getUserController.getUserDetails(
          3
        );

        const AgentUserIdsDetails: any =
          await getUserController.getUserIdsByRole(3);

        if (
          AgentUserIdsDetails?.success &&
          AgentUserIdsDetails.details.success
        ) {
          for (const agentIds of AgentUserIdsDetails.details.data) {
            const notificationData: any = {
              userId: agentIds.id,
              title: notificationtitle,
              body: notificationDataBody,
              sourceFrom: details.sourceFrom || 1,
            };
            let insertData = await NotifiyUserList.create(notificationData);
          }
        }
        for (const agentToken of AgentTokenDetails.details.data) {
          if (agentToken.length > 0) {
            for (const token of agentToken) {
              notificationData["to"] = token.fcmtoken;
              notificationData["userId"] = token.userId;
              const notificationResponse = await NotificationController.newNoty(
                notificationData
              );
            }
          }
        }
      }

      if (userTokenDetails.success) {
        if (userTokenDetails?.data?.userIds) {
          for (const userId of userTokenDetails?.data?.userIds) {
            const notificationData: any = {
              userId: userId,
              title: notificationtitle,
              body: notificationDataBody,
            };

            if (details.sourceFrom) {
              notificationData.sourceFrom = details.sourceFrom;
            }
            let insertData = await NotifiyUserList.create(notificationData);
          }
        }
        for (const userToken of userTokenDetails?.data?.data) {
          notificationData["to"] = userToken.fcmToken;
          notificationData["userId"] = userToken.userId;
          const notificationResponse = await NotificationController.newNoty(
            notificationData
          );
        }
      }
    }
  }
  // function get agent token details for agent, dealer, etc with fcm token
  export async function getNotificationUserDetails(
    CaseId: any,
    templateId: any = "",
    attri: any = "",
    extraDetail: any = ""
  ) {
    // attributes: ["id", "dealerId", "agentId", "deliveryRequestDropDealerId", "deliveryRequestCreatedDealerId"],   asp_owner, asp_mechanic
    const attributesArray = attri.split(",");
    const attributes = ["id"];

    let mergedAttributes: any = "";
    if (attri != "") {
      mergedAttributes = attributes.concat(attributesArray);
    }

    let aspArray: any = [];
    let caseArray: any = [];
    let paiddealerArray: any = [];

    if (
      mergedAttributes &&
      (templateId != 1 || extraDetail.notificationType == "CRM")
    ) {
      if (
        mergedAttributes.some(
          (mergedAttribute: string | string[]) =>
            mergedAttribute.includes("aspId") ||
            mergedAttribute.includes("aspMechanicId") ||
            mergedAttribute.includes("TL") ||
            mergedAttribute.includes("paidByDealerId")
        )
      ) {
        aspArray = mergedAttributes.filter(
          (mergedAttribute: string | string[]) =>
            (mergedAttribute.includes("aspId") ||
              mergedAttribute.includes("aspMechanicId")) &&
            !mergedAttribute.includes("TL") &&
            !mergedAttribute.includes("paidByDealerId")
        );
        caseArray = mergedAttributes.filter(
          (mergedAttribute: string | string[]) =>
            !mergedAttribute.includes("aspId") &&
            !mergedAttribute.includes("aspMechanicId") &&
            !mergedAttribute.includes("TL") &&
            !mergedAttribute.includes("paidByDealerId")
        );
        paiddealerArray = mergedAttributes.filter(
          (mergedAttribute: string | string[]) =>
            mergedAttribute.includes("paidByDealerId")
        );
      } else {
        caseArray = mergedAttributes;
      }
    }

    let caseDetail: any = "";
    if (caseArray.length > 0) {
      caseDetail = await CaseDetails.findByPk(CaseId, {
        attributes: caseArray,
      });
    }

    let getAgentDetail: any = "";
    let getPickupDealerDetail = "";
    let getDropDealerDetail = "";
    let getCreatedDealerDetail = "";

    if (caseDetail && Object.keys(caseDetail.dataValues).length > 1) {
      //GET AGENT DETAIL
      if (caseDetail?.dataValues?.agentId) {
        let agentData = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUser}`,
          {
            id: caseDetail.dataValues.agentId,
          }
        );
        getAgentDetail = agentData.data.success ? agentData.data.user.id : "";
      }

      // GET CREATED DEALER DETAIL (IF PAID BY DEALER ONLY EQUALS FALSE)
      if (
        caseDetail?.dataValues?.deliveryRequestCreatedDealerId &&
        !extraDetail.paidByDealerOnly
      ) {
        const createdDealer: any = await axios.get(
          `${userServiceUrl}/${userServiceEndpoint.getEntityUser}?userTypeId=140&entityId=${caseDetail.dataValues.deliveryRequestCreatedDealerId}`
        );
        getCreatedDealerDetail = createdDealer.data.success
          ? createdDealer.data.user.id
          : "";
      }

      // GET DROP DEALER DETAIL (IF PAID BY DEALER ONLY EQUALS FALSE)
      if (
        caseDetail?.dataValues?.deliveryRequestDropDealerId &&
        !extraDetail.paidByDealerOnly
      ) {
        const dropDealer: any = await axios.get(
          `${userServiceUrl}/${userServiceEndpoint.getEntityUser}?userTypeId=140&entityId=${caseDetail.dataValues.deliveryRequestDropDealerId}`
        );
        getDropDealerDetail = dropDealer.data.success
          ? dropDealer.data.user.id
          : "";
      }

      // GET PICKUP DEALER DETAIL (IF PAID BY DEALER ONLY EQUALS FALSE)
      if (caseDetail?.dataValues?.dealerId && !extraDetail.paidByDealerOnly) {
        const pickUpdealer: any = await axios.get(
          `${userServiceUrl}/${userServiceEndpoint.getEntityUser}?userTypeId=140&entityId=${caseDetail.dataValues.dealerId}`
        );
        getPickupDealerDetail = pickUpdealer.data.success
          ? pickUpdealer.data.user.id
          : "";
      }
    }

    // ASP DETAIL EXISTS
    let getASPUserID: any = "";
    if (Object.keys(extraDetail).length > 0 && extraDetail.aspDetail) {
      const getASPUserDetail: any = await axios.get(
        `${userServiceUrl}/${userServiceEndpoint.getEntityUser}?userTypeId=142&entityId=${extraDetail.aspDetail}`
      );
      getASPUserID = getASPUserDetail.data.success
        ? getASPUserDetail.data.user.id
        : "";
    }

    // ASP MECHANIC DETAIL EXISTS
    let getASPMechanicId: any = "";
    if (Object.keys(extraDetail).length > 0 && extraDetail.mechanicDetail) {
      const getASPMechanicDetail: any = await axios.get(
        `${userServiceUrl}/${userServiceEndpoint.getEntityUser}?userTypeId=143&entityId=${extraDetail.mechanicDetail}`
      );
      getASPMechanicId = getASPMechanicDetail.data.success
        ? getASPMechanicDetail.data.user.id
        : "";
    }

    // PAID BY DEALER DETAIL EXISTS
    let getPaidByDealerId: any = "";
    if (Object.keys(extraDetail).length > 0 && extraDetail.paidByDealerDetail) {
      const getPaidByDealerDetail: any = await axios.get(
        `${userServiceUrl}/${userServiceEndpoint.getEntityUser}?userTypeId=140&entityId=${extraDetail.paidByDealerDetail}`
      );
      getPaidByDealerId = getPaidByDealerDetail.data.success
        ? getPaidByDealerDetail.data.user.id
        : "";
    }

    // validate the details
    const userIds: any = [];
    if (getAgentDetail != "") {
      userIds.push(getAgentDetail);
    }
    if (getCreatedDealerDetail != "") {
      userIds.push(getCreatedDealerDetail);
    }
    if (getDropDealerDetail != "") {
      userIds.push(getDropDealerDetail);
    }
    if (getPickupDealerDetail != "") {
      userIds.push(getPickupDealerDetail);
    }
    if (getASPUserID != "") {
      userIds.push(getASPUserID);
    }
    if (getASPMechanicId != "") {
      userIds.push(getASPMechanicId);
    }
    if (getPaidByDealerId != "") {
      userIds.push(getPaidByDealerId);
    }

    // get user tokens
    let getUserTokens: any = "";

    if (userIds.length > 0) {
      getUserTokens = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.fetchUsersFcmToken}`,
        {
          id: userIds,
          getUserRecentFcmToken: 1,
        }
      );
    }

    if (getUserTokens?.data?.success) {
      const returnData = {
        data: getUserTokens.data.data,
        userIds: userIds,
      };
      return {
        success: true,
        data: returnData,
      };
    } else {
      return {
        success: false,
      };
    }
  }
  export async function newNoty(messageData: any) {
    try {
      const createNotyLog = await NotyLog.create({
        from: messageData.from,
        to: messageData.to,
        userId: messageData.userId,
        type: messageData.type,
        title: messageData.title,
        body: messageData.body,
        status: "NEW",
      });

      if (messageData?.type === "FCM") {
        const serviceAccount = require("../config/google-adminsdk-key.json");
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        }
        await admin
          .messaging()
          .send({
            notification: {
              title: messageData.title,
              body: messageData.body,
            },
            android: {
              notification: {
                sound: "music",
                channelId: "com.rsa.crm1",
              },
            },
            token: messageData.to,
          })
          .then(async (response: any) => {
            await NotyLog.update(
              {
                status: "SUCCESS",
                remarks: response,
              },
              {
                where: { id: createNotyLog.dataValues.id },
              }
            );
          })
          .catch(async (error: any) => {
            if (
              messageData.to &&
              (error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered" ||
                error.code === "messaging/invalid-argument")
            ) {
              await Utils.removeInvalidFCMToken(messageData.to);
            } else {
              await NotyLog.update(
                {
                  status: "ERROR",
                  remarks: error.errorInfo.message,
                },
                {
                  where: { id: createNotyLog.dataValues.id },
                }
              );
            }
          });
      } else {
        return "Invalid Type";
      }
      return "Notification Added to Queue";
    } catch (err: any) {
      console.log(err);
      return err;
    }
  }

  export async function getNotyLogList(req: Request, res: Response) {
    try {
      const { userId, sourceFrom }: any = req.body;

      // Get days limit from environment variable, default to 3 if not set
      const daysLimit = parseInt(process.env.NOTIFICATION_LOG_DAYS_LIMIT || "3", 10);

      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() - daysLimit); // subtract days from current date based on env config
      const formattedDate = currentDate.toISOString().slice(0, 10); // YYYY-MM-DD formatted date

      const whereConditions: any[] = [
        sequelize.where(
          sequelize.fn("DATE", sequelize.col("createdAt")),
          ">=",
          formattedDate
        ),
        {
          userId: userId,
        },
      ];

      // Add sourceFrom filter only if provided
      if (sourceFrom) {
        whereConditions.push({
          sourceFrom: sourceFrom,
        });
      }

      const notyLog: any = await NotifiyUserList.findAll({
        where: {
          [Op.and]: whereConditions,
        },
        attributes: ["id", "title", "body", "sourceFrom", "createdAt"],
        group: ["body", "createdAt"],
        order: [["id", "DESC"]],
      });

      interface OriginalEntry {
        id: number;
        title: string;
        body: string;
        sourceFrom: number | null;
        createdAt: string;
      }

      interface ConvertedEntry {
        id: number;
        title: string;
        body: string;
        sourceFrom: number | null;
        createdAt: string;
      }

      interface ConvertedStructure {
        label: string;
        list: ConvertedEntry[];
      }

      const convertedData: ConvertedStructure[] = [];
      const convertedStructureMap: { [label: string]: ConvertedEntry[] } = {};

      if (notyLog.length > 0) {
        notyLog.forEach(
          (entry: {
            createdAt: string | number | Date;
            id: any;
            title: any;
            body: any;
            sourceFrom: any;
          }) => {
            const createdAtDate = entry.createdAt;
            let label = moment
              .tz(createdAtDate, "Asia/Kolkata")
              .format("DD-MM-YYYY"); // Extracting YYYY-MM-DD

            if (label == moment().tz("Asia/Kolkata").format("DD-MM-YYYY")) {
              label = "Today";
            } else if (
              label ==
              moment()
                .tz("Asia/Kolkata")
                .subtract(1, "days")
                .format("DD-MM-YYYY")
            ) {
              label = "Yesterday";
            } else {
              label = moment.tz(createdAtDate, "Asia/Kolkata").format("dddd");
            }

            if (!convertedStructureMap[label]) {
              convertedStructureMap[label] = [];
            }

            const convertedEntry: ConvertedEntry = {
              id: entry.id,
              title: entry.title,
              body: entry.body,
              sourceFrom: entry.sourceFrom,
              createdAt: moment
                .tz(createdAtDate, "Asia/Kolkata")
                .format("DD/MM/YYYY hh:mm A"),
            };

            convertedStructureMap[label].push(convertedEntry);
          }
        );

        Object.keys(convertedStructureMap).forEach((label) => {
          convertedData.push({
            label,
            list: convertedStructureMap[label],
          });
        });

        return res.status(200).json({
          success: true,
          message: "Data Fetched Successfully",
          data: convertedData,
        });
      } else {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default NotificationController;
