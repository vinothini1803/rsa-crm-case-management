import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import {
  Activities,
  ActivityAspDetails,
  ActivityAspLiveLocations,
  ActivityTransactions,
  CaseDetails,
  CaseSla,
  ActivityLogs,
} from "../database/models/index";
import { Op, where } from "sequelize";
import notificationController from "./notificationController";
const config = require("../config/config.json");
import axios from "axios";
import caseSla from "../database/models/caseSla";
import moment from "moment-timezone";
import Utils from "../lib/utils";

export namespace caseSlaController {
  const defaultLimit = 10;
  const defaultOffset = 0;
  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  //API with endpoint (Master);
  const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
  const endpointMaster = config.MasterService.endpoint;

  //GET CASES THAT ARE IN OPEN AND INPROGRESS TO UPDATE SLA
  export async function getSlaCases(req: Request, res: Response) {
    try {
      const caseDetails: any = await CaseDetails.findAll({
        attributes: [
          "id",
          "caseNumber",
          "agentId",
          "agentAssignedAt",
          "subjectID",
          "deliveryRequestSubServiceId",
          "statusId",
          "deliveryRequestPickupDate",
          "deliveryRequestPickupTime",
          "dealerId",
          "deliveryRequestDropDealerId",
          "deliveryRequestCreatedDealerId",
          "createdAt",
        ],
        where: {
          statusId: {
            [Op.in]: [1, 2], //OPEN || INPROGRESS
          },
          typeId: 32, //VDM
        },
        order: [["id", "asc"]],
        include: [
          {
            model: Activities,
            attributes: [
              "id",
              "aspServiceAcceptedAt",
              "sentApprovalAt",
              "aspReachedToPickupAt",
              "dealerAdvanceInitialWarningSent",
              "dealerAdvanceFinalWarningSent",
              "dealerAdvanceEscalationSent",
            ],
            where: {
              activityStatusId: {
                [Op.notIn]: [4, 5, 8], // 4) Cancelled, 5) Failure, 8) Rejected
              },
            },
            required: false,
            separate: true,
            order: [["id", "DESC"]],
            include: [
              {
                model: ActivityTransactions,
                attributes: ["activityId", "paidAt"],
                where: {
                  paymentTypeId: 170, //ADVANCE
                  transactionTypeId: 181, //DEBIT
                  paymentStatusId: 191, //SUCCESS
                },
                limit: 1,
                required: false,
              },
            ],
          },
        ],
      });

      if (caseDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Case data fetched successfully",
        data: caseDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Create Sla For Based On Case and Activity
  export async function addCaseSla(req: Request, res: Response) {
    try {
      const inData = req.body;

      const slaDetails = inData.slaDetails;
      if (slaDetails.length == 0) {
        return res.status(200).json({
          success: false,
          message: "SLA detail not found",
        });
      }

      // if (inData.activityId) {
      //   await CaseSla.destroy({
      //     where: {
      //       caseDetailId: inData.caseDetailId,
      //       activityId: {
      //         [Op.is]: null,
      //       },
      //     },
      //   });
      // }

      for (const slaDetail of slaDetails) {
        const caseSlaInputData = {
          caseDetailId: inData.caseDetailId,
          activityId: inData.activityId,
          slaConfigId: slaDetail.id,
          slaStatus: slaDetail.status,
          statusColor: slaDetail.statusColor,
        };

        const caseSlaWhere: any = {};
        caseSlaWhere.caseDetailId = inData.caseDetailId;
        caseSlaWhere.slaConfigId = slaDetail.id;
        if (slaDetail.id != 360) {
          //NOT AGENT ASSIGNMENT
          caseSlaWhere.activityId = inData.activityId;
        }

        const caseSlaExists: any = await CaseSla.findOne({
          // where: {
          //   caseDetailId: inData.caseDetailId,
          //   activityId: inData.activityId,
          //   slaConfigId: slaDetail.id,
          // },
          where: caseSlaWhere,
        });
        if (!caseSlaExists) {
          await CaseSla.create(caseSlaInputData);
        } else {
          await CaseSla.update(caseSlaInputData, {
            // where: {
            //   caseDetailId: inData.caseDetailId,
            //   activityId: inData.activityId,
            //   slaConfigId: slaDetail.id,
            // },
            where: caseSlaWhere,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "SLA Created Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function autoCaseCancel(req: Request, res: Response) {
    try {
      const inData = req.validBody;
      const activityExists: any = await Activities.findOne({
        where: {
          id: inData.activityId,
        },
        attributes: ["id", "caseDetailId"],
        include: {
          model: CaseDetails,
          required: true,
          attributes: ["id", "caseNumber"],
        },
      });
      if (!activityExists) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      //CHECK ACTIVE ACTIVITY IS AVAILABLE
      const activeActivityExists = await Activities.findOne({
        where: {
          id: {
            [Op.ne]: inData.activityId,
          },
          caseDetailId: activityExists.dataValues.caseDetailId,
          activityStatusId: {
            [Op.in]: [3, 4, 7, 10, 11, 12, 14], //[IN PROGRESS, CANCELLED, SUCCESSFUL, ADVANCE PAYMENT PAID, BALANCE PAYMENT PENDING, EXCESS AMOUNT CREDIT PENDING, ADVANCE PAY LATER]
          },
          financeStatusId: {
            [Op.in]: [1, 2], //[MATURED, MATURED - EMPTY RETURN]
          },
        },
      });

      await Activities.update(
        {
          activityStatusId: 4, //CANCELLED
          aspActivityStatusId: 10, //CANCEL
          financeStatusId: 3, //NOT MATURED
        },
        {
          where: { id: inData.activityId },
        }
      );

      if (inData.previousActivityPaidByDealerId) {
        //FCM PUSH NOTIFICATIONS (PAID BY DEALER ONLY)
        notificationController.sendNotification({
          caseDetailId: activityExists.dataValues.caseDetailId,
          notifyToAll: [""],
          templateId: 48,
          paidByDealerDetail: inData.previousActivityPaidByDealerId,
          paidByDealerOnly: true,
        });
      } else {
        //FCM PUSH NOTIFICATIONS (CREATED DEALER)
        notificationController.sendNotification({
          caseDetailId: activityExists.dataValues.caseDetailId,
          notifyToAll: [""],
          templateId: 48,
        });
      }

      await ActivityLogs.create({
        activityId: inData.activityId,
        typeId: 240,
        title:
          "The service request was cancelled automatically due to a dealer advance payment SLA violation.",
      });

      let cancellationEmailSubject = "Service Request Cancellation";
      let cancellationEmailContent = `The service request against the Delivery Request ${activityExists.caseDetail.dataValues.caseNumber} was cancelled automatically due to a dealer advance payment SLA violation.`;

      //ACTIVE ACTIVITY NOT EXISTS THEN CANCEL CASE
      if (!activeActivityExists) {
        await CaseDetails.update(
          { statusId: 3 }, //CANCELLED
          { where: { id: activityExists.dataValues.caseDetailId } }
        );

        if (inData.previousActivityPaidByDealerId) {
          //FCM PUSH NOTIFICATIONS (PAID BY DEALER ONLY)
          notificationController.sendNotification({
            caseDetailId: activityExists.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 49,
            paidByDealerDetail: inData.previousActivityPaidByDealerId,
            paidByDealerOnly: true,
          });
        } else {
          //FCM PUSH NOTIFICATIONS (CREATED DEALER)
          notificationController.sendNotification({
            caseDetailId: activityExists.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 49,
          });
        }

        await ActivityLogs.create({
          caseDetailId: activityExists.dataValues.caseDetailId,
          typeId: 240, //WEB
          title:
            "The delivery request was cancelled automatically due to a dealer advance payment SLA violation.",
        });

        cancellationEmailSubject = "Delivery Request Cancellation";
        cancellationEmailContent = `The delivery request ${activityExists.caseDetail.dataValues.caseNumber} was cancelled automatically due to a dealer advance payment SLA violation.`;
      }

      return res.status(200).json({
        success: true,
        message: "Case and Activity Cancelled Successfully",
        data: {
          cancellationEmailSubject,
          cancellationEmailContent,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateDealerAdvanceSlaWarningStatus(
    req: Request,
    res: Response
  ) {
    try {
      const inData = req.validBody;
      const activityExists = await Activities.findOne({
        where: {
          id: inData.activityId,
        },
        attributes: ["id", "caseDetailId"],
      });
      if (!activityExists) {
        return res.status(200).json({
          success: false,
          message: "Activity not found",
        });
      }

      if (inData.time === "initialWarning") {
        if (inData.previousActivityPaidByDealerId) {
          //FCM PUSH NOTIFICATIONS (PAID BY DEALER ONLY)
          notificationController.sendNotification({
            caseDetailId: activityExists.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 45,
            paidByDealerDetail: inData.previousActivityPaidByDealerId,
            paidByDealerOnly: true,
          });
        } else {
          //FCM PUSH NOTIFICATIONS (ALL THE DEALERS)
          notificationController.sendNotification({
            caseDetailId: activityExists.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 45,
          });
        }
        await Activities.update(
          { dealerAdvanceInitialWarningSent: 1 },
          {
            where: {
              id: inData.activityId,
            },
          }
        );
        return res.status(200).json({
          success: true,
        });
      } else if (inData.time === "finalWarning") {
        if (inData.previousActivityPaidByDealerId) {
          //FCM PUSH NOTIFICATIONS (PAID BY DEALER ONLY)
          notificationController.sendNotification({
            caseDetailId: activityExists.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 46,
            paidByDealerDetail: inData.previousActivityPaidByDealerId,
            paidByDealerOnly: true,
          });
        } else {
          //FCM PUSH NOTIFICATIONS (ALL THE DEALERS)
          notificationController.sendNotification({
            caseDetailId: activityExists.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 46,
          });
        }
        await Activities.update(
          { dealerAdvanceFinalWarningSent: 1 },
          {
            where: {
              id: inData.activityId,
            },
          }
        );
        return res.status(200).json({
          success: true,
        });
      } else if (inData.time === "escalation") {
        //FCM PUSH NOTIFICATIONS (AGENT)
        notificationController.sendNotification({
          caseDetailId: activityExists.dataValues.caseDetailId,
          notifyToAll: [""],
          templateId: 47,
        });
        await Activities.update(
          { dealerAdvanceEscalationSent: 1 },
          {
            where: {
              id: inData.activityId,
            },
          }
        );
        return res.status(200).json({
          success: true,
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getSlaListByCaseDetailId(req: Request, res: Response) {
    try {
      const { caseDetailId } = req.body;
      if (!caseDetailId) {
        return res.status(200).json({
          success: false,
          error: "Case Detail ID is required",
        });
      }
      const slaExists: any = await CaseSla.findOne({
        where: { caseDetailId: caseDetailId },
        attributes: ["id", "slaConfigId", "slaStatus", "statusColor"],
        order: [["id", "desc"]],
      });

      if (!slaExists) {
        return res.status(200).json({
          success: false,
          error: "No SLA found",
        });
      }

      return res.status(200).json({
        success: true,
        data: slaExists,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getAllSlaByCaseDetailId(req: Request, res: Response) {
    try {
      const { caseDetailId } = req.body;
      if (!caseDetailId) {
        return res.status(200).json({
          success: false,
          error: "Case Detail ID is required",
        });
      }
      const caseSla: any = await CaseSla.findAll({
        where: { caseDetailId: caseDetailId },
        attributes: ["id", "slaConfigId", "slaStatus", "statusColor"],
        order: [["id", "desc"]],
      });

      if (caseSla.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No SLA found",
        });
      }

      return res.status(200).json({
        success: true,
        data: caseSla,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //CHECK IF DEALER PAID ADVANCE AMOUNT FOR PREVIOUS ACTIVITY AGAINST CASE OR NOT. BASED ON THAT GET DEALERS
  export async function getDealersForDealerAdvancePaymentSla(
    req: Request,
    res: Response
  ) {
    try {
      const { activityId } = req.query;

      if (!activityId) {
        return res.status(200).json({
          success: false,
          message: "Activity ID is required",
        });
      }

      const activityExists: any = await Activities.findOne({
        where: {
          id: activityId,
        },
        attributes: ["id", "caseDetailId"],
        include: {
          model: CaseDetails,
          required: true,
          attributes: [
            "id",
            "dealerId",
            "deliveryRequestDropDealerId",
            "deliveryRequestCreatedDealerId",
          ],
        },
      });
      if (!activityExists) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const advanceAmountPaidForOherActivityExists: any =
        await ActivityTransactions.findOne({
          attributes: ["id", "paidByDealerId"],
          where: {
            paymentTypeId: 170, //ADVANCE AMOUNT
            transactionTypeId: 181, //DEBIT
            paymentStatusId: 191, //SUCCESS
          },
          include: [
            {
              model: Activities,
              attributes: [],
              required: true,
              where: {
                caseDetailId: activityExists.dataValues.caseDetailId,
                id: {
                  [Op.ne]: activityId,
                },
              },
              order: [["id", "asc"]],
            },
          ],
        });

      const notyDealerIds = [];
      let previousActivityPaidByDealerId = null;
      if (advanceAmountPaidForOherActivityExists) {
        notyDealerIds.push(
          advanceAmountPaidForOherActivityExists.dataValues.paidByDealerId
        );
        previousActivityPaidByDealerId =
          advanceAmountPaidForOherActivityExists.dataValues.paidByDealerId;
      } else {
        notyDealerIds.push(
          activityExists.caseDetail.dataValues.dealerId,
          activityExists.caseDetail.dataValues.deliveryRequestDropDealerId,
          activityExists.caseDetail.dataValues.deliveryRequestCreatedDealerId
        );
      }
      let eligibleDealerIdsToSendNoty = [...new Set(notyDealerIds)];
      return res.status(200).json({
        success: true,
        data: {
          eligibleDealerIdsToSendNoty,
          previousActivityPaidByDealerId,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
  //Create Sla For Based On Case and Activity
  export async function updateCaseSlaViolateReason(payload: any) {
    try {
      const where: any = {};
      where.caseDetailId = payload.caseDetailId;
      where.slaConfigId = payload.slaConfigId;

      //OTHER THAN AGENT ASSIGNMENT
      if (payload.slaConfigId != 360) {
        where.activityId = payload.activityId;
      }

      const caseSlaExists: any = await CaseSla.findOne({
        attributes: ["id"],
        where,
      });
      if (caseSlaExists) {
        const updateCaseSla = {
          ...payload,
          updatedById: payload.userId,
        };

        await CaseSla.update(updateCaseSla, {
          where: { id: caseSlaExists.dataValues.id },
          transaction: payload.transaction ? payload.transaction : undefined,
        });
      } else {
        await CaseSla.create(payload, {
          transaction: payload.transaction ? payload.transaction : undefined,
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

  export async function agentAssignViolationCheck(payload: any) {
    try {
      const caseDetail: any = await CaseDetails.findOne({
        attributes: ["id", "typeId", "createdAt"],
        where: { id: payload.caseDetailId },
      });
      if (!caseDetail) {
        return {
          success: false,
          error: "Case detail not found",
        };
      }

      const agentAssignmentSlaSetting = await axios.post(
        `${masterService}/${endpointMaster.sla.getByCaseTypeAndTypeId}`,
        {
          caseTypeId: caseDetail.typeId,
          typeId: 360, //Agent Assignment
        }
      );
      if (!agentAssignmentSlaSetting.data.success) {
        return agentAssignmentSlaSetting.data;
      }

      const createdAtPlusAgentAssignSlaTime = moment
        .tz(caseDetail.createdAt, "Asia/Kolkata")
        .add(agentAssignmentSlaSetting.data.data.time, "seconds")
        .format("YYYY-MM-DD HH:mm:ss");
      const currentDate = moment()
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD HH:mm:ss");

      if (currentDate > createdAtPlusAgentAssignSlaTime) {
        //SLA VIOLATED
        if (!payload.slaViolateReasonId) {
          return {
            success: false,
            error: "SLA violation reason is required",
          };
        }

        //IF LOGGED USER IS NOT AN AGENT
        if (![3].includes(payload.authUserRoleId)) {
          return {
            success: false,
            error: `Only agent can update the SLA violate reason`,
          };
        }

        //GET SLA VIOLATE REASON
        const getSlaViolateReason: any = await Utils.getSlaViolateReason(
          payload.slaViolateReasonId
        );
        if (!getSlaViolateReason.data.success) {
          return getSlaViolateReason.data;
        }

        const slaViolateReasonUpdateRequest = {
          caseDetailId: payload.caseDetailId,
          activityId: null,
          slaConfigId: 360, //AGENT ASSIGNMENT
          slaStatus: "SLA Violated",
          statusColor: "red",
          userId: payload.authUserId,
          violateReasonId: payload.slaViolateReasonId,
          violateReasonComments: payload.slaViolateReasonComments
            ? payload.slaViolateReasonComments
            : null,
          transaction: payload.transaction,
        };
        const slaViolateReasonUpdateResponse: any =
          await updateCaseSlaViolateReason(slaViolateReasonUpdateRequest);
        if (!slaViolateReasonUpdateResponse.success) {
          return slaViolateReasonUpdateResponse;
        }
      }

      return {
        success: true,
        message: "Agent assignment violation checked successfully",
      };
    } catch (error: any) {
      throw error;
    }
  }

  export async function aspAcceptanceViolationCheck(payload: any) {
    try {
      const activity: any = await Activities.findOne({
        attributes: ["id"],
        where: { id: payload.activityId },
        include: {
          model: CaseDetails,
          attributes: ["id", "typeId", "agentAssignedAt"],
          required: true,
        },
      });
      if (!activity) {
        return {
          success: false,
          error: "Activity not found",
        };
      }

      const aspAcceptanceSlaSetting = await axios.post(
        `${masterService}/${endpointMaster.sla.getByCaseTypeAndTypeId}`,
        {
          caseTypeId: activity.caseDetail.typeId,
          typeId: 361, //ASP Assignment & Acceptance
        }
      );
      if (!aspAcceptanceSlaSetting.data.success) {
        return aspAcceptanceSlaSetting.data;
      }

      const agentAssignedAtPlusSlaTime = moment
        .tz(activity.caseDetail.agentAssignedAt, "Asia/Kolkata")
        .add(aspAcceptanceSlaSetting.data.data.time, "seconds")
        .format("YYYY-MM-DD HH:mm:ss");
      const currentDate = moment()
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD HH:mm:ss");

      if (currentDate > agentAssignedAtPlusSlaTime) {
        //SLA VIOLATED
        if (!payload.slaViolateReasonId) {
          return {
            success: false,
            error: "SLA violation reason is required",
          };
        }

        //IF LOGGED USER IS NOT (AGENT/ASP/ASP MECHANIC)
        if (![3, 4, 5].includes(payload.authUserRoleId)) {
          return {
            success: false,
            error: `Only Agent or ASP or Mechanic can update the SLA violate reason`,
          };
        }

        //GET SLA VIOLATE REASON
        const getSlaViolateReason: any = await Utils.getSlaViolateReason(
          payload.slaViolateReasonId
        );
        if (!getSlaViolateReason.data.success) {
          return getSlaViolateReason.data;
        }

        const slaViolateReasonUpdateRequest = {
          caseDetailId: activity.caseDetail.id,
          activityId: activity.id,
          slaConfigId: 361, //ASP Assignment & Acceptance
          slaStatus: "SLA Violated",
          statusColor: "red",
          userId: payload.authUserId,
          violateReasonId: payload.slaViolateReasonId,
          violateReasonComments: payload.slaViolateReasonComments
            ? payload.slaViolateReasonComments
            : null,
          transaction: payload.transaction,
        };

        const slaViolateReasonUpdateResponse: any =
          await updateCaseSlaViolateReason(slaViolateReasonUpdateRequest);
        if (!slaViolateReasonUpdateResponse.success) {
          return slaViolateReasonUpdateResponse;
        }
      }

      return {
        success: true,
        message: "Asp acceptance violation checked successfully",
      };
    } catch (error: any) {
      throw error;
    }
  }

  export async function dealerAdvancePaymentViolationCheck(payload: any) {
    try {
      const activity: any = await Activities.findOne({
        attributes: ["id", "sentApprovalAt"],
        where: { id: payload.activityId },
        include: {
          model: CaseDetails,
          attributes: ["id", "typeId"],
          required: true,
        },
      });
      if (!activity) {
        return {
          success: false,
          error: "Activity not found",
        };
      }

      const dealerAdvancePaymentSlaSetting = await axios.post(
        `${masterService}/${endpointMaster.sla.getByCaseTypeAndTypeId}`,
        {
          caseTypeId: activity.caseDetail.typeId,
          typeId: 363, //Dealer Advance Payment - Final Warning
        }
      );
      if (!dealerAdvancePaymentSlaSetting.data.success) {
        return dealerAdvancePaymentSlaSetting.data;
      }

      const sentApprovalAtPlusSlaTime = moment
        .tz(activity.sentApprovalAt, "Asia/Kolkata")
        .add(dealerAdvancePaymentSlaSetting.data.data.time, "seconds")
        .format("YYYY-MM-DD HH:mm:ss");
      const currentDate = moment()
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD HH:mm:ss");

      if (currentDate > sentApprovalAtPlusSlaTime) {
        //SLA VIOLATED
        if (!payload.slaViolateReasonId) {
          return {
            success: false,
            error: "SLA violation reason is required",
          };
        }

        //IF LOGGED USER IS NOT DEALER
        if (![2].includes(payload.authUserRoleId)) {
          return {
            success: false,
            error: `Only dealer can update the SLA violate reason`,
          };
        }

        //GET SLA VIOLATE REASON
        const getSlaViolateReason: any = await Utils.getSlaViolateReason(
          payload.slaViolateReasonId
        );
        if (!getSlaViolateReason.data.success) {
          return getSlaViolateReason.data;
        }

        const slaViolateReasonUpdateRequest = {
          caseDetailId: activity.caseDetail.id,
          activityId: activity.id,
          slaConfigId: 363, //Dealer Advance Payment - Final Warning
          slaStatus: "SLA Violated",
          statusColor: "red",
          userId: payload.authUserId,
          violateReasonId: payload.slaViolateReasonId,
          violateReasonComments: payload.slaViolateReasonComments
            ? payload.slaViolateReasonComments
            : null,
          transaction: payload.transaction,
        };

        const slaViolateReasonUpdateResponse: any =
          await updateCaseSlaViolateReason(slaViolateReasonUpdateRequest);
        if (!slaViolateReasonUpdateResponse.success) {
          return slaViolateReasonUpdateResponse;
        }
      }

      return {
        success: true,
        message: "Dealer advance payment violation checked successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export async function aspReachedPickupViolationCheck(payload: any) {
    try {
      const activity: any = await Activities.findOne({
        attributes: ["id"],
        where: { id: payload.activityId },
        include: {
          model: CaseDetails,
          attributes: [
            "id",
            "deliveryRequestPickupDate",
            "deliveryRequestPickupTime",
          ],
          required: true,
        },
      });
      if (!activity) {
        return {
          success: false,
          error: "Activity not found",
        };
      }

      const [startHour, endHour] =
        activity.caseDetail.deliveryRequestPickupTime.split(" - ");
      const actualEndHour = Utils.timeConvert(endHour);
      const expectedPickupDateAndTime = `${moment
        .tz(activity.caseDetail.deliveryRequestPickupDate, "Asia/Kolkata")
        .format("YYYY-MM-DD")} ${actualEndHour}:00:00`;
      const currentDate = moment()
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD HH:mm:ss");

      if (currentDate > expectedPickupDateAndTime) {
        //SLA VIOLATED
        if (!payload.slaViolateReasonId) {
          return {
            success: false,
            error: "SLA violation reason is required",
          };
        }

        //IF LOGGED USER IS NOT (AGENT/ASP/ASP MECHANIC)
        if (![3, 4, 5].includes(payload.authUserRoleId)) {
          return {
            success: false,
            error: `Only Agent or ASP or Mechanic can update the SLA violate reason`,
          };
        }

        //GET SLA VIOLATE REASON
        const getSlaViolateReason: any = await Utils.getSlaViolateReason(
          payload.slaViolateReasonId
        );
        if (!getSlaViolateReason.data.success) {
          return getSlaViolateReason.data;
        }

        const slaViolateReasonUpdateRequest = {
          caseDetailId: activity.caseDetail.id,
          activityId: activity.id,
          slaConfigId: 365, //ASP Reached Pickup
          slaStatus: "SLA Violated",
          statusColor: "red",
          userId: payload.authUserId,
          violateReasonId: payload.slaViolateReasonId,
          violateReasonComments: payload.slaViolateReasonComments
            ? payload.slaViolateReasonComments
            : null,
          transaction: payload.transaction,
        };

        const slaViolateReasonUpdateResponse: any =
          await updateCaseSlaViolateReason(slaViolateReasonUpdateRequest);
        if (!slaViolateReasonUpdateResponse.success) {
          return slaViolateReasonUpdateResponse;
        }
      }

      return {
        success: true,
        message: "ASP reached pickup violation checked successfully",
      };
    } catch (error: any) {
      throw error;
    }
  }
}
