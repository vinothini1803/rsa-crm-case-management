import { Request, Response } from "express";
import moment from "moment-timezone";
import Sequelize, { Op } from "sequelize";
import axios from "axios";

import {
  Reminder,
  CaseDetails,
  Activities,
  ActivityAspDetails,
  CaseInformation,
} from "../database/models/index";
import { checkCaseDetail } from "./caseContoller";
import { checkActivity } from "./activitiesContoller";
import { getUserToken, sendNotification } from "../services/notification";
import { createActivityLog } from "./activityLog";
import sequelize from "../database/connection";
const config = require("../config/config.json");
import { crmSlaController } from "./crmSla";
import Utils from "../lib/utils";

const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

const userServiceBaseUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceBaseEndpoint = config.userService.endpoint;

const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

const createReminder = async (data: any) => {
  try {
    const newReminder = {
      subject: data.subject,
      description: data.description,
      reminderId: data.reminder.id,
      scheduleTime: data.scheduleTime ? moment.tz(data.scheduleTime, "Asia/Kolkata").toDate() : null,
      priorityId: data.priority.id,
      typeId: data.type.id ? data.type.id : null,
      statusId: data.status.id ? data.status.id : null,
      activityId: data.activityId ? data.activityId : null,
      caseDetailId: data.caseDetailId,
      createdById: data.createdById,
    };
    return await Reminder.create(newReminder);
  } catch (error: any) {
    throw error;
  }
};

const getMasterReminderData = async () => {
  try {
    const response: any = await axios.get(
      `${masterService}/${endpointMaster.getReminderConfigDetails}`
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

const generateRemindersResponse = async (
  masterConfigData: any,
  reminders: any
) => {
  try {
    for (let reminder of reminders) {
      if (masterConfigData.priority)
        reminder.dataValues.priority = masterConfigData.priority.find(
          (p: any) => p.id == reminder.priorityId
        );
      if (masterConfigData.type)
        reminder.dataValues.type = masterConfigData.type.find(
          (t: any) => t.id == reminder.typeId
        );
      if (masterConfigData.status)
        reminder.dataValues.status = masterConfigData.status.find(
          (s: any) => s.id == reminder.statusId
        );
      if (masterConfigData.reminder)
        reminder.dataValues.reminder = masterConfigData.reminder.find(
          (r: any) => r.id == reminder.reminderId
        );
    }
    return reminders;
  } catch (error: any) {
    throw error;
  }
};

export namespace reminderController {
  export async function addReminder(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const caseDetail: any = await checkCaseDetail(req.validBody.caseDetailId);
      if (!caseDetail.success) {
        return res.status(200).json(caseDetail);
      }

      // if (caseDetail.data.dataValues.typeId == 31) {
      //   //RSA
      //   const authUserPermissions = req.validBody.authUserData.permissions;

      //   if (!Utils.hasPermission(authUserPermissions, "add-reminder-web")) {
      //     await transaction.rollback();
      //     return res.status(200).json({
      //       success: false,
      //       error: "Permission not found",
      //     });
      //   }
      // }

      if (req.validBody && req.validBody.activityId) {
        const activity = await checkActivity(req.validBody.activityId);
        if (!activity.success) {
          return res.status(200).json(activity);
        }

        //RSA CRM-> Reminder not available after the asp service accepted date means then check reminder created date with sla date , if violated process sla violate reason update
        if (caseDetail.data && caseDetail.data.dataValues.typeId == 31) {
          const slaViolateRequests = {
            caseDetailId: caseDetail.data.dataValues.id,
            activityId: activity.data?.dataValues.id,
            typeId: 868, //Remainder Setting SLA - No remainder set L1
            date: moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
            slaViolateReasonId: req.validBody.slaViolateReasonId
              ? req.validBody.slaViolateReasonId
              : null,
            slaViolateReasonComments: req.validBody.slaViolateReasonComments
              ? req.validBody.slaViolateReasonComments
              : null,
            authUserRoleId: req.validBody.authUserRoleId,
            authUserId: req.validBody.authUserId,
            transaction: transaction,
            authUserPermissions: req.validBody.authUserData.permissions,
          };

          const slaViolateReasonProcessResponse =
            await crmSlaController.processSlaViolateReason(slaViolateRequests);
          if (!slaViolateReasonProcessResponse.success) {
            await transaction.rollback();
            return res.status(200).json(slaViolateReasonProcessResponse);
          }
        }
      }
      const createdReminder: any = await createReminder(req.validBody);
      req.validBody.logTypeId = 243; //REMINDER
      // await createActivityLog(req.validBody, transaction, "The Reminder");
      await createActivityLog(
        req.validBody,
        transaction,
        `The reminder "${req.validBody.subject}"`
      );
      await transaction.commit();      

      Utils.createReportSyncTableRecord("remindersReportDetails", [createdReminder.id]);

      // Sync client report details, client report with mobile number details
      if (caseDetail.data && caseDetail.data.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [caseDetail.data.dataValues.id]
        );
      }
      return res
        .status(200)
        .json({ success: true, message: "Reminder saved successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  export async function getReminderList(req: Request, res: Response) {
    try {
      const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
      let reminders: any = await Reminder.findAll({
        where: {
          dismiss: false,
          scheduleTime: Sequelize.literal(`DATE(scheduleTime) = '${today}'`),
          createdById: req.validBody.createdById,
        },
        order: [["id", "desc"]],
      });
      if (reminders.length) {
        let masterConfigData: any = await getMasterReminderData();
        reminders = await generateRemindersResponse(
          masterConfigData,
          reminders
        );
      }
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: reminders,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  export async function updateReminder(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const reminder = await Reminder.findOne({
        where: { id: req.validBody.reminderId },
        include: {
          model: CaseDetails,
          attributes: ["id", "typeId"],
          required: false,
        },
      });
      if (!reminder) {
        return res
          .status(200)
          .json({ success: false, error: "Reminder not found" });
      }
      let data: any = { updatedById: req.validBody.updatedById };
      if (req.validBody.dismiss) {
        data.dismiss = req.validBody.dismiss;
      } else {
        // Snooze clicked - increment snoozeCount
        data.scheduleTime = req.validBody.scheduleTime ? moment.tz(req.validBody.scheduleTime, "Asia/Kolkata").toDate() : null;
        data.snoozeCount = Sequelize.literal("snoozeCount + 1");
      }
      await Reminder.update(data, {
        where: { id: req.validBody.reminderId },
        transaction: transaction,
      });
      // req.validBody.logTypeId = 240;
      // await createActivityLog(req.validBody, transaction, 'Reminder');
      await transaction.commit();

      Utils.createReportSyncTableRecord("remindersReportDetails", [req.validBody.reminderId]);

      // Sync client report details, client report with mobile number details
      const reminderWithCaseDetail: any = reminder;
      if (reminderWithCaseDetail.caseDetail && reminderWithCaseDetail.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [reminderWithCaseDetail.caseDetailId]
        );
      }
      
      return res
        .status(200)
        .json({ success: true, message: "Reminder updated successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  export async function triggerReminder(req: Request, res: Response) {
    try {
      const currentMinute = moment().tz("Asia/Kolkata").format("mm");
      const currentHour = moment().tz("Asia/Kolkata").format("HH");
      const reminders: any = await Reminder.findAll({
        where: {
          scheduleTime: {
            [Sequelize.Op.and]: [
              Sequelize.literal(`HOUR(scheduleTime) = ${currentHour}`),
              Sequelize.literal(`MINUTE(scheduleTime) = ${currentMinute}`),
              Sequelize.literal(`DATE(scheduleTime) = CURDATE()`),
            ],
          },
        },
      });
      let masterConfigData: any = await getMasterReminderData();
      for (let reminder of reminders) {
        let token: any = await getUserToken(reminder.dataValues.createdById);
        if (token.success === true) {
          reminder = await generateRemindersResponse(masterConfigData, [
            reminder,
          ]);
          await sendNotification({
            title: "Reminder",
            body: reminder[0].dataValues,
            to: token.data[0].fcmToken,
          });
        }
      }
      return res.status(200).json({
        success: true,
        message: "Reminders triggered successfully",
        reminders: reminders,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  export async function getReminderById(req: Request, res: Response) {
    try {
      let reminder = await Reminder.findOne({
        where: { id: req.validBody.reminderId },
      });
      if (!reminder) {
        return res
          .status(200)
          .json({ success: false, error: "Reminder not found" });
      }
      let masterConfigData: any = await getMasterReminderData();
      reminder = await generateRemindersResponse(masterConfigData, [reminder]);
      return res.status(200).json({
        success: true,
        message: "Reminder fetched successfully",
        data: reminder,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  export async function getReminderListPage(req: Request, res: Response) {
    try {
      const { limit, offset, search, startDate, endDate, ...inputData } =
        req.body;
      const userId = inputData.userId
        ? parseInt(inputData.userId as string)
        : null;
      const roleId = inputData.roleId
        ? parseInt(inputData.roleId as string)
        : null;

      const defaultLimit = 10;
      const defaultOffset = 0;

      let limitValue: number = defaultLimit;
      if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      let offsetValue: number = defaultOffset;
      if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const reminderWhere: any = {};
      const caseDetailWhere: any = {};
      const activityWhere: any = {};

      // Date filter
      if (startDate && endDate) {
        reminderWhere[Op.and] = [
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("reminder.createdAt")),
            ">=",
            startDate
          ),
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("reminder.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      // Search filter
      let searchWhereQuery: any = [];
      if (search) {
        // Get master data search results for service, subservice, priority, type
        const searchDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getReminderListSearchData}`,
          {
            search: search,
          }
        );

        let masterSearchDetails = [];
        if (searchDataResponse?.data?.success) {
          for (const searchDetail of searchDataResponse.data.searchDetails) {
            if (searchDetail.type == "subService") {
              masterSearchDetails.push({
                "$activity.activityAspDetail.subServiceId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "service") {
              masterSearchDetails.push({
                "$activity.activityAspDetail.serviceId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "reminderPriority") {
              masterSearchDetails.push({
                priorityId: {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "reminderType") {
              masterSearchDetails.push({
                typeId: {
                  [Op.in]: searchDetail.ids,
                },
              });
            }
          }
        }

        // Search for users by name
        let userSearchIds: any[] = [];
        const userSearchResponse: any = await axios.post(
          `${userServiceBaseUrl}/${userServiceBaseEndpoint.commonGetMasterDetails}`,
          {
            searchUsers: search,
          }
        );

        if (userSearchResponse.data.success && userSearchResponse.data.data.searchedUsers) {
          userSearchIds = userSearchResponse.data.data.searchedUsers.map((u: any) => u.id);
        }

        if (userSearchIds.length > 0) {
          masterSearchDetails.push({
            createdById: {
              [Op.in]: userSearchIds,
            },
          });
        }

        searchWhereQuery = [
          {
            "$caseDetail.caseNumber$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$caseDetail.registrationNumber$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            subject: {
              [Op.like]: `%${search}%`,
            },
          },
          {
            description: {
              [Op.like]: `%${search}%`,
            },
          },
        ];

        if (masterSearchDetails && masterSearchDetails.length > 0) {
          searchWhereQuery.push(...masterSearchDetails);
        }
      }

      // Permission-based listing: Handle Team Leader and Super Admin roles
      // Team Leader (roleId === 7): Get reminders for agents under their team
      // Super Admin (roleId === 1): Get reminders for all agents
      // Agent (other roles): Get reminders created by the user
      if (roleId === 1 || roleId === 7) {
        // Get agents based on role
        let agentDetails;
        if (roleId === 1) {
          // Super Admin: Get all agents
          agentDetails = await axios.post(
            `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
            {
              roleId: 3, // Agent
            }
          );
        } else {
          // Team Leader: Get agents where tlId = userId
          if (!userId) {
            return res.status(200).json({
              success: false,
              error: "User ID is required for team leader",
            });
          }
          agentDetails = await axios.post(
            `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
            {
              roleId: 3, // Agent
              where: {
                tlId: userId,
              },
            }
          );
        }

        if (!agentDetails.data.success) {
          return res.status(200).json({
            success: false,
            error: "Failed to fetch agents",
          });
        }

        const agents = agentDetails.data.data || [];
        const agentIds = agents.map((agent: any) => agent.id);

        if (agentIds.length > 0) {
          reminderWhere.createdById = {
            [Op.in]: agentIds,
          };
        } else {
          // No agents found, return empty result
          return res.status(200).json({
            success: true,
            message: "No data found",
            data: {
              count: 0,
              rows: [],
            },
          });
        }
      } else {
        // For agents and other roles: filter by createdById = userId
        if (!userId) {
          return res.status(200).json({
            success: false,
            error: "User ID is required",
          });
        }
        reminderWhere.createdById = userId;
      }

      const reminders = await Reminder.findAndCountAll({
        where: {
          ...reminderWhere,
          ...(searchWhereQuery.length > 0 ? { [Op.or]: searchWhereQuery } : {}),
        },
        attributes: [
          "id",
          "activityId",
          "caseDetailId",
          "subject",
          "description",
          "scheduleTime",
          "priorityId",
          "typeId",
          "statusId",
          "dismiss",
          "snoozeCount",
          "createdById",
          "createdAt",
          [Sequelize.col("caseDetail.caseNumber"), "caseNumber"],
          [Sequelize.col("activity.activityAspDetail.serviceId"), "serviceId"],
          [Sequelize.col("activity.activityAspDetail.subServiceId"), "subServiceId"],
        ],
        include: [
          {
            model: CaseDetails,
            required: true,
            where: caseDetailWhere,
            attributes: ["id", "caseNumber"],
            include: [
              {
                model: CaseInformation,
                required: false,
                attributes: ["id"],
              },
            ],
          },
          {
            model: Activities,
            required: false,
            where: activityWhere,
            attributes: ["id"],
            include: [
              {
                model: ActivityAspDetails,
                required: false,
                attributes: ["id", "serviceId", "subServiceId"],
              },
            ],
          },
        ],
        limit: limitValue,
        offset: offsetValue,
        order: [["id", "desc"]],
        distinct: true,
      });

      if (reminders.count === 0) {
        return res.status(200).json({
          success: true,
          message: "No data found",
          data: {
            count: 0,
            rows: [],
          },
        });
      }

      // Get service and subservice IDs
      const serviceIds = [
        ...new Set(
          reminders.rows
            .map((r: any) => r.dataValues.serviceId)
            .filter((id: any) => id)
        ),
      ];
      const subServiceIds = [
        ...new Set(
          reminders.rows
            .map((r: any) => r.dataValues.subServiceId)
            .filter((id: any) => id)
        ),
      ];

      // Get priority and type IDs
      const priorityIds = [
        ...new Set(
          reminders.rows
            .map((r: any) => r.dataValues.priorityId)
            .filter((id: any) => id)
        ),
      ];
      const typeIds = [
        ...new Set(
          reminders.rows
            .map((r: any) => r.dataValues.typeId)
            .filter((id: any) => id)
        ),
      ];

      let serviceData: any = {};
      let subServiceData: any = {};
      let priorityData: any = {};
      let typeData: any = {};

      // Get service, subservice, priority, type, and status names from master service
      const masterDetailResponse: any = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          getServicesWithoutValidation: serviceIds.length > 0 ? serviceIds : null,
          getSubServicesWithoutValidation: subServiceIds.length > 0 ? subServiceIds : null,
          getReminderPrioritiesWithoutValidation: priorityIds.length > 0 ? priorityIds : null,
          getReminderTypesWithoutValidation: typeIds.length > 0 ? typeIds : null,
        }
      );

      if (masterDetailResponse.data.success) {
        if (masterDetailResponse.data.data.servicesWithoutValidation) {
          masterDetailResponse.data.data.servicesWithoutValidation.forEach(
            (service: any) => {
              serviceData[service.id] = service;
            }
          );
        }
        if (masterDetailResponse.data.data.subServicesWithoutValidation) {
          masterDetailResponse.data.data.subServicesWithoutValidation.forEach(
            (subService: any) => {
              subServiceData[subService.id] = subService;
            }
          );
        }
        if (masterDetailResponse.data.data.reminderPrioritiesWithoutValidation) {
          masterDetailResponse.data.data.reminderPrioritiesWithoutValidation.forEach(
            (priority: any) => {
              priorityData[priority.id] = priority;
            }
          );
        }
        if (masterDetailResponse.data.data.reminderTypesWithoutValidation) {
          masterDetailResponse.data.data.reminderTypesWithoutValidation.forEach(
            (type: any) => {
              typeData[type.id] = type;
            }
          );
        }
      }

      // Get user names for createdBy - using commonGetMasterDetails
      const createdByIds = [
        ...new Set(reminders.rows.map((r: any) => r.dataValues.createdById)),
      ];
      let userData: any = {};

      if (createdByIds.length > 0) {
        const userResponse: any = await axios.post(
          `${userServiceBaseUrl}/${userServiceBaseEndpoint.commonGetMasterDetails}`,
          {
            userIds: createdByIds,
          }
        );
        if (userResponse.data.success && userResponse.data.data.usersInformation) {
          userResponse.data.data.usersInformation.forEach((user: any) => {
            userData[user.id] = user;
          });
        }
      }

      // Enrich reminder data
      const enrichedRows = reminders.rows.map((reminder: any) => {
        const reminderData = reminder.dataValues;

        // Get priority name from master service response
        if (reminderData.priorityId && priorityData[reminderData.priorityId]) {
          reminderData.priority = priorityData[reminderData.priorityId];
        }

        // Get type name from master service response
        if (reminderData.typeId && typeData[reminderData.typeId]) {
          reminderData.type = typeData[reminderData.typeId];
        }

        // Get service name from master service response
        if (reminderData.serviceId && serviceData[reminderData.serviceId]) {
          reminderData.service = serviceData[reminderData.serviceId].name;
        }

        // Get subservice name from master service response
        if (
          reminderData.subServiceId &&
          subServiceData[reminderData.subServiceId]
        ) {
          reminderData.subService =
            subServiceData[reminderData.subServiceId].name;
        }

        if (reminderData.createdById && userData[reminderData.createdById]) {
          reminderData.createdBy = userData[reminderData.createdById].name;
        }
        return reminderData;
      });

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: {
          count: reminders.count,
          rows: enrichedRows,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function autoReminderForActivities(req: Request, res: Response) {
    try {
      const reminderThresholdMinutes = process.env.AUTO_REMINDER_THRESHOLD_MINUTES || "24";
      const createdReminders = [];

      // Helper function to process a condition and create reminders in bulk
      const processCondition = async (
        activities: any[],
        subjectPattern: string,
        descriptionTemplate: (caseNumber: string) => string
      ): Promise<{ reminderIds: any[]; caseDetailIds: any[] }> => {
        if (activities.length === 0) return { reminderIds: [], caseDetailIds: [] };
        const activityIds = activities.map((a: any) => {
          const activityData = a.dataValues || a;
          return activityData.id;
        });

        // Batch check for existing reminders in one query
        const existingReminders = await Reminder.findAll({
          attributes: ["activityId"],
          where: {
            activityId: {
              [Op.in]: activityIds,
            },
            isAuto: 1,
            subject: subjectPattern,
          },
        });

        const existingActivityIds = new Set(
          existingReminders.map((r: any) => r.activityId)
        );

        const remindersToCreate: any[] = [];
        const scheduleTime = moment().tz("Asia/Kolkata").add(5, "minutes").format("YYYY-MM-DD HH:mm:ss");

        for (const activity of activities) {
          if (existingActivityIds.has(activity.id)) {
            continue;
          }

          remindersToCreate.push({
            activityId: activity.id,
            caseDetailId: activity.caseDetail.id,
            subject: subjectPattern,
            description: descriptionTemplate(activity.caseDetail?.caseNumber || "N/A"),
            reminderId: 1, //Others
            scheduleTime: scheduleTime,
            priorityId: 552, //High
            typeId: null,
            statusId: null,
            createdById: activity.caseDetail.agentId,
            isAuto: 1, //Auto reminder
          });
        }

        if (remindersToCreate.length > 0) {
          const created = await Reminder.bulkCreate(remindersToCreate, {
            returning: true,
          });
          return {
            reminderIds: created.map((r: any) => r.id || r.dataValues?.id),
            caseDetailIds: [...new Set(remindersToCreate.map((r: any) => r.caseDetailId))],
          };
        }

        return { reminderIds: [], caseDetailIds: [] };
      };

      const [
        condition1Activities,
        condition2Activities,
        condition3Activities,
        condition4Activities,
      ]: any = await Promise.all([
        // Condition 1: aspActivityStatusId = 2 (Asp assigned) - aspServiceAcceptedAt + threshold mins crossed but aspStartedToBreakdownAt is null
        Activities.findAll({
          attributes: ["id"],
          where: {
            aspActivityStatusId: { [Op.in]: [1, 2] }, // Accepted or Waiting for Service Initiation
            aspServiceAcceptedAt: {
              [Op.ne]: null,
            },
            aspStartedToBreakdownAt: null,
            [Op.and]: [
              Sequelize.literal(
                `DATE_ADD(aspServiceAcceptedAt, INTERVAL ${reminderThresholdMinutes} MINUTE) < NOW()`
              ),
            ],
          },
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id", "caseNumber", "agentId"],
              where: {
                statusId: 2,
                typeId: 31, // RSA
              },
            },
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id", "serviceId"],
            },
          ],
        }),

        // Condition 2: aspActivityStatusId = 14 (Started to BD) - aspStartedToBreakdownAt + threshold mins crossed but aspReachedToBreakdownAt is null
        Activities.findAll({
          attributes: ["id"],
          where: {
            aspActivityStatusId: 14, // Started to BD
            aspStartedToBreakdownAt: {
              [Op.ne]: null,
            },
            aspReachedToBreakdownAt: null,
            [Op.and]: [
              Sequelize.literal(
                `DATE_ADD(aspStartedToBreakdownAt, INTERVAL ${reminderThresholdMinutes} MINUTE) < NOW()`
              ),
            ],
          },
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id", "caseNumber", "agentId"],
              where: {
                statusId: 2,
                typeId: 31, // RSA
              },
            },
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id", "serviceId"],
            },
          ],
        }),

        // Condition 3: aspActivityStatusId = 15 (Reached BD) - aspReachedToBreakdownAt + threshold mins crossed but aspStartedToDropAt is null (only for towing: serviceId = 1)
        Activities.findAll({
          attributes: ["id"],
          where: {
            aspActivityStatusId: 15, // Reached BD
            aspReachedToBreakdownAt: {
              [Op.ne]: null,
            },
            aspStartedToDropAt: null,
            [Op.and]: [
              Sequelize.literal(
                `DATE_ADD(aspReachedToBreakdownAt, INTERVAL ${reminderThresholdMinutes} MINUTE) < NOW()`
              ),
            ],
          },
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id", "caseNumber", "agentId"],
              where: {
                statusId: 2,
                typeId: 31, // RSA
              },
            },
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id", "serviceId"],
              where: {
                serviceId: 1, // Towing service
              },
            },
          ],
        }),

        // Condition 4: aspActivityStatusId = 5 (Started to Drop) - aspStartedToDropAt + threshold mins crossed but aspReachedToDropAt is null (only for towing: serviceId = 1)
        Activities.findAll({
          attributes: ["id"],
          where: {
            aspActivityStatusId: 5, // Started to Drop
            aspStartedToDropAt: {
              [Op.ne]: null,
            },
            aspReachedToDropAt: null,
            [Op.and]: [
              Sequelize.literal(
                `DATE_ADD(aspStartedToDropAt, INTERVAL ${reminderThresholdMinutes} MINUTE) < NOW()`
              ),
            ],
          },
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id", "caseNumber", "agentId"],
              where: {
                statusId: 2,
                typeId: 31, // RSA
              },
            },
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id", "serviceId"],
              where: {
                serviceId: 1, // Towing service
              },
            },
          ],
        }),
      ]);

      const [reminders1, reminders2, reminders3, reminders4]: Array<{ reminderIds: any[]; caseDetailIds: any[] }> = await Promise.all([
        processCondition(
          condition1Activities,
          "Asp assigned but not started to BD",
          (caseNumber: string) =>
            `Case ${caseNumber}: Activity has been assigned to ASP but not started to breakdown location for more than ${reminderThresholdMinutes} minutes.`
        ),
        processCondition(
          condition2Activities,
          "Started to BD but not reached BD",
          (caseNumber: string) =>
            `Case ${caseNumber}: Activity has started to breakdown location but not reached for more than ${reminderThresholdMinutes} minutes.`
        ),
        processCondition(
          condition3Activities,
          "Reached BD but not started to Drop",
          (caseNumber: string) =>
            `Case ${caseNumber}: Activity has reached breakdown location but not started to drop location for more than ${reminderThresholdMinutes} minutes.`
        ),
        processCondition(
          condition4Activities,
          "Started to Drop but not reached to Drop",
          (caseNumber: string) =>
            `Case ${caseNumber}: Activity has started to drop location but not reached for more than ${reminderThresholdMinutes} minutes.`
        ),
      ]);

      createdReminders.push(...reminders1.reminderIds, ...reminders2.reminderIds, ...reminders3.reminderIds, ...reminders4.reminderIds);
      
      const uniqueCaseDetailIds = [...new Set([
        ...reminders1.caseDetailIds,
        ...reminders2.caseDetailIds,
        ...reminders3.caseDetailIds,
        ...reminders4.caseDetailIds,
      ])];

      if (createdReminders.length > 0) {
        Utils.createReportSyncTableRecord(
          "remindersReportDetails",
          createdReminders
        );
      }

      // Sync client report details, client report with mobile number details
      if (uniqueCaseDetailIds.length > 0) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          uniqueCaseDetailIds
        );
      }

      return res.status(200).json({
        success: true,
        message: "Auto reminders processed successfully",
        data: {
          remindersCreated: createdReminders.length,
          reminderIds: createdReminders,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default reminderController;
