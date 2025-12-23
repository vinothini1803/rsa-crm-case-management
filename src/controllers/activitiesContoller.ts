import { Request, Response } from "express";
import activities from "../database/models/activities";
import { Op, where, Sequelize } from "sequelize";
import sequelize from "../database/connection";
import {
  CaseDetails,
  Activities,
  ActivityAspDetails,
  ActivityInventories,
  ActivityDetails,
  ActivityCharges,
  ActivityTransactions,
  ActivityAspRateCards,
  ActivityClientRateCards,
  ActivityLogs,
  ActivityAspLiveLocations,
  CaseInformation,
  RsaActivityInventory,
  CallInitiation,
  ApiLogs,
  Templates,
  TemplateSmsDetails,
  CaseSla,
  links,
  CrmSla,
} from "../database/models/index";
import sendEmail from "../lib/mailer";
import activityAspDetails from "../database/models/activityAspDetails";
import caseDetails from "../database/models/caseDetails";
import { caseSlaController } from "./caseSla";
import axios from "axios";
const config = require("../config/config.json");
import { sendSms, smsInfo } from "../lib/sms";
import dotenv from "dotenv";
import notificationController from "./notificationController";
import moment from "moment-timezone";
import Utils from "../lib/utils";
import attachments from "../database/models/attachments";
import {
  getCustomerService,
  getNotesInformation,
} from "../controllers/customerService";
import { sendEscalationSms } from "../controllers/template";
import { getActivityCharge } from "./activityCharges";
import emailNotification from "../lib/emailNotification";

import { crmSlaController } from "./crmSla";
import { createLinkAndSendSmsToTarget } from "./linksController";
import { getComparisionDate } from "./crmSla";
dotenv.config();

//API with endpoint (API Gateway);
const apiGatewayService = `${config.apiGatewayService.host}:${config.apiGatewayService.port}/${config.apiGatewayService.version}`;
const endpointApiGateway = config.apiGatewayService.endpoint;

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

const userServiceBaseUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceBaseEndpoint = config.userService.endpoint;

export namespace activitiesController {
  const defaultLimit = 10;
  const defaultOffset = 0;

  const getKmComparisonThreshold = (): number => {
    const threshold = Number(process.env.ADDITIONAL_KM_COMPARISON_THRESHOLD);
    if (Number.isFinite(threshold) && threshold >= 0) {
      return threshold;
    }
    return 5;
  };

  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  //SubMaster (Master) Access;
  const subMasterDealers = `${config.MasterService.serviceAccess.dealers}`;
  const subMasterClients = `${config.MasterService.serviceAccess.clients}`;

  //CHECK ASP HAS ACTIVITY FOR CASE DETAIL AND GIVE ACTIVITY ID - FOR NEAREST SERVICE PROVIDER LIST API
  export async function getAspActivityId(req: Request, res: Response) {
    try {
      const { aspId, caseDetailId, subServiceId } = req.body;
      const activityAspDetailWhere: any = {};
      activityAspDetailWhere.aspId = aspId;
      if (subServiceId) {
        activityAspDetailWhere.subServiceId = subServiceId;
      }

      const aspActivityDetail = await ActivityAspDetails.findOne({
        where: activityAspDetailWhere,
        attributes: ["id", "activityId", "aspMechanicId"],
        include: {
          model: Activities,
          attributes: ["id"],
          required: true,
          where: {
            caseDetailId: caseDetailId,
            activityStatusId: {
              [Op.notIn]: [4, 8], //4 - Cancelled, 8 - Rejected
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "success",
        data: aspActivityDetail
          ? aspActivityDetail.dataValues.activityId
          : null,
        isTechnicianAssigned: aspActivityDetail && aspActivityDetail.dataValues.aspMechanicId ? true : false,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //CHECK ASP HAS REJECTED ACTIVITY FOR THE CASE AND SUB SERVICE - FOR NEAREST SERVICE PROVIDER LIST API 
  export async function getAspRejectedActivity(req: Request, res: Response) {
    try {
      const { aspId, caseDetailId, subServiceId } = req.body;
      const activityAspDetailWhere: any = {};
      activityAspDetailWhere.aspId = aspId;
      if (subServiceId) {
        activityAspDetailWhere.subServiceId = subServiceId;
      }

      const aspActivityDetail = await ActivityAspDetails.findOne({
        where: activityAspDetailWhere,
        attributes: ["id", "activityId"],
        include: {
          model: Activities,
          attributes: ["id"],
          required: true,
          where: {
            caseDetailId: caseDetailId,
            activityStatusId: 8, //8 - Rejected
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "success",
        activityExists: aspActivityDetail ? true : false,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET CASE ASSIGNED COUNT FOR SERVICE SCHEDULED DATE FOR ASP - FOR NEAREST SERVICE PROVIDER LIST API
  export async function getAspCaseAssignedCountForScheduledDate(req: Request, res: Response) {
    try {
      const { aspId, serviceScheduledDate } = req.body;

      if (!aspId || !serviceScheduledDate) {
        return res.status(200).json({
          success: true,
          message: "success",
          data: 0,
        });
      }

      // Query to get count of cases assigned for service scheduled date for ASP
      // Following the pattern from getAspWorkStatus function
      const activityStatusIds = [1, 4, 5, 8]; // 1) Open, 4) Cancelled, 5) Failure, 8) Rejected
      const [
        assignedVdmCount,
        assignedCrmInitialAndImmediateCount,
        assignedCrmInitialAndLaterCount,
        assignedCrmNotInitialCount,
      ] = await Promise.all([
        ActivityAspDetails.count(
          getAssignedCountBaseQuery(
            aspId,
            activityStatusIds,
            serviceScheduledDate,
            null,
            null
          )
        ),
        // INITIAL CREATED & IMMEDIATE SERVICE
        ActivityAspDetails.count(
          getAssignedCountBaseQuery(
            aspId,
            activityStatusIds,
            serviceScheduledDate,
            1,
            1
          )
        ),
        // INITIAL CREATED & LATER SERVICE
        ActivityAspDetails.count(
          getAssignedCountBaseQuery(
            aspId,
            activityStatusIds,
            serviceScheduledDate,
            1,
            0
          )
        ),
        // NOT INITIAL CREATED CASE
        ActivityAspDetails.count(
          getAssignedCountBaseQuery(
            aspId,
            activityStatusIds,
            serviceScheduledDate,
            0,
            null
          )
        ),
      ]);

      // Sum all counts
      const totalCount =
        assignedVdmCount +
        assignedCrmInitialAndImmediateCount +
        assignedCrmInitialAndLaterCount +
        assignedCrmNotInitialCount;

      return res.status(200).json({
        success: true,
        message: "success",
        data: totalCount,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //WE HAVE DUPLICATED THIS FUNCTION CODE FOR ASP OVER ALL MAP VIEW PURPOSE (getAspsWorkStatusDetails) SO MAKE CHANGES IN BOTH FUNCTIONS
  //CHECK ASP WORK STATUS BASED ON PICKUP DATE AND DRIVERS AVAILABILITY
  export async function getAspWorkStatus(req: Request, res: Response) {
    try {
      const { aspId, hasMechanic, aspMechanics, serviceScheduledDate } =
        req.body;
      let aspAvailable = true;
      let displaySendRequestBtn = true;

      const activityStatusIds = [1, 4, 5, 7, 8]; // 1) Open, 4) Cancelled, 5) Failure, 7) Successful, 8) Rejected
      const [
        scheduledVdmActivities,
        scheduledCrmInitialAndImmediateActivities,
        scheduledCrmInitialAndLaterActivities,
        scheduledCrmNotInitialActivities,
      ] = await Promise.all([
        ActivityAspDetails.findAll(
          getWorkStatusBaseQuery(
            aspId,
            null,
            activityStatusIds,
            serviceScheduledDate,
            null,
            null
          )
        ),
        // INITIAL CREATED & IMMEDIATE SERVICE
        ActivityAspDetails.findAll(
          getWorkStatusBaseQuery(
            aspId,
            null,
            activityStatusIds,
            serviceScheduledDate,
            1,
            1
          )
        ),
        // INITIAL CREATED & LATER SERVICE
        ActivityAspDetails.findAll(
          getWorkStatusBaseQuery(
            aspId,
            null,
            activityStatusIds,
            serviceScheduledDate,
            1,
            0
          )
        ),
        // NOT INITIAL CREATED CASE
        ActivityAspDetails.findAll(
          getWorkStatusBaseQuery(
            aspId,
            null,
            activityStatusIds,
            serviceScheduledDate,
            0,
            null
          )
        ),
      ]);

      // Merge all responses into a single array
      const aspScheduledActivities = [
        ...scheduledVdmActivities,
        ...scheduledCrmInitialAndImmediateActivities,
        ...scheduledCrmInitialAndLaterActivities,
        ...scheduledCrmNotInitialActivities,
      ];

      if (aspScheduledActivities.length > 0) {
        //HAS MECHANICS
        if (hasMechanic) {
          const aspScheduledMechanics = aspScheduledActivities.map(
            (aspHasScheduledActivity: any) =>
              aspHasScheduledActivity.dataValues.aspMechanicId
          );
          const uniqueAspScheduledMechanics = [
            ...new Set(aspScheduledMechanics),
          ].filter((value: any) => value !== null);

          // // IF ASP SCHEDULED MECHANICS COUNT MATCHED WITH TOTAL ASP MECHANICS LENGTH THEN HE IS BUSY
          // if (uniqueAspScheduledMechanics.length === aspMechanics.length) {
          //   aspAvailable = false;
          // }

          // GET UNSHEDULED ASP MECHANICS BY COMPARING THE ASP MECHANICS FROM MASTER WITH SCHEDULED ASP MECHANICS
          const unsheduledAspMechanics = aspMechanics
            .map((aspMechanic: any) => {
              if (!uniqueAspScheduledMechanics.includes(aspMechanic.id)) {
                return aspMechanic.id;
              }
              return null;
            })
            .filter((value: any) => value !== null);

          // IF UNSHEDULED ASP MECHANICS NOT AVAILABLE THEN ASP NOT AVAILABLE
          if (unsheduledAspMechanics.length == 0) {
            aspAvailable = false;
          }
        } else {
          aspAvailable = false;
        }

        //EVENTHOUGH ASP IS BUSY IF ANY ONE OF THE SCHEDULED DELIVERY REQUEST IS MOVED TO REACHED DROP LOCATION THEN ENABLE SEND REQUEST BUTTON
        if (!aspAvailable) {
          const aspScheduledActivityStatusIds = aspScheduledActivities.map(
            (aspHasScheduledActivity: any) =>
              aspHasScheduledActivity.activity.dataValues.aspActivityStatusId
          );

          //IF Reached Drop Location OR Started To Garage OR Reached Garage OR Activity Ended
          if (
            aspScheduledActivityStatusIds.includes(6) ||
            aspScheduledActivityStatusIds.includes(7) ||
            aspScheduledActivityStatusIds.includes(8) ||
            aspScheduledActivityStatusIds.includes(9)
          ) {
            displaySendRequestBtn = true;
          } else {
            displaySendRequestBtn = false;
          }
        }
      }

      const data = {
        aspAvailable: aspAvailable,
        displaySendRequestBtn: displaySendRequestBtn,
      };
      return res.status(200).json({
        success: true,
        message: "success",
        data: data,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //CHECK ASP MECHANIC WORK STATUS BASED ON DATE AVAILABILITY
  //USED IN GET NSP LOCATIONS & TECHNICIAN MAP VIEW
  export async function getAspMechanicWorkStatus(req: Request, res: Response) {
    try {
      const { aspMechanicId, serviceScheduledDate } = req.body;

      const result = await checkAspMechanicWorkStatus(aspMechanicId, serviceScheduledDate);

      return res.status(200).json({
        success: result.success,
        message: "success",
        data: result.data,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //ASP ASSIGNMENT GET ASP LIST (NOT USED)
  export async function getActivityAspList(req: Request, res: Response) {
    try {
      const inData = req.body.asps;
      const caseDetailId = req.body.caseDetailId;

      if (inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      if (!caseDetailId) {
        return res.status(200).json({
          success: false,
          error: "Case Detail ID is required",
        });
      }

      let aspActivityDetail: any;
      const finalData: any = [];
      for (var i = 0; i < inData.length; i++) {
        aspActivityDetail = await ActivityAspDetails.findOne({
          where: { aspId: inData[i].id },
          attributes: ["id", "activityId"],
          include: {
            model: Activities,
            attributes: ["id"],
            required: true,
            where: { caseDetailId: caseDetailId },
          },
        });
        await finalData.push({
          ...inData[i],
          activityId: aspActivityDetail
            ? aspActivityDetail.dataValues.activityId
            : null,
        });
      }
      return res.status(200).json({
        success: true,
        message: "success",
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //VALIDATE SEND REQUEST
  export async function validateSendRequest(req: Request, res: Response) {
    try {
      const inData = req.validBody;
      const [
        checkCaseIdExists,
        checkActivityAlreadyCreatedForAsp,
        checkActiveActivityAlreadyExists,
        getASPDetail,
      ]: any = await Promise.all([
        CaseDetails.findOne({
          where: {
            id: inData.caseDetailId,
            statusId: 2, // INPROGRESS
          },
          attributes: ["id", "typeId"],
        }),
        ActivityAspDetails.findOne({
          where: { aspId: inData.aspId, subServiceId: inData.subServiceId },
          attributes: ["id", "activityId"],
          include: {
            model: Activities,
            attributes: ["id"],
            required: true,
            where: {
              caseDetailId: inData.caseDetailId,
              activityStatusId: {
                [Op.notIn]: [4, 8], // 4) Cancelled, 8) Rejected
              },
            },
          },
        }),
        Activities.findOne({
          attributes: ["id", "activityStatusId", "financeStatusId"],
          where: {
            [Op.and]: [
              { caseDetailId: inData.caseDetailId },
              {
                activityStatusId: {
                  [Op.notIn]: [4, 5, 8], // 4) Cancelled, 5) Failure, 8) Rejected
                },
              },
            ],
          },
          include: [
            {
              model: ActivityAspDetails,
              attributes: ["id"],
              required: true,
              where: {
                subServiceId: inData.subServiceId,
                aspId: {
                  [Op.not]: null,
                },
              },
            },
          ],
        }),
        // GET ASP DETAILS TO CHECK IF IT'S COCO ASP
        Utils.getAspDetail(
          inData.aspId,
          false //paranoid false
        ),
      ]);

      if (!checkCaseIdExists) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      if (checkActivityAlreadyCreatedForAsp) {
        return res.status(200).json({
          success: false,
          error: "The send request has already been sent to the ASP",
        });
      }

      //FOR ADDITIONAL SERVICE REQUEST PURPOSE
      let ignoreActiveActivityExistsCondition = false;
      if (inData.ignoreActiveActivityExistsCondition) {
        ignoreActiveActivityExistsCondition =
          inData.ignoreActiveActivityExistsCondition;
      }
      //DO NOT ALLOW IF ACTIVITY STATUS OTHER THAN SUCCESS AND BALANCE PENDING AND EXCESS PENDING, IF ACTIVITY STATUS IS EITHER SUCCESS OR BALANCE PENDING OR EXCESS PENDING AND FINANCE STATUS IS MATURED
      if (
        checkActiveActivityAlreadyExists &&
        !ignoreActiveActivityExistsCondition
      ) {
        if (
          (checkActiveActivityAlreadyExists.dataValues.activityStatusId != 7 &&
            checkActiveActivityAlreadyExists.dataValues.activityStatusId !=
            11 &&
            checkActiveActivityAlreadyExists.dataValues.activityStatusId !=
            12) ||
          ((checkActiveActivityAlreadyExists.dataValues.activityStatusId == 7 ||
            checkActiveActivityAlreadyExists.dataValues.activityStatusId ==
            11 ||
            checkActiveActivityAlreadyExists.dataValues.activityStatusId ==
            12) &&
            checkActiveActivityAlreadyExists.dataValues.financeStatusId == 1)
        ) {
          return res.status(200).json({
            success: false,
            error: "The request has already been activated with another ASP",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Validation Successful",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Helper function to get KM for comparison based on nonMembershipType
  async function getKmForComparison(
    activity: any,
    activityAspDetail: any,
    usePaidKm: boolean = false
  ): Promise<number> {
    if (!activity) {
      return 0;
    }

    // If usePaidKm is true and paidTotalKm is available, use it (for previous KM that customer paid for)
    if (usePaidKm && activity.paidTotalKm) {
      return parseFloat(activity.paidTotalKm);
    }

    // Otherwise, use current estimated values (for new KM calculation)
    if (!activityAspDetail) {
      return 0;
    }

    const nonMembershipType = activity.nonMembershipType;

    if (nonMembershipType === "Excess Towing") {
      return activity.additionalChargeableKm
        ? parseFloat(activity.additionalChargeableKm)
        : 0;
    } else if (
      nonMembershipType === "Non Warranty Service" ||
      nonMembershipType === "One Time Paid Service"
    ) {
      return activityAspDetail.estimatedTotalKm
        ? parseFloat(activityAspDetail.estimatedTotalKm)
        : 0;
    }

    return 0;
  }

  // Helper function to switch transactions from canceled activity to new activity
  async function switchTransactionsFromCanceledOrRejectedActivity(
    canceledOrRejectedActivityId: number,
    newActivityId: number,
    authUserId: number,
    transaction: any
  ): Promise<{ success: boolean; transactionCount: number; error?: string }> {
    try {
      // Find all one-time service transactions from canceled activity
      const canceledOrRejectedActivityTransactions: any = await ActivityTransactions.findAll({
        where: {
          activityId: canceledOrRejectedActivityId,
          paymentTypeId: 174, // One time service
          paymentStatusId: 191, // Success
          refundStatusId: {
            [Op.or]: [
              {
                [Op.is]: null, // Refund not initiated
              },
              {
                [Op.eq]: 1303, // Refund failed
              },
            ],
          },
        },
        attributes: ["id", "membershipId"],
        transaction: transaction,
      });

      if (canceledOrRejectedActivityTransactions.length === 0) {
        return { success: true, transactionCount: 0 };
      }

      // Collect membership IDs
      const membershipIds: number[] = [];
      for (const canceledOrRejectedActivityTransaction of canceledOrRejectedActivityTransactions) {
        const transactionData: any =
          canceledOrRejectedActivityTransaction.dataValues || canceledOrRejectedActivityTransaction;
        if (transactionData.membershipId) {
          membershipIds.push(transactionData.membershipId);
        }

        // Update activityId to new activity
        await ActivityTransactions.update(
          {
            activityId: newActivityId,
            updatedById: authUserId,
          },
          {
            where: { id: transactionData.id },
            transaction: transaction as any,
          }
        );
      }

      await Promise.all([
        Activities.update(
          {
            paidTotalKm: null,
            hasAdditionalKmForPayment: null,
            additionalKmForPayment: null,
            paymentForAdditionalKmCaptured: null,
            customerAgreedToAdditionalPayment: null,
            additionalPaymentRemarks: null,
          },
          {
            where: { id: canceledOrRejectedActivityId },
            transaction: transaction,
          }
        ),
        ActivityAspDetails.update(
          {
            additionalKmEstimatedServiceCost: null,
            additionalKmDiscountPercentage: null,
            additionalKmDiscountAmount: null,
            additionalKmDiscountReasonId: null,
            additionalKmDiscountReason: null,
            additionalKmEstimatedTotalTax: null,
            additionalKmEstimatedTotalAmount: null,
          },
          {
            where: { activityId: canceledOrRejectedActivityId },
            transaction: transaction,
          }
        )
      ]);

      // Update RSA membership records with new activityId
      if (membershipIds.length > 0) {
        try {
          const updateRsaResponse = await axios.post(
            `${process.env.RSA_BASE_URL}/crm/update/membership/activityId`,
            {
              membershipIds: membershipIds,
              crmActivityId: newActivityId,
            }
          );

          if (!updateRsaResponse.data.success) {
            console.error(
              "Failed to update RSA membership activity IDs:",
              updateRsaResponse.data.error
            );
            // Continue even if RSA update fails - transaction mapping is still done
          }
        } catch (rsaError: any) {
          console.error(
            "Error updating RSA membership activity IDs:",
            rsaError.message
          );
          // Continue even if RSA update fails - transaction mapping is still done
        }
      }

      // // Create activity log for transaction switching
      // await ActivityLogs.create(
      //   {
      //     activityId: newActivityId,
      //     typeId: 240, // Web
      //     title: `Transactions switched from canceled activity (ID: ${canceledActivityId}). ${canceledTransactions.length} transaction(s) mapped.`,
      //     createdById: authUserId,
      //   },
      //   {
      //     transaction: transaction,
      //   }
      // );

      return {
        success: true,
        transactionCount: canceledOrRejectedActivityTransactions.length,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionCount: 0,
        error: error.message,
      };
    }
  }

  //ASP SEND REQUEST
  export async function addActivity(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      const [
        checkCaseIdExists,
        checkActivityAlreadyCreatedForAsp,
        checkActiveActivityAlreadyExists,
        getASPDetail,
      ]: any = await Promise.all([
        CaseDetails.findOne({
          where: {
            id: inData.caseDetailId,
            statusId: 2, // INPROGRESS
          },
          attributes: ["id", "typeId", "agentId"],
        }),
        ActivityAspDetails.findOne({
          where: { aspId: inData.aspId, subServiceId: inData.subServiceId },
          attributes: ["id", "activityId"],
          include: {
            model: Activities,
            attributes: ["id"],
            required: true,
            where: {
              caseDetailId: inData.caseDetailId,
              activityStatusId: {
                [Op.notIn]: [4, 8], // 4) Cancelled, 8) Rejected
              },
            },
          },
        }),
        Activities.findOne({
          attributes: ["id", "activityStatusId", "financeStatusId"],
          where: {
            [Op.and]: [
              { caseDetailId: inData.caseDetailId },
              {
                activityStatusId: {
                  [Op.notIn]: [4, 5, 8], // 4) Cancelled, 5) Failure, 8) Rejected
                },
              },
            ],
          },
          include: [
            {
              model: ActivityAspDetails,
              attributes: ["id"],
              required: true,
              where: {
                subServiceId: inData.subServiceId,
                aspId: {
                  [Op.not]: null,
                },
              },
            },
          ],
        }),
        // GET ASP DETAILS
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}`
        ),
      ]);

      if (!checkCaseIdExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      if (checkActivityAlreadyCreatedForAsp) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "The send request has already been sent to the ASP",
        });
      }

      //FOR ADDITIONAL SERVICE REQUEST PURPOSE
      let ignoreActiveActivityExistsCondition = false;
      if (inData.ignoreActiveActivityExistsCondition) {
        ignoreActiveActivityExistsCondition =
          inData.ignoreActiveActivityExistsCondition;
      }

      //DO NOT ALLOW IF ACTIVITY STATUS OTHER THAN SUCCESS AND BALANCE PENDING AND EXCESS PENDING, IF ACTIVITY STATUS IS EITHER SUCCESS OR BALANCE PENDING OR EXCESS PENDING AND FINANCE STATUS IS MATURED
      if (
        checkActiveActivityAlreadyExists &&
        !ignoreActiveActivityExistsCondition
      ) {
        if (
          (checkActiveActivityAlreadyExists.dataValues.activityStatusId != 7 &&
            checkActiveActivityAlreadyExists.dataValues.activityStatusId !=
            11 &&
            checkActiveActivityAlreadyExists.dataValues.activityStatusId !=
            12) ||
          ((checkActiveActivityAlreadyExists.dataValues.activityStatusId == 7 ||
            checkActiveActivityAlreadyExists.dataValues.activityStatusId ==
            11 ||
            checkActiveActivityAlreadyExists.dataValues.activityStatusId ==
            12) &&
            checkActiveActivityAlreadyExists.dataValues.financeStatusId == 1)
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "The request has already been activated with another ASP",
          });
        }
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: checkCaseIdExists.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      //GENERATE ACTIVITY NUMBER BASED ON SERIAL NUMBER
      const [generateActivityNumber, getMasterDetail] = await Promise.all([
        Utils.generateActivityNumber(),
        axios.post(`${masterService}/${endpointMaster.getMasterDetails}`, {
          subServiceId: inData.subServiceId,
        }),
      ]);

      if (!generateActivityNumber.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: generateActivityNumber.error,
        });
      }

      let activityData: any = {
        caseDetailId: inData.caseDetailId,
        activityStatusId: inData.activityStatusId,
        financeStatusId: 3, // NOT MATURED
        activityNumber: generateActivityNumber.number,
        aspAssignedById: inData.authUserId ? inData.authUserId : null,
      };

      if (inData.isAutoAllocatedAspProcess) {
        activityData.isAspAutoAllocated = 1;
      }

      //IF CASE TYPE IS RSA (CUSTODY SELF AND ASP REJECT NEW ACTIVITY SCENARIOS) THEN SAVE NOTES
      if (
        checkCaseIdExists.dataValues.typeId == 31 &&
        inData.saveActivityNote == 1 &&
        inData.activityNoteDetails
      ) {
        activityData.customerNeedToPay =
          inData.activityNoteDetails.customerNeedToPay;
        activityData.nonMembershipType =
          inData.activityNoteDetails.nonMembershipType;
        activityData.additionalChargeableKm =
          inData.activityNoteDetails.additionalChargeableKm;
        activityData.notes = inData.activityNoteDetails.notes;
      }

      //IF CASE TYPE IS RSA (CUSTODY & CAB ASSISTANCE SELF AND ASP REJECT NEW ACTIVITY SCENARIOS) THEN SAVE SERVICE EXPECTED CONFIGURATION
      if (
        checkCaseIdExists.dataValues.typeId == 31 &&
        inData.saveServiceExpectedConfig == 1
      ) {
        activityData.isInitiallyCreated = inData.isInitiallyCreated;
        activityData.isImmediateService = inData.isImmediateService;
        activityData.serviceInitiatingAt = inData.serviceInitiatingAt;
        activityData.serviceExpectedAt = inData.serviceExpectedAt;
        activityData.aspAutoAllocation = inData.aspAutoAllocation;
      }

      //GET AGENT PICKED AT FROM REJECTED OR CANCELLED ACTIVITY AND SAVE THAT IN NEW ACTIVITY FOR RSA CRM CASE.
      if (
        checkCaseIdExists.dataValues.typeId == 31 &&
        inData.saveAgentPickedAt == 1 &&
        inData.agentPickedAt
      ) {
        activityData.agentPickedAt = inData.agentPickedAt;
      }

      let breakdownOrPickupReachEta = "0 m";
      // RSA CRM
      if (checkCaseIdExists.dataValues.typeId == 31) {
        breakdownOrPickupReachEta =
          inData.estimatedTotalKmDurationBetweenLocations
            ?.estimatedAspToBreakdownKmDuration || "0 m";
      } else {
        // VDM
        breakdownOrPickupReachEta =
          inData.estimatedTotalKmDurationBetweenLocations
            ?.estimatedAspToPickupKmDuration || "0 m";
      }

      await activities
        .create(activityData, { transaction: transaction })
        .then(async function (record) {
          const aspActivityData = {
            activityId: record.dataValues.id,
            aspId: inData.aspId,
            subServiceId: inData.subServiceId,
            subServiceHasAspAssignment:
              getMasterDetail?.data?.data?.subService?.hasAspAssignment || null,
            serviceId:
              getMasterDetail?.data?.data?.subService?.serviceId || null,
            estimatedOnlineKm: inData.estimatedTotalKm,
            estimatedTotalKm: inData.estimatedTotalKm,
            estimatedTotalDuration: inData.estimatedTotalDuration,
            estimatedAspToPickupKm: inData.estimatedTotalKmBetweenLocations
              .estimatedAspToPickupKm
              ? inData.estimatedTotalKmBetweenLocations.estimatedAspToPickupKm
              : null,
            estimatedAspToPickupKmDuration: inData
              .estimatedTotalKmDurationBetweenLocations
              .estimatedAspToPickupKmDuration
              ? inData.estimatedTotalKmDurationBetweenLocations
                .estimatedAspToPickupKmDuration
              : null,
            estimatedPickupToDropKm: inData.estimatedTotalKmBetweenLocations
              .estimatedPickupToDropKm
              ? inData.estimatedTotalKmBetweenLocations.estimatedPickupToDropKm
              : null,
            estimatedPickupToDropKmDuration: inData
              .estimatedTotalKmDurationBetweenLocations
              .estimatedPickupToDropKmDuration
              ? inData.estimatedTotalKmDurationBetweenLocations
                .estimatedPickupToDropKmDuration
              : null,

            estimatedAspToBreakdownKm: inData.estimatedTotalKmBetweenLocations
              .estimatedAspToBreakdownKm
              ? inData.estimatedTotalKmBetweenLocations
                .estimatedAspToBreakdownKm
              : null,
            estimatedAspToBreakdownKmDuration: inData
              .estimatedTotalKmDurationBetweenLocations
              .estimatedAspToBreakdownKmDuration
              ? inData.estimatedTotalKmDurationBetweenLocations
                .estimatedAspToBreakdownKmDuration
              : null,
            estimatedBreakdownToAspKm: inData.estimatedTotalKmBetweenLocations
              .estimatedBreakdownToAspKm
              ? inData.estimatedTotalKmBetweenLocations
                .estimatedBreakdownToAspKm
              : null,
            estimatedBreakdownToAspKmDuration: inData
              .estimatedTotalKmDurationBetweenLocations
              .estimatedBreakdownToAspKmDuration
              ? inData.estimatedTotalKmDurationBetweenLocations
                .estimatedBreakdownToAspKmDuration
              : null,
            estimatedBreakdownToDropKm: inData.estimatedTotalKmBetweenLocations
              .estimatedBreakdownToDropKm
              ? inData.estimatedTotalKmBetweenLocations
                .estimatedBreakdownToDropKm
              : null,
            estimatedBreakdownToDropKmDuration: inData
              .estimatedTotalKmDurationBetweenLocations
              .estimatedBreakdownToDropKmDuration
              ? inData.estimatedTotalKmDurationBetweenLocations
                .estimatedBreakdownToDropKmDuration
              : null,

            estimatedDropToAspKm: inData.estimatedTotalKmBetweenLocations
              .estimatedDropToAspKm
              ? inData.estimatedTotalKmBetweenLocations.estimatedDropToAspKm
              : null,
            estimatedDropToAspKmDuration: inData
              .estimatedTotalKmDurationBetweenLocations
              .estimatedDropToAspKmDuration
              ? inData.estimatedTotalKmDurationBetweenLocations
                .estimatedDropToAspKmDuration
              : null,
            estimatedServiceCost: inData.estimatedServiceCost,
            estimatedTotalTax: inData.estimatedTotalTax,
            estimatedTotalAmount: inData.estimatedTotalAmount,
            estimatedAspServiceCost: inData.estimatedAspServiceCost,
            estimatedAspTotalTax: inData.estimatedAspTotalTax,
            estimatedAspTotalAmount: inData.estimatedAspTotalAmount,
            aspVehicleRegistrationNumber:
              inData.ownPatrolVehicleRegistrationNumber
                ? inData.ownPatrolVehicleRegistrationNumber
                : null,
            //IF COCO ASP HAVE COCO TECHNICIAN, THEN UPDATE ASP MECHANIC ID AND ASP MECHANIC ASSIGNED AT COLUMN ON SEND REQUEST
            aspMechanicId: checkCaseIdExists.dataValues.typeId == 32 && inData.cocoAspTechnicianId
              ? inData.cocoAspTechnicianId
              : null,
            aspMechanicAssignedAt: checkCaseIdExists.dataValues.typeId == 32 && inData.cocoAspTechnicianId
              ? new Date()
              : null,
          };
          const createdAspDetail = await ActivityAspDetails.create(aspActivityData, {
            transaction: transaction,
          });
          return {
            activityId: record.dataValues.id,
            activity: record,
            activityAspDetail: createdAspDetail,
            aspActivityData: aspActivityData
          };
        })
        .then(async function (result: any) {
          const activityId = result.activityId;
          const newActivity = result.activity;
          const newActivityAspDetail = result.activityAspDetail;
          const aspActivityData = result.aspActivityData;

          // Check for canceled or rejected activities with transactions and switch them (CRM case type only)
          if (checkCaseIdExists.dataValues.typeId == 31) {
            // Get serviceId from the new activity's ActivityAspDetails (aspActivityData contains serviceId)
            const serviceIdFilter = aspActivityData?.serviceId
              ? { serviceId: aspActivityData.serviceId }
              : {};

            // Find canceled or rejected activities in the same case with successful one-time service transactions
            // Filter by serviceId to match activities with the same service type
            const canceledOrRejectedActivities: any = await Activities.findAll({
              where: {
                caseDetailId: inData.caseDetailId,
                activityStatusId: [4, 8], // Cancelled, Rejected
                id: { [Op.ne]: activityId }, // Exclude the new activity
              },
              attributes: ["id", "nonMembershipType", "additionalChargeableKm", "paymentForAdditionalKmCaptured", "additionalKmForPayment", "paidTotalKm"],
              include: [
                {
                  model: ActivityAspDetails,
                  attributes: [
                    "id",
                    "estimatedTotalKm",
                    "serviceId",
                    "additionalKmEstimatedServiceCost",
                    "additionalKmDiscountPercentage",
                    "additionalKmDiscountAmount",
                    "additionalKmDiscountReasonId",
                    "additionalKmDiscountReason",
                    "additionalKmEstimatedTotalTax",
                    "additionalKmEstimatedTotalAmount"
                  ],
                  required: true,
                  where: serviceIdFilter, // Filter by serviceId
                },
                {
                  model: ActivityTransactions,
                  attributes: ["id"],
                  required: true,
                  where: {
                    paymentTypeId: 174, // One time service
                    paymentStatusId: 191, // Success
                    refundStatusId: {
                      [Op.or]: [
                        {
                          [Op.is]: null, // Refund not initiated
                        },
                        {
                          [Op.eq]: 1303, // Refund failed
                        },
                      ],
                    },
                  },
                },
              ],
              transaction: transaction,
            });

            if (canceledOrRejectedActivities.length > 0) {
              // Process each canceled or rejected activity
              for (const canceledOrRejectedActivity of canceledOrRejectedActivities) {
                const canceledOrRejectedActivityAspDetail = canceledOrRejectedActivity.activityAspDetail;

                // Always switch transactions from canceled or rejected activity to new activity
                const switchResult = await switchTransactionsFromCanceledOrRejectedActivity(
                  canceledOrRejectedActivity.dataValues.id,
                  activityId,
                  checkCaseIdExists.dataValues.agentId || inData.authUserId || 1,
                  transaction
                );

                if (switchResult.success && switchResult.transactionCount > 0) {
                  // Calculate KM difference
                  // For canceled or rejected KM: Use paidTotalKm if available (what customer paid for), otherwise fall back to estimated values
                  const canceledOrRejectedActivityKm = await getKmForComparison(
                    canceledOrRejectedActivity.dataValues,
                    canceledOrRejectedActivityAspDetail?.dataValues,
                    true // usePaidKm = true to use paidTotalKm when available
                  );

                  // For new activity KM: Use current estimated values (estimatedTotalKm or additionalChargeableKm)
                  const newActivityKm = await getKmForComparison(
                    newActivity.dataValues,
                    aspActivityData,
                    false // usePaidKm = false to use current estimated values
                  );
                  const kmDifference = Math.abs(newActivityKm - canceledOrRejectedActivityKm);

                  if (canceledOrRejectedActivity.dataValues.paymentForAdditionalKmCaptured == true) {
                    await Promise.all([
                      Activities.update(
                        {
                          paidTotalKm: canceledOrRejectedActivity.dataValues.paidTotalKm,
                          hasAdditionalKmForPayment: true,
                          additionalKmForPayment: canceledOrRejectedActivity.dataValues.additionalKmForPayment,
                          paymentForAdditionalKmCaptured: true,
                          customerAgreedToAdditionalPayment: true,
                        },
                        {
                          where: { id: activityId },
                          transaction: transaction,
                        }
                      ),
                      ActivityAspDetails.update(
                        {
                          additionalKmEstimatedServiceCost:
                            canceledOrRejectedActivityAspDetail.dataValues.additionalKmEstimatedServiceCost || null,
                          additionalKmDiscountPercentage:
                            canceledOrRejectedActivityAspDetail.dataValues.additionalKmDiscountPercentage || null,
                          additionalKmDiscountAmount:
                            canceledOrRejectedActivityAspDetail.dataValues.additionalKmDiscountAmount || null,
                          additionalKmDiscountReasonId:
                            canceledOrRejectedActivityAspDetail.dataValues.additionalKmDiscountReasonId || null,
                          additionalKmDiscountReason:
                            canceledOrRejectedActivityAspDetail.dataValues.additionalKmDiscountReason || null,
                          additionalKmEstimatedTotalTax:
                            canceledOrRejectedActivityAspDetail.dataValues.additionalKmEstimatedTotalTax || null,
                          additionalKmEstimatedTotalAmount:
                            canceledOrRejectedActivityAspDetail.dataValues.additionalKmEstimatedTotalAmount || null,
                        },
                        {
                          where: { activityId: activityId },
                          transaction: transaction,
                        }
                      ),
                    ]);
                  } else {
                    const kmComparisonThreshold = getKmComparisonThreshold();

                    // If KM difference > threshold, mark for additional payment
                    if (kmDifference > kmComparisonThreshold) {
                      await Activities.update(
                        {
                          paidTotalKm: canceledOrRejectedActivity.dataValues.paidTotalKm,
                          hasAdditionalKmForPayment: true,
                          additionalKmForPayment: kmDifference,
                          paymentForAdditionalKmCaptured: false,
                        },
                        {
                          where: { id: activityId },
                          transaction: transaction,
                        }
                      );
                    } else {
                      await Activities.update(
                        {
                          paidTotalKm: canceledOrRejectedActivity.dataValues.paidTotalKm,
                          hasAdditionalKmForPayment: false,
                          additionalKmForPayment: null,
                          paymentForAdditionalKmCaptured: false,
                        },
                        {
                          where: { id: activityId },
                          transaction: transaction,
                        }
                      );
                    }
                  }

                }
              }
            }
          }

          const processArray: any = [];
          //CREATE ACTIVITY ASP RATE CARD
          processArray.push(
            ActivityAspRateCards.create(
              {
                activityId: activityId,
                aspId: inData.aspId,
                ...inData.aspRateCard,
              },
              {
                transaction: transaction,
              }
            )
          );

          if (inData.clientRateCard) {
            //ACTIVITY CLIENT RATE CARD
            processArray.push(
              ActivityClientRateCards.create(
                {
                  activityId: activityId,
                  ...inData.clientRateCard,
                },
                {
                  transaction: transaction,
                }
              )
            );
          }

          //ACTIVITY LOG CREATION
          processArray.push(
            ActivityLogs.create(
              {
                activityId: activityId,
                typeId: 240, //WEB
                title: `The agent "${getAgentDetail.data.user.name}" has sent a request to a service provider "${getASPDetail.data.data.workshopName}". ETA - ${breakdownOrPickupReachEta}`,
              },
              {
                transaction: transaction,
              }
            )
          );

          await Promise.all(processArray);

          //IF COCO ASP HAVE COCO TECHNICIAN, THEN UPDATE ASP MECHANIC ID AND ASP MECHANIC ASSIGNED AT COLUMN ON SEND REQUEST
          if (checkCaseIdExists.dataValues.typeId == 32 && inData.cocoAspTechnicianId) {
            await ActivityLogs.create(
              {
                activityId: activityId,
                typeId: 240, //WEB
                title: `The driver "${inData.cocoAspTechnicianName}" has been automatically assigned to this request since the shift is in progress".`,
              },
              {
                transaction: transaction,
              }
            );
          }

          //FCM PUSH NOTIFICATIONS
          let sendPushNotification = false;
          let details: any = {};
          if (checkCaseIdExists.dataValues.typeId == 32) {
            // VDM Notification
            details = {
              caseDetailId: inData.caseDetailId,
              templateId: 4,
              notifyToAll: [""],
              agentName: getAgentDetail.data.user.name,
              workshopName: getASPDetail.data.data.workshopName,
              aspDetail: inData.aspId,
              notificationType: "VDM",
              breakdownOrPickupReachEta: breakdownOrPickupReachEta,
            };
            sendPushNotification = true;
          } else {
            // CRM Notifications
            if (inData.sendCrmPushNotification) {
              // COCO TECHNICIAN
              // if (inData.cocoAspTechnicianId) {
              //   details = {
              //     caseDetailId: inData.caseDetailId,
              //     templateId: 34,
              //     notifyToAll: [""],
              //     agentName: getAgentDetail.data.user.name,
              //     workshopName: getASPDetail.data.data.workshopName,
              //     mechanicDetail: inData.cocoAspTechnicianId,
              //     notificationType: "CRM",
              //     breakdownOrPickupReachEta: breakdownOrPickupReachEta,
              //   };
              // } else {
              //   // THIRD PARTY ASP
              //   details = {
              //     caseDetailId: inData.caseDetailId,
              //     templateId: 2,
              //     notifyToAll: [""],
              //     agentName: getAgentDetail.data.user.name,
              //     workshopName: getASPDetail.data.data.workshopName,
              //     aspDetail: inData.aspId,
              //     notificationType: "CRM",
              //     breakdownOrPickupReachEta: breakdownOrPickupReachEta,
              //   };
              // }

              if (!getASPDetail.data.data.isOwnPatrol) {
                // THIRD PARTY ASP
                details = {
                  caseDetailId: inData.caseDetailId,
                  templateId: 2,
                  notifyToAll: [""],
                  agentName: getAgentDetail.data.user.name,
                  workshopName: getASPDetail.data.data.workshopName,
                  aspDetail: inData.aspId,
                  notificationType: "CRM",
                  breakdownOrPickupReachEta: breakdownOrPickupReachEta,
                };
              }

              sendPushNotification = true;
            }
          }

          if (sendPushNotification == true) {
            notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc
          }

          await transaction.commit();

          // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
          Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
            activityId,
          ]);

          //If send request to asp then sync asp auto allocated details for crm report.
          if (
            checkCaseIdExists.dataValues.typeId == 31 &&
            inData.isAutoAllocatedAspProcess
          ) {
            Utils.createReportSyncTableRecord(
              "autoAllocatedAspReportDetails", [
              activityId
            ]);
          }


          // Sync client report details, client report with mobile number details
          if (checkCaseIdExists.dataValues.typeId == 31) {
            Utils.createReportSyncTableRecord(
              ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
              [inData.caseDetailId]
            );
          }

          // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
          if (checkCaseIdExists.dataValues.typeId == 31) {
            Utils.createReportSyncTableRecord(
              ["financialReportDetails", "activityReportDetails"],
              [activityId]
            );
          }

          return res.status(200).json({
            success: true,
            message: "Activities added successfully to the case",
            activityId: activityId,
          });
        });
    } catch (error: any) {
      console.log(error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateActivityRequest(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      const [
        checkCaseIdExists,
        checkActivityAlreadyCreatedForAsp,
        getASPDetail,
      ]: any = await Promise.all([
        CaseDetails.findOne({
          attributes: ["id", "agentId", "typeId"],
          where: { id: inData.caseDetailId },
        }),
        ActivityAspDetails.findOne({
          where: { aspId: inData.aspId, subServiceId: inData.subServiceId },
          attributes: ["id", "activityId"],
          include: {
            model: Activities,
            attributes: ["id"],
            required: true,
            where: {
              caseDetailId: inData.caseDetailId,
              activityStatusId: {
                [Op.notIn]: [4, 8], // 4) Cancelled, 8) Rejected
              },
            },
          },
        }),
        // GET ASP DETAILS
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}`
        ),
      ]);

      if (!checkCaseIdExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      if (checkActivityAlreadyCreatedForAsp) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "The send request has already been sent to the ASP",
        });
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: checkCaseIdExists.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      const breakdownOrPickupReachEta =
        inData.estimatedTotalKmDurationBetweenLocations
          ?.estimatedAspToBreakdownKmDuration || "0 m";
      const promiseArray: any = [];

      const activityData: any = {
        caseDetailId: inData.caseDetailId,
        activityStatusId: inData.activityStatusId,
        financeStatusId: 3, //NOT MATURED
        aspAssignedById: inData.authUserId ? inData.authUserId : null,
      };

      if (inData.isAutoAllocatedAspProcess) {
        activityData.isAspAutoAllocated = 1;
      }

      //IF CASE TYPE IS RSA (UPDATE ACTIVITY REQUEST SCENARIO) THEN SAVE NOTES
      if (
        checkCaseIdExists.dataValues.typeId == 31 &&
        inData.saveActivityNote == 1 &&
        inData.activityNoteDetails
      ) {
        activityData.customerNeedToPay =
          inData.activityNoteDetails.customerNeedToPay;
        activityData.nonMembershipType =
          inData.activityNoteDetails.nonMembershipType;
        activityData.additionalChargeableKm =
          inData.activityNoteDetails.additionalChargeableKm;
        activityData.notes = inData.activityNoteDetails.notes;
      }

      promiseArray.push(
        Activities.update(activityData, {
          where: { id: inData.activityId },
          transaction: transaction,
        })
      );

      const aspActivityData = {
        aspId: inData.aspId,
        estimatedTotalKm: inData.estimatedTotalKm,
        estimatedTotalDuration: inData.estimatedTotalDuration,
        estimatedAspToPickupKm: inData.estimatedTotalKmBetweenLocations
          .estimatedAspToPickupKm
          ? inData.estimatedTotalKmBetweenLocations.estimatedAspToPickupKm
          : null,
        estimatedAspToPickupKmDuration: inData
          .estimatedTotalKmDurationBetweenLocations
          .estimatedAspToPickupKmDuration
          ? inData.estimatedTotalKmDurationBetweenLocations
            .estimatedAspToPickupKmDuration
          : null,
        estimatedPickupToDropKm: inData.estimatedTotalKmBetweenLocations
          .estimatedPickupToDropKm
          ? inData.estimatedTotalKmBetweenLocations.estimatedPickupToDropKm
          : null,
        estimatedPickupToDropKmDuration: inData
          .estimatedTotalKmDurationBetweenLocations
          .estimatedPickupToDropKmDuration
          ? inData.estimatedTotalKmDurationBetweenLocations
            .estimatedPickupToDropKmDuration
          : null,

        estimatedAspToBreakdownKm: inData.estimatedTotalKmBetweenLocations
          .estimatedAspToBreakdownKm
          ? inData.estimatedTotalKmBetweenLocations.estimatedAspToBreakdownKm
          : null,
        estimatedAspToBreakdownKmDuration: inData
          .estimatedTotalKmDurationBetweenLocations
          .estimatedAspToBreakdownKmDuration
          ? inData.estimatedTotalKmDurationBetweenLocations
            .estimatedAspToBreakdownKmDuration
          : null,
        estimatedBreakdownToAspKm: inData.estimatedTotalKmBetweenLocations
          .estimatedBreakdownToAspKm
          ? inData.estimatedTotalKmBetweenLocations.estimatedBreakdownToAspKm
          : null,
        estimatedBreakdownToAspKmDuration: inData
          .estimatedTotalKmDurationBetweenLocations
          .estimatedBreakdownToAspKmDuration
          ? inData.estimatedTotalKmDurationBetweenLocations
            .estimatedBreakdownToAspKmDuration
          : null,
        estimatedBreakdownToDropKm: inData.estimatedTotalKmBetweenLocations
          .estimatedBreakdownToDropKm
          ? inData.estimatedTotalKmBetweenLocations.estimatedBreakdownToDropKm
          : null,
        estimatedBreakdownToDropKmDuration: inData
          .estimatedTotalKmDurationBetweenLocations
          .estimatedBreakdownToDropKmDuration
          ? inData.estimatedTotalKmDurationBetweenLocations
            .estimatedBreakdownToDropKmDuration
          : null,

        estimatedDropToAspKm: inData.estimatedTotalKmBetweenLocations
          .estimatedDropToAspKm
          ? inData.estimatedTotalKmBetweenLocations.estimatedDropToAspKm
          : null,
        estimatedDropToAspKmDuration: inData
          .estimatedTotalKmDurationBetweenLocations.estimatedDropToAspKmDuration
          ? inData.estimatedTotalKmDurationBetweenLocations
            .estimatedDropToAspKmDuration
          : null,
        estimatedServiceCost: inData.estimatedServiceCost,
        estimatedTotalTax: inData.estimatedTotalTax,
        estimatedTotalAmount: inData.estimatedTotalAmount,
        estimatedAspServiceCost: inData.estimatedAspServiceCost,
        estimatedAspTotalTax: inData.estimatedAspTotalTax,
        estimatedAspTotalAmount: inData.estimatedAspTotalAmount,
        aspVehicleRegistrationNumber: inData.ownPatrolVehicleRegistrationNumber
          ? inData.ownPatrolVehicleRegistrationNumber
          : null,
        //IF COCO ASP HAVE COCO TECHNICIAN, THEN UPDATE ASP MECHANIC ID AND ASP MECHANIC ASSIGNED AT COLUMN ON SEND REQUEST
        aspMechanicId: checkCaseIdExists.dataValues.typeId == 32 && inData.cocoAspTechnicianId
          ? inData.cocoAspTechnicianId
          : null,
        aspMechanicAssignedAt: checkCaseIdExists.dataValues.typeId == 32 && inData.cocoAspTechnicianId ? new Date() : null,
      };
      promiseArray.push(
        ActivityAspDetails.update(aspActivityData, {
          where: { id: inData.activityAspDetailId },
          transaction: transaction,
        })
      );

      //ACTIVITY ASP RATE CARD
      const activityAspRateCardData = {
        activityId: inData.activityId,
        aspId: inData.aspId,
        ...inData.aspRateCard,
      };

      const activityAspRateCard = await ActivityAspRateCards.findOne({
        attributes: ["id"],
        where: { activityId: inData.activityId, aspId: inData.aspId },
      });
      if (!activityAspRateCard) {
        promiseArray.push(
          ActivityAspRateCards.create(activityAspRateCardData, {
            transaction: transaction,
          })
        );
      } else {
        promiseArray.push(
          ActivityAspRateCards.update(activityAspRateCardData, {
            where: { id: activityAspRateCard.dataValues.id },
            transaction: transaction,
          })
        );
      }

      //ACTIVITY CLIENT RATE CARD
      if (inData.clientRateCard) {
        const activityClientRateCard = await ActivityClientRateCards.findOne({
          attributes: ["id"],
          where: {
            activityId: inData.activityId,
            clientId: inData.clientRateCard.clientId,
          },
        });
        if (!activityClientRateCard) {
          promiseArray.push(
            ActivityClientRateCards.create(
              {
                activityId: inData.activityId,
                ...inData.clientRateCard,
              },
              {
                transaction: transaction,
              }
            )
          );
        } else {
          promiseArray.push(
            ActivityClientRateCards.update(
              {
                activityId: inData.activityId,
                ...inData.clientRateCard,
              },
              {
                where: { id: activityClientRateCard.dataValues.id },
                transaction: transaction,
              }
            )
          );
        }
      }

      //ACTIVITY LOG CREATION
      promiseArray.push(
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name}" has sent a request to a service provider "${getASPDetail.data.data.workshopName}". ETA - ${breakdownOrPickupReachEta}`,
          },
          {
            transaction: transaction,
          }
        )
      );

      await Promise.all(promiseArray);

      if (inData.sendCrmPushNotification) {
        //FCM PUSH NOTIFICATIONS
        let details: any = {};
        // COCO TECHNICIAN
        // if (inData.cocoAspTechnicianId) {
        //   details = {
        //     caseDetailId: inData.caseDetailId,
        //     templateId: 34,
        //     notifyToAll: [""],
        //     agentName: getAgentDetail.data.user.name,
        //     workshopName: getASPDetail.data.data.workshopName,
        //     mechanicDetail: inData.cocoAspTechnicianId,
        //     notificationType: "CRM",
        //     breakdownOrPickupReachEta: breakdownOrPickupReachEta,
        //   };
        // } else {
        //   // THIRD PARTY ASP
        //   details = {
        //     caseDetailId: inData.caseDetailId,
        //     templateId: 2,
        //     notifyToAll: [""],
        //     agentName: getAgentDetail.data.user.name,
        //     workshopName: getASPDetail.data.data.workshopName,
        //     aspDetail: inData.aspId,
        //     notificationType: "CRM",
        //     breakdownOrPickupReachEta: breakdownOrPickupReachEta,
        //   };
        // }

        if (!getASPDetail.data.data.isOwnPatrol) {
          // THIRD PARTY ASP
          details = {
            caseDetailId: inData.caseDetailId,
            templateId: 2,
            notifyToAll: [""],
            agentName: getAgentDetail.data.user.name,
            workshopName: getASPDetail.data.data.workshopName,
            aspDetail: inData.aspId,
            notificationType: "CRM",
            breakdownOrPickupReachEta: breakdownOrPickupReachEta,
          };
        }

        notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc
      }
      await transaction.commit();

      //If send request to asp then sync asp auto allocated details for crm report.
      if (checkCaseIdExists.dataValues.typeId == 31 && inData.isAutoAllocatedAspProcess) {
        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          [inData.activityId]
        );
      }

      // Sync client report details, client report with mobile number details
      if (checkCaseIdExists.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [inData.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (checkCaseIdExists.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [inData.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Activities updated successfully to the case",
        activityId: inData.activityId,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function listCases(req: Request, res: Response) { }

  //get owner activities list
  export async function getAspActivityDashboardData(
    req: Request,
    res: Response
  ) {
    try {
      //Require data destructure;
      const inData = req.validBody;
      const userId = parseInt(inData.userId as string);
      const userTypeId = parseInt(inData.userTypeId as string);

      let isInShift = false;
      let attendance = null;
      let aspMechanicTypeId = null;
      let aspMechanicWorkStatusId = null;
      let caseInprogressRequestCount: any = [];
      if (userTypeId == 143 || userTypeId == 144) {
        //ASP MECHANIC OR OWN PATROL VEHICLE HELPER
        const entityUserResponse: any = await axios.get(
          `${userServiceUrl}/${userServiceEndpoint.getEntityUser}?userTypeId=${userTypeId}&entityId=${userId}`
        );
        if (entityUserResponse.data.success) {
          isInShift = entityUserResponse.data.user.inShift;
          attendance = entityUserResponse.data.attendance;

          if (userTypeId == 143 && entityUserResponse.data.entityData) {
            aspMechanicTypeId = entityUserResponse.data.entityData.aspTypeId;
          }
        }

        // COCO VEHICLE HELPER
        if (userTypeId == 144 && attendance && attendance.ownPatrolVehicle) {
          caseInprogressRequestCount = await activityAspDetails.count({
            attributes: ["aspVehicleRegistrationNumber"],
            where: {
              aspVehicleRegistrationNumber:
                attendance.ownPatrolVehicle.vehicleRegistrationNumber,
            },
            group: ["aspVehicleRegistrationNumber"],
            include: [
              {
                model: Activities,
                required: true,
                where: {
                  activityStatusId: 3, //INPROGRESS
                },
                include: [
                  {
                    model: CaseDetails,
                    required: true,
                    where: {
                      statusId: 2, //INPROGRESS
                    },
                  },
                ],
              },
            ],
          });
        }

        //GET COCO TECHNICIAN WORK STATUS
        if (userTypeId == 143 && aspMechanicTypeId == 771) {
          const [aspMechanicScheduledActivities, aspMechanicExists]: any =
            await Promise.all([
              ActivityAspDetails.findAll({
                where: { aspMechanicId: userId },
                attributes: ["id", "activityId", "aspId", "aspMechanicId"],
                include: [
                  {
                    model: Activities,
                    attributes: ["id", "aspActivityStatusId"],
                    required: true,
                    where: {
                      activityStatusId: {
                        [Op.notIn]: [1, 4, 5, 7, 8], // 1) Open, 4) Cancelled, 5) Failure, 7) Successful, 8) Rejected
                      },
                    },
                  },
                ],
              }),
              axios.post(
                `${masterService}/${endpointMaster.aspMechanics.getById}`,
                {
                  aspMechanicId: userId,
                }
              ),
            ]);

          //IF CASE IS INPROGRESS THEN "BUSY"
          //IF THERE IS NO CASE THEN CHECK THE WORK STATUS UPDATED OTHERWISE STATUS WILL BE "OFFLINE"
          if (aspMechanicScheduledActivities.length > 0) {
            aspMechanicWorkStatusId = 13; //BUSY
          } else if (
            !aspMechanicExists.data.success ||
            !aspMechanicExists.data.data.workStatusId
          ) {
            aspMechanicWorkStatusId = 11; //OFFLINE
          } else {
            aspMechanicWorkStatusId = aspMechanicExists.data.data.workStatusId;
          }
        }
      }

      let activityAspDetailWhere: any = {};
      let groupByColumn: string = "";
      let activeRequestActivityAspDetailWhere: any = {};
      let activeRequestActivityWhere: any = {};

      // Owner login
      if (userTypeId === 142) {
        // activityAspDetailWhere.aspId = userId;

        let aspIds = [];
        aspIds.push(userId);

        //IF ASP IS FINANCE ADMIN THEN GET ITS SUB ASPS
        const aspSubAspResponse: any = await axios.get(
          `${masterService}/${endpointMaster.asps.getAspSubAsps}?aspId=${userId}`
        );

        if (
          aspSubAspResponse?.data?.success &&
          aspSubAspResponse?.data?.subAsps?.length > 0
        ) {
          const subAspIds = aspSubAspResponse.data.subAsps.map(
            (subAsp: any) => subAsp.id
          );
          aspIds.push(...subAspIds);
        }

        activityAspDetailWhere.aspId = {
          [Op.in]: aspIds,
        };
        groupByColumn = "aspId";

        //ACTIVE REQUEST LOGIC
        activeRequestActivityWhere.activityStatusId = [1, 2, 9, 10, 14]; //OPEN || ((ASSIGNED || WAITING FOR DEALER APPROVAL || ADVANCE AMOUNT PAID || ADVANCE PAY LATER) WITH DRIVER NOT ASSIGNED)
        // activeRequestActivityAspDetailWhere.aspId = userId;
        activeRequestActivityAspDetailWhere.aspId = {
          [Op.in]: aspIds,
        };
        activeRequestActivityAspDetailWhere.aspServiceAccepted = [0, 1]; //not accepted and accepted only
        activeRequestActivityAspDetailWhere.aspMechanicId = null;
      } else if (userTypeId === 143) {
        // Driver login
        activityAspDetailWhere.aspMechanicId = userId;
        groupByColumn = "aspMechanicId";

        //COCO
        if (aspMechanicTypeId == 771) {
          //ACTIVE REQUEST LOGIC
          activeRequestActivityWhere.activityStatusId = [1, 2, 9, 10, 14]; //OPEN || ((ASSIGNED || WAITING FOR DEALER APPROVAL || ADVANCE AMOUNT PAID || ADVANCE PAY LATER) WITH DRIVER NOT ASSIGNED)
          activeRequestActivityAspDetailWhere.aspServiceAccepted = [0, 1]; //not accepted and accepted only
          activeRequestActivityAspDetailWhere.aspMechanicId = userId;
        }
      }

      let totalDeliveryCount: any = [];
      let activeRequestCount: any = [];
      let assignedRequestCount: any = [];
      let ongoingRequestCount: any = [];
      let inprogressRequestCount: any = [];
      let cancelledRequestCount: any = [];
      let rejectedRequestCount: any = [];
      let failureRequestCount: any = [];
      let successRequestCount: any = [];
      let checkAspInDriving = null;
      let activeActivity: any = null;

      if (userTypeId != 144) {
        totalDeliveryCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
            },
          ],
        });
        activeRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activeRequestActivityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: activeRequestActivityWhere,
              include: [
                {
                  model: CaseDetails,
                  required: true,
                  where: {
                    statusId: {
                      [Op.ne]: 3, //CANCELLED
                    },
                  },
                },
              ],
            },
          ],
        });
        assignedRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: {
                activityStatusId: 2, //ASSIGNED
              },
            },
          ],
        });

        let onGoingRequestWhere: any = {
          [Op.or]: [
            { activityStatusId: 3 }, //INPROGRESS
            { activityStatusId: 10 }, //ADVANCE PAYMENT PAID
            { activityStatusId: 14 }, //ADVANCE PAY LATER
          ],
        };
        // IF ADVANCE PAYMENT METHOD ID IS CASH(1069) THEN NOT INCLUDE REACHED GARAGE (18), CHARGES COLLECTED FROM CUSTOMER(31)
        // IF IT IS ONLINE(1070) OR NULL THEN NOT INCLUDE ADDITIONAL CHARGES (16), REACHED GARAGE(18), CHARGES COLLECTED FROM CUSTOMER(31)
        onGoingRequestWhere[Op.and] = [
          Sequelize.literal(`
              (CASE 
                WHEN activity.advancePaymentMethodId = 1069 THEN activity.activityAppStatusId NOT IN (18, 31)
                WHEN activity.advancePaymentMethodId = 1070 THEN activity.activityAppStatusId NOT IN (16, 18, 31)
                ELSE activity.activityAppStatusId NOT IN (16, 18, 31)
              END)
          `),
        ];
        ongoingRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: onGoingRequestWhere,
              include: [
                {
                  model: CaseDetails,
                  required: true,
                  where: {
                    statusId: 2, //INPROGRESS
                  },
                },
              ],
            },
          ],
        });
        inprogressRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: {
                [Op.or]: [
                  { activityStatusId: 3 }, //INPROGRESS
                  { activityStatusId: 9 }, //WAITING FOR DEALER APPROVAL
                  { activityStatusId: 10 }, //ADVANCE PAYMENT PAID
                  { activityStatusId: 14 }, //ADVANCE PAY LATER
                ],
              },
              include: [
                {
                  model: CaseDetails,
                  required: true,
                  where: {
                    statusId: {
                      [Op.ne]: 3, //CANCELLED
                    },
                  },
                },
              ],
            },
          ],
        });
        cancelledRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: {
                activityStatusId: 4, //CANCELLED
              },
            },
          ],
        });
        rejectedRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: {
                activityStatusId: 8, //REJECTED
              },
            },
          ],
        });
        failureRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: {
                activityStatusId: 5, //FAILURE
              },
            },
          ],
        });
        successRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: {
                [Op.or]: [
                  { activityStatusId: 7 }, //SUCCESSFUL
                  { activityStatusId: 11 }, //BALANCE PAYMENT PENDING
                  { activityStatusId: 12 }, //EXCESS AMOUNT CREDIT PENDING
                  { activityStatusId: 13 }, //PAYMENT NOT NEED
                ],
              },
            },
          ],
        });
        checkAspInDriving = await activityAspDetails.findOne({
          attributes: ["id", "activityId", "aspId"],
          where: activityAspDetailWhere,
          include: [
            {
              model: Activities,
              required: true,
              where: {
                activityStatusId: 3, //INPROGRESS,
                [Op.or]: [
                  { activityAppStatusId: 4 }, //STARTED TO PICKUP
                  { activityAppStatusId: 10 }, //STARTED TO DROP
                  { activityAppStatusId: 17 }, //STARTED TO GARAGE
                  { activityAppStatusId: 21 }, //STARTED TO BD
                ],
              },
            },
          ],
        });

        caseInprogressRequestCount = await activityAspDetails.count({
          attributes: [groupByColumn],
          where: activityAspDetailWhere,
          group: [groupByColumn],
          include: [
            {
              model: Activities,
              required: true,
              where: {
                activityStatusId: 3, //INPROGRESS
              },
              include: [
                {
                  model: CaseDetails,
                  required: true,
                  where: {
                    statusId: 2, //INPROGRESS
                  },
                },
              ],
            },
          ],
        });

        //GET ACTIVITY THAT WAS STARTED BY EITHER OWNER OR DRIVER
        let activeActivityWhere: any = {
          activityStatusId: 3, //INPROGRESS
          aspActivityStatusId: {
            [Op.in]: [3, 4, 5, 6, 14, 15], //3-Started To Pickup, 4-Reached Pickup, 5-Started To Drop Location, 6-Reached Drop Location, 14-Started To BD, 15-Reached BD
          },
        };
        // IF ADVANCE PAYMENT METHOD ID IS CASH(1069) THEN NOT INCLUDE REACHED GARAGE (18), CHARGES COLLECTED FROM CUSTOMER(31)
        // IF IT IS ONLINE(1070) OR NULL THEN NOT INCLUDE ADDITIONAL CHARGES (16), REACHED GARAGE(18), CHARGES COLLECTED FROM CUSTOMER(31)
        activeActivityWhere[Op.and] = [
          Sequelize.literal(`
              (CASE 
                WHEN activity.advancePaymentMethodId = 1069 THEN activity.activityAppStatusId NOT IN (18, 31)
                WHEN activity.advancePaymentMethodId = 1070 THEN activity.activityAppStatusId NOT IN (16, 18, 31)
                ELSE activity.activityAppStatusId NOT IN (16, 18, 31)
              END)
          `),
        ];
        activeActivity = await activityAspDetails.findOne({
          attributes: ["id", "activityId"],
          where: activityAspDetailWhere,
          order: [["id", "asc"]],
          include: [
            {
              model: Activities,
              required: true,
              where: activeActivityWhere,
              include: [
                {
                  model: CaseDetails,
                  required: true,
                  where: {
                    statusId: 2, //INPROGRESS
                  },
                },
              ],
            },
          ],
        });
      }

      const data = {
        aspIsInDriving: checkAspInDriving ? true : false,
        activityId: checkAspInDriving
          ? checkAspInDriving.dataValues.activityId
          : null,
        activeActivityId: activeActivity
          ? activeActivity.dataValues.activityId
          : null,
        aspId: checkAspInDriving ? checkAspInDriving.dataValues.aspId : null,
        totalDeliveryCount:
          totalDeliveryCount.length > 0 ? totalDeliveryCount[0].count : 0,
        activeRequestCount:
          activeRequestCount.length > 0 ? activeRequestCount[0].count : 0,
        assignedRequestCount:
          assignedRequestCount.length > 0 ? assignedRequestCount[0].count : 0,
        ongoingRequestCount:
          ongoingRequestCount.length > 0 ? ongoingRequestCount[0].count : 0,
        inprogressRequestCount:
          inprogressRequestCount.length > 0
            ? inprogressRequestCount[0].count
            : 0,
        cancelledRequestCount:
          cancelledRequestCount.length > 0 ? cancelledRequestCount[0].count : 0,
        rejectedRequestCount:
          rejectedRequestCount.length > 0 ? rejectedRequestCount[0].count : 0,
        failureRequestCount:
          failureRequestCount.length > 0 ? failureRequestCount[0].count : 0,
        successRequestCount:
          successRequestCount.length > 0 ? successRequestCount[0].count : 0,
        aspMechanicTypeId: aspMechanicTypeId,
        aspMechanicWorkStatusId: aspMechanicWorkStatusId,
        isInShift: isInShift,
        attendance: attendance,
        caseInprogressRequestCount:
          caseInprogressRequestCount.length > 0
            ? caseInprogressRequestCount[0].count
            : 0,
      };
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET CASE ACTIVITY LIST FOR ASP SEND REQUEST RESTRICTION lOGIC
  export async function getSendRequestActivities(req: Request, res: Response) {
    try {
      //Require data destructure;
      const { caseDetailId } = req.validBody;
      const data: any = [];
      const activityAspDetails = await ActivityAspDetails.findAll({
        attributes: [
          "activityId",
          "aspId",
          "subServiceId",
          "aspServiceAccepted",
          "rejectReasonId",
        ],
        order: [["id", "desc"]],
        include: [
          {
            model: Activities,
            attributes: [
              "caseDetailId",
              "activityStatusId",
              "aspActivityStatusId",
              "activityAppStatusId",
              "dealerApprovalStatusId",
            ],
            required: true,
            include: [
              {
                model: caseDetails,
                attributes: ["id"],
                required: true,
                where: {
                  id: caseDetailId,
                },
              },
            ],
          },
        ],
      });

      if (activityAspDetails.length > 0) {
        for (const activityAspDetail of activityAspDetails) {
          data.push({
            caseDetailId: caseDetailId,
            activityId: activityAspDetail.dataValues.activityId,
            aspId: activityAspDetail.dataValues.aspId,
            subServiceId: activityAspDetail.dataValues.subServiceId,
            aspServiceAccepted: activityAspDetail.dataValues.aspServiceAccepted,
            rejectReasonId: activityAspDetail.dataValues.rejectReasonId,
            activityStatusId:
              activityAspDetail.dataValues.activity.activityStatusId,
            aspActivityStatusId:
              activityAspDetail.dataValues.activity.aspActivityStatusId,
            activityAppStatusId:
              activityAspDetail.dataValues.activity.activityAppStatusId,
            dealerApprovalStatusId:
              activityAspDetail.dataValues.activity.dealerApprovalStatusId,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //get owner activities list
  export async function getAspActivitiesList(req: Request, res: Response) {
    try {
      //Require data destructure;
      const inData = req.validBody;
      const userId = inData.userId;
      const userTypeId = parseInt(inData.userTypeId as string);
      const limit = parseInt(inData.limit as string);
      const offset = parseInt(inData.offset as string);
      const statusId = parseInt(inData.statusId as string);
      const requestType = inData.requestType;
      const search = inData.search;
      const startDate = inData.startDate;
      const endDate = inData.endDate;
      let clientIds: any = [],
        vehicleTypeIds: any = [],
        vehicleMakeIds: any = [],
        vehicleModelIds: any = [],
        subServiceIds: any = [];

      let activityAspDetailWhere: any = {};
      // Owner login
      if (userTypeId === 142) {
        // activityAspDetailWhere.aspId = userId;

        let aspIds = [];
        aspIds.push(userId);

        //IF ASP IS FINANCE ADMIN THEN GET ITS SUB ASPS
        const aspSubAspResponse: any = await axios.get(
          `${masterService}/${endpointMaster.asps.getAspSubAsps}?aspId=${userId}`
        );

        if (
          aspSubAspResponse?.data?.success &&
          aspSubAspResponse?.data?.subAsps?.length > 0
        ) {
          const subAspIds = aspSubAspResponse.data.subAsps.map(
            (subAsp: any) => subAsp.id
          );
          aspIds.push(...subAspIds);
        }

        activityAspDetailWhere.aspId = {
          [Op.in]: aspIds,
        };
      } else if (userTypeId === 143) {
        // Driver login
        activityAspDetailWhere.aspMechanicId = userId;
      }

      //ACTIVITY STATUS FILTER
      let whereCase: any = {};
      let whereCaseDetail: any = {};
      whereCaseDetail.typeId = 32; //DELIVERY REQUEST CASES ONLY
      if (statusId) {
        //INPROGRESS
        if (statusId == 3) {
          whereCase.activityStatusId = [3, 9, 10, 14]; //INPROGRESS AND WAITING FOR DEALER APPROVAL AND ADVANCE PAYMENT PAID AND ADVANCE PAY LATER
        } else if (statusId == 7) {
          //COMPLETED
          whereCase.activityStatusId = [7, 11, 12, 13]; //SUCCESSFUL AND BALANCE PAYMENT PENDING AND EXCESS AMOUNT CREDIT PENDING AND PAYMENT NOT NEED
        } else {
          whereCase.activityStatusId = statusId;
        }
      }

      //ACTIVITY REQUEST LOGIC
      if (requestType == "activityRequest") {
        whereCase.activityStatusId = [1, 2, 9, 10, 14]; //OPEN || (ASSIGNED || WAITING FOR DEALER APPROVAL || ADVANCE AMOUNT PAID || ADVANCE PAY LATER) WITH DRIVER NOT ASSIGNED(OWNER ONLY)
        activityAspDetailWhere.aspServiceAccepted = [0, 1]; //not accepted and accepted only
        activityAspDetailWhere.aspMechanicId =
          userTypeId === 143 ? userId : null; //FOR COCO TECHNICIAN WE ARE ALLOWING ACTIVE REQUEST FOR ACCEPT & REJECT
        whereCaseDetail.statusId = 2; //INPROGRESS
      } else if (requestType == "ongoingRequest") {
        //ONGOING REQUEST LOGIC
        whereCase.activityStatusId = [3, 10, 14]; //INPROGRESS AND ADVANCE PAYMENT PAID AND ADVANCE PAY LATER

        // IF ADVANCE PAYMENT METHOD ID IS CASH(1069) THEN NOT INCLUDE REACHED GARAGE (18), CHARGES COLLECTED FROM CUSTOMER(31)
        // IF IT IS ONLINE(1070) OR NULL THEN NOT INCLUDE ADDITIONAL CHARGES (16), REACHED GARAGE(18), CHARGES COLLECTED FROM CUSTOMER(31)
        whereCase[Op.and] = [
          Sequelize.literal(`
              (CASE 
                WHEN activity.advancePaymentMethodId = 1069 THEN activity.activityAppStatusId NOT IN (18, 31)
                WHEN activity.advancePaymentMethodId = 1070 THEN activity.activityAppStatusId NOT IN (16, 18, 31)
                ELSE activity.activityAppStatusId NOT IN (16, 18, 31)
              END)
          `),
        ];
        whereCaseDetail.statusId = 2; //INPROGRESS
      } else {
        whereCaseDetail.statusId = [1, 2, 3, 4]; //OPEN || INPROGRESS || CANCELED || CLOSED
      }

      if (search) {
        const masterDataResponse = await axios.get(
          `${masterService}/${endpointMaster.aspActivitiesSearchMasterData}?search=${search}`
        );

        if (masterDataResponse.data.success) {
          clientIds = masterDataResponse.data.data.clientIds;
          vehicleTypeIds = masterDataResponse.data.data.vehicleTypeIds;
          vehicleMakeIds = masterDataResponse.data.data.vehicleMakeIds;
          vehicleModelIds = masterDataResponse.data.data.vehicleModelIds;
          subServiceIds = masterDataResponse.data.data.subServiceIds;
        }

        if (subServiceIds.length == 0) {
          whereCaseDetail[Op.or] = [
            { caseNumber: { [Op.like]: `%${search}%` } },
            { vin: { [Op.like]: `%${search}%` } },
            { registrationNumber: { [Op.like]: `%${search}%` } },
            clientIds.length > 0 ? { clientId: { [Op.in]: clientIds } } : null,
            vehicleTypeIds.length > 0
              ? { vehicleTypeId: { [Op.in]: vehicleTypeIds } }
              : null,
            vehicleMakeIds.length > 0
              ? { vehicleMakeId: { [Op.in]: vehicleMakeIds } }
              : null,
            vehicleModelIds.length > 0
              ? { vehicleModelId: { [Op.in]: vehicleModelIds } }
              : null,
          ];
        } else {
          activityAspDetailWhere.subServiceId = { [Op.in]: subServiceIds };
        }
      }

      if (startDate !== undefined && endDate !== undefined) {
        whereCase[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("activity.createdAt")),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("activity.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      const data = await activityAspDetails.findAndCountAll({
        attributes: [
          "activityId",
          "aspId",
          "subServiceId",
          "estimatedTotalKm",
          "estimatedTotalDuration",
          "estimatedAspToBreakdownKm",
          "estimatedAspToBreakdownKmDuration",
        ],
        order: [["activityId", "desc"]],
        where: activityAspDetailWhere,
        include: [
          {
            model: Activities,
            attributes: [
              "id",
              "caseDetailId",
              "activityStatusId",
              "aspActivityStatusId",
              "activityAppStatusId",
              "dealerApprovalStatusId",
              "enableAspWaitingTimeInApp",
              "isAspAcceptedCcDetail",
              "serviceStatus",
              "advancePaymentMethodId",
              "aspServiceAcceptedAt",
              "customerNeedToPay",
            ],
            required: true,
            where: whereCase,
            include: [
              {
                model: caseDetails,
                attributes: [
                  "id",
                  "typeId",
                  "clientId",
                  "agentAssignedAt",
                  "caseNumber",
                  "registrationNumber",
                  "vin",
                  "vehicleTypeId",
                  "vehicleMakeId",
                  "vehicleModelId",
                  "subjectID",
                  "statusId",
                  "deliveryRequestSubServiceId",
                  "deliveryRequestPickupDate",
                  "deliveryRequestPickupTime",
                  "createdAt",
                ],
                required: true,
                where: whereCaseDetail,
                include: [
                  {
                    model: CaseInformation,
                    attributes: [
                      "id",
                      "caseTypeId",
                      "irateCustomer",
                      "womenAssist",
                    ],
                    required: false,
                  },
                ],
              },
              {
                model: ActivityTransactions,
                attributes: [
                  "activityId",
                  "paymentTypeId",
                  "transactionTypeId",
                  "paymentStatusId",
                  "paidAt",
                ],
                required: false,
              },
              {
                model: CrmSla,
                attributes: ["id", "slaConfigId", "slaStatus", "statusColor"],
                required: false,
              },
            ],
          },
        ],
        limit: limit ? limit : defaultLimit,
        offset: offset ? offset : defaultOffset,
      });
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //get owner activities list - BuddyApp
  export async function getAspActivitiesListBuddyApp(req: Request, res: Response) {
    try {
      //Require data destructure;
      const inData = req.validBody;
      const entityId = inData.entityId;
      const userTypeId = parseInt(inData.userTypeId as string);
      const limit = parseInt(inData.limit as string);
      const offset = parseInt(inData.offset as string);
      const search = inData.search;
      const startDate = inData.startDate;
      const endDate = inData.endDate;
      const type = inData.type;
      let clientIds: any = [],
        vehicleTypeIds: any = [],
        vehicleMakeIds: any = [],
        vehicleModelIds: any = [],
        subServiceIds: any = [];

      let activityAspDetailWhere: any = {};
      // Owner login
      if (userTypeId === 142) {
        let aspIds = [];
        aspIds.push(entityId);

        //IF ASP IS FINANCE ADMIN THEN GET ITS SUB ASPS
        const aspSubAspResponse: any = await axios.get(
          `${masterService}/${endpointMaster.asps.getAspSubAsps}?aspId=${entityId}`
        );

        if (
          aspSubAspResponse?.data?.success &&
          aspSubAspResponse?.data?.subAsps?.length > 0
        ) {
          const subAspIds = aspSubAspResponse.data.subAsps.map(
            (subAsp: any) => subAsp.id
          );
          aspIds.push(...subAspIds);
        }

        activityAspDetailWhere.aspId = {
          [Op.in]: aspIds,
        };
      } else if (userTypeId === 143) {
        // Driver login
        activityAspDetailWhere.aspMechanicId = entityId;
      }

      let whereCase: any = {};
      let whereCaseDetail: any = {};
      whereCaseDetail.statusId = [1, 2, 3, 4]; //OPEN || INPROGRESS || CANCELED || CLOSED
      whereCaseDetail.typeId = 31; //RSA CASES ONLY

      if (search) {
        const masterDataResponse = await axios.get(
          `${masterService}/${endpointMaster.aspActivitiesSearchMasterData}?search=${search}`
        );

        if (masterDataResponse.data.success) {
          clientIds = masterDataResponse.data.data.clientIds;
          vehicleTypeIds = masterDataResponse.data.data.vehicleTypeIds;
          vehicleMakeIds = masterDataResponse.data.data.vehicleMakeIds;
          vehicleModelIds = masterDataResponse.data.data.vehicleModelIds;
          subServiceIds = masterDataResponse.data.data.subServiceIds;
        }

        if (subServiceIds.length == 0) {
          whereCaseDetail[Op.or] = [
            { caseNumber: { [Op.like]: `%${search}%` } },
            { vin: { [Op.like]: `%${search}%` } },
            { registrationNumber: { [Op.like]: `%${search}%` } },
            clientIds.length > 0 ? { clientId: { [Op.in]: clientIds } } : null,
            vehicleTypeIds.length > 0
              ? { vehicleTypeId: { [Op.in]: vehicleTypeIds } }
              : null,
            vehicleMakeIds.length > 0
              ? { vehicleMakeId: { [Op.in]: vehicleMakeIds } }
              : null,
            vehicleModelIds.length > 0
              ? { vehicleModelId: { [Op.in]: vehicleModelIds } }
              : null,
          ];
        } else {
          activityAspDetailWhere.subServiceId = { [Op.in]: subServiceIds };
        }
      }

      if (startDate !== undefined && endDate !== undefined) {
        whereCase[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("activity.createdAt")),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("activity.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      // ACTIVE REQUESTS
      if (type == "activeRequest") {
        whereCase.activityStatusId = [1, 2, 3, 10, 14]; // OPEN || ASSIGNED || INPROGRESS || ADVANCE AMOUNT PAID || ADVANCE PAY LATER
        whereCase.aspActivityStatusId = {
          [Op.or]: [
            { [Op.eq]: null }, // NULL
            { [Op.in]: [1, 2, 14, 15, 16, 17, 18, 13] }, // ACCEPTED || WAITING FOR SERVICE INITIATION || STARTED TO BD || REACHED BD || STARTED TO DEALER || REACHED DEALER || ACTIVITY STARTED || ACTIVITY ENDED
          ]
        };
        whereCaseDetail.statusId = 2; // INPROGRESS
      }

      const data = await activityAspDetails.findAndCountAll({
        attributes: [
          "activityId",
          "aspId",
          "aspMechanicId",
          "subServiceId",
          "serviceId",
        ],
        order: [["activityId", "desc"]],
        where: activityAspDetailWhere,
        include: [
          {
            model: Activities,
            attributes: [
              "id",
              "caseDetailId",
              "activityStatusId",
              "aspActivityStatusId",
              "aspServiceAcceptedAt",
              "customerNeedToPay",
              "advancePaymentMethodId",
            ],
            required: true,
            where: whereCase,
            include: [
              {
                model: caseDetails,
                attributes: [
                  "id",
                  "caseNumber",
                  "subjectID",
                  "statusId",
                  "registrationNumber",
                  "vehicleMakeId",
                  "vehicleModelId",
                  "createdAt",
                ],
                required: true,
                where: whereCaseDetail,
                include: [
                  {
                    model: CaseInformation,
                    attributes: [
                      "breakdownLocation",
                      "breakdownLat",
                      "breakdownLong",
                      "customerContactName",
                      "customerMobileNumber",
                    ],
                    required: false,
                  },
                ],
              },
              {
                model: ActivityTransactions,
                attributes: [
                  "id",
                  "activityId",
                  "paymentTypeId",
                  "transactionTypeId",
                  "paymentStatusId",
                  "paidAt",
                  "refundStatusId",
                ],
                required: false,
                where: {
                  paymentTypeId: {
                    [Op.in]: [174], // One time service (174)
                  },
                },
              },
            ],
          },
        ],
        limit: limit ? limit : defaultLimit,
        offset: offset ? offset : defaultOffset,
      });
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Update Activity Status
  // Helper function to determine status flag for buddyAPP (CRM cases only)
  const getBuddyAppStatusFlag = (
    activity: any,
    requestedAspActivityStatusId: number
  ): string | null => {
    // Only for CRM cases
    if (!activity || !activity.caseDetail || activity.caseDetail.typeId !== 31) {
      return "3";
    }

    // Flag "3" (Canceled): If activity is canceled
    if (
      activity.activityStatusId == 4 ||
      activity.aspActivityStatusId == 10
    ) {
      return "3";
    }

    // Map aspActivityStatusId to corresponding datetime column
    let datetimeColumn: string | null = null;
    const statusId = typeof requestedAspActivityStatusId === 'string'
      ? parseInt(requestedAspActivityStatusId)
      : requestedAspActivityStatusId;
    switch (statusId) {
      case 3: // Started To Pickup
        datetimeColumn = "aspStartedToPickupAt";
        break;
      case 4: // Reached Pickup
        datetimeColumn = "aspReachedToPickupAt";
        break;
      case 5: // Started To Drop
      case 16: // Started to Dealer
        datetimeColumn = "aspStartedToDropAt";
        break;
      case 6: // Reached Drop
      case 17: // Reached Dealer
        datetimeColumn = "aspReachedToDropAt";
        break;
      case 7: // Started To Garage
        datetimeColumn = "aspStartedToGarageAt";
        break;
      case 8: // Reached Garage
        datetimeColumn = "aspReachedToGarageAt";
        break;
      case 9: // End Service
        datetimeColumn = "aspEndServiceAt";
        break;
      case 13: // Activity Ended
        datetimeColumn = "serviceEndDateTime";
        break;
      case 14: // Started To BD
        datetimeColumn = "aspStartedToBreakdownAt";
        break;
      case 15: // Reached BD
        datetimeColumn = "aspReachedToBreakdownAt";
        break;
      case 18: // Activity Started
        datetimeColumn = "serviceStartDateTime";
        break;
      default:
        return null;
    }

    // Check if datetime column is set (action completed)
    if (datetimeColumn && activity[datetimeColumn] !== null) {
      return "1"; // Skip - already completed
    }

    return "2"; // Proceed - not completed
  };

  // Helper function to add flag to response object
  const addFlagToResponse = (
    response: any,
    activity: any,
    requestedAspActivityStatusId: number,
    routeOrigin: string | null | undefined
  ): any => {
    if (routeOrigin === "buddyApp") {
      const flag = getBuddyAppStatusFlag(activity, requestedAspActivityStatusId);
      if (flag !== null) {
        response.appActivityStatusFlag = flag;
      }
    }
    return response;
  };

  export async function updateAspActivityStatus(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    // Extract routeOrigin and aspActivityStatusId early for use in catch block
    const routeOrigin = req.validBody?.routeOrigin;
    const aspActivityStatusId = req.validBody?.aspActivityStatusId;
    try {
      const {
        activityId,
        fromLogTypeId,
        authUserId,
        authUserRoleId,
        slaViolateReasonId,
        slaViolateReasonComments,
        dateTime,
        authUserData,
      } = req.validBody;

      let logTypeId = null;
      if (fromLogTypeId && fromLogTypeId == 240) {
        //WEB
        logTypeId = fromLogTypeId;
      } else {
        //MOBILE
        logTypeId = 241;
      }

      let formattedDateTime = null;
      if (dateTime) {
        formattedDateTime = moment.tz(dateTime, "Asia/Kolkata").toDate();
      }

      const activity: any = await Activities.findOne({
        where: {
          id: activityId,
          activityStatusId: {
            [Op.in]: [10, 3, 14], // 10-Advance Payment Paid, 3-In Progress, 14-Advance Pay Later
          },
        },
        attributes: [
          "id",
          "aspActivityStatusId",
          "activityStatusId",
          "serviceStartDateTime",
          "serviceEndDateTime",
          "aspStartedToBreakdownAt",
          "aspReachedToBreakdownAt",
          "aspStartedToPickupAt",
          "aspReachedToPickupAt",
          "aspStartedToDropAt",
          "aspReachedToDropAt",
          "aspStartedToGarageAt",
          "aspReachedToGarageAt",
          "aspEndServiceAt",
        ],
        include: [
          {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            attributes: [
              "id",
              "clientId",
              "vin",
              "registrationNumber",
              "dealerId",
              "deliveryRequestDropDealerId",
              "contactNumberAtPickUp",
              "contactNumberAtDrop",
              "deliveryRequestPickUpLocation",
              "deliveryRequestDropLocation",
              "caseNumber",
              "typeId",
              "agentId",
              "createdAt",
            ],
            required: true,
            include: [
              {
                model: CaseInformation,
                attributes: [
                  "id",
                  "customerCurrentMobileNumber",
                  "customerMobileNumber",
                  "breakdownLocation",
                  "breakdownAreaId",
                  "dropDealerId",
                  "dropLocation",
                  "dropLocationTypeId",
                  "policyTypeId",
                  "policyNumber",
                  "serviceEligibilityId",
                ],
                required: false,
              },
            ],
          },
          {
            model: ActivityAspDetails,
            attributes: ["id", "aspId", "subServiceId"],
            required: true,
          },
        ],
      });
      if (!activity) {
        await transaction.rollback();
        const response = addFlagToResponse(
          {
            success: false,
            error: "Activity not found",
          },
          null,
          aspActivityStatusId,
          routeOrigin
        );
        return res.status(200).json(response);
      }

      // Check if the requested aspActivityStatusId is already completed (only for buddyAPP and CRM cases)
      if (routeOrigin === "buddyApp" && activity.caseDetail?.typeId === 31) {
        const statusFlag = getBuddyAppStatusFlag(activity, aspActivityStatusId);
        if (statusFlag === "1") {
          // Status is already completed - block the process
          await transaction.rollback();
          const response = addFlagToResponse(
            {
              success: false,
              error: "This activity status has already been completed",
            },
            activity,
            aspActivityStatusId,
            routeOrigin
          );
          return res.status(200).json(response);
        }
      }

      let setParanoidFalse = false;
      //AGENT
      if (authUserRoleId == 3) {
        setParanoidFalse = true;
      }

      const [getASPDetail, getAgentDetail, getMasterDetail]: any =
        await Promise.all([
          // GET ASP DETAILS
          Utils.getAspDetail(
            activity.activityAspDetail.dataValues.aspId,
            setParanoidFalse
          ),
          // GET AGENT DETAILS
          Utils.getUserDetail(activity.caseDetail.dataValues.agentId),
          // GET SUB SERVICE MASTER DETAILS
          axios.post(`${masterService}/${endpointMaster.getMasterDetails}`, {
            subServiceId: activity.activityAspDetail.subServiceId,
            getAspActivityStatusWithoutValidation: aspActivityStatusId,
          }),
        ]);

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        const response = addFlagToResponse(
          {
            success: false,
            error: "ASP not found",
          },
          activity,
          aspActivityStatusId,
          routeOrigin
        );
        return res.status(200).json(response);
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        const response = addFlagToResponse(
          {
            success: false,
            error: "Agent not found",
          },
          activity,
          aspActivityStatusId,
          routeOrigin
        );
        return res.status(200).json(response);
      }

      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        const response = addFlagToResponse(
          getMasterDetail.data,
          activity,
          aspActivityStatusId,
          routeOrigin
        );
        return res.status(200).json(response);
      }

      let aspGarageLocation = getASPDetail.data.data.addressLineOne;
      if (getASPDetail.data.data.addressLineTwo) {
        aspGarageLocation += `, ${getASPDetail.data.data.addressLineTwo}`;
      }

      let dealerPickupLocation = null;
      let dealerDropLocation = null;
      //DELIVERY REQUEST
      if (activity.caseDetail.dataValues.typeId == 32) {
        dealerPickupLocation =
          activity.caseDetail.dataValues.deliveryRequestPickUpLocation;
        dealerDropLocation =
          activity.caseDetail.dataValues.deliveryRequestDropLocation;
      } else {
        //RSA
        if (!activity.caseDetail.caseInformation) {
          await transaction.rollback();
          const response = addFlagToResponse(
            {
              success: false,
              error: "Case information not found",
            },
            activity,
            aspActivityStatusId,
            routeOrigin
          );
          return res.status(200).json(response);
        }

        dealerPickupLocation =
          activity.caseDetail.caseInformation.dataValues.breakdownLocation;
        dealerDropLocation =
          activity.caseDetail.caseInformation.dataValues.dropLocation;
      }

      let activityAppStatusId = null;
      let activityLogTitle = null;
      let activityLogDescription = null;
      let actionTypeId = null;

      // FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activity.caseDetail.dataValues.id,
        notifyToAll: [""],
        workshopName: getASPDetail.data.data.workshopName,
      };
      let sendFcmPushNotification = false;

      if (parseInt(aspActivityStatusId) == 3) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 21; // STARTED TO PICKUP
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }

        activityAppStatusId = 4; // STARTED TO PICKUP
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has started to pickup location.`;
        } else {
          //WEB
          activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the status to "Started To Pickup".`;
        }
        activityLogDescription = aspGarageLocation ? aspGarageLocation : null;
        actionTypeId = 1011; //Activity start to pickup
      } else if (parseInt(aspActivityStatusId) == 4) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 22; // REACHED PICKUP
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }

        activityAppStatusId = 5; // REACHED PICKUP
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has reached to pickup location.`;
        } else {
          //WEB
          activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the status to "Reached To Pickup".`;
        }
        activityLogDescription = dealerPickupLocation
          ? dealerPickupLocation
          : null;
        actionTypeId = 1012; //Activity reached to pickup
      } else if (parseInt(aspActivityStatusId) == 5) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 26; // STARTED TO DROP
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }

        activityAppStatusId = 10; // STARTED TO DROP
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has started to drop location.`;
        } else {
          //WEB
          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to  "Started To Drop".`;
        }
        activityLogDescription = dealerPickupLocation
          ? dealerPickupLocation
          : null;
      } else if (parseInt(aspActivityStatusId) == 6) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 27; //  REACHED DROP
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }

        activityAppStatusId = 11; // REACHED DROP
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has reached to drop location.`;
        } else {
          //WEB
          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to "Reached To Drop".`;
        }
        activityLogDescription = dealerDropLocation ? dealerDropLocation : null;
      } else if (parseInt(aspActivityStatusId) == 7) {
        // Push notification template id
        sendFcmPushNotification = true;

        if (activity.caseDetail.dataValues.typeId == 32) {
          // VDM Notifications
          details.templateId = 32; //   STARTED TO GARAGE
          details.aspDetail = activity.activityAspDetail.dataValues.aspId;
          details.workshopName = getASPDetail.data.data.workshopName;
          if (logTypeId == 241) {
            details.sourceFrom = 2; //Mobile
          }
        } else {
          // CRM Notifications
          details.templateId = 11; //   STARTED TO GARAGE
          details.aspDetail = activity.activityAspDetail.dataValues.aspId;
          details.workshopName = getASPDetail.data.data.workshopName;
          details.notificationType = "CRM";
          if (logTypeId == 241) {
            details.sourceFrom = 2; //Mobile
          }
        }

        activityAppStatusId = 17; // STARTED TO GARAGE
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has started to garage location.`;
        } else {
          //WEB
          // activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the status to "Started To Garage".`;

          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to "Started To Garage".`;
        }
        activityLogDescription = dealerDropLocation ? dealerDropLocation : null;
      } else if (parseInt(aspActivityStatusId) == 8) {
        // Push notification template id
        sendFcmPushNotification = true;
        if (activity.caseDetail.dataValues.typeId == 32) {
          // VDM Notifications
          details.templateId = 33; //  REACHED GARAGE
          details.aspDetail = activity.activityAspDetail.dataValues.aspId;
          details.workshopName = getASPDetail.data.data.workshopName;
          if (logTypeId == 241) {
            details.sourceFrom = 2; //Mobile
          }
        } else {
          // CRM Notifications
          details.templateId = 12; //   REACHED GARAGE
          details.aspDetail = activity.activityAspDetail.dataValues.aspId;
          details.workshopName = getASPDetail.data.data.workshopName;
          details.notificationType = "CRM";
          if (logTypeId == 241) {
            details.sourceFrom = 2; //Mobile
          }
        }
        activityAppStatusId = 18; // REACHED GARAGE
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has reached to garage location.`;
        } else {
          //WEB
          // activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the status to "Reached To Garage".`;

          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to "Reached To Garage".`;
        }
        activityLogDescription = aspGarageLocation ? aspGarageLocation : null;
      } else if (parseInt(aspActivityStatusId) == 9) {
        //END SERVICE
        activityAppStatusId = 19; // END SERVICE
        //MOBILE
        if (logTypeId == 241) {
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has ended the service.`;
        } else {
          //WEB
          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has ended the service.`;
        }
      } else if (parseInt(aspActivityStatusId) == 18) {
        //ACTIVITY STARTED
        activityAppStatusId = 25; // RSA Service Started
        //MOBILE
        if (logTypeId == 241) {
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has started the service.`;
        } else {
          //WEB
          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has started the service.`;
        }
      } else if (parseInt(aspActivityStatusId) == 13) {
        //ACTIVITY ENDED
        activityAppStatusId = 26; // RSA Service Ended
        //MOBILE
        if (logTypeId == 241) {
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has ended the service.`;
        } else {
          //WEB
          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has ended the service.`;
        }
      } else if (parseInt(aspActivityStatusId) == 14) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 9; // STARTED TO BD
        details.notificationType = "CRM";
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }

        activityAppStatusId = 21; // STARTED TO BD
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has started to breakdown location.`;
        } else {
          //WEB
          // activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the status to "Started To Breakdown".`;

          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to "Started To Breakdown".`;
        }
        activityLogDescription = aspGarageLocation ? aspGarageLocation : null;
        actionTypeId = 1013; //Activity start to breakdown
      } else if (parseInt(aspActivityStatusId) == 15) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 10; // REACHED BD
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        details.notificationType = "CRM";
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }
        activityAppStatusId = 22; // REACHED BD
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has reached to breakdown location.`;
        } else {
          //WEB
          // activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the status to "Reached To Breakdown".`;

          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to "Reached To Breakdown".`;
        }

        activityLogDescription = dealerPickupLocation
          ? dealerPickupLocation
          : null;
        actionTypeId = 1014; //Activity reached to breakdown
      } else if (parseInt(aspActivityStatusId) == 16) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 13; // STARTED TO DEALER
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        details.notificationType = "CRM";
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }

        activityAppStatusId = 10; // STARTED TO DEALER
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has started to dealer location.`;
        } else {
          //WEB
          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to  "Started To Dealer".`;
        }
        activityLogDescription = dealerPickupLocation
          ? dealerPickupLocation
          : null;
      } else if (parseInt(aspActivityStatusId) == 17) {
        // Push notification template id
        sendFcmPushNotification = true;
        details.templateId = 14; //  REACHED DEALER
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.workshopName = getASPDetail.data.data.workshopName;
        details.notificationType = "CRM";
        if (logTypeId == 241) {
          details.sourceFrom = 2; //Mobile
        }

        activityAppStatusId = 11; // REACHED DEALER
        if (logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has reached to dealer location.`;
        } else {
          //WEB
          activityLogTitle = `The ${authUserData.role.name} "${authUserData.name}" has updated the status to "Reached Dealer".`;
        }
        activityLogDescription = dealerDropLocation ? dealerDropLocation : null;
      }

      //IF REACHED PICKUP OR REACHED DROP LOCATION OR REACHED BREAKDOWN OR REACHED DEALER LOCATION
      if (
        parseInt(aspActivityStatusId) == 4 ||
        parseInt(aspActivityStatusId) == 6 ||
        parseInt(aspActivityStatusId) == 15 ||
        parseInt(aspActivityStatusId) == 17
      ) {
        //GENERATE OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString(); //4 DIGIT

        const pickupDealerId = activity.caseDetail.dataValues.dealerId;
        let dropDealerId = null;
        //DELIVERY REQUEST
        if (activity.caseDetail.dataValues.typeId == 32) {
          dropDealerId =
            activity.caseDetail.dataValues.deliveryRequestDropDealerId;
        } else {
          //RSA
          dropDealerId =
            activity.caseDetail.caseInformation.dataValues.dropDealerId;
        }

        const contactNumberAtPickUp =
          activity.caseDetail.dataValues.contactNumberAtPickUp;
        const contactNumberAtDrop =
          activity.caseDetail.dataValues.contactNumberAtDrop;

        // SEND OTP
        let emailSubject: string = "";
        let toEmailAddress: string = "";
        let toMobileNumber: string = "";
        let smsSubject: string = "";
        let smsType: string = "";
        let sendEmailProcess = true;
        let sendSmsProcess = true;
        let updateSlaAchievedDelayed = false;

        let notifiDetails: any = {
          caseDetailId: activity.dataValues.caseDetailId,
          notifyToAll: [""],
        };
        //REACHED PICKUP LOCATION
        if (parseInt(aspActivityStatusId) == 4) {
          emailSubject = `Vehicle Delivery Request ${activity.caseDetail.dataValues.caseNumber} - Pickup OTP!`;
          // smsSubject = `Pl share this OTP ${otp} to the service provider to confirm pickup of your vehicle. Team TVS AUTO ASSIST`;
          smsSubject = `Pl share this OTP ${otp} to the service provider to confirm pickup of your Request id:${activity.caseDetail.dataValues.caseNumber}. Team TVS AUTO ASSIST`;
          smsType = "pickup";

          //GET PICKUP DEALER EMAIL ADDRESS
          if (pickupDealerId) {
            const pickupDealerDetail = await axios.get(
              `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${pickupDealerId}`
            );
            if (!pickupDealerDetail.data.success) {
              await transaction.rollback();
              const response = addFlagToResponse(
                {
                  success: false,
                  error: pickupDealerDetail.data.error,
                },
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }

            toEmailAddress = pickupDealerDetail.data.data.email;
            if (!toEmailAddress) {
              await transaction.rollback();
              const response = addFlagToResponse(
                {
                  success: false,
                  error: "Pickup Dealer Email address not found",
                },
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }
          } else {
            sendEmailProcess = false;
          }

          toMobileNumber = contactNumberAtPickUp;
          if (!toMobileNumber) {
            await transaction.rollback();
            const response = addFlagToResponse(
              {
                success: false,
                error: "Pickup Dealer Mobile Number not found",
              },
              activity,
              aspActivityStatusId,
              routeOrigin
            );
            return res.status(200).json(response);
          }

          //SLA VIOLATE REASON PROCESS
          const aspReachedToPickupViolationCheckRequest = {
            activityId: activityId,
            slaViolateReasonId: slaViolateReasonId ? slaViolateReasonId : null,
            authUserId: authUserId,
            authUserRoleId: authUserRoleId ? authUserRoleId : null,
            slaViolateReasonComments: slaViolateReasonComments
              ? slaViolateReasonComments
              : null,
            transaction: transaction,
          };
          const aspReachedToPickupViolationCheckResponse: any =
            await caseSlaController.aspReachedPickupViolationCheck(
              aspReachedToPickupViolationCheckRequest
            );
          if (!aspReachedToPickupViolationCheckResponse.success) {
            await transaction.rollback();
            return res
              .status(200)
              .json(aspReachedToPickupViolationCheckResponse);
          }

          // send notifications to Agent and TL
          notifiDetails.templateId = 50; //  REACHED PICKUP LOCATION OTP TEMPLATE
          notifiDetails.otp = otp;
          notificationController.sendNotification(notifiDetails);
        } else if (parseInt(aspActivityStatusId) == 6 || parseInt(aspActivityStatusId) == 17) {
          // REACHED DROP LOCATION

          //DELIVERY REQUEST
          if (activity.caseDetail.dataValues.typeId == 32) {
            emailSubject = `Vehicle Delivery Request ${activity.caseDetail.dataValues.caseNumber} - Drop OTP!`;
          } else {
            //RSA
            emailSubject = `Roadside Assistance Request ${activity.caseDetail.dataValues.caseNumber} - Drop OTP!`;
          }

          smsSubject = `Pl share this OTP ${otp} to the service provider to confirm receipt of your Request id:${activity.caseDetail.dataValues.caseNumber}. Team TVS AUTO ASSIST`;
          smsType = "drop";

          let dropDealerDetail = null;
          if (dropDealerId) {
            //GET DROP DEALER EMAIL ADDRESS
            dropDealerDetail = await axios.get(
              `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${dropDealerId}`
            );
            if (!dropDealerDetail.data.success) {
              await transaction.rollback();
              const response = addFlagToResponse(
                {
                  success: false,
                  error: dropDealerDetail.data.error,
                },
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }

            toEmailAddress = dropDealerDetail.data.data.email;
            if (!toEmailAddress) {
              await transaction.rollback();
              const response = addFlagToResponse(
                {
                  success: false,
                  error: "Drop Dealer Email address not found",
                },
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }
          } else {
            sendEmailProcess = false;
          }

          //DELIVERY REQUEST
          if (activity.caseDetail.dataValues.typeId == 32) {
            toMobileNumber = contactNumberAtDrop;
            if (!toMobileNumber) {
              await transaction.rollback();
              const response = addFlagToResponse(
                {
                  success: false,
                  error: "Drop Dealer Mobile Number not found",
                },
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }
          } else if (
            activity.caseDetail.dataValues.typeId == 31 &&
            dropDealerId &&
            dropDealerDetail &&
            dropDealerDetail.data.success
          ) {
            //RSA AND DROP LOCATION IS DEALER BASED
            toMobileNumber = dropDealerDetail.data.data.mobileNumber;
            if (!toMobileNumber) {
              await transaction.rollback();
              const response = addFlagToResponse(
                {
                  success: false,
                  error: "Drop Dealer Mobile Number not found",
                },
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }
          } else if (
            activity.caseDetail.dataValues.typeId == 31 &&
            activity.caseDetail.caseInformation &&
            activity.caseDetail.caseInformation.dataValues
              .customerCurrentMobileNumber
          ) {
            //RSA AND DROP LOCATION IS CUSTOMER BASED
            toMobileNumber =
              activity.caseDetail.caseInformation.dataValues
                .customerCurrentMobileNumber;
            if (!toMobileNumber) {
              await transaction.rollback();
              const response = addFlagToResponse(
                {
                  success: false,
                  error: "Drop Customer Mobile Number not found",
                },
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }
          } else {
            sendSmsProcess = false;
          }
          // send notifications to Agent and TL
          notifiDetails.templateId = 51; //  REACHED DROP LOCATION OTP TEMPLATE
          notifiDetails.otp = otp;
          notificationController.sendNotification(notifiDetails);
        } else {
          // REACHED BD LOCATION
          sendSmsProcess = false;
          sendEmailProcess = false;

          // smsSubject = `Pl share this OTP ${otp} to the service provider to confirm pickup of your Request id:${activity.caseDetail.dataValues.caseNumber}. Team TVS AUTO ASSIST`;
          // smsType = "pickup";

          toMobileNumber = activity.caseDetail.caseInformation
            ? activity.caseDetail.caseInformation.dataValues
              .customerCurrentMobileNumber
            : null;
          if (!toMobileNumber) {
            await transaction.rollback();
            const response = addFlagToResponse(
              {
                success: false,
                error: "Customer mobile number not found",
              },
              activity,
              aspActivityStatusId,
              routeOrigin
            );
            return res.status(200).json(response);
          }

          //IF DATETIME GIVEN FROM FRONT END THEN GIVEN DATE TIME IS BD REACH TIME OTHERWISE CURRENT DATETIME IS BD REACH TIME
          const breakdownReachTime = formattedDateTime
            ? moment
              .tz(formattedDateTime, "Asia/Kolkata")
              .format("YYYY-MM-DD HH:mm:ss")
            : moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");

          // CHECK BD REACH SLA VIOLATION FOR WEB ONLY
          if (logTypeId == 240) {
            const slaViolateRequests = {
              caseDetailId: activity.caseDetail.id,
              activityId: activity.id,
              typeId: 870, //ASP Breakdown Reach Time SLA - L1
              date: breakdownReachTime,
              slaViolateReasonId: slaViolateReasonId ? slaViolateReasonId : null,
              slaViolateReasonComments: slaViolateReasonComments
                ? slaViolateReasonComments
                : null,
              authUserRoleId: authUserRoleId ? authUserRoleId : null,
              authUserId: authUserId,
              transaction: transaction,
            };

            const slaViolateReasonProcessResponse =
              await crmSlaController.processSlaViolateReason(slaViolateRequests);
            if (!slaViolateReasonProcessResponse.success) {
              await transaction.rollback();
              const response = addFlagToResponse(
                slaViolateReasonProcessResponse,
                activity,
                aspActivityStatusId,
                routeOrigin
              );
              return res.status(200).json(response);
            }
          }

          //GET SLA SETTING BASED ON CASE TYPE, TYPE ID AND CASE BREAKDOWN AREA LOCATION TYPE
          const slaSettingResponse = await axios.post(
            `${masterService}/${endpointMaster.sla.getByCaseTypeAndTypeId}`,
            {
              caseTypeId: activity.caseDetail.typeId,
              typeId: 870,
              breakdownAreaId:
                activity.caseDetail.caseInformation.breakdownAreaId, //ASP BREADOWN REACH TIME SLA - L1
            }
          );
          if (!slaSettingResponse.data.success) {
            await transaction.rollback();
            const response = addFlagToResponse(
              slaSettingResponse.data,
              activity,
              aspActivityStatusId,
              routeOrigin
            );
            return res.status(200).json(response);
          }

          let caseBaseDate: any = await getComparisionDate(
            activity,
            activity.caseDetail
          );
          if (caseBaseDate) {
            const breakdownReachSlaTime = moment
              .tz(caseBaseDate, "Asia/Kolkata")
              .add(slaSettingResponse.data.data.time, "seconds")
              .format("YYYY-MM-DD HH:mm:ss");

            if (breakdownReachTime <= breakdownReachSlaTime) {
              updateSlaAchievedDelayed = true;
            }
          }

          const templateReplacements = {
            "{OTP}": otp,
            "{ticket_no}": activity.caseDetail.caseNumber,
          };

          sendEscalationSms(
            toMobileNumber,
            templateReplacements,
            952, //Activity
            activityId,
            null,
            127, //OTP Customer
            null
          );
        }

        const portalLogoUrl = `${process.env.API_GATEWAY_URL}images/portalLogo.png`;
        //Email Send
        if (sendEmailProcess) {
          sendEmail(otp, emailSubject, toEmailAddress, portalLogoUrl);
        }

        //SMS Send;
        if (sendSmsProcess) {
          const smsDetails = {
            phoneNumber: toMobileNumber,
            message: smsSubject,
          };

          sendSms(smsDetails, smsInfo, smsType);
        }

        let updateData: any = {};
        //PICKUP OTP
        if (parseInt(aspActivityStatusId) == 4) {
          updateData = {
            reachedPickupOtp: otp,
          };
        } else if (parseInt(aspActivityStatusId) == 15) {
          // BREAKDOWN OTP
          updateData = {
            reachedBreakdownOtp: otp,
          };
        } else {
          updateData = {
            reachedDropOtp: otp,
          };
        }

        //CHANGE STATUS
        await Activities.update(
          {
            ...updateData,
            activityStatusId: 3, // INPROGRESS
            aspActivityStatusId: aspActivityStatusId,
            // Conditionally set aspReachToPickUpLocationDate or aspReachToDropUpLocationDate
            ...(parseInt(aspActivityStatusId) == 4 && {
              aspReachedToPickupAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
              reachedToPickupInApp: logTypeId == 241 ? 1 : 0,
            }),
            ...((parseInt(aspActivityStatusId) == 6 || parseInt(aspActivityStatusId) == 17) && {
              aspReachedToDropAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
              reachedToDropInApp: logTypeId == 241 ? 1 : 0,
            }),
            ...(parseInt(aspActivityStatusId) == 15 && {
              aspReachedToBreakdownAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
            }),
            ...(activityAppStatusId && {
              activityAppStatusId: activityAppStatusId,
            }),
            ...(updateSlaAchievedDelayed && {
              slaAchievedDelayed: 1,
            }),
          },
          {
            where: { id: activityId },
            transaction: transaction,
          }
        );

        //SAVE ACTIVITY LOG
        let createdActivityLog = null;
        if (activityLogTitle) {
          createdActivityLog = await ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              actionTypeId: actionTypeId,
              title: activityLogTitle,
              description: activityLogDescription,
              aspActivityReportNewValue: getMasterDetail?.data?.data?.aspActivityStatusWithoutValidation?.name || null
            },
            {
              transaction: transaction,
            }
          );
        }

        //IF ASP REACHED DROP LOCATION THEN REDUCE CUSTOMER SERVICE ENTITLEMENT FOR RSA CASES
        if (
          activity.caseDetail.typeId == 31 &&
          parseInt(aspActivityStatusId) == 17 &&
          !activity.isServiceEntitlementUpdated
        ) {
          const customerServiceEntitlementReduceRequest = {
            activityId: activity.id,
            clientId: activity.caseDetail.clientId,
            vin: activity.caseDetail.vin,
            registrationNumber: activity.caseDetail.registrationNumber,
            serviceId: getMasterDetail.data.data.subService.serviceId,
            subServiceId: activity.activityAspDetail.subServiceId,
            policyTypeId: activity.caseDetail.caseInformation.policyTypeId,
            policyNumber: activity.caseDetail.caseInformation.policyNumber,
            serviceEligibilityId:
              activity.caseDetail.caseInformation.serviceEligibilityId,
          };

          const customerServiceEntitlementReduceResponse: any =
            await Utils.reduceCustomerServiceEntitlement(
              customerServiceEntitlementReduceRequest,
              transaction
            );
          if (!customerServiceEntitlementReduceResponse.success) {
            await transaction.rollback();
            const response = addFlagToResponse(
              customerServiceEntitlementReduceResponse,
              activity,
              aspActivityStatusId,
              routeOrigin
            );
            return res.status(200).json(response);
          }
        }

        if (sendFcmPushNotification) {
          notificationController.sendNotification(details);
        }

        await transaction.commit();

        // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
        Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
          activityId,
        ]);

        // CREATE REPORT SYNC TABLE RECORD FOR ASP ACTIVITY REPORT
        if (
          activity.caseDetail.typeId == 31 && createdActivityLog
        ) {
          Utils.createReportSyncTableRecord("aspActivityReportDetails", [
            createdActivityLog.dataValues.id,
          ]);
        }

        // Sync client report details, client report with mobile number details
        if (activity.caseDetail.typeId == 31) {
          Utils.createReportSyncTableRecord(
            ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
            [activity.caseDetail.id]
          );
        }

        // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
        if (activity.caseDetail.typeId == 31) {
          Utils.createReportSyncTableRecord(
            ["financialReportDetails", "activityReportDetails"],
            [activityId]
          );
        }

        const successResponse = addFlagToResponse(
          {
            success: true,
            message: "Status updated successfully",
            otp: otp,
          },
          activity,
          aspActivityStatusId,
          routeOrigin
        );
        return res.status(200).json(successResponse);
      } else {
        let activityStatusId = 3; // INPROGRESS
        let actualAspActivityStatusId = aspActivityStatusId;
        let aspActivityReportNewValue = getMasterDetail?.data?.data?.aspActivityStatusWithoutValidation?.name;

        //CHANGE STATUS
        await Activities.update(
          {
            activityStatusId: activityStatusId,
            aspActivityStatusId: actualAspActivityStatusId,
            ...(activityAppStatusId && {
              activityAppStatusId: activityAppStatusId,
            }),
            // Conditionally set ASP Started To Pickup or ASP Started To Drop
            ...(parseInt(aspActivityStatusId) == 14 && {
              aspStartedToBreakdownAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
            }),
            ...(parseInt(aspActivityStatusId) == 3 && {
              aspStartedToPickupAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
              startedToPickupInApp: logTypeId == 241 ? 1 : 0,
            }),
            ...((parseInt(aspActivityStatusId) == 5 || parseInt(aspActivityStatusId) == 16) && {
              aspStartedToDropAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
              startedToDropInApp: logTypeId == 241 ? 1 : 0,
            }),
            ...(parseInt(aspActivityStatusId) == 7 && {
              aspStartedToGarageAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
              startedToGarageInApp: logTypeId == 241 ? 1 : 0,
            }),
            ...(parseInt(aspActivityStatusId) == 8 && {
              aspReachedToGarageAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
              reachedToGarageInApp: logTypeId == 241 ? 1 : 0,
            }),
            ...(parseInt(aspActivityStatusId) == 9 && {
              aspEndServiceAt: formattedDateTime
                ? formattedDateTime
                : new Date(),
              endServiceInApp: logTypeId == 241 ? 1 : 0,
            }),
            // FOR RSA CASES - UPDATE SERVICE START DATE AND TIME
            ...(parseInt(aspActivityStatusId) == 18 && {
              serviceStartDateTime: formattedDateTime
                ? formattedDateTime
                : new Date(),
            }),
            // FOR RSA CASES - UPDATE SERVICE END DATE AND TIME
            ...(parseInt(aspActivityStatusId) == 13 && {
              serviceEndDateTime: formattedDateTime
                ? formattedDateTime
                : new Date(),
              serviceDuration: activity.dataValues.serviceStartDateTime
                ? moment
                  .duration(
                    moment.tz(formattedDateTime ? formattedDateTime : new Date(), "Asia/Kolkata").diff(
                      moment.tz(activity.dataValues.serviceStartDateTime, "Asia/Kolkata")
                    )
                  )
                  .asSeconds()
                  .toString()
                : null,
            }),
            // FOR VDM CASES - UPDATE END SERVICE IF ASP STARTED TO GARAG OR REACHED TO GARAGE AND END SERVICE NOT SET
            ...((parseInt(aspActivityStatusId) == 7 ||
              parseInt(aspActivityStatusId) == 8) &&
              !activity.dataValues.aspEndServiceAt &&
              activity.caseDetail.dataValues.typeId == 32 &&
              activity.dataValues.aspReachedToPickupAt &&
              activity.dataValues.aspStartedToDropAt &&
              activity.dataValues.aspReachedToDropAt
              ? {
                aspEndServiceAt: formattedDateTime
                  ? formattedDateTime
                  : new Date(),
                endServiceInApp: logTypeId == 241 ? 1 : 0,
              }
              : {}),
          },
          {
            where: { id: activityId },
            transaction: transaction,
          }
        );

        //SAVE ACTIVITY LOG
        let createdActivityLog: any = null;
        if (activityLogTitle) {
          createdActivityLog = await ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              actionTypeId: actionTypeId,
              title: activityLogTitle,
              description: activityLogDescription,
              aspActivityReportNewValue: aspActivityReportNewValue
            },
            {
              transaction: transaction,
            }
          );
        }

        if (sendFcmPushNotification) {
          notificationController.sendNotification(details);
        }

        await transaction.commit();

        //ON UPDATING STARTED TO BD IN MOBILE APP THEN SEND SERVICE PROVIDER ID CARD LINK TO CUSTOMER THROUGH SMS. ITS ONLY FOR RSA CRM.
        if (
          logTypeId == 241 &&
          activity.caseDetail.typeId == 31 &&
          parseInt(aspActivityStatusId) == 14
        ) {
          const serviceProviderIdCardLinkPayload = {
            activityId: activityId,
            existingLinkId: activity.technicianIdCardLinkId,
            customerMobileNumber:
              activity.caseDetail.caseInformation.customerMobileNumber,
          };

          serviceProviderIdCardLinkSendToCustomer(
            serviceProviderIdCardLinkPayload
          );
        }

        // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
        Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
          activityId,
        ]);

        //IF started to BD then sync asp auto allocated details for crm report.
        if (
          parseInt(aspActivityStatusId) == 14 &&
          activity.isAspAutoAllocated
        ) {
          Utils.createReportSyncTableRecord(
            "autoAllocatedAspReportDetails",
            [activityId]
          );
        }

        // CREATE REPORT SYNC TABLE RECORD FOR ASP ACTIVITY REPORT
        if (
          activity.caseDetail.typeId == 31 && createdActivityLog
        ) {
          Utils.createReportSyncTableRecord("aspActivityReportDetails", [
            createdActivityLog.dataValues.id,
          ]);
        }

        // Sync client report details, client report with mobile number details
        if (activity.caseDetail.typeId == 31) {
          Utils.createReportSyncTableRecord(
            ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
            [activity.caseDetail.id]
          );
        }

        // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
        if (activity.caseDetail.typeId == 31) {
          Utils.createReportSyncTableRecord(
            ["financialReportDetails", "activityReportDetails"],
            [activityId]
          );
        }

        const successResponse = addFlagToResponse(
          {
            success: true,
            message: "Status updated successfully",
          },
          activity,
          aspActivityStatusId,
          routeOrigin
        );
        return res.status(200).json(successResponse);
      }
    } catch (error: any) {
      await transaction.rollback();
      const errorResponse = addFlagToResponse(
        {
          success: false,
          error: error.message,
        },
        null,
        aspActivityStatusId,
        routeOrigin
      );
      return res.status(500).json(errorResponse);
    }
  }

  //VERIFY PICKUP AND DROP OTP
  export async function verifyOtp(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const { activityId, otpNumber, type } = req.body;

      const activity: any = await Activities.findOne({
        attributes: [
          "id",
          "caseDetailId",
          "reachedPickupOtp",
          "reachedBreakdownOtp",
          "reachedDropOtp",
          "pickupOtpVerifiedAt",
          "pickupSignatureSubmittedAt",
          "dropInventorySubmittedAt",
          "dropOtpVerifiedAt",
        ],
        where: {
          id: activityId,
          activityStatusId: 3, //In Progress
        },
        include: [
          {
            model: ActivityAspDetails,
            attributes: ["id", "aspId", "aspMechanicId"],
          },
          {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            attributes: ["id", "clientId", "statusId", "typeId"],
            required: true,
          },
        ],
      });

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const getASPDetail = await axios.get(
        `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activity.activityAspDetail.dataValues.aspId}`
      );
      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      let activityAppStatusId = null;
      let activityLogTitle = null;
      const activityUpdateColumns: any = {};

      //FCM PUSH NOTFICATIONS
      let details: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
        workshopName: getASPDetail.data.data.workshopName,
      };
      if (type == "pickup") {
        details.templateId = 23;
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.mechanicDetail =
          activity.activityAspDetail.dataValues.aspMechanicId;
        details.sourceFrom = 2; //Mobile

        if (parseInt(activity.getDataValue("reachedPickupOtp")) !== otpNumber) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "OTP verification failed",
          });
        }
        activityAppStatusId = 6; //PICKUP OTP VERIFIED
        activityLogTitle =
          "The OTP verification has been completed at the pickup location.";

        activityUpdateColumns.pickupOtpVerifiedAt = new Date();
      } else if (type == "breakdown") {
        details.templateId = 23; // NEED TO CHANGE
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.mechanicDetail =
          activity.activityAspDetail.dataValues.aspMechanicId;
        details.notificationType = "CRM";
        details.sourceFrom = 2; //Mobile

        // OTP verification disabled for breakdown type - allowing any OTP
        // if (
        //   parseInt(activity.getDataValue("reachedBreakdownOtp")) !== otpNumber
        // ) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: "OTP verification failed",
        //   });
        // }
        activityAppStatusId = 23; //BREAKDOWN OTP VERIFIED
        activityLogTitle =
          "The OTP verification has been completed at the breakdown location.";
      } else {
        // VDM Notifications
        if (activity.caseDetail.dataValues.typeId == 32) {
          details.templateId = 30;
          details.aspDetail = activity.activityAspDetail.dataValues.aspId;
          details.mechanicDetail =
            activity.activityAspDetail.dataValues.aspMechanicId;
          details.sourceFrom = 2; //Mobile
        } else {
          // CRM Notifications
          details.templateId = 26;
          details.aspDetail = activity.activityAspDetail.dataValues.aspId;
          details.mechanicDetail =
            activity.activityAspDetail.dataValues.aspMechanicId;
          details.notificationType = "CRM";
          details.sourceFrom = 2; //Mobile
        }

        // OTP verification disabled for drop type - allowing any OTP
        // if (activity.dataValues.reachedDropOtp.toString() !== otpNumber.toString()) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: "OTP verification failed",
        //   });
        // }
        activityAppStatusId = 13; //DROP OTP VERIFIED
        activityLogTitle =
          "The OTP verification has been completed at the drop location.";

        //CLIENT WAITING TIME PROCESS FOR VDM CASES
        if (
          activity.caseDetail.dataValues.typeId == 32 &&
          activity.dataValues.pickupOtpVerifiedAt &&
          activity.dataValues.pickupSignatureSubmittedAt &&
          activity.dataValues.dropInventorySubmittedAt &&
          !activity.dataValues.dropOtpVerifiedAt
        ) {
          activityUpdateColumns.dropOtpVerifiedAt = new Date();
          activity.dataValues.dropOtpVerifiedAt =
            activityUpdateColumns.dropOtpVerifiedAt;

          const clientWaitingTimeProcessResponse =
            await clientWaitingTimeProcess(activity);
          if (
            clientWaitingTimeProcessResponse &&
            clientWaitingTimeProcessResponse.success
          ) {
            activityUpdateColumns.enableAspWaitingTimeInApp = 1;
          }
        }
      }

      notificationController.sendNotification(details);

      //UPDATE ACTIVITY APP STATUS
      if (activityAppStatusId) {
        await Activities.update(
          {
            activityAppStatusId: activityAppStatusId,
            ...activityUpdateColumns,
          },
          {
            where: { id: activityId },
            transaction: transaction,
          }
        );
      }

      //SAVE ACTIVITY LOG
      if (activityLogTitle) {
        await ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 241, //MOBILE
            title: activityLogTitle,
          },
          {
            transaction: transaction,
          }
        );
      }
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "OTP verification successful",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateActivityStartAndEndTime(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        type,
        dateTime,
        durationInSeconds,
        isServiceTimerRunning,
        authUserId,
      } = req.body;
      const [activity, activityAspDetail]: any = await Promise.all([
        Activities.findOne({
          where: {
            id: activityId,
            activityStatusId: 3, //INPROGRESS
          },
          attributes: ["id"],
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                statusId: 2, //In Progress
              },
            },
          ],
        }),
        ActivityAspDetails.findOne({
          where: { activityId: activityId },
          attributes: ["id", "aspId"],
        }),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity asp detail not found",
        });
      }

      //GET ASP DETAILS
      const getAspDetail = await axios.get(
        `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activityAspDetail.dataValues.aspId}`
      );
      if (!getAspDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      let updateData: any = {
        isServiceTimerRunning: isServiceTimerRunning,
      };
      let logTitle = null;

      let message = "Activity time updated successfully";

      if (type == 1) {
        //START
        updateData.serviceStartDateTime = dateTime;
        updateData.activityAppStatusId = 25; //RSA Service Started
        updateData.updatedById = authUserId;

        logTitle = `The service provider "${getAspDetail.data.data.workshopName}" has started the service.`;
      } else if (type == 2) {
        //PAUSE
        updateData.serviceDuration = durationInSeconds;
        updateData.updatedById = authUserId;
        message = "Service paused successfully";
      } else if (type == 3) {
        //END
        updateData.serviceEndDateTime = dateTime;
        updateData.serviceDuration = durationInSeconds;
        updateData.activityAppStatusId = 26; //RSA Service Ended
        updateData.updatedById = authUserId;
        logTitle = `The service provider "${getAspDetail.data.data.workshopName}" has ended the service.`;
        message = "Service ended successfully";
      } else if (type == 4) {
        //BACK
        updateData.serviceResumeDateTime = dateTime;
        updateData.serviceDuration = durationInSeconds;
        updateData.updatedById = authUserId;
      } else if (type == 5) {
        //RESUME
        updateData.serviceResumeDateTime = dateTime;
        updateData.serviceDuration = durationInSeconds;
        updateData.updatedById = authUserId;
        message = "Service resumed successfully";
      }

      await activity.update(
        {
          ...updateData,
        },
        { transaction: transaction }
      );

      if (type == 1 || type == 3) {
        await ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 241, //Mobile
            title: logTitle,
          },
          {
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: message,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateActivityServiceStatus(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        logTypeId,
        aspId,
        repairOnSiteStatus,
        additionalServiceRequested,
        additionalServiceId,
        additionalSubServiceId,
        dropLocationTypeId,
        customerPreferredLocationId,
        dropDealerId,
        dropLocationLat,
        dropLocationLong,
        dropLocation,
        dropAreaId,
        breakdownToDropDistance,
        custodyRequested,
        assignedTo,
        custodyServiceId,
        custodySubServiceId,
        cabAssistanceRequested,
        cabAssistanceServiceId,
        cabAssistanceSubServiceId,
        cabAssistanceAssignedTo,
        authUserId,
        bearerToken,
      } = req.body;

      const [activity, getAspDetail]: any = await Promise.all([
        //Activity
        Activities.findOne({
          where: {
            id: activityId,
            activityStatusId: 3, //INPROGRESS
          },
          attributes: [
            "id",
            "caseDetailId",
            "serviceStatus",
            "isServiceEntitlementUpdated",
          ],
          include: [
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id", "subServiceId"],
            },
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                statusId: 2, //In Progress
              },
            },
          ],
        }),
        //ASP
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`
        ),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!getAspDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      //REPAIR ON SITE STATUS IS SUCCESS
      if (repairOnSiteStatus == 1) {
        const caseDetail: any = await CaseDetails.findOne({
          where: {
            id: activity.dataValues.caseDetailId,
          },
          attributes: [
            "id",
            "clientId",
            "vin",
            "registrationNumber",
            "caseNumber",
            "typeId",
          ],
          include: {
            model: CaseInformation,
            required: true,
            attributes: [
              "id",
              "policyTypeId",
              "policyNumber",
              "serviceEligibilityId",
              "customerMobileNumber",
            ],
          },
        });
        if (!caseDetail) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Case detail not found",
          });
        }

        await Promise.all([
          //Repair on site status is success
          activity.update(
            {
              serviceStatus: repairOnSiteStatus,
              activityAppStatusId: 27, //RSA Service Status Updated
              updatedById: authUserId,
            },
            { transaction: transaction }
          ),
          ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              title: `The service provider "${getAspDetail.data.data.workshopName}" successfully completed the repair on site service.`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);

        //CUSTOMER SERVICE ENTITLEMENT REDUCE
        if (!activity.isServiceEntitlementUpdated) {
          const getMasterDetail = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              subServiceId: activity.activityAspDetail.subServiceId,
            }
          );
          if (!getMasterDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json(getMasterDetail.data);
          }

          const customerServiceEntitlementReduceRequest = {
            activityId: activityId,
            clientId: caseDetail.clientId,
            vin: caseDetail.vin,
            registrationNumber: caseDetail.registrationNumber,
            serviceId: getMasterDetail.data.data.subService.serviceId,
            subServiceId: activity.activityAspDetail.subServiceId,
            policyTypeId: caseDetail.caseInformation.policyTypeId,
            policyNumber: caseDetail.caseInformation.policyNumber,
            serviceEligibilityId:
              caseDetail.caseInformation.serviceEligibilityId,
          };

          const customerServiceEntitlementReduceResponse: any =
            await Utils.reduceCustomerServiceEntitlement(
              customerServiceEntitlementReduceRequest,
              transaction
            );
          if (!customerServiceEntitlementReduceResponse.success) {
            await transaction.rollback();
            return res
              .status(200)
              .json(customerServiceEntitlementReduceResponse);
          }
        }

        //SEND ROS SUCCESS ESCALATION TO CUSTOMER ONLY FOR ISUZU CLIENT.
        const templateReplacements = {
          "{ticket_no}": caseDetail.caseNumber,
        };
        sendEscalationSms(
          caseDetail.caseInformation.customerMobileNumber,
          templateReplacements,
          952, //Activity
          activity.id,
          authUserId,
          130, //ROS Successful
          caseDetail.clientId
        );
      } else if (repairOnSiteStatus == 0) {
        //Repair on site status is failure
        let caseInformation: any = await CaseInformation.findOne({
          where: {
            caseDetailId: activity.dataValues.caseDetailId,
          },
          attributes: [
            "id",
            "customerContactName",
            "policyTypeId",
            "policyStartDate",
            "policyEndDate",
            "policyNumber",
            "caseTypeId",
            "breakdownLat",
            "breakdownLong",
            "breakdownToDropLocationDistance",
            "serviceEligibilityId",
            "serviceId",
            "subServiceId",
          ],
        });
        if (!caseInformation) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Case information not found",
          });
        }

        // ADDITIONAL SERVICE NOT REQUESTED
        if (additionalServiceRequested == 0) {
          await Promise.all([
            //Additional service not requested
            activity.update(
              {
                serviceStatus: repairOnSiteStatus,
                activityAppStatusId: 27, //RSA Service Status Updated
                additionalServiceRequested: additionalServiceRequested,
                updatedById: authUserId,
              },
              { transaction: transaction }
            ),
            //CASE INFORMATION UPDATE
            CaseInformation.update(
              {
                additionalServiceRequested,
              },
              {
                where: {
                  caseDetailId: activity.dataValues.caseDetailId,
                },
                transaction: transaction,
              }
            ),
          ]);

          await ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              title: `The service provider "${getAspDetail.data.data.workshopName}" failed to complete the repair on site service.`,
            },
            {
              transaction: transaction,
            }
          );

          await ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              title: `The customer "${caseInformation.dataValues.customerContactName}" does not requests additional service.`,
            },
            {
              transaction: transaction,
            }
          );
        } else {
          if (
            (dropLocationTypeId == 452 || customerPreferredLocationId == 461) &&
            !dropDealerId
          ) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop dealer is required",
            });
          }

          // ADDITIONAL SERVICE REQUESTED
          let caseDetail: any = await CaseDetails.findOne({
            where: {
              id: activity.dataValues.caseDetailId,
            },
            attributes: ["id", "clientId", "vin", "registrationNumber", "typeId"],
          });
          if (!caseDetail) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Case detail not found",
            });
          }

          //GET MASTER DETAILS
          const getMasterDetail = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              subServiceId: additionalSubServiceId,
            }
          );
          if (!getMasterDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: getMasterDetail.data.error,
            });
          }

          if (!getMasterDetail.data.data.subService) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Additional sub service not found",
            });
          }

          //Case update
          const caseInformationUpdateFields: any = {
            additionalServiceRequested: additionalServiceRequested,
            custodyRequested: custodyRequested,
            cabAssistanceRequested: cabAssistanceRequested,
          };

          //Towing
          if (additionalServiceId == 1) {
            caseInformationUpdateFields.dropLocationTypeId = dropLocationTypeId
              ? dropLocationTypeId
              : null;
            caseInformationUpdateFields.customerPreferredLocationId =
              customerPreferredLocationId ? customerPreferredLocationId : null;
            caseInformationUpdateFields.dropDealerId = dropDealerId
              ? dropDealerId
              : null;
            caseInformationUpdateFields.dropLocation = dropLocation
              ? dropLocation
              : null;
            caseInformationUpdateFields.dropAreaId = dropAreaId
              ? dropAreaId
              : null;
            caseInformationUpdateFields.dropLocationLat = dropLocationLat
              ? dropLocationLat
              : null;
            caseInformationUpdateFields.dropLocationLong = dropLocationLong
              ? dropLocationLong
              : null;
            caseInformationUpdateFields.breakdownToDropLocationDistance =
              breakdownToDropDistance ? breakdownToDropDistance : null;
          }

          await Promise.all([
            //Additional service is requested
            Activities.update(
              {
                serviceStatus:
                  logTypeId == 241
                    ? repairOnSiteStatus
                    : activity.dataValues.serviceStatus,
                activityAppStatusId: 27, //RSA Service Status Updated
                additionalServiceRequested: additionalServiceRequested,
                custodyRequested: custodyRequested,
                isCustodySelf: assignedTo,
                cabAssistanceRequested: cabAssistanceRequested,
                isCabAssistanceSelf: cabAssistanceAssignedTo,
                updatedById: authUserId,
              },
              {
                where: {
                  id: activity.dataValues.id,
                },
                transaction: transaction,
              }
            ),
            CaseInformation.update(caseInformationUpdateFields, {
              where: {
                caseDetailId: activity.dataValues.caseDetailId,
              },
              transaction: transaction,
            }),
            ActivityLogs.create(
              {
                activityId: activityId,
                typeId: logTypeId,
                title: `The service provider "${getAspDetail.data.data.workshopName}" failed to complete the repair on site service.`,
              },
              {
                transaction: transaction,
              }
            ),
          ]);

          const additionalServiceRequestUpdateActivityIds: any = [];
          // CUSTODY REQUESTED AS YES
          if (custodyRequested == 1) {
            await ActivityLogs.create(
              {
                caseDetailId: activity.dataValues.caseDetailId,
                typeId: logTypeId,
                title: `The customer "${caseInformation.dataValues.customerContactName}" requested the custody service.`,
              },
              {
                transaction: transaction,
              }
            );

            const custodyServiceRequestResponse =
              await getNotesAndCreateActivity(
                bearerToken,
                custodyServiceId,
                custodySubServiceId,
                aspId,
                caseDetail,
                activity,
                caseInformation,
                assignedTo,
                authUserId,
                transaction
              );

            if (!custodyServiceRequestResponse.success) {
              await transaction.rollback();
              return res.status(200).json(custodyServiceRequestResponse);
            }

            //PUSH ACTIVITY ID IF ASSIGNED TO IS SELF AND ACTIVITY CREATED WITH ASP
            if (
              assignedTo == 1 &&
              custodyServiceRequestResponse.rsaActivityResponse &&
              custodyServiceRequestResponse.rsaActivityResponse.activityId
            ) {
              additionalServiceRequestUpdateActivityIds.push(
                custodyServiceRequestResponse.rsaActivityResponse.activityId
              );
              await ActivityLogs.create(
                {
                  activityId:
                    custodyServiceRequestResponse.rsaActivityResponse
                      .activityId,
                  typeId: logTypeId, //Mobile
                  title: `The service provider "${getAspDetail.data.data.workshopName}" has accepted the custody request.`,
                },
                { transaction: transaction }
              );
            }
          }

          //CAB ASSISTANCE REQUESTED AS YES
          if (cabAssistanceRequested == 1) {
            await ActivityLogs.create(
              {
                caseDetailId: activity.dataValues.caseDetailId,
                typeId: logTypeId,
                title: `The customer "${caseInformation.dataValues.customerContactName}" requested the cab assistance service.`,
              },
              {
                transaction: transaction,
              }
            );

            const cabAssistanceServiceRequestResponse =
              await getNotesAndCreateActivity(
                bearerToken,
                cabAssistanceServiceId,
                cabAssistanceSubServiceId,
                aspId,
                caseDetail,
                activity,
                caseInformation,
                cabAssistanceAssignedTo,
                authUserId,
                transaction
              );

            if (!cabAssistanceServiceRequestResponse.success) {
              await transaction.rollback();
              return res.status(200).json(cabAssistanceServiceRequestResponse);
            }

            //PUSH ACTIVITY ID IF ASSIGNED TO IS SELF AND ACTIVITY CREATED WITH ASP
            if (
              cabAssistanceAssignedTo == 1 &&
              cabAssistanceServiceRequestResponse.rsaActivityResponse &&
              cabAssistanceServiceRequestResponse.rsaActivityResponse.activityId
            ) {
              additionalServiceRequestUpdateActivityIds.push(
                cabAssistanceServiceRequestResponse.rsaActivityResponse
                  .activityId
              );
              await ActivityLogs.create(
                {
                  activityId:
                    cabAssistanceServiceRequestResponse.rsaActivityResponse
                      .activityId,
                  typeId: logTypeId, //Mobile
                  title: `The service provider "${getAspDetail.data.data.workshopName}" has accepted the cab assistance request.`,
                },
                { transaction: transaction }
              );
            }
          }

          //UPDATE ACTIVITY AS ACCEPTED FOR THE SELF REQUESTED ACTIVITY IDS
          if (
            additionalServiceRequestUpdateActivityIds &&
            additionalServiceRequestUpdateActivityIds.length > 0
          ) {
            const additionalServiceRequestUpdateResponse =
              await updateActivityAndActivityAspDetails(
                additionalServiceRequestUpdateActivityIds,
                aspId,
                transaction
              );
            if (!additionalServiceRequestUpdateResponse.success) {
              await transaction.rollback();
              return res
                .status(200)
                .json(additionalServiceRequestUpdateResponse);
            }
          }

          //ADDITIONAL SERVICE REQUEST LOG
          await ActivityLogs.create(
            {
              caseDetailId: activity.dataValues.caseDetailId,
              typeId: logTypeId,
              title: `The customer "${caseInformation.dataValues.customerContactName}" requested the additional service "${getMasterDetail.data.data.subService.service.name}".`,
            },
            {
              transaction: transaction,
            }
          );

          //CREATE ACTIVITY FOR ADDITIONAL SERVICE REQUESTED
          const additionalServiceCreateActivityResponse =
            await createActivityAndActivityAspDetail(
              caseDetail,
              caseInformation,
              authUserId,
              additionalServiceId,
              additionalSubServiceId,
              breakdownToDropDistance ? breakdownToDropDistance : null,
              0, //NOT INITIALLY CREATED
              1, //IMMEDIATE SERVICE
              null, //SERVICE INITIATING AT
              null, //SERVICE EXPECTED AT
              0, //ASP AUTO ALLOCATION
              transaction
            );
          if (!additionalServiceCreateActivityResponse.success) {
            await transaction.rollback();
            return res
              .status(200)
              .json(additionalServiceCreateActivityResponse);
          }
        }
      }
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Activity service status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Update Service Status (Unified function for Repair On Site and Tow)
  export async function updateServiceStatus(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        logTypeId,
        aspId,
        serviceType, // "repairOnSite" or "tow"
        status, // 0 or 1
        successReasonId,
        failureReasonId,
        remarks,
        authUserId,
      } = req.body;

      // Validate serviceType
      if (serviceType !== "repairOnSite" && serviceType !== "tow") {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Invalid serviceType. Must be 'repairOnSite' or 'tow'",
        });
      }

      const [activity, getAspDetail]: any = await Promise.all([
        //Activity
        Activities.findOne({
          where: {
            id: activityId,
            activityStatusId: 3, //INPROGRESS
          },
          attributes: [
            "id",
            "caseDetailId",
            "serviceStatus",
            "isServiceEntitlementUpdated",
          ],
          include: [
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id", "subServiceId"],
            },
            {
              model: CaseDetails,
              required: true,
              attributes: ["id", "typeId"],
              where: {
                statusId: 2, //In Progress
              },
            },
          ],
        }),
        //ASP
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`
        ),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!getAspDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // Check if service status has already been updated
      if (activity.dataValues.serviceStatus !== null && activity.dataValues.serviceStatus !== undefined) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Service status has already been updated and cannot be modified again",
        });
      }

      // Service messages based on type
      const serviceMessages: {
        [key: string]: { success: string; failure: string };
      } = {
        repairOnSite: {
          success: "repair on site service",
          failure: "repair on site service",
        },
        tow: {
          success: "towing service",
          failure: "towing service",
        },
      };

      //STATUS IS SUCCESS
      if (status == 1) {
        const caseDetail: any = await CaseDetails.findOne({
          where: {
            id: activity.dataValues.caseDetailId,
          },
          attributes: [
            "id",
            "clientId",
            "vin",
            "registrationNumber",
            "caseNumber",
          ],
          include: {
            model: CaseInformation,
            required: true,
            attributes: [
              "id",
              "policyTypeId",
              "policyNumber",
              "serviceEligibilityId",
              "customerMobileNumber",
            ],
          },
        });
        if (!caseDetail) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Case detail not found",
          });
        }

        await Promise.all([
          //Service status is success
          activity.update(
            {
              serviceStatus: status,
              serviceSuccessReasonId: successReasonId,
              serviceFailureReasonId: null,
              serviceRemarks: remarks,
              activityAppStatusId: 27, //RSA Service Status Updated
              updatedById: authUserId,
            },
            { transaction: transaction }
          ),
          ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              title: `The service provider "${getAspDetail.data.data.workshopName}" successfully completed the ${serviceMessages[serviceType].success}.`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);

        //CUSTOMER SERVICE ENTITLEMENT REDUCE
        if (!activity.isServiceEntitlementUpdated) {
          const getMasterDetail = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              subServiceId: activity.activityAspDetail.subServiceId,
            }
          );
          if (!getMasterDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json(getMasterDetail.data);
          }

          const customerServiceEntitlementReduceRequest = {
            activityId: activityId,
            clientId: caseDetail.clientId,
            vin: caseDetail.vin,
            registrationNumber: caseDetail.registrationNumber,
            serviceId: getMasterDetail.data.data.subService.serviceId,
            subServiceId: activity.activityAspDetail.subServiceId,
            policyTypeId: caseDetail.caseInformation.policyTypeId,
            policyNumber: caseDetail.caseInformation.policyNumber,
            serviceEligibilityId:
              caseDetail.caseInformation.serviceEligibilityId,
          };

          const customerServiceEntitlementReduceResponse: any =
            await Utils.reduceCustomerServiceEntitlement(
              customerServiceEntitlementReduceRequest,
              transaction
            );
          if (!customerServiceEntitlementReduceResponse.success) {
            await transaction.rollback();
            return res
              .status(200)
              .json(customerServiceEntitlementReduceResponse);
          }
        }

        //SEND SUCCESS ESCALATION TO CUSTOMER ONLY FOR ISUZU CLIENT.
        const templateReplacements = {
          "{ticket_no}": caseDetail.caseNumber,
        };
        sendEscalationSms(
          caseDetail.caseInformation.customerMobileNumber,
          templateReplacements,
          952, //Activity
          activity.id,
          authUserId,
          130, //Service Successful
          caseDetail.clientId
        );
      } else if (status == 0) {
        //Service status is failure
        await Promise.all([
          //Service status is failure
          activity.update(
            {
              serviceStatus: status,
              serviceSuccessReasonId: null,
              serviceFailureReasonId: failureReasonId,
              serviceRemarks: remarks,
              activityAppStatusId: 27, //RSA Service Status Updated
              updatedById: authUserId,
            },
            { transaction: transaction }
          ),
          ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              title: `The service provider "${getAspDetail.data.data.workshopName}" failed to complete the ${serviceMessages[serviceType].failure}.`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);
      }
      await transaction.commit();

      // Sync client report details, client report with mobile number details
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [activity.dataValues.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [activity.dataValues.id]
        );
      }

      return res.status(200).json({
        success: true,
        message: `${serviceType === "repairOnSite" ? "Repair on site" : "Tow"} status updated successfully`,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Update Repair On Site Status (Wrapper function for backward compatibility)
  export async function updateRepairOnSiteStatus(
    req: Request,
    res: Response
  ) {
    // Map old request format to new unified format
    req.body.serviceType = "repairOnSite";
    req.body.status = req.body.repairOnSiteStatus;
    req.body.successReasonId = req.body.rosSuccessReasonId;
    req.body.failureReasonId = req.body.rosFailureReasonId;
    req.body.remarks = req.body.rosRemarks;
    return updateServiceStatus(req, res);
  }

  // Update Tow Status (Wrapper function for backward compatibility)
  export async function updateTowStatus(
    req: Request,
    res: Response
  ) {
    // Map old request format to new unified format
    req.body.serviceType = "tow";
    req.body.status = req.body.towStatus;
    req.body.successReasonId = req.body.towSuccessReasonId;
    req.body.failureReasonId = req.body.towFailureReasonId;
    req.body.remarks = req.body.towRemarks;
    return updateServiceStatus(req, res);
  }

  // Raise Custody Request
  export async function raiseCustodyRequest(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        logTypeId,
        aspId,
        custodyRequested,
        assignedTo,
        custodyServiceId,
        custodySubServiceId,
        authUserId,
        bearerToken,
      } = req.body;

      const [activity, getAspDetail]: any = await Promise.all([
        //Activity
        Activities.findOne({
          where: {
            id: activityId,
            activityStatusId: 3, //INPROGRESS
          },
          attributes: ["id", "caseDetailId"],
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                statusId: 2, //In Progress
              },
            },
          ],
        }),
        //ASP
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`
        ),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!getAspDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      let caseInformation: any = await CaseInformation.findOne({
        where: {
          caseDetailId: activity.dataValues.caseDetailId,
        },
        attributes: [
          "id",
          "customerContactName",
          "policyTypeId",
          "policyStartDate",
          "policyEndDate",
          "policyNumber",
          "caseTypeId",
          "breakdownLat",
          "breakdownLong",
          "breakdownToDropLocationDistance",
          "serviceEligibilityId",
          "serviceId",
          "subServiceId",
        ],
      });
      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case information not found",
        });
      }

      let caseDetail: any = await CaseDetails.findOne({
        where: {
          id: activity.dataValues.caseDetailId,
        },
        attributes: ["id", "clientId", "vin", "registrationNumber", "typeId"],
      });
      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      // CUSTODY REQUESTED AS YES
      if (custodyRequested == 1) {
        await Promise.all([
          Activities.update(
            {
              custodyRequested: custodyRequested,
              isCustodySelf: assignedTo,
              updatedById: authUserId,
            },
            {
              where: {
                id: activity.dataValues.id,
              },
              transaction: transaction,
            }
          ),
          CaseInformation.update(
            {
              custodyRequested: custodyRequested,
            },
            {
              where: {
                caseDetailId: activity.dataValues.caseDetailId,
              },
              transaction: transaction,
            }
          ),
          ActivityLogs.create(
            {
              caseDetailId: activity.dataValues.caseDetailId,
              typeId: logTypeId,
              title: `The customer "${caseInformation.dataValues.customerContactName}" requested the custody service.`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);

        const custodyServiceRequestResponse =
          await getNotesAndCreateActivity(
            bearerToken,
            custodyServiceId,
            custodySubServiceId,
            aspId,
            caseDetail,
            activity,
            caseInformation,
            assignedTo,
            authUserId,
            transaction
          );

        if (!custodyServiceRequestResponse.success) {
          await transaction.rollback();
          return res.status(200).json(custodyServiceRequestResponse);
        }

        //UPDATE ACTIVITY FOR THE SELF REQUESTED
        if (
          assignedTo == 1 &&
          custodyServiceRequestResponse.rsaActivityResponse &&
          custodyServiceRequestResponse.rsaActivityResponse.activityId
        ) {
          const createdActivityId =
            custodyServiceRequestResponse.rsaActivityResponse.activityId;

          // Fetch the created activity to check customerNeedToPay
          const createdActivity: any = await Activities.findOne({
            where: {
              id: createdActivityId,
            },
            attributes: ["id", "customerNeedToPay", "caseDetailId"],
            transaction: transaction,
          });

          if (!createdActivity) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Created activity not found",
            });
          }

          // Check if customer needs to pay
          const customerNeedToPay =
            createdActivity.dataValues.customerNeedToPay === true ||
            createdActivity.dataValues.customerNeedToPay === 1;

          let updateDetails: any = {};
          let activityLogsToCreate: any = [];

          if (!customerNeedToPay) {
            // If customer doesn't need to pay, update to "Reached BD" status
            updateDetails = {
              activityStatusId: 3, // INPROGRESS
              aspActivityStatusId: 15, //REACHED BD
              activityAppStatusId: 22, //REACHED BD
              agentPickedAt: new Date(),
              aspServiceAcceptedAt: new Date(),
              serviceAcceptedInApp: 1,
              aspStartedToBreakdownAt: new Date(),
              aspReachedToBreakdownAt: new Date(),
            };

            activityLogsToCreate = [
              // CREATE ACTIVITY LOG FOR ACCEPTED STATUS
              {
                activityId: createdActivityId,
                typeId: logTypeId,
                title: `The service provider "${getAspDetail.data.data.workshopName}" has accepted the custody request.`,
              },
              //CREATE ACTIVITY LOG FOR REACHED BD STATUS
              {
                activityId: createdActivityId,
                typeId: logTypeId,
                title: `The service provider "${getAspDetail.data.data.workshopName}" has already in the breakdown location.`,
              },
            ];
          } else {
            // If customer needs to pay, keep in accepted request stage
            updateDetails = {
              activityStatusId: 2, //Assigned
              aspActivityStatusId: 1, //Accepted
              activityAppStatusId: 1, //Accepted
              agentPickedAt: new Date(),
              aspServiceAcceptedAt: new Date(),
              serviceAcceptedInApp: 1,
            };

            activityLogsToCreate = [
              // CREATE ACTIVITY LOG FOR ACCEPTED STATUS
              {
                activityId: createdActivityId,
                typeId: logTypeId,
                title: `The service provider "${getAspDetail.data.data.workshopName}" has accepted the custody request.`,
              },
            ];
          }

          const updatePromises: any = [
            //UPDATE ACTIVITY STATUS
            Activities.update(
              { ...updateDetails },
              {
                where: {
                  id: createdActivityId,
                },
                transaction: transaction,
              }
            ),
            //UPDATE SERVICE AS ACCEPTED
            ActivityAspDetails.update(
              { aspServiceAccepted: 1 },
              {
                where: {
                  activityId: createdActivityId,
                  aspId: aspId,
                },
                transaction: transaction,
              }
            ),
          ];

          // Create activity logs
          activityLogsToCreate.forEach((logData: any) => {
            updatePromises.push(
              ActivityLogs.create(logData, { transaction: transaction })
            );
          });

          // Sync client report details, client report with mobile number details
          updatePromises.push(
            Utils.createReportSyncTableRecord(
              ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
              [createdActivity.dataValues.caseDetailId]
            )
          );

          await Promise.all(updatePromises);
        }
      } else {
        // CUSTODY REQUESTED AS NO
        await Promise.all([
          Activities.update(
            {
              custodyRequested: custodyRequested,
              updatedById: authUserId,
            },
            {
              where: {
                id: activity.dataValues.id,
              },
              transaction: transaction,
            }
          ),
          CaseInformation.update(
            {
              custodyRequested: custodyRequested,
            },
            {
              where: {
                caseDetailId: activity.dataValues.caseDetailId,
              },
              transaction: transaction,
            }
          ),
        ]);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Custody request updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Raise Cab Assistance Request
  export async function raiseCabAssistanceRequest(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        logTypeId,
        aspId,
        cabAssistanceRequested,
        cabAssistanceServiceId,
        cabAssistanceSubServiceId,
        authUserId,
      } = req.body;

      const [activity, getAspDetail]: any = await Promise.all([
        //Activity
        Activities.findOne({
          where: {
            id: activityId,
            activityStatusId: 3, //INPROGRESS
          },
          attributes: ["id", "caseDetailId"],
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                statusId: 2, //In Progress
              },
            },
          ],
        }),
        //ASP
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`
        ),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!getAspDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      let caseInformation: any = await CaseInformation.findOne({
        where: {
          caseDetailId: activity.dataValues.caseDetailId,
        },
        attributes: ["id", "customerContactName"],
      });
      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case information not found",
        });
      }

      let caseDetail: any = await CaseDetails.findOne({
        where: {
          id: activity.dataValues.caseDetailId,
        },
        attributes: ["id", "clientId", "vin", "registrationNumber", "typeId"],
      });
      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      // CAB ASSISTANCE REQUESTED AS YES
      if (cabAssistanceRequested == 1) {
        await Promise.all([
          Activities.update(
            {
              cabAssistanceRequested: cabAssistanceRequested,
              updatedById: authUserId,
            },
            {
              where: {
                id: activity.dataValues.id,
              },
              transaction: transaction,
            }
          ),
          CaseInformation.update(
            {
              cabAssistanceRequested: cabAssistanceRequested,
            },
            {
              where: {
                caseDetailId: activity.dataValues.caseDetailId,
              },
              transaction: transaction,
            }
          ),
          ActivityLogs.create(
            {
              caseDetailId: activity.dataValues.caseDetailId,
              typeId: logTypeId,
              title: `The customer "${caseInformation.dataValues.customerContactName}" requested the cab assistance service.`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);

        // Always create activity for others (assignedTo = 0 logic)
        const cabAssistanceServiceRequestResponse =
          await createActivityAndActivityAspDetail(
            caseDetail,
            caseInformation,
            authUserId,
            cabAssistanceServiceId,
            cabAssistanceSubServiceId,
            null,
            0, //NOT INITIALLY CREATED
            1, //IMMEDIATE SERVICE
            null, //SERVICE INITIATING AT
            null, //SERVICE EXPECTED AT
            0, //ASP AUTO ALLOCATION
            transaction
          );

        if (!cabAssistanceServiceRequestResponse.success) {
          await transaction.rollback();
          return res.status(200).json(cabAssistanceServiceRequestResponse);
        }
      } else {
        // CAB ASSISTANCE REQUESTED AS NO
        await Promise.all([
          Activities.update(
            {
              cabAssistanceRequested: cabAssistanceRequested,
              updatedById: authUserId,
            },
            {
              where: {
                id: activity.dataValues.id,
              },
              transaction: transaction,
            }
          ),
          CaseInformation.update(
            {
              cabAssistanceRequested: cabAssistanceRequested,
            },
            {
              where: {
                caseDetailId: activity.dataValues.caseDetailId,
              },
              transaction: transaction,
            }
          ),
        ]);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Cab assistance request updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Raise Towing Request
  export async function raiseTowingRequest(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        logTypeId,
        aspId,
        towingRequested,
        towingServiceId,
        towingSubServiceId,
        authUserId,
      } = req.body;

      const [activity, getAspDetail]: any = await Promise.all([
        //Activity
        Activities.findOne({
          where: {
            id: activityId,
            activityStatusId: 3, //INPROGRESS
          },
          attributes: ["id", "caseDetailId"],
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                statusId: 2, //In Progress
              },
            },
          ],
        }),
        //ASP
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`
        ),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!getAspDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      let caseInformation: any = await CaseInformation.findOne({
        where: {
          caseDetailId: activity.dataValues.caseDetailId,
        },
        attributes: ["id", "customerContactName"],
      });
      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case information not found",
        });
      }

      let caseDetail: any = await CaseDetails.findOne({
        where: {
          id: activity.dataValues.caseDetailId,
        },
        attributes: ["id", "clientId", "vin", "registrationNumber", "typeId"],
      });
      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      // TOWING REQUESTED AS YES
      if (towingRequested == 1) {
        //GET MASTER DETAILS
        const getMasterDetail = await axios.post(
          `${masterService}/${endpointMaster.getMasterDetails}`,
          {
            subServiceId: towingSubServiceId,
          }
        );
        if (!getMasterDetail.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: getMasterDetail.data.error,
          });
        }

        if (!getMasterDetail.data.data.subService) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Towing sub service not found",
          });
        }

        await Promise.all([
          Activities.update(
            {
              additionalServiceRequested: towingRequested,
              updatedById: authUserId,
            },
            {
              where: {
                id: activity.dataValues.id,
              },
              transaction: transaction,
            }
          ),
          CaseInformation.update(
            {
              additionalServiceRequested: towingRequested,
            },
            {
              where: {
                caseDetailId: activity.dataValues.caseDetailId,
              },
              transaction: transaction,
            }
          ),
          ActivityLogs.create(
            {
              caseDetailId: activity.dataValues.caseDetailId,
              typeId: logTypeId,
              title: `The customer "${caseInformation.dataValues.customerContactName}" requested the additional service "${getMasterDetail.data.data.subService.service.name}".`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);

        //CREATE ACTIVITY FOR TOWING SERVICE REQUESTED
        const towingServiceCreateActivityResponse =
          await createActivityAndActivityAspDetail(
            caseDetail,
            caseInformation,
            authUserId,
            towingServiceId,
            towingSubServiceId,
            null,
            0, //NOT INITIALLY CREATED
            1, //IMMEDIATE SERVICE
            null, //SERVICE INITIATING AT
            null, //SERVICE EXPECTED AT
            0, //ASP AUTO ALLOCATION
            transaction
          );
        if (!towingServiceCreateActivityResponse.success) {
          await transaction.rollback();
          return res
            .status(200)
            .json(towingServiceCreateActivityResponse);
        }
      } else {
        // TOWING REQUESTED AS NO
        await Promise.all([
          Activities.update(
            {
              additionalServiceRequested: towingRequested,
              updatedById: authUserId,
            },
            {
              where: {
                id: activity.dataValues.id,
              },
              transaction: transaction,
            }
          ),
          CaseInformation.update(
            {
              additionalServiceRequested: towingRequested,
            },
            {
              where: {
                caseDetailId: activity.dataValues.caseDetailId,
              },
              transaction: transaction,
            }
          ),
        ]);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Towing request updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //Asp accept activitity
  export async function acceptActivity(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;

      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}`;
      //AGENT
      if (inData.authUserRoleId == 3) {
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}&setParanoidFalse=true`;
      }

      const [activity, activityAspDetail, getASPDetail]: any =
        await Promise.all([
          Activities.findOne({
            where: {
              id: inData.activityId,
              activityStatusId: 1, //Open
            },
            attributes: ["id", "caseDetailId", "customerNeedToPay", "isAspAutoAllocated", "aspActivityStatusId"],
            include: [
              {
                model: CaseDetails,
                where: {
                  statusId: 2, //In Progress
                },
                required: true,
                attributes: ["id", "agentId", "typeId", "clientId"],
                include: [
                  {
                    model: CaseInformation,
                    required: false,
                    attributes: [
                      "id",
                      "customerContactName",
                      "customerMobileNumber",
                    ],
                  },
                ],
              },
            ],
          }),
          ActivityAspDetails.findOne({
            where: { activityId: inData.activityId, aspId: inData.aspId },
          }),
          axios.get(aspApiUrl),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP Detail not found",
        });
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: activity.caseDetail.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      //SLA VIOLATE REASON PROCESS
      //VDM
      if (activity.caseDetail.typeId == 32) {
        const aspAcceptanceViolationCheckRequest = {
          activityId: inData.activityId,
          slaViolateReasonId: inData.slaViolateReasonId
            ? inData.slaViolateReasonId
            : null,
          authUserId: inData.authUserId,
          authUserRoleId: inData.authUserRoleId ? inData.authUserRoleId : null,
          slaViolateReasonComments: inData.slaViolateReasonComments
            ? inData.slaViolateReasonComments
            : null,
          transaction: transaction,
        };

        const aspAcceptanceViolationCheckResponse: any =
          await caseSlaController.aspAcceptanceViolationCheck(
            aspAcceptanceViolationCheckRequest
          );
        if (!aspAcceptanceViolationCheckResponse.success) {
          return res.status(200).json(aspAcceptanceViolationCheckResponse);
        }
      } else if (activity.caseDetail.typeId == 31) {
        //RSA CRM

        // Validate proposed delay reason if Expected Reach Date exceeds Breakdown Reach Time SLA
        if (inData.endTime && inData.breakdownReachTimeSlaDateTime) {
          if (inData.endTime > inData.breakdownReachTimeSlaDateTime && !inData.proposedDelayReasonId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error:
                "Proposed delay reason is required when Expected Reach Date & Time exceeds Breakdown Reach Time SLA",
            });
          }
        }

        // Process SLA violate reason only when routeOrigin is "case"
        if (inData.routeOrigin == "case" || !inData.routeOrigin) {
          const slaViolateRequests = {
            caseDetailId: activity.caseDetail.id,
            activityId: activity.id,
            typeId: 866, //ASP Acceptance  SLA - Manual Assignment L1
            date: moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
            slaViolateReasonId: inData.slaViolateReasonId
              ? inData.slaViolateReasonId
              : null,
            slaViolateReasonComments: inData.slaViolateReasonComments
              ? inData.slaViolateReasonComments
              : null,
            authUserId: inData.authUserId,
            authUserRoleId: inData.authUserRoleId ? inData.authUserRoleId : null,
            transaction: transaction,
          };

          const slaViolateReasonProcessResponse =
            await crmSlaController.processSlaViolateReason(slaViolateRequests);
          if (!slaViolateReasonProcessResponse.success) {
            await transaction.rollback();
            return res.status(200).json(slaViolateReasonProcessResponse);
          }
        }
      }

      let activityAppStatusId = 1; //Accepted
      if (
        activityAspDetail.dataValues.aspMechanicId &&
        activityAspDetail.dataValues.aspMechanicAssignedAt
      ) {
        activityAppStatusId = 2; //Driver Assigned
      }

      let activityUpdateData: any = {
        activityStatusId: 2, //Assigned
        aspActivityStatusId: 1, //Accepted
        activityAppStatusId: activityAppStatusId,
        aspServiceAcceptedAt: new Date(),
        serviceAcceptedInApp: inData.logTypeId == 241 ? 1 : 0,
      };

      //IF CASE TYPE IS RSA
      if (activity.caseDetail.typeId == 31) {
        // if (!inData.startTime) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: "Start time is required",
        //   });
        // }
        // if (!inData.endTime) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: "End time is required",
        //   });
        // }
        activityUpdateData.expectedServiceStartDateTime = inData.startTime
          ? moment.tz(inData.startTime, "Asia/Kolkata").toDate()
          : null;
        activityUpdateData.expectedServiceEndDateTime = inData.endTime
          ? moment.tz(inData.endTime, "Asia/Kolkata").toDate()
          : null;
        activityUpdateData.comments = inData.comments ? inData.comments : null;

        // Add proposedDelayReasonId to activity update data
        activityUpdateData.proposedDelayReasonId = inData.proposedDelayReasonId
          ? inData.proposedDelayReasonId
          : null;

        //FREE SERVICE MEANS UPDATE STATUS AS APPROVED
        if (!activity.customerNeedToPay) {
          activityUpdateData.dealerApprovalStatusId = 42; //APPROVED
          activityUpdateData.activityStatusId = 10; //PAYMENT PAID
          activityUpdateData.aspActivityStatusId = 2; //WAITING FOR SERVICE INITIATION
          activityUpdateData.activityAppStatusId = 3; //WAITING FOR SERVICE INITIATION          
        } else {
          // Check if activity has mapped one-time service transactions (from canceled activity)
          const mappedTransactions: any = await ActivityTransactions.findAll({
            where: {
              activityId: inData.activityId,
              paymentTypeId: 174, // One time service
              paymentStatusId: 191, // Success
              refundStatusId: {
                [Op.or]: [
                  {
                    [Op.is]: null, // Refund not initiated
                  },
                  {
                    [Op.eq]: 1303, // Refund failed
                  },
                ],
              },
            },
            attributes: ["id"],
            transaction: transaction,
          });

          // If transactions exist (were mapped from canceled activity), set status to Advance amount paid
          if (mappedTransactions.length > 0) {
            activityUpdateData.dealerApprovalStatusId = 42; //APPROVED
            activityUpdateData.activityStatusId = 10; // Advance amount paid
            activityUpdateData.aspActivityStatusId = 2; // Waiting for service initiation
            activityUpdateData.activityAppStatusId = 3; // Waiting for service initiation
          }
        }
      }

      await Promise.all([
        //UPDATE ACTIVITY STATUS INPROGRESS AND ASP ACTIVITY STATUS AS ACCEPTED
        Activities.update(
          { ...activityUpdateData },
          { where: { id: inData.activityId }, transaction: transaction }
        ),
        //UPDATE SERVICE AS ACCEPTED
        ActivityAspDetails.update(
          { aspServiceAccepted: 1 },
          {
            where: { activityId: inData.activityId, aspId: inData.aspId },
            transaction: transaction,
          }
        ),
      ]);

      //SAVE ACTIVITY LOG
      let activityLogTitle = null;

      // FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
      };

      //WEB

      if (activity.caseDetail.typeId == 31) {
        // CRM Notifications
        if (inData.logTypeId == 241) {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has accepted this request.`;

          details.templateId = 5;
          details.workshopName = getASPDetail.data.data.workshopName;
          details.notificationType = "CRM";
          details.sourceFrom = 2; //Mobile
        } else {
          //WEB

          activityLogTitle = `The request was accepted by the agent "${getAgentDetail.data.user.name}" on behalf of the service provider "${getASPDetail.data.data.workshopName}".`;
        }
      } else {
        // VDM Notifications
        if (inData.logTypeId == 240) {
          activityLogTitle = `The request was accepted by the agent "${getAgentDetail.data.user.name}" on behalf of the service provider "${getASPDetail.data.data.workshopName}".`;

          // notifications
          details.templateId = 7;
          details.agentName = getAgentDetail.data.user.name;
          details.workshopName = getASPDetail.data.data.workshopName;
        } else {
          //MOBILE
          activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has accepted this request.`;

          // notifications
          details.templateId = 6;
          details.workshopName = getASPDetail.data.data.workshopName;
          details.sourceFrom = 2; //Mobile
        }
      }
      notificationController.sendNotification(details);
      const createdActivityLog = await ActivityLogs.create(
        {
          activityId: inData.activityId,
          typeId: inData.logTypeId,
          actionTypeId: 1010, //Activity Accept
          title: activityLogTitle,
          aspActivityReportNewValue: "Accepted",
        },
        { transaction: transaction }
      );

      await transaction.commit();

      //SEND SERVICE PROVIDER TRACK LINK SMS TO CUSTOMER ONLY FOR RSA CRM CASE ICICIL CLIENT
      if (activity.caseDetail.typeId == 31) {
        activityAcceptAutoEscalation(getASPDetail.data.data.name, activity);
      }

      // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
      Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
        inData.activityId,
      ]);

      //If activity accepted then sync asp auto allocated details for crm report.
      if (
        activity.caseDetail.typeId == 31 &&
        activity.isAspAutoAllocated
      ) {
        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          [inData.activityId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR ASP ACTIVITY REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord("aspActivityReportDetails", [
          createdActivityLog.dataValues.id,
        ]);
      }

      // Sync client report details, client report with mobile number details
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [activity.dataValues.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [inData.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Activity Accepted Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Reject Activity
  export async function rejectActivity(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      let emailSubject: string = "";
      let toEmailAddress: string = "";
      const [activity, activityAspDetail]: any = await Promise.all([
        Activities.findOne({
          where: {
            id: inData.activityId,
            activityStatusId: 1, //Open
          },
          attributes: ["id", "caseDetailId", "isAspAutoAllocated", "aspActivityStatusId"],
          include: {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            required: true,
            attributes: ["id", "agentId", "typeId", "caseNumber"],
          },
        }),
        ActivityAspDetails.findOne({
          where: { activityId: inData.activityId },
          attributes: ["id", "aspId"],
        }),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP Detail not found",
        });
      }

      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activityAspDetail.dataValues.aspId}`;
      //AGENT
      if (inData.authUserRoleId == 3) {
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activityAspDetail.dataValues.aspId}&setParanoidFalse=true`;
      }
      const [getASPDetail, getAgentDetail]: any = await Promise.all([
        // GET ASP DETAILS
        axios.get(aspApiUrl),
        // GET AGENT DETAILS
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: activity.caseDetail.dataValues.agentId,
        }),
      ]);

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      let regionManagerDetail = null;
      let aspActivityRejectReason = "";
      if (getASPDetail.data.data.rmId) {
        const [getRegionManagerDetail, getAspActivityRejectReason]: any =
          await Promise.all([
            // GET REGION MANAGER DETAILS
            axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
              id: getASPDetail.data.data.rmId,
            }),
            // GET ASP ACTIVITY REJECT REASON DETAILS
            axios({
              method: "get",
              url: `${masterService}/${endpointMaster.aspActivityRejectReasons.getById}`,
              data: {
                id: inData.rejectReasonId,
              },
            }),
          ]);
        if (!getRegionManagerDetail.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: getRegionManagerDetail.data.error,
          });
        }
        if (!getAspActivityRejectReason.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: getAspActivityRejectReason.data.error,
          });
        }
        regionManagerDetail = getRegionManagerDetail;
        aspActivityRejectReason = getAspActivityRejectReason.data.data.name;
      }

      let activityUpdateData: any = {
        activityStatusId: 8, //REJECTED
        aspServiceRejectedAt: new Date(),
        serviceRejectedInApp: inData.logTypeId == 241 ? 1 : 0,
      };
      // IF CASE TYPE IS RSA
      if (activity.caseDetail.typeId == 31) {
        activityUpdateData.comments = inData.comments ? inData.comments : null;
      }

      await Promise.all([
        //UPDATE ACTIVITY STATUS AS REJECTED
        Activities.update(
          { ...activityUpdateData },
          { where: { id: inData.activityId }, transaction: transaction }
        ),
        //UPDATE SERVICE AS NOT ACCEPTED AND REJECT REASON
        ActivityAspDetails.update(
          { aspServiceAccepted: 0, rejectReasonId: inData.rejectReasonId },
          {
            where: { activityId: inData.activityId },
            transaction: transaction,
          }
        ),
      ]);

      //SAVE ACTIVITY LOG
      let activityLogTitle = null;
      //WEB
      if (inData.logTypeId == 240) {
        activityLogTitle = `The request was rejected by the agent "${getAgentDetail.data.user.name}" on behalf of the service provider "${getASPDetail.data.data.workshopName}".`;
      } else {
        //MOBILE
        activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has rejected this request.`;

        // FCM PUSH NOTIFICATIONS
        let details: any = {};
        if (activity.caseDetail.typeId == 31) {
          // CRM Notifications
          details = {
            caseDetailId: activity.dataValues.caseDetailId,
            templateId: 4,
            notifyToAll: [""],
            workshopName: getASPDetail.data.data.workshopName,
            notificationType: "CRM",
            sourceFrom: 2, //Mobile
          };
        } else {
          // VDM Notification
          details = {
            caseDetailId: activity.dataValues.caseDetailId,
            templateId: 5,
            notifyToAll: [""],
            workshopName: getASPDetail.data.data.workshopName,
            notificationType: "VDM",
            sourceFrom: 2, //Mobile
          };
        }

        notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc
      }
      const createdActivityLog = await ActivityLogs.create(
        {
          activityId: inData.activityId,
          typeId: inData.logTypeId,
          title: activityLogTitle,
          aspActivityReportNewValue: "Rejected",
        },
        {
          transaction: transaction,
        }
      );

      // ASP REJECT EMAIL - DISABLED TEMPORARILY
      // if (regionManagerDetail) {
      //   emailSubject = "Case Request Reject!";
      //   toEmailAddress = regionManagerDetail.data.user.email;
      //   if (toEmailAddress) {
      //     const portalLogoUrl = `${process.env.API_GATEWAY_URL}images/portalLogo.png`;
      //     //Email Send
      //     const sendMailResponseData: any = sendEmail(
      //       "",
      //       emailSubject,
      //       toEmailAddress,
      //       portalLogoUrl,
      //       "activity-reject-template.html",
      //       `The service provider "${getASPDetail.data.data.workshopName}" has rejected the request for this case "${activity.caseDetail.dataValues.caseNumber}" due to the reason "${aspActivityRejectReason}". Kindly take appropriate action.`
      //     );

      //     if (!sendMailResponseData.success) {
      //       console.log(sendMailResponseData.error);
      //     }
      //   }
      // }

      await transaction.commit();

      //SYNC ASP REJECTION DETAILS FOR CRM REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord("aspRejectionReportDetails", [
          inData.activityId,
        ]);
      }

      // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
      Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
        inData.activityId,
      ]);

      //If activity reject then sync asp auto allocated details for crm report.
      if (
        activity.caseDetail.typeId == 31 &&
        activity.isAspAutoAllocated
      ) {
        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          [inData.activityId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR ASP ACTIVITY REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord("aspActivityReportDetails", [
          createdActivityLog.dataValues.id,
        ]);
      }

      // Sync client report details, client report with mobile number details
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [activity.dataValues.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [inData.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Activity Rejected Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //ASP ASSIGN ACTIVITY
  export async function assignActivity(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;

      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}`;
      //AGENT
      if (inData.authUserRoleId == 3) {
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}&setParanoidFalse=true`;
      }
      const [
        activity,
        activityAspDetail,
        getASPDetail,
        getASPMechanicDetail,
      ]: any = await Promise.all([
        Activities.findOne({
          where: {
            id: inData.activityId,
            [Op.or]: [
              { activityStatusId: 1 }, //Open
              { activityStatusId: 2 }, //2-ASSIGNED
              { activityStatusId: 10 }, //10-ADVANCE PAYMENT PAID (allow assign driver for both free/paid; paid requires successful txn validation below)
            ],
          },
          attributes: [
            "id",
            "caseDetailId",
            "dealerApprovalStatusId",
            "customerNeedToPay",
            "isInitiallyCreated",
            "isImmediateService",
            "serviceInitiatingAt",
            "createdAt",
          ],
          include: {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            required: true,
            attributes: ["id", "agentId", "typeId", "date"],
          },
        }),
        ActivityAspDetails.findOne({
          where: { activityId: inData.activityId, aspId: inData.aspId },
          attributes: ["id", "aspId", "estimatedAspToBreakdownKmDuration"],
        }),
        // GET ASP DETAILS
        axios.get(aspApiUrl),
        // GET ASP MECHANIC DETAILS
        axios.get(
          `${masterService}/${endpointMaster.aspMechanics.getDetails}?aspMechanicId=${inData.aspMechanicId}`
        ),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP Detail not found",
        });
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (!getASPMechanicDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP mechanic not found",
        });
      }

      // For CRM paid service: allow assigning driver in activityStatusId=10 only if a successful one-time-service
      // transaction exists (refund not initiated OR refund failed).
      if (activity?.dataValues?.activityStatusId == 10 && (activity?.dataValues?.customerNeedToPay == 1 ||
        activity?.dataValues?.customerNeedToPay == true)) {
        const successfulNonMembershipTxn = await ActivityTransactions.findOne({
          where: {
            activityId: inData.activityId,
            paymentTypeId: 174, // One time service
            paymentStatusId: 191, // Success
            refundStatusId: {
              [Op.or]: [
                { [Op.is]: null }, // Refund not initiated
                { [Op.eq]: 1303 }, // Refund failed
              ],
            },
          },
          attributes: ["id"],
          transaction: transaction,
        });

        if (!successfulNonMembershipTxn) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error:
              "Unable to assign driver. Advance payment successful transaction not found for this activity.",
          });
        }
      }

      // FOR RSA CRM CASE TYPE IF ASP IS COCO ASP THEN CHECK IF THE ASP HAS MORE THAN CONFIGURED ACTIVITIES IN PROGRESS
      if (Utils.isCocoAspActivityLimitEnabled() &&
        activity.caseDetail.typeId == 31 &&
        getASPDetail?.data?.data?.isOwnPatrol &&
        inData.aspMechanicId
      ) {
        let serviceScheduledDate = null;
        //INITIALLY CREATED AND NOT IMMEDIATE SERVICE 
        if (activity.isInitiallyCreated == 1 && activity.isImmediateService == 0) {
          serviceScheduledDate =
            moment.tz(activity.serviceInitiatingAt, "Asia/Kolkata").format("YYYY-MM-DD");
        } else if (activity.isInitiallyCreated == 0) {
          //NOT INITIALLY CREATED
          serviceScheduledDate = moment.tz(activity.createdAt, "Asia/Kolkata").format("YYYY-MM-DD");
        } else {
          //INITIALLY CREATED AND IMMEDIATE SERVICE
          serviceScheduledDate = activity.caseDetail.dataValues.date;
        }

        const inProgressCheckResponse = await Utils.checkCocoAspInProgressActivities(
          inData.aspMechanicId,
          serviceScheduledDate
        );
        if (!inProgressCheckResponse.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: inProgressCheckResponse.error,
          });
        }

        const activityLimit = Utils.getCocoAspActivityLimit();
        const totalActivitiesCount = (inProgressCheckResponse.mechanicActivitiesCount || 0) +
          (inProgressCheckResponse.towingActivitiesCount || 0);
        // IF THE COCO TECHNICIAN HAS EQUAL TO OR MORE THAN CONFIGURED TOTAL ACTIVITIES (MECHANIC + TOWING) IN PROGRESS THEN RETURN ERROR
        if (inProgressCheckResponse.success && totalActivitiesCount >= activityLimit) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error:
              `This COCO technician has already been working on the maximum allowed ${activityLimit} cases. Please assign another technician.`,
          });
        }
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: activity.caseDetail.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      //UPDATE ACTIVITY APP STATUS
      let activityAppStatusId = 2; //DRIVER ASSIGNED
      //IF DEALER PAID ADVANCE AMOUNT
      if (activity.dataValues.dealerApprovalStatusId == 42) {
        activityAppStatusId = 3; //WAITING FOR SERVICE INITIATION
      }

      await Promise.all([
        Activities.update(
          { activityAppStatusId: activityAppStatusId },
          {
            where: { id: inData.activityId },
            transaction: transaction,
          }
        ),
        //UPDATE MECHANIC ID AND ASSIGNED DATE
        ActivityAspDetails.update(
          {
            aspMechanicId: inData.aspMechanicId,
            aspMechanicAssignedAt: new Date(),
          },
          {
            where: { activityId: inData.activityId },
            transaction: transaction,
          }
        ),
      ]);

      //SAVE ACTIVITY LOG
      let activityLogTitle = null;
      //WEB
      if (inData.logTypeId == 240) {
        activityLogTitle = `The driver "${getASPMechanicDetail.data.data.name}" has been assigned to this request by the agent "${getAgentDetail.data.user.name}".`;

        // RSA CRM
        if (activity.caseDetail.typeId == 31) {
          // SEND REQUEST NOTIFICATION TO COCO TECHNICIAN
          if (getASPDetail.data.data.isOwnPatrol) {
            const details = {
              caseDetailId: activity.dataValues.caseDetailId,
              templateId: 34,
              notifyToAll: [""],
              agentName: getAgentDetail.data.user.name,
              workshopName: getASPDetail.data.data.workshopName,
              mechanicDetail: inData.aspMechanicId,
              notificationType: "CRM",
              breakdownOrPickupReachEta: activityAspDetail.dataValues.estimatedAspToBreakdownKmDuration || "0 m",
            }
            notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc
          }
        }
      } else {
        //MOBILE
        activityLogTitle = `The driver "${getASPMechanicDetail.data.data.name}" has been assigned to this request by the service provider "${getASPDetail.data.data.workshopName}".`;

        //FCM PUSH NOTIFICATIONS

        let details: any = {};
        if (activity.caseDetail.typeId == 31) {
          // CRM Notifications
          details = {
            caseDetailId: activity.dataValues.caseDetailId,
            templateId: 6,
            notificationType: "CRM",
            workshopName: getASPDetail.data.data.workshopName,
            sourceFrom: 2, //Mobile
          };
        } else {
          // VDM Notification
          details = {
            caseDetailId: activity.dataValues.caseDetailId,
            templateId: 11,
            notifyToAll: [""],
            workshopName: getASPDetail.data.data.workshopName,
            sourceFrom: 2, //Mobile
          };
        }
        notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc
      }
      await ActivityLogs.create(
        {
          activityId: inData.activityId,
          typeId: inData.logTypeId,
          title: activityLogTitle,
        },
        {
          transaction: transaction,
        }
      );
      await transaction.commit();

      // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
      Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
        inData.activityId,
      ]);

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [inData.activityId]
        );
      }
      return res.status(200).json({
        success: true,
        message: "Driver assigned successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET ACTIVITY DETAILS
  export async function getActivityData(req: Request, res: Response) {
    try {
      const { activityId } = req.validBody;
      const data: any = await activityAspDetails.findOne({
        attributes: {
          exclude: [
            "id",
            "createdById",
            "updatedById",
            "deletedById",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
        where: { activityId },
        include: [
          {
            model: Activities,
            required: true,
            attributes: {
              exclude: [
                "createdById",
                "updatedById",
                "deletedById",
                "updatedAt",
                "deletedAt",
              ],
            },
            include: [
              {
                model: caseDetails,
                attributes: {
                  exclude: [
                    "createdById",
                    "updatedById",
                    "deletedById",
                    // "createdAt",
                    "updatedAt",
                    "deletedAt",
                  ],
                },
                include: [
                  {
                    model: CaseInformation,
                    attributes: [
                      "id",
                      "customerContactName",
                      "customerMobileNumber",
                      "customerCurrentContactName",
                      "customerCurrentMobileNumber",
                      "customerAlternateMobileNumber",
                      "voiceOfCustomer",
                      "breakdownLocation",
                      "breakdownLat",
                      "breakdownLong",
                      "breakdownAreaId",
                      "dropLocation",
                      "dropLocationLat",
                      "dropLocationLong",
                      "runningKm",
                      "dropDealerId",
                      "caseTypeId",
                      "runningKm",
                      "policyNumber",
                      "policyTypeId",
                      "serviceEligibilityId",
                      "policyStartDate",
                      "policyEndDate",
                    ],
                    required: false,
                  },
                ],
              },
              {
                model: ActivityDetails,
              },
              {
                model: ActivityCharges,
                attributes: ["id", "chargeId", "typeId", "amount"],
              },
              {
                model: ActivityInventories,
                attributes: ["id", "typeId", "inventoryId"],
              },
              {
                model: ActivityTransactions,
                attributes: [
                  "id",
                  "activityId",
                  "dealerId",
                  "date",
                  "paymentMethodId",
                  "paymentTypeId",
                  "transactionTypeId",
                  "amount",
                  "paymentStatusId",
                  "refundStatusId",
                  "refundId",
                  "paidByDealerId",
                  "paidAt",
                  "createdAt",
                  "updatedAt",
                ],
              },
              {
                model: ActivityAspLiveLocations,
                attributes: ["latitude", "longitude"],
                required: false,
                limit: 1,
                order: [["id", "DESC"]],
              },
              {
                model: RsaActivityInventory,
                attributes: [
                  "id",
                  "typeId",
                  "activityId",
                  "failedPartName",
                  "repairWork",
                  "hubCaps",
                  "spareWheel",
                  "jackAndJackRoad",
                  "audioSystem",
                  "reverseParkingSystem",
                  "speakers",
                  "keyWithRemote",
                  "aerial",
                  "floorMat",
                  "fixedOrHangingIdol",
                  "reachedDealershipStatus",
                  "vehicleAcknowledgedBy",
                  "mobileNumberOfReceiver",
                  "requestDealershipSignature",
                  "termsAndConditions",
                ],
                required: false,
              },
              {
                model: CrmSla,
                attributes: ["slaConfigId", "slaStatus", "statusColor"],
                required: false,
              },
            ],
          },
        ],
      });

      if (!data) {
        return res.status(200).json({
          success: false,
          error: "Data not found",
        });
      }

      const [
        activityLogs,
        issueIdentificationAttachments,
        rsaActivityInventoryAttachments,
        otherServiceAttachments,
        reimbursementTransaction,
        dealerAttachments,
        bankDetailAttachments,
        digitalInventoryAttachments,
      ] = await Promise.all([
        ActivityLogs.findAll({
          where: {
            [Op.or]: [
              { activityId: activityId },
              { caseDetailId: data.activity.dataValues.caseDetailId },
            ],
          },
          attributes: {
            exclude: ["updatedById", "deletedById", "updatedAt", "deletedAt"],
          },
          order: [["id", "ASC"]],
        }),
        //ISSUE IDENTIFICATION ATTACHMENTS
        Utils.getAttachments([83, 603], 102, data.activity.dataValues.id),
        //RSA ACTIVITY INVENTORY ATTACHMENTS
        Utils.getAttachments(
          [
            85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 600,
            601,
          ],
          102,
          data.activity.dataValues.id
        ),
        //OTHER SERVICE ATTACHMENTS
        Utils.getAttachments([100], 102, data.activity.dataValues.id),
        ActivityTransactions.findOne({
          attributes: [
            "id",
            "paymentMethodId",
            "accountHolderName",
            "accountNumber",
            "ifscCode",
            "upiLinkedMobileNumber",
            "amount",
            "paymentStatusId",
            "remarks",
          ],
          where: {
            activityId: activityId,
            paymentTypeId: 175, //Reimbursement
          },
        }),
        //DELIVERY REQUEST DEALER ATTACHMENTS
        Utils.getAttachments([612], 102, data.activity.dataValues.id),
        //BANK DETAIL ATTACHMENTS
        Utils.getAttachments([613], 102, data.activity.dataValues.id),
        //DIGITAL INVENTORY ATTACHMENTS
        Utils.getAttachments([616], 102, data.activity.dataValues.id),
      ]);

      data.activity.dataValues.issueIdentificationAttachments =
        issueIdentificationAttachments;
      data.activity.dataValues.rsaActivityInventoryAttachments =
        rsaActivityInventoryAttachments;
      data.activity.dataValues.otherServiceAttachments =
        otherServiceAttachments;
      data.activity.dataValues.reimbursementTransaction =
        reimbursementTransaction;
      data.activity.dataValues.dealerAttachments = dealerAttachments;
      data.activity.dataValues.bankDetailAttachments =
        bankDetailAttachments;
      data.activity.dataValues.digitalInventoryAttachments =
        digitalInventoryAttachments;

      //SLA VIOLATE REASON CHECK BASE DATE
      const slaViolateCheckActivity = data.activity;
      const slaViolateCheckCaseDetail = data.activity.caseDetail;
      const slaViolateCheckBaseDate = await getComparisionDate(
        slaViolateCheckActivity,
        slaViolateCheckCaseDetail
      );
      data.activity.dataValues.slaViolateCheckBaseMilliSeconds =
        slaViolateCheckBaseDate
          ? moment.tz(slaViolateCheckBaseDate, "Asia/Kolkata").valueOf()
          : null;

      // INCLUDE SLA VIOLATION REASON
      data.activity.dataValues.slaViolationReasonId = null;
      data.activity.dataValues.breakdownReachSlaStatus = null;
      //CRM
      if (data.activity.caseDetail.typeId == 31) {
        const crmSlaDetail: any = await CrmSla.findOne({
          attributes: ["id", "violateReasonId"],
          where: {
            caseDetailId: data.activity.caseDetailId,
            activityId: activityId,
            slaConfigId: 870, //ASP Breakdown Reach Time SLA - L1
            slaStatus: "SLA Violated",
          },
        });
        if (crmSlaDetail) {
          data.activity.dataValues.slaViolationReasonId =
            crmSlaDetail.violateReasonId;
        }

        let breakdownReachSlaDetail = data.activity.crmSlas.find(
          (sla: any) => sla.slaConfigId === 870 //ASP Breakdown Reach Time SLA - L1
        );
        if (breakdownReachSlaDetail?.slaStatus) {
          if (breakdownReachSlaDetail.slaStatus == "SLA Violated") {
            data.activity.dataValues.breakdownReachSlaStatus = "Not Met";
          } else if (breakdownReachSlaDetail.slaStatus == "SLA Achieved") {
            data.activity.dataValues.breakdownReachSlaStatus = "Met";
          } else {
            data.activity.dataValues.breakdownReachSlaStatus = "Inprogress";
          }
        }
      } else {
        //VDM
        const caseSlaDetail: any = await CaseSla.findOne({
          attributes: ["id", "violateReasonId"],
          where: {
            caseDetailId: data.activity.caseDetailId,
            activityId: activityId,
            slaConfigId: 365, //ASP Reached Pickup
            slaStatus: "SLA Violated",
          },
        });
        if (caseSlaDetail) {
          data.activity.dataValues.slaViolationReasonId =
            caseSlaDetail.violateReasonId;
        }
      }

      //ASP TRAVEL DISTANCE CALCULATION
      data.activity.dataValues.activityAspFromLocations = [];
      data.activity.dataValues.activityAspToLocations = [];

      const [activityAspFromLocation, activityAspToLocation]: any =
        await Promise.all([
          ActivityAspLiveLocations.findOne({
            attributes: ["id", "latitude", "longitude"],
            where: { activityId: activityId },
            order: [["id", "ASC"]],
          }),
          ActivityAspLiveLocations.findOne({
            attributes: ["id", "latitude", "longitude"],
            where: { activityId: activityId },
            order: [["id", "DESC"]],
          }),
        ]);

      if (activityAspFromLocation) {
        data.activity.dataValues.activityAspFromLocations.push(
          activityAspFromLocation.latitude +
          "," +
          activityAspFromLocation.longitude
        );
      }

      if (
        activityAspFromLocation &&
        activityAspToLocation &&
        activityAspToLocation.id !== activityAspFromLocation.id
      ) {
        data.activity.dataValues.activityAspToLocations.push(
          activityAspToLocation.latitude + "," + activityAspToLocation.longitude
        );
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: data,
        activityLogs: activityLogs,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET ACTIVITY DETAILS - BuddyApp
  export async function getActivityDataBuddyApp(req: Request, res: Response) {
    try {
      const { activityId } = req.validBody;
      const data: any = await activityAspDetails.findOne({
        attributes: [
          "activityId",
          "aspId",
          "aspMechanicId",
          "subServiceId",
          "serviceId",
        ],
        where: { activityId },
        include: [
          {
            model: Activities,
            required: true,
            attributes: [
              "id",
              "caseDetailId",
              "activityStatusId",
              "aspActivityStatusId",
              "aspServiceAcceptedAt",
              "customerNeedToPay",
            ],
            include: [
              {
                model: caseDetails,
                attributes: [
                  "id",
                  "caseNumber",
                  "subjectID",
                  "statusId",
                  "registrationNumber",
                  "vehicleMakeId",
                  "vehicleModelId",
                  "createdAt",
                ],
                required: true,
                include: [
                  {
                    model: CaseInformation,
                    attributes: [
                      "breakdownLocation",
                      "breakdownLat",
                      "breakdownLong",
                      "customerContactName",
                      "customerMobileNumber",
                    ],
                    required: false,
                  },
                ],
              },
            ],
          },
        ],
      });

      if (!data) {
        return res.status(200).json({
          success: false,
          error: "Data not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET ACTIVITY SERVICE DETAIL
  //ALSO USED IN ROUTE DEVIATION KM UPDATE API
  export async function getServiceDetail(req: Request, res: Response) {
    try {
      const { activityId } = req.validBody;
      const data = await activityAspDetails.findOne({
        attributes: {
          exclude: [
            "id",
            "createdById",
            "updatedById",
            "deletedById",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
        where: { activityId },
        include: [
          {
            model: Activities,
            required: true,
            attributes: {
              exclude: [
                "id",
                "createdById",
                "updatedById",
                "deletedById",
                "createdAt",
                "updatedAt",
                "deletedAt",
              ],
            },
            include: [
              {
                model: CaseDetails,
                attributes: [
                  "typeId",
                  "clientId",
                  "dealerId",
                  "deliveryRequestDropDealerId",
                  "deliveryRequestSchemeId",
                  "locationTypeId",
                  "pickupLatitude",
                  "pickupLongitude",
                  "deliveryRequestPickUpLocation",
                  "dropLatitude",
                  "dropLongitude",
                  "deliveryRequestDropLocation",
                  "createdAt",
                ],
                required: true,
                include: [
                  {
                    model: CaseInformation,
                    attributes: [
                      "id",
                      "serviceId",
                      "breakdownLat",
                      "breakdownLong",
                      "breakdownLocation",
                      "dropDealerId",
                      "dropLocationLat",
                      "dropLocationLong",
                      "dropLocation",
                    ],
                    required: false,
                  },
                ],
              },
              {
                model: ActivityCharges,
                attributes: ["id", "chargeId", "typeId", "amount"],
              },
            ],
          },
        ],
      });

      if (!data) {
        return res.status(200).json({
          success: false,
          error: "Data not found",
        });
      }
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET ACTIVITY ASP DETAIL
  export async function getActivityAspDetail(req: Request, res: Response) {
    try {
      const { caseDetailId, activityId, aspId, typeId } = req.validBody;

      let where: any = {};
      //CASE
      if (typeId == 1 && caseDetailId) {
        where.caseDetailId = caseDetailId;

        if (activityId) {
          where.id = activityId;
        }
      } else if (typeId == 2 && activityId) {
        //ACTIVITY
        where.id = activityId;
      }

      const data = await activityAspDetails.findOne({
        attributes: {
          exclude: [
            "createdById",
            "updatedById",
            "deletedById",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
        where: { aspId: aspId },
        include: [
          {
            model: Activities,
            required: true,
            attributes: {
              exclude: [
                "createdById",
                "updatedById",
                "deletedById",
                "createdAt",
                "updatedAt",
                "deletedAt",
              ],
            },
            where: where,
          },
        ],
      });

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //ASP Mechanic Accept Activitity
  export async function mechanicAcceptActivity(req: Request, res: Response) {
    try {
      const { activityId, aspId, aspMechanicId } = req.validBody;
      const activity = await Activities.findOne({
        where: { id: activityId },
      });
      if (!activity) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const activityAspDetail = await ActivityAspDetails.findOne({
        where: {
          activityId: activityId,
          aspId: aspId,
          aspMechanicId: aspMechanicId,
        },
      });
      if (!activityAspDetail) {
        return res.status(200).json({
          success: false,
          error: "Activity ASP Detail not found",
        });
      }

      //UPDATE ASP MECHANIC ID AND SERVICE AS ACCEPTED
      await ActivityAspDetails.update(
        { aspMechanicServiceAccepted: 1 },
        {
          where: {
            activityId: activityId,
            aspId: aspId,
            aspMechanicId: aspMechanicId,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Mechanic Accepted Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //ADD ACTIVITY INVENTORIES
  export async function addActivityInventory(req: Request, res: Response) {
    try {
      const { activityId, typeId, inventoryIds } = req.validBody;
      const activity: any = await Activities.findOne({
        where: {
          id: activityId,
          activityStatusId: 3, //In Progress
        },
        attributes: ["id", "caseDetailId"],
        include: [
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "aspId", "aspMechanicId"],
          },
          {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            attributes: ["id", "clientId", "statusId"],
            required: true,
          },
        ],
      });
      if (!activity) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      // GET ASP DETAILS
      const getASPDetail = await axios.get(
        `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activity.activityAspDetail.dataValues.aspId}`
      );
      if (!getASPDetail.data.success) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      //DELETE THE EXISTING INVENTORIES
      await ActivityInventories.destroy({
        where: {
          activityId: activityId,
          typeId: typeId,
        },
      });

      for (let inventoryId of inventoryIds) {
        await ActivityInventories.create({
          activityId: activityId,
          typeId: typeId,
          inventoryId: inventoryId,
        });
      }

      let activityAppStatusId = null;
      let activityLogTitle = null;
      const activityUpdateColumns: any = {};

      //FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
        workshopName: getASPDetail.data.data.workshopName,
      };

      //PICKUP INVENTORY TYPE
      if (parseInt(typeId) == 160) {
        activityAppStatusId = 7; //PICKUP INVENTORY ADDED
        activityLogTitle = `The pickup inventory details have been updated by the service provider "${getASPDetail.data.data.workshopName}".`;

        details.templateId = 24;
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.mechanicDetail =
          activity.activityAspDetail.dataValues.aspMechanicId;
        details.sourceFrom = 2; //Mobile

        activityUpdateColumns.pickupInventorySubmittedAt = new Date();
      } else if (parseInt(typeId) == 161) {
        //DROP INVENTORY TYPE
        activityAppStatusId = 14; //DROP INVENTORY ADDED
        activityLogTitle = `The drop inventory details have been updated by the service provider "${getASPDetail.data.data.workshopName}".`;

        details.templateId = 28;
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.mechanicDetail =
          activity.activityAspDetail.dataValues.aspMechanicId;
        details.sourceFrom = 2; //Mobile

        activityUpdateColumns.dropInventorySubmittedAt = new Date();
      }

      notificationController.sendNotification(details);

      //UPDATE ACTIVITY APP STATUS
      if (activityAppStatusId) {
        await Activities.update(
          {
            activityAppStatusId: activityAppStatusId,
            ...activityUpdateColumns,
          },
          {
            where: { id: activityId },
          }
        );
      }

      //SAVE ACTIVITY LOG
      if (activityLogTitle) {
        await ActivityLogs.create({
          activityId: activityId,
          typeId: 241, //MOBILE
          title: activityLogTitle,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Inventory Added Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Dealer Accept and Pay for Activity
  export async function dealerActivityAcceptAndPay(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        paymentMethodId,
        paidByDealerId,

        authUserId,
        authUserRoleId,
        slaViolateReasonId,
        slaViolateReasonComments,
      } = req.validBody;
      const [activity, activityTransaction, getDealerDetail]: any =
        await Promise.all([
          Activities.findOne({
            attributes: ["id", "caseDetailId"],
            where: {
              id: activityId,
              activityStatusId: 9, //Waiting for Dealer Approval
            },
            include: [
              {
                model: activityAspDetails,
                attributes: ["id", "aspId", "aspMechanicId"],
                required: true,
              },
              {
                model: CaseDetails,
                where: {
                  statusId: 2, //In Progress
                },
                attributes: ["id", "vin", "caseNumber"],
                required: true,
              },
            ],
          }),
          ActivityTransactions.findOne({
            attributes: ["id", "amount"],
            where: {
              activityId: activityId,
              paymentTypeId: 170, //ADVANCE
              transactionTypeId: 181, //DEBIT
              paymentStatusId: {
                [Op.ne]: 191, //SUCCESS
              },
            },
          }),
          // GET DEALER DETAILS
          axios.get(
            `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${paidByDealerId}&setParanoidFalse=false`
          ),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Advance payment has already been paid",
        });
      }

      if (!getDealerDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Dealer not found",
        });
      }

      const advanceAmount = Utils.convertToIndianCurrencyFormat(
        parseFloat(activityTransaction.dataValues.amount)
      );

      await Promise.all([
        //UPDATE APPROVAL STATUS, PAYMENT METHOD, ACTIVITY AND ASP ACTIVITY STATUS
        Activities.update(
          {
            dealerApprovalStatusId: 42, //APPROVED
            activityStatusId: 10, //PAYMENT PAID
            aspActivityStatusId: 2, //WAITING FOR SERVICE INITIATION
            activityAppStatusId: 3, //WAITING FOR SERVICE INITIATION
          },
          {
            where: {
              id: activityId,
            },
            transaction,
          }
        ),
        ActivityTransactions.update(
          {
            paymentStatusId: 191, //SUCCESS
            paymentMethodId: paymentMethodId,
            paidByDealerId: paidByDealerId,
            paidAt: new Date(),
          },
          {
            where: {
              activityId: activityId,
              paymentTypeId: 170, //ADVANCE
              transactionTypeId: 181, //DEBIT
            },
            transaction,
          }
        ),
        // SAVE ACTIVITY LOG
        ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 240, //WEB
            title: `The dealer "${getDealerDetail.data.data.name}" has paid the advance amount(${advanceAmount}) of the delivery request.`,
          },
          { transaction }
        ),
      ]);

      //SLA VIOLATE REASON PROCESS
      const dealerAdvancePaymentViolationCheckRequest = {
        activityId: activityId,
        slaViolateReasonId: slaViolateReasonId ? slaViolateReasonId : null,
        authUserId: authUserId,
        authUserRoleId: authUserRoleId ? authUserRoleId : null,
        slaViolateReasonComments: slaViolateReasonComments
          ? slaViolateReasonComments
          : null,
        transaction: transaction,
      };
      const dealerAdvancePaymentViolationCheckResponse: any =
        await caseSlaController.dealerAdvancePaymentViolationCheck(
          dealerAdvancePaymentViolationCheckRequest
        );
      if (!dealerAdvancePaymentViolationCheckResponse.success) {
        await transaction.rollback();
        return res.status(200).json(dealerAdvancePaymentViolationCheckResponse);
      }

      const dealerWalletDebitRequest = {
        dealerCode: getDealerDetail.data.data.code,
        amount: activityTransaction.dataValues.amount,
        vin: activity.caseDetail.vin,
        requestId: activity.caseDetail.caseNumber,
        type: "advance",
      };

      const dealerWalletDebitResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/dealer/debitWalletTransaction`,
        dealerWalletDebitRequest
      );
      if (!dealerWalletDebitResponse.data.success) {
        await transaction.rollback();
        return res.status(200).json(dealerWalletDebitResponse.data);
      }

      // FCM PUSH NOTIFICATIONS (ADVANCE AMOUNT PAYMENT DONE)
      const details = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
        templateId: 14,
        paidDealerName: getDealerDetail.data.data.name,
      };
      notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc

      // FCM PUSH NOTIFICATIONS (ADVANCE AMOUNT PAYMENT DONE - ASP SERVICE ALERT)
      const details1: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        templateId: 15,
        notifyToAll: [""],
        paidDealerName: getDealerDetail.data.data.name,
        aspDetail: activity.activityAspDetail.dataValues.aspId,
        mechanicDetail: activity.activityAspDetail.dataValues.aspMechanicId,
      };
      notificationController.sendNotification(details1); // function get agent token details for agent, dealer, etc

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Activity Approved Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateAdditionalCharges(req: Request, res: Response) {
    let lockAcquired = false;
    // CUSTOM VALIDATIONS WITHOUT TRANSACTION WHILE UPDATE ACTUAL ADDITIONAL CHARGE
    if (
      req?.body?.caseDetailId &&
      req.body.caseDetailId !== null &&
      req.body.caseDetailId !== undefined &&
      req.body.caseDetailId !== "" &&
      req?.body?.typeId == 151
    ) {
      lockAcquired = await Utils.tryAcquireCaseProcessingLock(
        req.body.caseDetailId
      );
      if (!lockAcquired) {
        return res.status(200).json({
          success: false,
          error: "Another update is in progress. Please try again in 5 minutes",
        });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      interface DataItem {
        activityId: number;
        chargeId: number;
        typeId: number;
        amount: number;
      }
      const activityId = req.body.activityId;
      const aspId = req.body.aspId;
      const typeId = req.body.typeId;
      const logTypeId = req.body.logTypeId;
      const totalAdditionalCharges = req.body.totalAdditionalCharges;
      const data: DataItem[] = req.body.chargesData;
      const discountPercentage = req.body.discountPercentage;
      const discountAmount = req.body.discountAmount;
      const discountReasonId = req.body.discountReasonId;
      const discountReason = req.body.discountReason;

      if (!aspId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP ID is required",
        });
      }

      const activityExists: any = await Activities.findOne({
        where: {
          id: activityId,
          [Op.or]: [
            {
              "$caseDetail.typeId$": 31, // RSA
              activityStatusId: {
                [Op.in]: [1, 2, 3, 7, 11, 12], // 1-Open, 2-Assigned, 3-In Progress, 7-Successful, 11-Balance Payment Pending, 12-Excess Amount Credit Pending
              },
            },
            {
              "$caseDetail.typeId$": 32, // DELIVERY REQUEST
              activityStatusId: {
                [Op.in]: [1, 2, 3, 11, 12], // 1-Open, 2-Assigned, 3-In Progress, 11-Balance Payment Pending, 12-Excess Amount Credit Pending
              },
            },
            {
              activityStatusId: 4, // CANCELLED
              financeStatusId: 2, //Matured - Empty Return
            },
            { activityStatusId: 10, customerNeedToPay: 0 }, //10-ADVANCE PAYMENT PAID AND CUSTOMER NEED TO PAY IS FALSE
          ],
        },
        attributes: [
          "id",
          "caseDetailId",
          "aspReachedToBreakdownAt",
          "aspReachedToPickupAt",
          "aspStartedToDropAt",
          "aspReachedToDropAt",
          "aspEndServiceAt",
        ],
        include: {
          model: CaseDetails,
          where: {
            statusId: 2, //In Progress
          },
          required: true,
          attributes: ["id", "agentId", "clientId", "typeId"],
        },
      });

      if (!activityExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`;
      //AGENT
      if (req.body.authUserRoleId == 3) {
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}&setParanoidFalse=true`;
      }

      const [activityAspDetailExist, getASPDetail, tax, getAgentDetail]: any =
        await Promise.all([
          ActivityAspDetails.findOne({
            where: {
              activityId: activityId,
              aspId: aspId,
            },
          }),
          // GET ASP DETAILS
          axios.get(aspApiUrl),
          //GET TAX
          axios.get(`${masterService}/${endpointMaster.getTax}`),
          // GET Agent DETAILS
          axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
            id: activityExists.caseDetail.dataValues.agentId,
          }),
        ]);

      if (!activityAspDetailExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP detail not found",
        });
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (!tax.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: tax.data.error,
        });
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      const masterDetailResponse: any = await axios.post(
        `${masterService}/${endpointMaster.getAspMasterDetails}`,
        {
          subServiceId: activityAspDetailExist.dataValues.subServiceId,
        }
      );

      if (!masterDetailResponse.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: masterDetailResponse.data.error,
        });
      }

      if (!masterDetailResponse?.data?.data?.subService) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }

      if (!masterDetailResponse?.data?.data?.subService?.serviceId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Service not found",
        });
      }

      const caseServiceId = masterDetailResponse.data.data.subService.serviceId;

      //DELETE THE EXISTING CHARGES
      await ActivityCharges.destroy({
        where: {
          activityId: activityId,
          typeId: typeId,
        },
        transaction: transaction,
      });

      //IF CHARGES DATA EXIST
      if (data.length > 0) {
        const chargesPromises = data.map(async (item) => {
          let chargesData = {
            activityId: activityId,
            chargeId: item.chargeId,
            typeId: typeId,
            amount: item.amount,
          };
          ActivityCharges.create(chargesData, {
            transaction: transaction,
          });
        });
        await Promise.all(chargesPromises);
      }

      const gstPercentage = tax.data.data.percentage;

      //FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activityExists.dataValues.caseDetailId,
        notifyToAll: [""],
      };

      let syncMobileAppUsageReport = false;
      //IF TYPE IS ESTIMATED THEN UPDATE ESTIMATED ADDITIONAL CHARGES
      if (typeId === 150) {
        let estimatedTaxableValue: any;
        let estimatedTotalAmount: any;
        if (activityAspDetailExist.dataValues.estimatedServiceCost) {
          estimatedTaxableValue =
            +activityAspDetailExist.dataValues.estimatedServiceCost +
            +totalAdditionalCharges;
        } else {
          estimatedTaxableValue = +totalAdditionalCharges;
        }

        // DEDUCT DISCOUNT AMOUNT IF EXISTS - ONLY CRM
        if (discountPercentage && parseFloat(discountPercentage) > 0) {
          estimatedTaxableValue =
            parseFloat(estimatedTaxableValue || 0) - parseFloat(discountAmount);
        }

        const estimatedTotalTax = calculateGSTAmount(
          estimatedTaxableValue,
          gstPercentage
        );
        estimatedTotalAmount = estimatedTaxableValue + estimatedTotalTax;

        //ASP TOTAL COST
        let estimatedAspTaxableValue: any;
        let estimatedAspTotalAmount: any;
        if (activityAspDetailExist.dataValues.estimatedAspServiceCost) {
          estimatedAspTaxableValue =
            +activityAspDetailExist.dataValues.estimatedAspServiceCost +
            +totalAdditionalCharges;
        } else {
          estimatedAspTaxableValue = +totalAdditionalCharges;
        }
        const estimatedAspTotalTax = calculateGSTAmount(
          estimatedAspTaxableValue,
          gstPercentage
        );
        estimatedAspTotalAmount =
          estimatedAspTaxableValue + estimatedAspTotalTax;

        await ActivityAspDetails.update(
          {
            estimatedAdditionalCharge: totalAdditionalCharges,
            estimatedTotalTax: estimatedTotalTax.toFixed(2),
            estimatedTotalAmount: estimatedTotalAmount.toFixed(2),
            estimatedAspTotalTax: estimatedAspTotalTax.toFixed(2),
            estimatedAspTotalAmount: estimatedAspTotalAmount.toFixed(2),
            discountPercentage: discountPercentage
              ? parseFloat(discountPercentage).toFixed(2)
              : null,
            discountAmount: discountAmount
              ? parseFloat(discountAmount).toFixed(2)
              : null,
            discountReasonId: discountReasonId ? discountReasonId : null,
            discountReason: discountReason ? discountReason : null,
          },
          {
            where: {
              activityId: activityId,
              aspId: aspId,
            },
            transaction: transaction,
          }
        );

        //SAVE ACTIVITY LOG
        let activityLogTitle = null;
        //WEB
        if (logTypeId == 240) {
          activityLogTitle = `The estimated additional charges have been updated by the agent "${getAgentDetail.data.user.name}".`;
          details.templateId = 12;
          details.agentName = getAgentDetail.data.user.name;
        } else {
          //MOBILE
          activityLogTitle = `The estimated additional charges have been updated by the service provider "${getASPDetail.data.data.workshopName}".`;
          details.templateId = 10;
          details.workshopName = getASPDetail.data.data.workshopName;
          details.sourceFrom = 2; //Mobile
        }
        await ActivityLogs.create(
          {
            activityId: activityId,
            typeId: logTypeId,
            title: activityLogTitle,
          },
          {
            transaction: transaction,
          }
        );

        // notificationController.sendNotification(details);
        if (activityExists.caseDetail.dataValues.typeId == 32) {
          notificationController.sendNotification(details);
        }
      } else if (typeId === 152) {
        await Promise.all([
          //CHARGES COLLECTED FROM CUSTOMER
          ActivityAspDetails.update(
            {
              actualChargeCollectedFromCustomer: totalAdditionalCharges,
            },
            {
              where: {
                activityId: activityId,
                aspId: aspId,
              },
              transaction: transaction,
            }
          ),
          //UPDATE ACTIVITY APP STATUS
          Activities.update(
            {
              activityAppStatusId: 31, //CHARGES COLLECTED FROM CUSTOMER
            },
            {
              where: { id: activityId },
              transaction: transaction,
            }
          ),
        ]);

        //IF CHARGES EXISTS THEN CREATE LOG AND SEND NOTIFICATION
        if (data.length > 0) {
          let activityLogTitle = null;
          if (logTypeId == 240) {
            //Web
            activityLogTitle = `The charges collected from customer have been updated by the agent "${getAgentDetail.data.user.name}".`;

            // CRM Notifications
            details.templateId = 33;
            details.agentName = getAgentDetail.data.user.name;
            details.aspDetail = activityAspDetailExist.dataValues.aspId;
            details.workshopName = getASPDetail.data.data.workshopName;
            details.notificationType = "CRM";
          } else {
            //MOBILE
            activityLogTitle = `The charges collected from customer have been updated by the service provider "${getASPDetail.data.data.workshopName}".`;

            details.templateId = 32;
            details.aspDetail = activityAspDetailExist.dataValues.aspId;
            details.workshopName = getASPDetail.data.data.workshopName;
            details.notificationType = "CRM";
            details.sourceFrom = 2; //Mobile
          }
          await ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              title: activityLogTitle,
            },
            {
              transaction: transaction,
            }
          );

          notificationController.sendNotification(details);
        }
      } else {
        //IF TYPE IS ACTUAL THEN UPDATE ACTUAL ADDITIONAL CHARGES

        //CLIENT WAITING TIME CHARGE CALCULATION
        const activityUpdateColumns: any = {};
        let clientWaitingCharge = null;
        let aspWaitingCharge = null;

        const aspReachedToBreakdownAt = moment.tz(
          activityExists.dataValues.aspReachedToBreakdownAt,
          "Asia/Kolkata"
        );
        const aspReachedToPickupAt = moment.tz(
          activityExists.dataValues.aspReachedToPickupAt,
          "Asia/Kolkata"
        );
        const aspStartedToDropAt = moment.tz(
          activityExists.dataValues.aspStartedToDropAt,
          "Asia/Kolkata"
        );
        const aspReachedToDropAt = moment.tz(
          activityExists.dataValues.aspReachedToDropAt,
          "Asia/Kolkata"
        );

        if (!activityExists.dataValues.aspEndServiceAt) {
          //VDM
          if (
            activityExists.caseDetail.dataValues.typeId == 32 &&
            aspReachedToPickupAt &&
            aspStartedToDropAt &&
            aspReachedToDropAt
          ) {
            activityUpdateColumns.aspEndServiceAt = new Date();
            activityUpdateColumns.endServiceInApp = logTypeId == 241 ? 1 : 0;
            syncMobileAppUsageReport = logTypeId == 241 ? true : false;
          } else if (
            activityExists.caseDetail.dataValues.typeId == 31 &&
            ((caseServiceId == 1 &&
              aspReachedToBreakdownAt &&
              aspStartedToDropAt &&
              aspReachedToDropAt) ||
              (caseServiceId != 1 && aspReachedToBreakdownAt))
          ) {
            //CRM
            activityUpdateColumns.aspEndServiceAt = new Date();
            activityUpdateColumns.endServiceInApp = logTypeId == 241 ? 1 : 0;
            syncMobileAppUsageReport = logTypeId == 241 ? true : false;
          }
        }

        clientWaitingCharge =
          activityAspDetailExist.dataValues.actualClientWaitingCharge;
        aspWaitingCharge =
          activityAspDetailExist.dataValues.actualAspWaitingCharge;

        let actualTaxableValue: any;
        let actualTotalAmount: any;
        if (activityAspDetailExist.dataValues.actualServiceCost) {
          actualTaxableValue =
            +activityAspDetailExist.dataValues.actualServiceCost +
            +totalAdditionalCharges;
        } else {
          actualTaxableValue = +totalAdditionalCharges;
        }

        //IF CLIENT HAVE WAITING CHARGE THEN UPDATE THE ACTUALS
        if (clientWaitingCharge && clientWaitingCharge > 0) {
          actualTaxableValue += +clientWaitingCharge;
        }

        const actualTotalTax = calculateGSTAmount(
          actualTaxableValue,
          gstPercentage
        );
        actualTotalAmount = actualTaxableValue + actualTotalTax;

        //ASP TOTAL COST
        let actualAspTaxableValue: any;
        let actualAspTotalAmount: any;
        if (activityAspDetailExist.dataValues.actualAspServiceCost) {
          actualAspTaxableValue =
            +activityAspDetailExist.dataValues.actualAspServiceCost +
            +totalAdditionalCharges;
        } else {
          actualAspTaxableValue = +totalAdditionalCharges;
        }

        //IF ASP HAVE WAITING CHARGE THEN UPDATE THE ACTUALS
        if (aspWaitingCharge && aspWaitingCharge > 0) {
          actualAspTaxableValue += +aspWaitingCharge;
        }

        const actualAspTotalTax = calculateGSTAmount(
          actualAspTaxableValue,
          gstPercentage
        );
        actualAspTotalAmount = actualAspTaxableValue + actualAspTotalTax;

        await Promise.all([
          ActivityAspDetails.update(
            {
              actualAdditionalCharge: totalAdditionalCharges,
              actualTotalTax: actualTotalTax.toFixed(2),
              actualTotalAmount: actualTotalAmount.toFixed(2),
              actualAspTotalTax: actualAspTotalTax.toFixed(2),
              actualAspTotalAmount: actualAspTotalAmount.toFixed(2),
            },
            {
              where: {
                activityId: activityId,
                aspId: aspId,
              },
              transaction: transaction,
            }
          ),
          //UPDATE ACTIVITY APP STATUS
          Activities.update(
            {
              activityAppStatusId: 16, //ASP ADDITIONAL CHARGES ADDED
              ...activityUpdateColumns,
            },
            {
              where: { id: activityId },
              transaction: transaction,
            }
          ),
        ]);

        // GET ADVANCE ACTIVITY TRANSACTION DETAIL
        const advanceActivityTransaction = await ActivityTransactions.findOne({
          attributes: ["id", "paidByDealerId"],
          where: {
            activityId: activityId,
            paymentTypeId: 170, // ADVANCE
            transactionTypeId: 181, // DEBIT
            paymentStatusId: 191, // SUCCESS
          },
        });

        //IF CHARGES EXISTS THEN CREATE LOG AND SEND NOTIFICATION
        if (data.length > 0) {
          //SAVE ACTIVITY LOG
          let activityLogTitle = null;
          //WEB
          if (logTypeId == 240) {
            activityLogTitle = `The actual additional charges have been updated by the agent "${getAgentDetail.data.user.name}".`;

            if (activityExists.caseDetail.dataValues.typeId == 32) {
              // VDM Notifications
              details.templateId = 37;
              details.agentName = getAgentDetail.data.user.name;
              details.aspDetail = aspId;
              if (advanceActivityTransaction) {
                details.paidByDealerDetail =
                  advanceActivityTransaction.dataValues.paidByDealerId;
              }
            } else {
              // CRM Notifications
              details.templateId = 20;
              details.agentName = getAgentDetail.data.user.name;
              details.aspDetail = activityAspDetailExist.dataValues.aspId;
              details.workshopName = getASPDetail.data.data.workshopName;
              details.notificationType = "CRM";
            }
          } else {
            //MOBILE
            activityLogTitle = `The actual additional charges have been updated by the service provider "${getASPDetail.data.data.workshopName}".`;

            if (activityExists.caseDetail.dataValues.typeId == 32) {
              details.templateId = 31;
              details.aspDetail = activityAspDetailExist.dataValues.aspId;
              details.workshopName = getASPDetail.data.data.workshopName;
              details.sourceFrom = 2; //Mobile
            } else {
              details.templateId = 19;
              details.aspDetail = activityAspDetailExist.dataValues.aspId;
              details.workshopName = getASPDetail.data.data.workshopName;
              details.notificationType = "CRM";
              details.sourceFrom = 2; //Mobile
            }
          }
          await ActivityLogs.create(
            {
              activityId: activityId,
              typeId: logTypeId,
              title: activityLogTitle,
            },
            {
              transaction: transaction,
            }
          );
          notificationController.sendNotification(details);
        }
      }
      await transaction.commit();

      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS DURING ACTUAL ADDITIONAL CHARGES
      if (lockAcquired) {
        await Utils.releaseCaseProcessingLock(req.body.caseDetailId);
      }

      if (syncMobileAppUsageReport) {
        // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
        Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
          activityId,
        ]);
      }

      // Sync client report details, client report with mobile number details
      if (activityExists && activityExists.caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [activityExists.dataValues.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activityExists && activityExists.caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Charges details have been updated",
        chargesData: data,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    } finally {
      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS DURING ACTUAL ADDITIONAL CHARGES
      if (lockAcquired) {
        try {
          await Utils.releaseCaseProcessingLock(req.body.caseDetailId);
        } catch (err: any) {
          console.error(
            "Error releasing isActivityProcessing in Charges Update finally",
            err
          );
        }
      }
    }
  }

  //UPDATE ACTUAL KM AND SERVICE COST
  export async function updateActivityActualKmAndCost(
    req: Request,
    res: Response
  ) {
    let lockAcquired = false;
    // CUSTOM VALIDATIONS WITHOUT TRANSACTION
    if (
      req?.validBody?.caseDetailId &&
      req.validBody.caseDetailId !== null &&
      req.validBody.caseDetailId !== undefined &&
      req.validBody.caseDetailId !== ""
    ) {
      lockAcquired = await Utils.tryAcquireCaseProcessingLock(
        req.validBody.caseDetailId
      );
      if (!lockAcquired) {
        return res.status(200).json({
          success: false,
          error: "Another update is in progress. Please try again in 5 minutes",
        });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}`;
      if (inData.authUserRoleId == 3) {
        //AGENT
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}&setParanoidFalse=true`;
      }

      const activity: any = await Activities.findOne({
        where: {
          id: inData.activityId,
          activityStatusId: {
            [Op.in]: [3, 4, 11, 12], // 3-In Progress, 4-Cancelled, 11-Balance Payment Pending, 12-Excess Amount Credit Pending
          },
        },
        include: {
          model: CaseDetails,
          where: {
            statusId: 2, //In Progress
          },
          attributes: ["id", "clientId"],
          required: true,
        },
      });

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const [activityAspDetail, getASPDetail, caseDetail]: any =
        await Promise.all([
          ActivityAspDetails.findOne({
            where: { activityId: inData.activityId, aspId: inData.aspId },
          }),
          // GET ASP DETAILS
          axios.get(aspApiUrl),
          CaseDetails.findByPk(activity.dataValues.caseDetailId),
        ]);

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP Detail not found",
        });
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case Detail not found",
        });
      }

      const [getAgentDetail, advanceActivityTransaction] = await Promise.all([
        // GET Agent DETAILS
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: caseDetail.dataValues.agentId,
        }),
        ActivityTransactions.findOne({
          attributes: ["id", "amount", "paidByDealerId"],
          where: {
            activityId: inData.activityId,
            dealerId: caseDetail.dataValues.dealerId
              ? caseDetail.dataValues.dealerId
              : caseDetail.dataValues.deliveryRequestCreatedDealerId,
            paymentTypeId: 170, // ADVANCE
            transactionTypeId: 181, // DEBIT
            paymentStatusId: 191, // SUCCESS
          },
        }),
      ]);

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      if (!advanceActivityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity advance amount not paid",
        });
      }

      // GET ADVANCE PAID DEALER DATA
      const advancePaidDealerData = await axios.get(
        `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${advanceActivityTransaction.dataValues.paidByDealerId}`
      );
      if (!advancePaidDealerData.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Advance paid dealer not found",
        });
      }

      let actualServiceCost = inData.actualServiceCost;
      let actualTotalTax = inData.actualTotalTax;
      let actualTotalAmount = inData.actualTotalAmount;
      let actualAspServiceCost = inData.actualAspServiceCost;
      let actualAspTotalTax = inData.actualAspTotalTax;
      let actualAspTotalAmount = inData.actualAspTotalAmount;

      let actualTotalKmReason = null;
      if (inData.actualTotalKmReason) {
        const currentDateTime = moment()
          .tz("Asia/Kolkata")
          .format("DD-MM-YYYY hh:mm A");
        let actualTotalKmReasonContent = "";
        if (inData.logTypeId == 240) {
          //WEB
          actualTotalKmReasonContent = `Reason: ${inData.actualTotalKmReason}. By: Agent at: ${currentDateTime}`;
        } else if (inData.logTypeId == 241) {
          //MOBILE
          actualTotalKmReasonContent = `Reason: ${inData.actualTotalKmReason}. By: ASP at: ${currentDateTime}`;
        }

        actualTotalKmReason = activityAspDetail.dataValues.actualTotalKmReason
          ? activityAspDetail.dataValues.actualTotalKmReason +
          ` , ${actualTotalKmReasonContent}`
          : actualTotalKmReasonContent;
      }

      const updateData: any = {
        actualTotalKm: inData.actualTotalKm,
        // actualTotalKmReason: inData.actualTotalKmReason
        //   ? inData.actualTotalKmReason
        //   : activityAspDetail.dataValues.actualTotalKmReason,
        actualServiceCost: actualServiceCost.toFixed(2),
        actualTotalTax: actualTotalTax.toFixed(2),
        actualTotalAmount: actualTotalAmount.toFixed(2),
        actualAspServiceCost: actualAspServiceCost.toFixed(2),
        actualAspTotalTax: actualAspTotalTax.toFixed(2),
        actualAspTotalAmount: actualAspTotalAmount.toFixed(2),
      };
      if (actualTotalKmReason) {
        updateData.actualTotalKmReason = actualTotalKmReason;
      }

      //CREATE ACTIVITY TRANSACTION BASED ON DIFFERENCE AMOUNT
      const actualTotalAmountForPayment = actualTotalAmount;
      // const estimatedTotalAmountForPayment =
      //   activityAspDetail.dataValues.estimatedTotalAmount;
      const estimatedTotalAmountPaid =
        advanceActivityTransaction.dataValues.amount;

      //ACTUAL AMOUNT GREATER THAN ESTIMATED AMOUNT SO DEALER HAS TO PAY BALANCE AMOUNT
      let activityStatusId: number;
      let aspActivityStatusId = 9; // ACTIVITY ENDED
      let activityAppStatusId = 19; // ACTIVITY ENDED

      //FCM PUSH NOTIFICATIONS
      let activityStatusNotification: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
      };

      if (
        parseFloat(actualTotalAmountForPayment) >
        parseFloat(estimatedTotalAmountPaid)
      ) {
        const amount =
          parseFloat(actualTotalAmountForPayment) -
          parseFloat(estimatedTotalAmountPaid);
        const activityTransactionData = {
          activityId: inData.activityId,
          dealerId: caseDetail.dataValues.dealerId
            ? caseDetail.dataValues.dealerId
            : caseDetail.dataValues.deliveryRequestCreatedDealerId,
          date: new Date(),
          paymentTypeId: 171, // BALANCE
          amount: amount,
          transactionTypeId: 181, // DEBIT
          paymentStatusId: 190, // PENDING
        };
        const activityTransactionExist = await ActivityTransactions.findOne({
          where: {
            activityId: inData.activityId,
            dealerId: caseDetail.dataValues.dealerId
              ? caseDetail.dataValues.dealerId
              : caseDetail.dataValues.deliveryRequestCreatedDealerId,
            paymentTypeId: 171, // BALANCE
            transactionTypeId: 181, // DEBIT
            paymentStatusId: 190, // PENDING
          },
          order: [["id", "desc"]],
        });
        if (activityTransactionExist) {
          await ActivityTransactions.update(activityTransactionData, {
            where: {
              id: activityTransactionExist.dataValues.id,
            },
            transaction,
          });
        } else {
          await ActivityTransactions.create(activityTransactionData, {
            transaction,
          });
        }

        activityStatusId = 11; //BALANCE PAYMENT PENDING

        //FCM PUSH NOTIFICATIONS
        activityStatusNotification.templateId = 38;
        activityStatusNotification.dealerWhoPaidAdvance =
          advancePaidDealerData.data.data.name;
        activityStatusNotification.paidByDealerDetail =
          advanceActivityTransaction.dataValues.paidByDealerId;
      } else if (
        parseFloat(actualTotalAmountForPayment) <
        parseFloat(estimatedTotalAmountPaid)
      ) {
        //ESTIMATED AMOUNT GREATER THAN ACTUAL AMOUNT SO WE NEED TO PAY THE EXCESS AMOUNT
        const amount =
          parseFloat(estimatedTotalAmountPaid) -
          parseFloat(actualTotalAmountForPayment);
        const activityTransactionData = {
          activityId: inData.activityId,
          dealerId: caseDetail.dataValues.dealerId
            ? caseDetail.dataValues.dealerId
            : caseDetail.dataValues.deliveryRequestCreatedDealerId,
          date: new Date(),
          paymentTypeId: 172, // EXCESS
          amount: amount,
          transactionTypeId: 180, // CREDIT
          paymentStatusId: 190, // PENDING
        };
        const activityTransactionExist = await ActivityTransactions.findOne({
          where: {
            activityId: inData.activityId,
            dealerId: caseDetail.dataValues.dealerId
              ? caseDetail.dataValues.dealerId
              : caseDetail.dataValues.deliveryRequestCreatedDealerId,
            paymentTypeId: 172, // EXCESS
            transactionTypeId: 180, // CREDIT
            paymentStatusId: 190, // PENDING
          },
          order: [["id", "desc"]],
        });
        if (activityTransactionExist) {
          await ActivityTransactions.update(activityTransactionData, {
            where: {
              id: activityTransactionExist.dataValues.id,
            },
            transaction,
          });
        } else {
          await ActivityTransactions.create(activityTransactionData, {
            transaction,
          });
        }

        activityStatusId = 12; //EXCESS AMOUNT CREDIT PENDING

        //FCM PUSH NOTIFICATIONS
        activityStatusNotification.templateId = 40;
        activityStatusNotification.dealerWhoPaidAdvance =
          advancePaidDealerData.data.data.name;
        activityStatusNotification.paidByDealerDetail =
          advanceActivityTransaction.dataValues.paidByDealerId;
      } else {
        //BOTH ARE EQUAL
        // activityStatusId = 13; //PAYMENT NOT NEED
        activityStatusId = 7; //SUCCESSFUL
      }

      let financeStatusId = 1; //MATURED
      //IF FINANCE STATUS IS MATURED EMPTY RETURN THEN WE SHOULD CHANGE IT TO MATURED
      if (activity.dataValues.financeStatusId == 2) {
        financeStatusId = 2; //MATURED EMPTY RETURN
      }

      await Promise.all([
        Activities.update(
          {
            activityStatusId: activityStatusId,
            aspActivityStatusId: aspActivityStatusId,
            activityAppStatusId: activityAppStatusId,
            financeStatusId: financeStatusId,
          },
          {
            where: { id: inData.activityId },
            transaction,
          }
        ),
        ActivityAspDetails.update(
          { ...updateData },
          {
            where: { activityId: inData.activityId },
            transaction,
          }
        ),
        //UPDATE ACTIVITY ASP RATE CARD
        ActivityAspRateCards.update(
          { ...inData.aspRateCard },
          {
            where: { activityId: inData.activityId },
            transaction,
          }
        ),
        //UPDATE ACTIVITY CLIENT RATE CARD
        ActivityClientRateCards.update(
          { ...inData.clientRateCard },
          {
            where: { activityId: inData.activityId },
            transaction,
          }
        ),
      ]);

      //FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
      };

      //SAVE ACTIVITY LOG
      let activityLogTitle = null;
      //WEB
      if (inData.logTypeId == 240) {
        details.templateId = 36;
        details.agentName = getAgentDetail.data.user.name;
        details.paidByDealerDetail =
          advanceActivityTransaction.dataValues.paidByDealerId;
        details.aspDetail = inData.aspId;
        activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the actual KM.`;
      } else {
        details.templateId = 35;
        details.workshopName = getASPDetail.data.data.workshopName;
        details.paidByDealerDetail =
          advanceActivityTransaction.dataValues.paidByDealerId;
        details.sourceFrom = 2; //Mobile

        //MOBILE
        activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has updated the actual KM and ended the service.`;
      }

      //ACTUAL KM UPDATE NOTIFICATIONS
      notificationController.sendNotification(details);

      //ACTIVITY STATUS CHANGE NOTIFICATION (EXCEPT SUCCESSFULL)
      if (activityStatusNotification.templateId) {
        if (inData.logTypeId == 241) {
          activityStatusNotification.sourceFrom = 2; //Mobile
        }
        notificationController.sendNotification(activityStatusNotification);
      }

      //ASP ACTIVITY ACCEPT OR REJECT CC DETAILS AND PUSH CASE, ACTIVITY TO ASP PORTAL
      if (
        inData.isAspAcceptedCcDetail == 1 ||
        inData.isAspAcceptedCcDetail == 0
      ) {
        //ACTIVITY UPDATED COLUMNS USED FOR PUSHING INVOICE TO ASP PORTAL
        activity.activityStatusId = activityStatusId;
        activity.aspActivityStatusId = aspActivityStatusId;
        activity.financeStatusId = financeStatusId;

        //ACTIVITY ASP DETAIL UPDATED COLUMNS USED FOR PUSHING INVOICE TO ASP PORTAL
        activityAspDetail.actualTotalKm = inData.actualTotalKm;

        const updateAspActivityAcceptOrRejectCcDetailResponse =
          await updateAspActivityAcceptOrRejectCcDetail(
            caseDetail,
            activity,
            activityAspDetail,
            inData.isAspAcceptedCcDetail,
            inData.aspRejectedCcDetailReasonId,
            inData.authUserId,
            transaction
          );
        if (!updateAspActivityAcceptOrRejectCcDetailResponse.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: updateAspActivityAcceptOrRejectCcDetailResponse.error,
          });
        }
      }

      await ActivityLogs.create(
        {
          activityId: inData.activityId,
          typeId: inData.logTypeId,
          title: activityLogTitle,
        },
        { transaction }
      );

      await transaction.commit();

      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      if (lockAcquired) {
        await Utils.releaseCaseProcessingLock(req.validBody.caseDetailId);
      }

      return res.status(200).json({
        success: true,
        message: "Actual KM updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    } finally {
      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      if (lockAcquired) {
        try {
          await Utils.releaseCaseProcessingLock(req.validBody.caseDetailId);
        } catch (err: any) {
          console.error(
            "Error releasing isActivityProcessing in KM Update finally",
            err
          );
        }
      }
    }
  }

  //DEALER BALANCE AMOUNT PAYMENT
  export async function activityPayBalanceAmount(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const { activityId, paymentMethodId, paidByDealerId } = req.validBody;
      const [activity, activityTransaction, getDealerDetail]: any =
        await Promise.all([
          Activities.findOne({
            attributes: [
              "id",
              "caseDetailId",
              "activityNumber",
              "slaAchievedDelayed",
              "advancePaymentMethodId",
              "advancePaymentPaidToId",
              "financeStatusId",
              "aspActivityStatusId",
              "activityStatusId",
              "aspRejectedCcDetailReasonId",
              "isAspAcceptedCcDetail",
              "aspWaitingTime",
              "aspReachedToPickupAt",
              "aspReachedToBreakdownAt",
            ],
            where: {
              id: activityId,
              activityStatusId: 11, //Balance Payment Pending
            },
            include: [
              {
                model: CaseDetails,
                where: {
                  statusId: 2, //In Progress
                },
                attributes: [
                  "id",
                  "typeId",
                  "vin",
                  "deliveryRequestSubServiceId",
                  "locationTypeId",
                  "pickupLatitude",
                  "pickupLongitude",
                  "deliveryRequestDropDealerId",
                  "dropLatitude",
                  "dropLongitude",
                  "caseNumber",
                  "deliveryRequestDropLocation",
                  "isCasePushedToAspPortal",
                ],
                required: true,
                include: [
                  {
                    model: CaseInformation,
                    attributes: [
                      "id",
                      "caseDetailId",
                      "customerContactName",
                      "customerMobileNumber",
                      "customerCurrentContactName",
                      "customerCurrentMobileNumber",
                      "policyNumber",
                      "serviceEligibility",
                      "breakdownLocation",
                      "breakdownLat",
                      "breakdownLong",
                      "breakdownAreaId",
                      "nearestCity",
                      "dropLocationTypeId",
                      "dropDealerId",
                      "dropLocationLat",
                      "dropLocationLong",
                      "dropLocation",
                    ],
                    required: false,
                  },
                ],
              },
              {
                model: ActivityAspDetails,
                attributes: [
                  "id",
                  "rejectReasonId",
                  "aspId",
                  "subServiceId",
                  "aspMechanicId",
                  "actualTotalKm",
                  "estimatedRouteDeviationKm",
                  "estimatedAspToPickupKm",
                  "estimatedPickupToDropKm",
                  "estimatedDropToAspKm",
                  "estimatedAspToBreakdownKm",
                  "estimatedBreakdownToDropKm",
                  "estimatedDropToAspKm",
                  "estimatedBreakdownToAspKm",
                  "estimatedTotalAmount",
                  "actualChargeCollectedFromCustomer",
                ],
                required: true,
              },
            ],
          }),

          ActivityTransactions.findOne({
            attributes: ["id", "amount"],
            where: {
              activityId: activityId,
              paymentTypeId: 171, //BALANCE
              transactionTypeId: 181, //DEBIT
              paymentStatusId: {
                [Op.ne]: 191, //SUCCESS
              },
            },
          }),
          // GET DEALER DETAILS
          axios.get(
            `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${paidByDealerId}&setParanoidFalse=false`
          ),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Balance payment has already been paid",
        });
      }

      if (!getDealerDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Dealer not found",
        });
      }

      const balanceAmount = Utils.convertToIndianCurrencyFormat(
        parseFloat(activityTransaction.dataValues.amount)
      );

      await Promise.all([
        //UPDATE ACTIVITY STATUS
        Activities.update(
          {
            activityStatusId: 7, //SUCCESSFUL
          },
          {
            where: {
              id: activityId,
            },
            transaction,
          }
        ),
        ActivityTransactions.update(
          {
            paymentStatusId: 191, //SUCCESS
            paymentMethodId: paymentMethodId,
            paidByDealerId: paidByDealerId,
            paidAt: new Date(),
          },
          {
            where: {
              activityId: activityId,
              paymentTypeId: 171, //BALANCE
              transactionTypeId: 181, //DEBIT
            },
            transaction,
          }
        ),
        //SAVE ACTIVITY LOG
        ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 240, //WEB
            title: `The dealer "${getDealerDetail.data.data.name}" has paid the balance amount(${balanceAmount}) of the delivery request.`,
          },
          { transaction }
        ),
      ]);

      const dealerWalletDebitRequest = {
        dealerCode: getDealerDetail.data.data.code,
        amount: activityTransaction.dataValues.amount,
        vin: activity.caseDetail.vin,
        requestId: activity.caseDetail.caseNumber,
        type: "balance",
      };

      const dealerWalletDebitResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/dealer/debitWalletTransaction`,
        dealerWalletDebitRequest
      );
      if (!dealerWalletDebitResponse.data.success) {
        await transaction.rollback();
        return res.status(200).json(dealerWalletDebitResponse.data);
      }

      //IF CASE INITIALLY PUSHED TO ASP PORTAL THEN PUSH ACTIVITY WITH SUCCESFULL STATUS
      if (activity.caseDetail.isCasePushedToAspPortal == 1) {
        activity.dataValues.activityStatusId = 7; //SUCCESSFUL
        const aspInvoiceActivityResponse = await Utils.createAspInvoiceActivity(
          activity.caseDetail,
          activity,
          activity.activityAspDetail
        );
        if (!aspInvoiceActivityResponse.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: aspInvoiceActivityResponse.error,
          });
        }
      }

      //FCM PUSH NOTIFICATIONS
      notificationController.sendNotification({
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
        templateId: 39,
        balancePaidDealerName: getDealerDetail.data.data.name,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Activity balance amount successfully paid",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateActivityCancelled(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        cancelReasonId,
        logTypeId,
        authUserId,
        activityFinanceStatusId,
        authUserRoleId,
      } = req.validBody;

      const [activity, activityAspDetail]: any = await Promise.all([
        Activities.findOne({
          where: {
            id: activityId,
            activityStatusId: {
              [Op.notIn]: [4], //4-Cancelled
            },
          },
          attributes: [
            "id",
            "caseDetailId",
            "financeStatusId",
            "activityStatusId",
            "aspActivityStatusId",
            "isAspAutoAllocated"
          ],
          include: [
            {
              model: CaseDetails,
              where: {
                statusId: {
                  [Op.in]: [1, 2], // 1-Open, 2-In Progress
                },
              },
              required: true,
              attributes: [
                "id",
                "rmId",
                "agentId",
                "vin",
                "caseNumber",
                "dealerId",
                "typeId",
                "clientId",
                "isCustomerInvoiced",
                "customerInvoiceNumber",
                "customerInvoiceDate",
                "customerInvoicePath",
              ],
              include: [
                {
                  model: CaseInformation,
                  attributes: [
                    "id",
                    "customerContactName",
                    "customerMobileNumber",
                  ],
                },
              ],
            },
          ],
        }),
        ActivityAspDetails.findOne({
          where: { activityId: activityId },
          attributes: ["id", "aspId", "aspMechanicId"],
        }),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP detail not found",
        });
      }

      // CHECK IF PAYMENT IS CAPTURED OR NOT FOR CRM CASE DURING PAYMENT LINK IS SENT BUT PAYMENT STATUS NOT UPDATED IN CRM
      // Check for transactions with razorpayOrderId but razorpayTransactionId is null (payment captured but not mapped in CRM)
      if (activity.caseDetail.typeId == 31 && activity.activityStatusId == 2) {
        const activityTransactions: any = await ActivityTransactions.findAll({
          where: {
            activityId: activity.id,
            paymentTypeId: 174, //One time service
            razorpayOrderId: { [Op.ne]: null }, // Has payment link
            razorpayTransactionId: { [Op.eq]: null }, // Payment not mapped in CRM
          },
          attributes: ["id", "razorpayOrderId"],
        });

        if (activityTransactions.length > 0) {
          // Check payment status for all transactions that have razorpayOrderId but no razorpayTransactionId
          const paymentStatusChecks = await Promise.all(
            activityTransactions.map(async (txn: any) => {
              try {
                const razorpayPaymentStatusCheckResponse: any = await axios.post(
                  `${process.env.RAZORPAY_PAYMENT_STATUS_CHECK_URL}`,
                  {
                    payment_link_id: txn.razorpayOrderId,
                  }
                );

                if (
                  razorpayPaymentStatusCheckResponse?.data?.response?.payments?.length >
                  0 &&
                  razorpayPaymentStatusCheckResponse.data.response.payments.find(
                    (payment: any) => payment.status == "captured"
                  )
                ) {
                  return true; // Payment captured but not mapped in CRM
                }
                return false; // Payment not captured
              } catch (error: any) {
                console.error(
                  `Error checking payment status for transaction ${txn.id}:`,
                  error.message
                );
                return false; // Assume not captured on error
              }
            })
          );

          // If any payment is captured but not mapped in CRM, prevent cancellation
          if (paymentStatusChecks.some((isCaptured) => isCaptured === true)) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error:
                "The payment has been captured in the sales portal, but it has not been updated in the CRM. Therefore, cancellation is not possible at this time.",
            });
          }
        }
      }

      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activityAspDetail.dataValues.aspId}`;
      let authUserApiData: any = {
        id: authUserId,
      };
      //AGENT OR DEALER
      if (authUserRoleId == 3 || authUserRoleId == 2) {
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activityAspDetail.dataValues.aspId}&setParanoidFalse=true`;
        authUserApiData.setParanoidFalse = true;
      }
      // GET ASP DETAILS
      const getASPDetail = await axios.get(aspApiUrl);
      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // GET AUTH USER DETAILS
      const getAuthUserDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        authUserApiData
      );
      if (!getAuthUserDetail.data.success) {
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      let financeStatusId = activity.dataValues.financeStatusId;
      //ONLY FOR WEB - IF AGENT CANCEL THE ACTIVITY
      if (logTypeId == 240) {
        //IF ASP STARTED ACTIVITY
        // if (activity.dataValues.activityStatusId == 3) {
        //   financeStatusId = 2; //Matured - Empty Return
        // } else {
        //   financeStatusId = 3; //Not Matured
        // }

        //AGENT AND ACTIVITY STATUS EITHER ADVANCE PAYMENT PAID OR INPROGRESS OR ADVANCE PAY LATER
        if (
          getAuthUserDetail.data.user.roleId == 3 &&
          (activity.dataValues.activityStatusId == 3 ||
            activity.dataValues.activityStatusId == 10 ||
            activity.dataValues.activityStatusId == 14)
        ) {
          if (!activityFinanceStatusId) {
            return res.status(200).json({
              success: false,
              error: "Activity finance status is required",
            });
          }
          financeStatusId = activityFinanceStatusId;
        }
      }

      await Promise.all([
        Activities.update(
          {
            activityStatusId: 4, //CANCELLED
            aspActivityStatusId: 10, //CANCEL
            financeStatusId: financeStatusId,
            aspServiceCanceledAt: new Date(),
            serviceCanceledInApp: logTypeId == 241 ? 1 : 0,
          },
          { where: { id: activityId }, transaction: transaction }
        ),
        ActivityAspDetails.update(
          { cancelReasonId: cancelReasonId },
          { where: { activityId: activityId }, transaction: transaction }
        ),
      ]);

      //FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
      };

      //SAVE ACTIVITY LOG
      let activityLogTitle = null;
      //WEB
      if (logTypeId == 240) {
        //DEALER
        if (getAuthUserDetail.data.user.roleId == 2) {
          details.templateId = 18;
          details.canceledDealerName = getAuthUserDetail.data.user.name;

          activityLogTitle = `The request was cancelled by the dealer "${getAuthUserDetail.data.user.name}".`;
        } else if (getAuthUserDetail.data.user.roleId == 3) {
          if (activity.caseDetail.dataValues.typeId == 31) {
            // CRM Notifications
            details.templateId = 8;
            details.notificationType = "CRM";
            details.agentName = getAuthUserDetail.data.user.name;
          } else {
            details.templateId = 17;
            details.agentName = getAuthUserDetail.data.user.name;
          }
          //AGENT
          activityLogTitle = `The request was cancelled by the agent "${getAuthUserDetail.data.user.name}" on behalf of the service provider "${getASPDetail.data.data.workshopName}" and the agent is currently arranging with an alternative service provider.`;
        }
        details.aspDetail = activityAspDetail.dataValues.aspId;
      } else {
        if (activity.caseDetail.dataValues.typeId == 31) {
          // CRM Notifications
          details.templateId = 7;
          details.notificationType = "CRM";
          details.workshopName = getASPDetail.data.data.workshopName;
          details.aspDetail = activityAspDetail.dataValues.aspId;
          details.sourceFrom = 2; //Mobile
        } else {
          details.templateId = 16;
          details.workshopName = getASPDetail.data.data.workshopName;
          details.aspDetail = activityAspDetail.dataValues.aspId;
          details.sourceFrom = 2; //Mobile
        }
        //MOBILE
        activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has cancelled this request and the agent is currently arranging with an alternative service provider.`;
      }

      if (activityAspDetail.dataValues.aspMechanicId) {
        details.mechanicDetail = activityAspDetail.dataValues.aspMechanicId;
      }
      notificationController.sendNotification(details);
      const createdActivityLog = await ActivityLogs.create(
        {
          activityId: activityId,
          typeId: logTypeId,
          title: activityLogTitle,
          aspActivityReportNewValue: "Cancelled",
        },
        {
          transaction: transaction,
        }
      );

      //IF FINANCE STATUS IS NOT MATURED AND TYPE IS 32 (DELIVERY REQUEST)
      if (financeStatusId == 3 && activity.caseDetail.dataValues.typeId == 32) {
        const activityDebitTransaction = await ActivityTransactions.findOne({
          attributes: ["amount", "paidByDealerId"],
          where: {
            activityId: activityId,
            paymentTypeId: 170, //ADVANCE
            transactionTypeId: 181, //DEBIT
            paymentStatusId: 191, //SUCCESS
          },
        });

        // IF ADVANCE AMOUNT PAID BY DEALER THEN REFUND THE AMOUNT TO THE RESPECTIVE DEALER
        if (activityDebitTransaction) {
          const advancePaidByDealerId =
            activityDebitTransaction.dataValues.paidByDealerId;
          const getDealerDetail = await axios.get(
            `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${advancePaidByDealerId}`
          );
          if (!getDealerDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: `Dealer (${advancePaidByDealerId}) not found`,
            });
          }

          const creditDealerWalletResponse = await axios.post(
            `${process.env.RSA_BASE_URL}/crm/dealer/creditAdvanceWalletTransaction`,
            {
              dealerCode: getDealerDetail.data.data.code,
              amount: activityDebitTransaction.dataValues.amount,
              vin: activity.caseDetail.dataValues.vin,
              requestId: activity.caseDetail.dataValues.caseNumber,
              type: "cancelRefund",
            }
          );

          if (!creditDealerWalletResponse.data.success) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: creditDealerWalletResponse.data.error,
            });
          }

          const advanceAmount = Utils.convertToIndianCurrencyFormat(
            parseFloat(activityDebitTransaction.dataValues.amount)
          );

          //ADVANCE AMOUNT REFUND FCM PUSH NOTIFICATIONS
          notificationController.sendNotification({
            caseDetailId: activity.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 19,
            paidByDealerDetail: advancePaidByDealerId,
            paidByDealerOnly: true,
          });

          //CREATE ACTIVITY TRANSACTION DATA FOR ADVANCE REFUND AMOUNT
          const activityTransactionData = {
            activityId: activityId,
            dealerId: activity.caseDetail.dataValues.dealerId
              ? activity.caseDetail.dataValues.dealerId
              : advancePaidByDealerId,
            date: new Date(),
            paymentTypeId: 173, //ADVANCE REFUND
            transactionTypeId: 180, //CREDIT
            amount: activityDebitTransaction.dataValues.amount,
            paymentStatusId: 191, //SUCCESS
            paymentMethodId: 1, //WALLET
            paidToDealerId: advancePaidByDealerId,
            isAdvanceRefundUsed: 0,
            paidAt: new Date(),
          };

          await Promise.all([
            //SAVE ACTIVITY LOG
            ActivityLogs.create(
              {
                activityId: activityId,
                typeId: logTypeId,
                title: `The advance amount(${advanceAmount}) has been refunded to the dealer "${getDealerDetail.data.data.name}" wallet due to ASP service cancellation`,
              },
              {
                transaction: transaction,
              }
            ),
            ActivityTransactions.create(activityTransactionData, {
              transaction: transaction,
            }),
          ]);
        }
      }

      await transaction.commit();

      //For rsa crm, if agent cancel the activity then process auto escalations
      if (activity.caseDetail.dataValues.typeId == 31 && logTypeId == 240) {
        activityCancelAutoEscalation(activity, activityAspDetail, authUserId);
      }

      // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
      Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
        activityId,
      ]);

      //If activity cancel then sync asp auto allocated details for crm report
      if (
        activity.caseDetail.dataValues.typeId == 31 &&
        activity.isAspAutoAllocated
      ) {
        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          [activityId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR ASP ACTIVITY REPORT
      if (activity.caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord("aspActivityReportDetails", [
          createdActivityLog.dataValues.id,
        ]);
      }

      // Sync client report details, client report with mobile number details
      if (activity.caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [activity.dataValues.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activity.caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Activity cancelled successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getUnbilledDealerDeliveryRequests(
    req: Request,
    res: Response
  ) {
    try {
      const { dealerCode, startDate, endDate } = req.validBody;

      // GET DEALER DETAILS
      const getDealerDetail = await axios.get(
        `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetailByCode}?dealerCode=${dealerCode}`
      );
      if (!getDealerDetail.data.success) {
        return res.status(200).json({
          success: false,
          error: "Dealer not found",
        });
      }
      const unbilledDealerId = getDealerDetail.data.data.id;

      // GET CLIENT DETAILS
      const getClientDetail = await axios.get(
        `${masterService}/${subMasterClients}/${endpointMaster.clients.getDetail}?clientId=${getDealerDetail.data.data.clientId}`
      );
      if (!getClientDetail.data.success) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      //GET DELIVERY REQUESTS OF DEALER WHO DID THE ADVANCE PAYMENT - NEED TO GENERATE INVOICE ONLY FOR THESE DEALERS
      const unbilledDealerDeliveryRequests: any =
        await caseDetails.findAndCountAll({
          where: {
            [Op.and]: [
              sequelize.where(
                sequelize.fn("DATE", sequelize.col("closedAt")),
                ">=",
                moment.tz(startDate, "Asia/Kolkata").format("YYYY-MM-DD")
              ),
              sequelize.where(
                sequelize.fn("DATE", sequelize.col("closedAt")),
                "<=",
                moment.tz(endDate, "Asia/Kolkata").format("YYYY-MM-DD")
              ),
              { statusId: 4 }, //CLOSED
            ],
          },
          attributes: ["id", "closedAt"],
          include: [
            {
              model: Activities,
              attributes: ["id"],
              required: true,
              where: {
                financeStatusId: {
                  [Op.in]: [1, 2], //MATURED AND MATURED EMPTY RETURN
                },
                isDealerInvoiced: 0,
              },
              include: [
                {
                  model: activityAspDetails,
                  attributes: [
                    "id",
                    "estimatedServiceCost",
                    "estimatedAdditionalCharge",
                    "actualServiceCost",
                    "actualAdditionalCharge",
                    "actualClientWaitingCharge",
                  ],
                  required: true,
                },
                {
                  model: ActivityTransactions,
                  attributes: ["id"],
                  required: true,
                  where: {
                    paymentTypeId: 170, //ADVANCE
                    transactionTypeId: 181, //DEBIT
                    paymentStatusId: 191, //SUCCESS
                    paidByDealerId: unbilledDealerId,
                  },
                },
              ],
            },
          ],
        });

      if (unbilledDealerDeliveryRequests.count == 0) {
        return res.status(200).json({
          success: false,
          error: `Dealer (${dealerCode}) has no vehicle delivery requests`,
        });
      }

      let unbilledDealerDeliveryRequestTotalRate = 0;
      const unbilledDeliveryRequestForOracle: any = [];
      for (const unbilledDealerDeliveryRequest of unbilledDealerDeliveryRequests.rows) {
        // CALCULATE INDIVIDUAL DELIVERY REQUEST RATE BY LOOPING ITS ACTIVITIES

        let unbilledDealerDeliveryRequestIndividualRate = 0;
        const unbilledDealerDeliveryRequestActivityIds: any = [];
        unbilledDealerDeliveryRequest.activities.forEach((activity: any) => {
          if (activity.activityAspDetail.dataValues.actualServiceCost) {
            unbilledDealerDeliveryRequestIndividualRate += activity
              .activityAspDetail.dataValues.actualAdditionalCharge
              ? +activity.activityAspDetail.dataValues.actualServiceCost +
              +activity.activityAspDetail.dataValues.actualAdditionalCharge +
              +activity.activityAspDetail.dataValues.actualClientWaitingCharge
              : +activity.activityAspDetail.dataValues.actualServiceCost +
              +activity.activityAspDetail.dataValues
                .actualClientWaitingCharge;
          } else if (
            activity.activityAspDetail.dataValues.estimatedServiceCost
          ) {
            unbilledDealerDeliveryRequestIndividualRate += activity
              .activityAspDetail.dataValues.estimatedAdditionalCharge
              ? +activity.activityAspDetail.dataValues.estimatedServiceCost +
              +activity.activityAspDetail.dataValues.estimatedAdditionalCharge
              : +activity.activityAspDetail.dataValues.estimatedServiceCost;
          }
          unbilledDealerDeliveryRequestActivityIds.push(activity.dataValues.id);
        });
        // console.log(unbilledDealerDeliveryRequestIndividualRate);
        // CALCULATE COMBINED DELIVERY REQUEST RATE - MAY CONTAINS MULTIPLE ACTIVITIES
        unbilledDealerDeliveryRequestTotalRate +=
          unbilledDealerDeliveryRequestIndividualRate;

        // PUSH INDIVIDUAL DELIVERY REQUESTS FOR ORACLE REPORT PURPOSE - MAY CONTAINS MULTIPLE ACTIVITIES
        unbilledDeliveryRequestForOracle.push({
          caseDetailId: unbilledDealerDeliveryRequest.dataValues.id,
          rate: unbilledDealerDeliveryRequestIndividualRate.toString(),
          amount: unbilledDealerDeliveryRequestIndividualRate.toString(),
          closingDate: moment
            .tz(
              unbilledDealerDeliveryRequest.dataValues.closedAt,
              "Asia/Kolkata"
            )
            .format("YYYY-MM-DD"),
          activityIds: unbilledDealerDeliveryRequestActivityIds,
        });
      }

      // PREPARE DEALER WISE COMBIND DELIVERY REQUEST DATA AND INDIVIDUAL DELIVERY REQUEST DATA
      const unbilledDealerDeliveryRequestData = {
        dealerCode: getDealerDetail.data.data.code,
        dealerGroupCode: getDealerDetail.data.data.groupCode,
        clientName: getClientDetail.data.data.name,
        subject: "Vehicle Transfer",
        subService: "Vehicle Transfer",
        headerLevelDescription: `Towards vehicle transfer fee from ${moment
          .tz(startDate, "Asia/Kolkata")
          .format("DD/MM/YYYY")} to ${moment
            .tz(endDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")}`,
        deliveryRequest: [
          {
            description: `Total ${unbilledDealerDeliveryRequests.rows.length} vehicle transfer`,
            qty: 1,
            rate: unbilledDealerDeliveryRequestTotalRate.toString(),
            amount: unbilledDealerDeliveryRequestTotalRate.toString(),
          },
        ],
        oracleDeliveryRequests: unbilledDeliveryRequestForOracle,
      };

      return res.status(200).json({
        success: true,
        message: "Unbilled dealer delivery request fetched successfully",
        data: unbilledDealerDeliveryRequestData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateDealerInvoiceDetails(
    req: Request,
    res: Response
  ) {
    try {
      const { dealerInvoiceNumber, deliveryRequests } = req.validBody;

      if (deliveryRequests.length > 0) {
        for (const deliveryRequest of deliveryRequests) {
          await Activities.update(
            {
              isDealerInvoiced: 1,
              dealerInvoiceNumber: dealerInvoiceNumber,
            },
            {
              where: {
                id: {
                  [Op.in]: deliveryRequest.activityIds,
                },
              },
            }
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Dealer invoice details updated successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Store customer additional payment disagreement when customer does not agree to proceed
  export async function storeAdditionalPaymentDisagreement(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const { activityId, customerAgreedToAdditionalPayment, additionalPaymentRemarks, authUserId } =
        req.validBody;

      // Check case type first - only proceed if case type is 31 (CRM case type)
      const activity: any = await Activities.findOne({
        where: {
          id: activityId,
        },
        attributes: ["id", "hasAdditionalKmForPayment"],
        include: [
          {
            model: CaseDetails,
            attributes: ["id", "typeId"],
            required: true,
          },
        ],
        transaction: transaction,
      });

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      // Only proceed if case type is 31 (CRM case type)
      if (activity.caseDetail.dataValues.typeId !== 31) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "This endpoint is only available for CRM case type",
        });
      }

      // Validate activity has additional KM payment requirement
      if (!activity.hasAdditionalKmForPayment) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity does not have additional KM payment requirement",
        });
      }

      // Validate customerAgreedToAdditionalPayment is false
      if (customerAgreedToAdditionalPayment !== false) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "customerAgreedToAdditionalPayment must be false",
        });
      }

      // Store customer agreement status and remarks in activities table
      await Activities.update(
        {
          customerAgreedToAdditionalPayment: false,
          additionalPaymentRemarks: additionalPaymentRemarks || null,
        },
        {
          where: { id: activityId },
          transaction: transaction,
        }
      );

      // Create activity log
      await ActivityLogs.create(
        {
          activityId: activityId,
          typeId: 240, // Web
          title: `Customer did not agree to proceed with additional KM payment link. Comments: ${additionalPaymentRemarks || "No comments provided"}`,
          createdById: authUserId,
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Customer payment agreement stored successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function processNonMembership(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        authUserId,
        paymentLinkSentTo,
        discountPercentage,
        discountAmount,
        discountReasonId,
        discountReason,

        customerTypeId,
        customerTypeName,
        legalName,
        tradeName,
        gstin,
      } = req.validBody;

      const activityExists: any = await Activities.findOne({
        attributes: [
          "id",
          "caseDetailId",
          "nonMembershipType",
          "additionalChargeableKm",
          "hasAdditionalKmForPayment",
          "additionalKmForPayment",
        ],
        where: {
          id: activityId,
          activityStatusId: [2, 3, 10], //ASSIGNED AND INPROGRESS AND ADVANCE PAYMENT PAID
        },
        include: [
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "description",
              "vin",
              "registrationNumber",
              "clientId",
              "vehicleTypeId",
              "vehicleMakeId",
              "vehicleModelId",
              "subjectID",
              "cancelReasonId",
              "callCenterId",
              "statusId",
              "createdAt",
              "typeId"
            ],
            required: true,
            where: {
              statusId: 2, //INPROGRESS
            },
          },
          {
            model: ActivityAspDetails,
            attributes: [
              "id",
              "aspId",
              "subServiceId",
              "estimatedTotalKm",
              "estimatedServiceCost",
              "estimatedAdditionalCharge",
              "additionalKmEstimatedServiceCost"
            ],
            required: true,
          },
        ],
      });
      if (!activityExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity details not found",
        });
      }

      const [caseInformation, getAgentDetail]: any =
        await Promise.all([
          //CASE INFORMATION
          CaseInformation.findOne({
            where: {
              caseDetailId: activityExists.dataValues.caseDetailId,
            },
            attributes: [
              "id",
              "customerContactName",
              "customerMobileNumber",
              "customerCurrentContactName",
              "customerCurrentMobileNumber",
              "customerLocation",
              "customerStateId",
              "customerCityId",
              "serviceEligibility",
              "policyNumber",
              "breakdownLat",
              "breakdownLong",
              "breakdownLocation",
              "breakdownAreaId",
              "nonMembershipType",
              "additionalChargeableKm",
              "sendPaymentLinkTo",
            ],
          }),
          //GET AGENT DETAILS
          axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
            id: authUserId,
          }),
        ]);

      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case information details not found",
        });
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent details not found",
        });
      }

      //ACTIVITY TRANSACTIONS - Create new transaction record for each send link process
      // Will be updated with membershipId and razorpayOrderId after RSA response
      const activityTransactionData: any = {
        activityId: activityExists.dataValues.id,
        date: new Date(),
        paymentMethodId: 2, //Razorpay
        paymentTypeId: 174, //One Time Service
        transactionTypeId: 181, //Debit
        paymentStatusId: 190, //Pending
        isForAdditionalKmPayment: activityExists.dataValues.hasAdditionalKmForPayment == true ? true : false,
        createdById: authUserId,
      };
      const createdTransaction = await ActivityTransactions.create(activityTransactionData, {
        transaction: transaction,
      });
      const activityTransactionId = createdTransaction.dataValues.id;

      //GET MASTER DETAILS
      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          clientId: activityExists.caseDetail.dataValues.clientId,
          aspId: activityExists.activityAspDetail.dataValues.aspId,
          subServiceId:
            activityExists.activityAspDetail.dataValues.subServiceId,
          vehicleTypeId: activityExists.caseDetail.dataValues.vehicleTypeId,
          vehicleMakeId: activityExists.caseDetail.dataValues.vehicleMakeId,
          vehicleModelId: activityExists.caseDetail.dataValues.vehicleModelId,
          cityId: caseInformation.dataValues.breakdownAreaId,
          customerStateId: caseInformation.dataValues.customerStateId,
          customerCityId: caseInformation.dataValues.customerCityId,
          paymentMethodId: 2, //Razorpay,
          cancelReasonId: activityExists.caseDetail.dataValues.cancelReasonId,
          subjectId: activityExists.caseDetail.dataValues.subjectID,
          caseStatusId: activityExists.caseDetail.dataValues.statusId,
          callCenterId: activityExists.caseDetail.dataValues.callCenterId,
          getIgstTax: true,
        }
      );

      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: getMasterDetail.data.error,
        });
      }

      //PUSH CASE TO SALES PORTAL
      const caseResponse = await Utils.createRsaNonMembershipCase(
        activityExists.caseDetail,
        caseInformation,
        getMasterDetail.data
      );
      if (!caseResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: caseResponse.error,
        });
      }

      // Check if this is for additional KM payment
      const isAdditionalKmPayment = activityExists.dataValues.hasAdditionalKmForPayment;

      let totalKm = 0;
      // For additional KM payment, use additionalKmForPayment
      if (isAdditionalKmPayment) {
        totalKm = parseFloat(activityExists.dataValues.additionalKmForPayment || "0");
      } else if (
        activityExists.activityAspDetail.dataValues.estimatedTotalKm &&
        (activityExists.dataValues.nonMembershipType ==
          "Non Warranty Service" ||
          activityExists.dataValues.nonMembershipType ==
          "One Time Paid Service")
      ) {
        totalKm = parseFloat(
          activityExists.activityAspDetail.dataValues.estimatedTotalKm
        );
      } else if (
        activityExists.dataValues.nonMembershipType == "Excess Towing" &&
        activityExists.dataValues.additionalChargeableKm
      ) {
        totalKm = parseFloat(activityExists.dataValues.additionalChargeableKm);
      }

      const nonMembershipRequests = {
        crmActivityId: activityExists.dataValues.id,
        payment_from: "CRM",
        agentCode: getAgentDetail.data?.user?.code || null,
        clientName: getMasterDetail.data?.data?.client?.name || null,
        caseNumber: activityExists.caseDetail.dataValues.caseNumber,
        aspCode: getMasterDetail.data?.data?.asp?.code || null,
        serviceName:
          getMasterDetail.data?.data?.subService?.service?.name || null,
        subServiceName: getMasterDetail.data?.data?.subService?.name || null,
        km: totalKm,
        vin: activityExists.caseDetail.dataValues.vin,
        registrationNumber:
          activityExists.caseDetail.dataValues.registrationNumber,
        vehicleTypeName: getMasterDetail.data?.data?.vehicleType?.name || null,
        vehicleMakeName: getMasterDetail.data?.data?.vehicleMake?.name || null,
        vehicleModelName:
          getMasterDetail.data?.data?.vehicleModel?.name || null,

        customerTypeName: customerTypeName,
        customerFirstName:
          customerTypeId == 1150
            ? legalName
            : caseInformation.dataValues.customerContactName,
        lastName: customerTypeId == 1150 ? tradeName : null,
        gstin: customerTypeId == 1150 ? gstin : null,

        customerContactNumber: paymentLinkSentTo,
        stateName: getMasterDetail.data?.data?.customerState?.name || null, //doubt
        // cityName: getMasterDetail.data?.data?.customerCity?.name || null, //doubt
        cityName: null, //doubt - CITY WILL NOT MATCH WITH SALES PORTAL
        address: caseInformation.dataValues.customerLocation || null,
        membershipTypeName: activityExists.dataValues.nonMembershipType,
        paymentModeName:
          getMasterDetail.data?.data?.paymentMethod?.name || null,

        estimatedAdditionalCharge: isAdditionalKmPayment ? 0 : (
          activityExists?.activityAspDetail?.dataValues
            ?.estimatedAdditionalCharge || 0
        ),
        discountPercentage: discountPercentage ? discountPercentage : null,
        discountAmount: discountAmount ? discountAmount : null,
        discountReasonId: discountReasonId ? discountReasonId : null,
      };

      const newApiLog = await ApiLogs.create({
        typeId: 818, //NON MEMBERSHIP PAYMENT
        entityNumber: activityExists.caseDetail.dataValues.caseNumber,
        host: "RSA ASP",
        url: `${process.env.RSA_BASE_URL}/crm/process/nonMembership/payment`,
        request: JSON.stringify(nonMembershipRequests),
        isInbound: 0, //OUTBOUND
      });

      const nonMembershipPaymentResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/process/nonMembership/payment`,
        nonMembershipRequests
      );

      await ApiLogs.update(
        {
          status: !nonMembershipPaymentResponse.data.success ? 0 : 1,
          response: JSON.stringify(nonMembershipPaymentResponse.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      if (!nonMembershipPaymentResponse.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: nonMembershipPaymentResponse.data.error,
        });
      }

      // Prepare activity update data
      const activityUpdateData: any = {
        sendPaymentLinkTo: paymentLinkSentTo,
        updatedById: authUserId,
      };

      // Prepare ActivityAspDetails update data
      const activityAspDetailsUpdateData: any = {};

      // Prepare activity log title
      let activityLogTitle = `The payment link has been successfully sent to the customer's mobile number "${paymentLinkSentTo}"`;

      if (isAdditionalKmPayment) {
        // For additional KM payment: store discount in ActivityAspDetails table, don't update other ActivityAspDetails fields

        // DISCOUNT PROCESS
        const taxPercentage =
          getMasterDetail?.data?.data?.igstTax?.percentage || 0;
        const newNetAmount =
          parseFloat(activityExists.activityAspDetail.additionalKmEstimatedServiceCost || 0) -
          parseFloat(discountAmount || 0);
        const newTaxAmount = newNetAmount * (taxPercentage / 100);

        activityUpdateData.customerAgreedToAdditionalPayment = true;

        activityAspDetailsUpdateData.additionalKmDiscountPercentage = discountPercentage
          ? parseFloat(discountPercentage).toFixed(2)
          : null;
        activityAspDetailsUpdateData.additionalKmDiscountAmount = discountAmount
          ? parseFloat(discountAmount).toFixed(2)
          : null;
        activityAspDetailsUpdateData.additionalKmDiscountReasonId = discountReasonId
          ? discountReasonId
          : null;
        activityAspDetailsUpdateData.additionalKmDiscountReason = discountReason
          ? discountReason
          : null;
        activityAspDetailsUpdateData.additionalKmEstimatedTotalTax = newTaxAmount.toFixed(2);
        activityAspDetailsUpdateData.additionalKmEstimatedTotalAmount = (
          newNetAmount + newTaxAmount
        ).toFixed(2);

        // Change activity log title for additional KM
        activityLogTitle = `The additional KM payment link has been successfully sent to the customer's mobile number "${paymentLinkSentTo}"`;
      } else {
        // For regular payment: update ActivityAspDetails with discount and other fields

        // DISCOUNT PROCESS
        const taxPercentage =
          getMasterDetail?.data?.data?.igstTax?.percentage || 0;
        const newNetAmount =
          parseFloat(activityExists.activityAspDetail.estimatedServiceCost || 0) +
          parseFloat(
            activityExists.activityAspDetail.estimatedAdditionalCharge || 0
          ) -
          parseFloat(discountAmount || 0);
        const newTaxAmount = newNetAmount * (taxPercentage / 100);

        activityUpdateData.advancePaymentMethodId = 1070; //Online
        activityUpdateData.advancePaymentPaidToId = 1081; //Online

        activityAspDetailsUpdateData.discountPercentage = discountPercentage
          ? parseFloat(discountPercentage).toFixed(2)
          : null;
        activityAspDetailsUpdateData.discountAmount = discountAmount
          ? parseFloat(discountAmount).toFixed(2)
          : null;
        activityAspDetailsUpdateData.discountReasonId = discountReasonId
          ? discountReasonId
          : null;
        activityAspDetailsUpdateData.discountReason = discountReason
          ? discountReason
          : null;
        activityAspDetailsUpdateData.estimatedTotalTax = newTaxAmount.toFixed(2);
        activityAspDetailsUpdateData.estimatedTotalAmount = (
          newNetAmount + newTaxAmount
        ).toFixed(2);
      }

      // Prepare Promise.all array
      await Promise.all([
        // UPDATE ACTIVITY TRANSACTION WITH MEMBERSHIP ID AND RAZORPAY ORDER ID
        ActivityTransactions.update(
          {
            membershipId: nonMembershipPaymentResponse.data.membershipPrimaryId || null,
            razorpayOrderId: nonMembershipPaymentResponse.data.razorpayOrderId || null,
            amount: nonMembershipPaymentResponse.data.amount || null,
            totalKm: totalKm > 0 ? totalKm.toString() : "0",
            updatedById: authUserId,
          },
          {
            where: {
              id: activityTransactionId,
            },
            transaction: transaction,
          }
        ),
        //UPDATE ACTIVITY PAYMENT DETAILS
        Activities.update(
          activityUpdateData,
          {
            where: { id: activityId },
            transaction: transaction,
          }
        ),
        //CREATE ACTIVITY LOG
        ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 240, //Web
            title: activityLogTitle,
          },
          { transaction }
        ),
        ActivityAspDetails.update(
          activityAspDetailsUpdateData,
          {
            where: {
              id: activityExists.activityAspDetail.id,
            },
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activityExists.caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "One time service payment link has been sent successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function paymentStatusUpdate(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const activityExists: any = await Activities.findOne({
        where: {
          id: payload.activityId,
        },
        attributes: ["id", "caseDetailId", "isAspAutoAllocated", "paidTotalKm"],
        include: [
          {
            model: CaseDetails,
            attributes: ["id", "typeId"],
            required: true,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "customerContactName"],
                required: true,
              },
            ],
          },
        ],
      });

      if (!activityExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      // Find the specific transaction using razorpayOrderId if provided, otherwise find any pending transaction
      let activityTransactionWhere: any = {
        activityId: payload.activityId,
        paymentTypeId: 174, //One time service
      };

      // Use razorpayOrderId to find the correct transaction if provided
      if (payload.razorpayOrderId) {
        activityTransactionWhere.razorpayOrderId = payload.razorpayOrderId;
      }

      const activityTransactionExists: any = await ActivityTransactions.findOne({
        where: activityTransactionWhere,
        attributes: ["id", "isForAdditionalKmPayment", "totalKm"],
      });

      if (!activityTransactionExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity transaction not found for the provided razorpayOrderId",
        });
      }

      // Check if this transaction is for additional KM payment
      const isForAdditionalKmPayment = activityTransactionExists.isForAdditionalKmPayment == true;

      // Prepare activity update data
      const activityUpdateData: any = {
        paidTotalKm: (parseFloat(activityExists.dataValues.paidTotalKm || "0") + parseFloat(activityTransactionExists.dataValues.totalKm || "0")).toString(),
      };

      // Prepare activity log title
      const advanceAmount = Utils.convertToIndianCurrencyFormat(
        parseFloat(payload.amount)
      );
      let activityLogTitle = `The customer "${activityExists.caseDetail.caseInformation.dataValues.customerContactName}" has paid the advance amount(${advanceAmount}) of the request.`;

      if (isForAdditionalKmPayment) {
        // For additional KM payment: only set paymentForAdditionalKmCaptured, don't update status fields
        activityUpdateData.paymentForAdditionalKmCaptured = true;

        // Change activity log title for additional KM payment
        activityLogTitle = `The customer "${activityExists.caseDetail.caseInformation.dataValues.customerContactName}" has paid the additional KM payment amount(${advanceAmount}) of the request.`;
      } else {
        // For regular payment: update all status fields
        activityUpdateData.dealerApprovalStatusId = 42; //APPROVED
        activityUpdateData.activityStatusId = 10; //PAYMENT PAID
        activityUpdateData.aspActivityStatusId = 2; //WAITING FOR SERVICE INITIATION
        activityUpdateData.activityAppStatusId = 3; //WAITING FOR SERVICE INITIATION
      }

      await Promise.all([
        //UPDATE APPROVAL STATUS, PAYMENT METHOD, ACTIVITY AND ASP ACTIVITY STATUS
        // Note: Invoice fields removed - invoice will be generated at case closure
        Activities.update(
          activityUpdateData,
          {
            where: {
              id: payload.activityId,
            },
            transaction: transaction,
          }
        ),
        ActivityTransactions.update(
          {
            paymentStatusId: 191, //SUCCESS
            amount: payload.amount,
            paidAt: new Date(),
            razorpayTransactionId: payload.transaction_id || null,
          },
          {
            where: {
              id: activityTransactionExists.id,
            },
            transaction: transaction,
          }
        ),
      ]);

      const details = {
        caseDetailId: activityExists.caseDetail.dataValues.id,
        templateId: 21,
        notifyToAll: [""],
        customerName:
          activityExists.caseDetail.caseInformation.dataValues
            .customerCurrentContactName,
        notificationType: "CRM",
      };
      notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc

      //SAVE ACTIVITY LOG
      await ActivityLogs.create(
        {
          activityId: payload.activityId,
          typeId: 240, //WEB
          title: activityLogTitle,
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();

      //If payment updated then sync asp auto allocated details for crm report.
      if (
        activityExists.caseDetail.dataValues.typeId == 31 &&
        activityExists.isAspAutoAllocated
      ) {
        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          [payload.activityId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activityExists.caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [payload.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Activity payment status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function resendPaymentLink(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const { transactionId, authUserId } = req.validBody;

      // Find the specific transaction
      const activityTransaction: any = await ActivityTransactions.findOne({
        where: {
          id: transactionId,
          paymentTypeId: 174, //One time service
        },
        attributes: ["id", "activityId", "razorpayOrderId", "razorpayTransactionId"],
        include: [
          {
            model: Activities,
            attributes: ["id", "sendPaymentLinkTo", "activityStatusId"],
            required: true,
            include: [
              {
                model: CaseDetails,
                attributes: ["id", "statusId"],
                required: true,
                where: {
                  statusId: 2, //INPROGRESS
                },
              },
            ],
            where: {
              activityStatusId: 2, //ASSIGNED
            },
          },
        ],
      });

      if (!activityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Transaction not found",
        });
      }

      const activity = activityTransaction.activity;
      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found for this transaction",
        });
      }

      if (!activityTransaction.razorpayOrderId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "No payment link found for this transaction. Please send a new payment link first.",
        });
      }

      const response = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/nonMembership/resendPaymentLink`,
        {
          razorpayOrderId: activityTransaction.razorpayOrderId,
        }
      );

      if (!response.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: response.data.error,
        });
      }

      // Update activityTransaction with new razorpayOrderId if a new one is returned
      if (response.data.razorpayOrderId && response.data.razorpayOrderId !== activityTransaction.razorpayOrderId) {
        await ActivityTransactions.update(
          {
            razorpayOrderId: response.data.razorpayOrderId,
            updatedById: authUserId,
          },
          {
            where: { id: activityTransaction.id },
            transaction: transaction,
          }
        );
      }

      await Promise.all([
        //CREATE ACTIVITY LOG
        ActivityLogs.create(
          {
            activityId: activityTransaction.activityId,
            typeId: 240, //Web
            title: `The payment link has been successfully resent to the customer's mobile number "${activity.sendPaymentLinkTo}".`,
          },
          { transaction }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "One time service payment link has been resent successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function rsaApproveActivity(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const activityExists: any = await Activities.findOne({
        attributes: ["id", "isAspAutoAllocated"],
        where: {
          id: payload.activityId,
        },
        include: [
          {
            model: CaseDetails,
            attributes: ["id", "agentId", "typeId"],
            required: true,
          },
        ],
      });
      if (!activityExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity details not found",
        });
      }

      const getAgentDetail: any = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: activityExists.caseDetail.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      await Promise.all([
        //UPDATE APPROVAL STATUS, PAYMENT METHOD, ACTIVITY AND ASP ACTIVITY STATUS
        Activities.update(
          {
            dealerApprovalStatusId: 42, //APPROVED
            activityStatusId: 10, //PAYMENT PAID
            aspActivityStatusId: 2, //WAITING FOR SERVICE INITIATION
            activityAppStatusId: 3, //WAITING FOR SERVICE INITIATION
          },
          {
            where: {
              id: payload.activityId,
            },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: payload.activityId,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name}" has approved the activity.`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();

      //If activity approved then sync asp auto allocated details for crm report.
      if (
        activityExists.caseDetail.typeId == 31 &&
        activityExists.isAspAutoAllocated
      ) {
        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          [payload.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Activity approved successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function aspActivityAcceptOrRejectCcDetail(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const {
        authUserId,
        activityId,
        aspId,
        isAspAcceptedCcDetail,
        aspRejectedCcDetailReasonId,
      } = req.validBody;

      const [activity, activityAspDetail]: any = await Promise.all([
        Activities.findOne({
          where: { id: activityId },
          attributes: [
            "id",
            "caseDetailId",
            "activityNumber",
            "slaAchievedDelayed",
            "advancePaymentMethodId",
            "advancePaymentPaidToId",
            "financeStatusId",
            "activityStatusId",
            "aspRejectedCcDetailReasonId",
            "isAspAcceptedCcDetail",
            "aspWaitingTime",
            "aspActivityStatusId",
            "aspReachedToPickupAt",
            "aspReachedToBreakdownAt",
          ],
          include: [
            {
              model: caseDetails,
              attributes: {
                exclude: ["createdById", "updatedById", "deletedById"],
              },
              required: true,
              include: [
                {
                  model: CaseInformation,
                  attributes: [
                    "id",
                    "caseDetailId",
                    "customerContactName",
                    "customerMobileNumber",
                    "customerCurrentContactName",
                    "customerCurrentMobileNumber",
                    "policyNumber",
                    "serviceEligibility",
                    "breakdownLocation",
                    "breakdownLat",
                    "breakdownLong",
                    "breakdownAreaId",
                    "nearestCity",
                    "dropLocationTypeId",
                    "dropDealerId",
                    "dropLocationLat",
                    "dropLocationLong",
                    "dropLocation",
                  ],
                  required: false,
                },
              ],
            },
          ],
        }),
        ActivityAspDetails.findOne({
          where: {
            activityId: activityId,
            aspId: aspId,
          },
          attributes: [
            "id",
            "aspId",
            "subServiceId",
            "estimatedRouteDeviationKm",
            "estimatedAspToPickupKm",
            "estimatedPickupToDropKm",
            "estimatedDropToAspKm",
            "estimatedAspToBreakdownKm",
            "estimatedBreakdownToDropKm",
            "estimatedDropToAspKm",
            "estimatedBreakdownToAspKm",
            "rejectReasonId",
            "actualTotalKm",
            "estimatedTotalAmount",
            "actualChargeCollectedFromCustomer",
          ],
        }),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP detail not found",
        });
      }

      const updateAspActivityAcceptOrRejectCcDetailResponse =
        await updateAspActivityAcceptOrRejectCcDetail(
          activity.caseDetail,
          activity,
          activityAspDetail,
          isAspAcceptedCcDetail,
          aspRejectedCcDetailReasonId,
          authUserId,
          transaction
        );

      if (!updateAspActivityAcceptOrRejectCcDetailResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: updateAspActivityAcceptOrRejectCcDetailResponse.error,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: updateAspActivityAcceptOrRejectCcDetailResponse.message,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function aspActivityUpdateAspWaitingTime(
    req: Request,
    res: Response
  ) {
    let lockAcquired = false;
    // CUSTOM VALIDATIONS WITHOUT TRANSACTION
    if (
      req?.validBody?.caseDetailId &&
      req.validBody.caseDetailId !== null &&
      req.validBody.caseDetailId !== undefined &&
      req.validBody.caseDetailId !== ""
    ) {
      lockAcquired = await Utils.tryAcquireCaseProcessingLock(
        req.validBody.caseDetailId
      );
      if (!lockAcquired) {
        return res.status(200).json({
          success: false,
          error: "Another update is in progress. Please try again in 5 minutes",
        });
      }
    }
    const transaction = await sequelize.transaction();
    try {
      const {
        activityId,
        aspId,
        aspCode,
        subServiceName,
        caseDate,
        waitingTimeInMinutes,
      } = req.validBody;

      const aspRateCardData = {
        aspCode: aspCode,
        subService: subServiceName,
        date: moment.tz(caseDate, "Asia/Kolkata").format("YYYY-MM-DD"),
        isMobile: 1,
      };
      const [activity, activityAspDetail, getAspRateCard]: any =
        await Promise.all([
          Activities.findOne({
            where: {
              id: activityId,
              activityStatusId: {
                [Op.in]: [3, 4, 7, 11, 12], // 3-In Progress, 4-Cancelled, 7-Successful, 11-Balance Payment Pending, 12-Excess Amount Credit Pending
              },
            },
            attributes: ["id", "caseDetailId"],
            include: {
              model: CaseDetails,
              where: {
                statusId: 2, //In Progress
              },
              attributes: ["id", "clientId", "typeId"],
              required: true,
            },
          }),
          ActivityAspDetails.findOne({
            where: {
              activityId: activityId,
              aspId: aspId,
            },
            attributes: ["id"],
          }),
          //ASP RATE CARD
          axios.post(
            `${process.env.RSA_BASE_URL}/crm/asp/getRateCard`,
            aspRateCardData
          ),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP detail not found",
        });
      }

      if (!getAspRateCard.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP rate card not found",
        });
      }

      const aspRateCardDetails = {
        rangeLimit: getAspRateCard.data.aspRateCard.range_limit,
        belowRangePrice: getAspRateCard.data.aspRateCard.below_range_price,
        aboveRangePrice: getAspRateCard.data.aspRateCard.above_range_price,
        waitingChargePerHour:
          getAspRateCard.data.aspRateCard.waiting_charge_per_hour,
        emptyReturnRangePrice:
          getAspRateCard.data.aspRateCard.empty_return_range_price,
      };
      const updateAspWaitingTimeAndChargeResponse =
        await updateAspWaitingTimeAndCharge(
          aspId,
          activity,
          activityAspDetail,
          aspRateCardDetails,
          waitingTimeInMinutes,
          transaction
        );
      if (!updateAspWaitingTimeAndChargeResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: updateAspWaitingTimeAndChargeResponse.error,
        });
      }

      await transaction.commit();

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [activityId]
        );
      }

      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      if (lockAcquired) {
        await Utils.releaseCaseProcessingLock(req.validBody.caseDetailId);
      }

      return res.status(200).json({
        success: true,
        message: "Activity ASP waiting time updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    } finally {
      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      if (lockAcquired) {
        try {
          await Utils.releaseCaseProcessingLock(req.validBody.caseDetailId);
        } catch (err: any) {
          console.error(
            "Error releasing isActivityProcessing in KM Update finally",
            err
          );
        }
      }
    }
  }

  //GET NOTES DETAILS OF GIVEN ACTIVITY ID
  export async function getActivityNotes(req: Request, res: Response) {
    try {
      const { caseDetailId, serviceId, subServiceId } = req.validBody;
      const caseDetail: any = await CaseDetails.findOne({
        attributes: ["id", "clientId", "vin", "registrationNumber"],
        where: {
          id: caseDetailId,
        },
        include: [
          {
            model: CaseInformation,
            attributes: [
              "id",
              "customerCurrentContactName",
              "policyTypeId",
              "policyStartDate",
              "policyEndDate",
              "policyNumber",
              "caseTypeId",
              "breakdownLat",
              "breakdownLong",
              "breakdownToDropLocationDistance",
              "serviceEligibilityId",
              "serviceId",
              "subServiceId",
            ],
            required: true,
          },
        ],
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case data not found",
        });
      }

      let noteDetails: any = {};
      const notesResponse = await getNotes(
        caseDetail,
        caseDetail.caseInformation,
        serviceId,
        subServiceId,
        caseDetail.caseInformation.dataValues.breakdownToDropLocationDistance
      );
      if (notesResponse && notesResponse.success) {
        noteDetails.notes = JSON.stringify(notesResponse.notes);
        noteDetails.customerNeedToPay = notesResponse.notes.customerNeedToPay;
        noteDetails.nonMembershipType = notesResponse.notes.nonMembershipType;
        noteDetails.additionalChargeableKm =
          notesResponse.notes.additionalChargeableKm;
      }

      const data = {
        caseDetail: caseDetail,
        notes: noteDetails,
      };

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspActivityStatuses(req: Request, res: Response) {
    try {
      const { activityId } = req.validBody;
      const activity: any = await Activities.findOne({
        attributes: ["id", "caseDetailId", "aspActivityStatusId"],
        where: { id: activityId },
        include: [
          {
            model: caseDetails,
            attributes: ["id", "typeId"],
            required: true,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "dropLocation"],
                required: false,
              },
            ],
          },
          {
            model: ActivityAspDetails,
            attributes: ["id", "subServiceId"],
            required: true,
          },
        ],
      });
      if (!activity) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      //GET MASTER DETAILS
      const masterDetailResponse = await axios.post(
        `${masterService}/${endpointMaster.getAspMasterDetails}`,
        {
          subServiceId: activity.activityAspDetail.dataValues.subServiceId,
        }
      );

      if (!masterDetailResponse.data.success) {
        return res.status(200).json({
          success: false,
          error: masterDetailResponse.data.error,
        });
      }

      const aspActivityStatusIds = [];
      //Delivery Request
      if (activity.caseDetail.typeId == 32) {
        if (activity.dataValues.aspActivityStatusId == 2) {
          //Waiting for Service Initiation
          aspActivityStatusIds.push(3); //Started To Pickup
        } else if (activity.dataValues.aspActivityStatusId == 3) {
          //Started To Pickup
          aspActivityStatusIds.push(4); //Reached Pickup
        } else if (activity.dataValues.aspActivityStatusId == 4) {
          //Reached Pickup
          aspActivityStatusIds.push(5); //Started To Drop Location
        } else if (activity.dataValues.aspActivityStatusId == 5) {
          //Started To Drop Location
          aspActivityStatusIds.push(6); //Reached Drop Location
        } else if (activity.dataValues.aspActivityStatusId == 6) {
          //Reached Drop Location
          aspActivityStatusIds.push(7); //Started To Garage
        } else if (activity.dataValues.aspActivityStatusId == 7) {
          //Started To Garage
          aspActivityStatusIds.push(8); //Reached Garage
        }
      } else if (activity.caseDetail.typeId == 31) {
        //RSA (CRM case type)
        if (!activity.caseDetail.caseInformation) {
          return res.status(200).json({
            success: false,
            error: "Case information not found",
          });
        }

        const serviceId = masterDetailResponse.data.data?.subService?.serviceId;
        const subServiceId = masterDetailResponse.data.data?.subService?.id;
        const isCustodySubService = subServiceId == 24; // Custody sub service ID

        // Check if it's a CRM case type and handle accordingly
        // For CRM cases, return statuses based on service type
        if (serviceId == 2 || isCustodySubService) {
          // Mechanical service or Others service with Custody sub service
          // Both have the same status flow: Started To BD, Reached BD, Activity Started, Activity Ended, End Trip
          if (activity.dataValues.aspActivityStatusId == 2) {
            //Waiting for Service Initiation
            aspActivityStatusIds.push(14); //Started To BD
          } else if (activity.dataValues.aspActivityStatusId == 14) {
            //Started To BD
            aspActivityStatusIds.push(15); //Reached BD
          } else if (activity.dataValues.aspActivityStatusId == 15) {
            //Reached BD
            aspActivityStatusIds.push(18); //Activity Started
          } else if (activity.dataValues.aspActivityStatusId == 18) {
            //Activity Started
            aspActivityStatusIds.push(13); //Activity Ended
          } else if (activity.dataValues.aspActivityStatusId == 13) {
            //Activity Ended
            aspActivityStatusIds.push(9); //End Trip
          }
        } else if (serviceId == 1 && activity.caseDetail.caseInformation.dropLocation) {
          // Towing service
          if (activity.dataValues.aspActivityStatusId == 2) {
            //Waiting for Service Initiation
            aspActivityStatusIds.push(14); //Started To BD
          } else if (activity.dataValues.aspActivityStatusId == 14) {
            //Started To BD
            aspActivityStatusIds.push(15); //Reached BD
          } else if (activity.dataValues.aspActivityStatusId == 15) {
            //Reached BD
            aspActivityStatusIds.push(16); //Started to Dealer
          } else if (activity.dataValues.aspActivityStatusId == 16) {
            //Started to Dealer
            aspActivityStatusIds.push(17); //Reached Dealer
          } else if (activity.dataValues.aspActivityStatusId == 17) {
            //Reached Dealer
            aspActivityStatusIds.push(18); //Activity Started
          } else if (activity.dataValues.aspActivityStatusId == 18) {
            //Activity Started
            aspActivityStatusIds.push(13); //Activity Ended
          } else if (activity.dataValues.aspActivityStatusId == 13) {
            //Activity Ended
            aspActivityStatusIds.push(9); //End Trip
          }
        } else {
          // For other services (not mechanical, not towing, not custody)
          // Based on requirement #4: "For other services the asp activity status will come only for custody sub service"
          // Since isCustodySubService is false here, we don't return any statuses
          // This else block is kept for legacy RSA flow compatibility (non-CRM cases or edge cases)
          // For CRM cases with non-custody "Others" services, no statuses will be returned
          if (activity.dataValues.aspActivityStatusId == 2) {
            //Waiting for Service Initiation
            aspActivityStatusIds.push(14); //Started To BD
          } else if (activity.dataValues.aspActivityStatusId == 14) {
            //Started To BD
            aspActivityStatusIds.push(15); //Reached BD
          }
        }
      }

      if (aspActivityStatusIds.length == 0) {
        return res.status(200).json({
          success: false,
          error: "ASP activity status not found",
        });
      }

      const aspActivityResponse = await axios.post(
        `${masterService}/${endpointMaster.aspActivityStatuses.getByIds}`,
        {
          ids: aspActivityStatusIds,
        }
      );
      if (!aspActivityResponse.data.success) {
        return res.status(200).json({
          success: false,
          error: aspActivityResponse.data.errors
            ? aspActivityResponse.data.errors.join(",")
            : aspActivityResponse.data.error,
        });
      }

      return res.status(200).json({
        success: true,
        data: aspActivityResponse.data.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspMechanicOverAllMapViewDetails(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;

      //FETCH OWNER MECHANICS
      const getAspMechanicResponse = await axios.post(
        `${masterService}/${endpointMaster.getOverAllMapViewAspMechanics}`,
        {
          aspId: payload.aspId,
        }
      );
      if (!getAspMechanicResponse.data.success) {
        return res.status(200).json({
          success: false,
          error: getAspMechanicResponse.data.errors
            ? getAspMechanicResponse.data.errors.join(",")
            : getAspMechanicResponse.data.error,
        });
      }

      const aspMechanicDetails: any = [];
      for (const aspMechanic of getAspMechanicResponse.data.data) {
        //FETCH ACTIVE OWNER MECHANIC ACTIVITY
        const activityAspDetail: any = await ActivityAspDetails.findOne({
          where: {
            aspMechanicId: aspMechanic.id,
          },
          attributes: ["id", "aspId", "aspMechanicId", "activityId"],
          order: [["id", "DESC"]],
          include: [
            {
              model: Activities,
              where: {
                activityStatusId: 3, // In Progress
              },
              attributes: ["id", "caseDetailId"],
              required: true,
              include: [
                {
                  model: ActivityAspLiveLocations,
                  attributes: ["id", "latitude", "longitude"],
                  required: true,
                  limit: 1,
                  separate: true,
                  order: [["id", "DESC"]],
                },
                {
                  model: CaseDetails,
                  attributes: ["id", "typeId"],
                  required: true,
                  include: [
                    {
                      model: CaseInformation,
                      attributes: ["id", "serviceId"],
                      required: false,
                    },
                  ],
                },
              ],
            },
          ],
        });

        let details: any = {
          ...aspMechanic,
          activityId: null,
          caseTypeId: null,
          rsaServiceId: null,
        };

        if (activityAspDetail) {
          let rsaServiceId = null;
          if (
            activityAspDetail.activity.caseDetail.typeId == 31 &&
            activityAspDetail.activity.caseDetail.caseInformation
          ) {
            // RSA
            rsaServiceId =
              activityAspDetail.activity.caseDetail.caseInformation.serviceId;
          }

          details.activityId = activityAspDetail.activity.id;
          details.caseTypeId = activityAspDetail.activity.caseDetail.typeId;
          details.rsaServiceId = rsaServiceId;
          if (activityAspDetail?.activity?.activityAspLiveLocations[0]) {
            details.latitude =
              activityAspDetail.activity.activityAspLiveLocations[0].latitude;
            details.longitude =
              activityAspDetail.activity.activityAspLiveLocations[0].longitude;
          }
        }
        aspMechanicDetails.push(details);
      }

      if (aspMechanicDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "ASP mechanic details not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: aspMechanicDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateCustodyAspArrivalStatus(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const { activityId, isCustodyAspArrived, authUserId } = req.validBody;
      const activity: any = await Activities.findOne({
        attributes: ["id"],
        where: { id: activityId },
        include: {
          model: ActivityAspDetails,
          attributes: ["id", "aspId"],
          required: true,
        },
      });
      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const getASPDetail: any = await Utils.getAspDetail(
        activity.activityAspDetail.dataValues.aspId
      );
      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP details not found",
        });
      }

      const custodyAspStatus =
        isCustodyAspArrived == 1 ? "Arrived" : "Not Arrived";

      await Promise.all([
        Activities.update(
          {
            isCustodyAspArrived: isCustodyAspArrived,
            activityAppStatusId: 30, // RSA Custody Service Status Updated
            updatedById: authUserId,
          },
          {
            where: {
              id: activityId,
            },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 241, //MOBILE
            title: `The service provider "${getASPDetail.data.data.workshopName}" has updated the custody ASP arrival status as "${custodyAspStatus}".`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Custody ASP arrival status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function sendCustomerInvoice(req: Request, res: Response) {
    try {
      const { caseId, email } = req.validBody;

      // Find case directly using caseId
      const caseDetail: any = await CaseDetails.findOne({
        attributes: ["id", "customerInvoicePath"],
        where: { id: caseId },
      });

      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      if (!caseDetail.customerInvoicePath) {
        return res.status(200).json({
          success: false,
          error: "Customer invoice not found for this case",
        });
      }

      const emailData = {
        subject: "Customer Invoice",
        templateFileName: "activity-customer-invoice-template.html",
        toEmail: [email],
        ccEmail: null,
        content: `Kindly find the attached document for the customer invoice`,
        portalLogoUrl: `${process.env.API_GATEWAY_URL}images/portalLogo.png`,
        attachments: [
          {
            fileName: "Invoice.pdf",
            path: `${process.env.RSA_WEB_BASE_URL}${caseDetail.customerInvoicePath}`,
          },
        ],
      };

      const sendMailResponse = await emailNotification(emailData);
      if (!sendMailResponse.success) {
        return res.status(200).json({
          success: false,
          error: sendMailResponse.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Customer invoice mail sent successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function approvedActivityList(req: any, res: any) {
    try {
      const data = req.body;
      const url = `${process.env.RSA_BASE_URL}/case-pkg/get-invoiceable-activities`;

      let aspCodes = [];
      aspCodes.push(data.asp_code);

      //IF ASP IS FINANCE ADMIN THEN GET ITS SUB ASPS
      const aspSubAspResponse: any = await axios.get(
        `${masterService}/${endpointMaster.asps.getAspSubAsps}?aspCode=${data.asp_code}`
      );

      if (
        aspSubAspResponse?.data?.success &&
        aspSubAspResponse?.data?.subAsps?.length > 0
      ) {
        const subAspCodes = aspSubAspResponse.data.subAsps.map(
          (subAsp: any) => subAsp.code
        );
        aspCodes.push(...subAspCodes);
      }

      data.asp_codes = aspCodes;

      // CREATE API LOG
      const newApiLog: any = await ApiLogs.create({
        typeId: 813, // APPROVED ACTIVITY
        host: "RSA ASP",
        url: url,
        request: JSON.stringify(data),
        isInbound: 0, //OUTBOUND
      });

      // CALL OUTBOUND API
      const response: any = await axios.post(url, data);

      await ApiLogs.update(
        {
          status: !response.data.success ? 0 : 1,
          response: JSON.stringify(response.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      return res.status(200).json(response.data);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function approvedActivityPreview(req: any, res: any) {
    try {
      const { encryptionKey, aspId } = req.query;
      const url = `${process.env.RSA_BASE_URL}/case-pkg/activity-approved/get-details/${encryptionKey}/${aspId}`;

      // CREATE API LOG
      const newApiLog: any = await ApiLogs.create({
        typeId: 814, // APPROVED ACTIVITY PREVIEW
        host: "RSA ASP",
        url: url,
        request: JSON.stringify(req.query),
        isInbound: 0, //OUTBOUND
      });

      // CALL OUTBOUND API
      const response: any = await axios.get(url);

      await ApiLogs.update(
        {
          status: !response.data.success ? 0 : 1,
          response: JSON.stringify(response.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      return res.status(200).json(response.data);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function createAspInvoice(req: any, res: any) {
    try {
      const { apiLogRequest, ...data } = req.body;
      const url = `${process.env.RSA_BASE_URL}/case-pkg/create-invoice`;

      // CREATE API LOG
      const newApiLog: any = await ApiLogs.create({
        typeId: 815, //CREATE ASP INVOICE
        host: "RSA ASP",
        url: url,
        request: JSON.stringify(apiLogRequest),
        isInbound: 0, //OUTBOUND
      });

      // CALL OUTBOUND API
      const response: any = await axios.post(url, data);

      await ApiLogs.update(
        {
          status: !response.data.success ? 0 : 1,
          response: JSON.stringify(response.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      return res.status(200).json(response.data);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function aspInvoiceList(req: any, res: any) {
    try {
      const data = req.body;
      const url = `${process.env.RSA_BASE_URL}/case-pkg/get-invoice-list`;

      let aspCodes = [];
      aspCodes.push(data.asp_code);

      //IF ASP IS FINANCE ADMIN THEN GET ITS SUB ASPS
      const aspSubAspResponse: any = await axios.get(
        `${masterService}/${endpointMaster.asps.getAspSubAsps}?aspCode=${data.asp_code}`
      );

      if (
        aspSubAspResponse?.data?.success &&
        aspSubAspResponse?.data?.subAsps?.length > 0
      ) {
        const subAspCodes = aspSubAspResponse.data.subAsps.map(
          (subAsp: any) => subAsp.code
        );
        aspCodes.push(...subAspCodes);
      }

      data.asp_codes = aspCodes;

      // CREATE API LOG
      const newApiLog: any = await ApiLogs.create({
        typeId: 816, //ASP INVOICE LIST
        host: "RSA ASP",
        url: url,
        request: JSON.stringify(data),
        isInbound: 0, //OUTBOUND
      });

      // CALL OUTBOUND API
      const response: any = await axios.post(url, data);

      await ApiLogs.update(
        {
          status: !response.data.success ? 0 : 1,
          response: JSON.stringify(response.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      return res.status(200).json(response.data);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function aspInvoiceView(req: any, res: any) {
    try {
      const { invoiceId } = req.query;
      const url = `${process.env.RSA_BASE_URL}/case-pkg/invoice/view/${invoiceId}/1`;

      // CREATE API LOG
      const newApiLog: any = await ApiLogs.create({
        typeId: 817, //ASP INVOICE VIEW
        host: "RSA ASP",
        url: url,
        request: JSON.stringify(req.query),
        isInbound: 0, //OUTBOUND
      });

      // CALL OUTBOUND API
      const response: any = await axios.get(url);

      await ApiLogs.update(
        {
          status: !response.data.success ? 0 : 1,
          response: JSON.stringify(response.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      return res.status(200).json(response.data);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getRsaServiceDetail(req: Request, res: Response) {
    try {
      const { activityId } = req.validBody;
      const serviceDetail: any = await getServiceDetails(activityId);
      if (!serviceDetail.success) {
        return res.status(200).json(serviceDetail);
      }

      const serviceDetails = {
        serviceStartDateTime: serviceDetail?.activity?.dataValues
          .serviceStartDateTime
          ? moment
            .tz(
              serviceDetail.activity.dataValues.serviceStartDateTime,
              "Asia/Kolkata"
            )
            .format("DD/MM/YYYY hh:mm A")
          : null,
        serviceEndDateTime: serviceDetail?.activity?.dataValues
          .serviceEndDateTime
          ? moment
            .tz(
              serviceDetail.activity.dataValues.serviceEndDateTime,
              "Asia/Kolkata"
            )
            .format("DD/MM/YYYY hh:mm A")
          : null,
        breakDownLocation:
          serviceDetail.activity.caseDetail.caseInformation.breakdownLocation,
      };

      let dropLocationDetails = null;
      if (serviceDetail.activity.caseDetail.caseInformation.dropLocation) {
        dropLocationDetails = {
          dropLocationLat:
            serviceDetail.activity.caseDetail.caseInformation.dropLocationLat,
          dropLocationLong:
            serviceDetail.activity.caseDetail.caseInformation.dropLocationLong,
          vehicleAcknowledgedBy: serviceDetail.dropActivityInventory
            ? serviceDetail.dropActivityInventory.dataValues
              .vehicleAcknowledgedBy
            : null,
          mobileNumberOfReceiver: serviceDetail.dropActivityInventory
            ? serviceDetail.dropActivityInventory.dataValues
              .mobileNumberOfReceiver
            : null,
          additionalChargeableKm:
            serviceDetail.activity.dataValues.additionalChargeableKm,
          breakDownLocation:
            serviceDetail.activity.caseDetail.caseInformation.breakdownLocation,
          dropLocation:
            serviceDetail.activity.caseDetail.caseInformation.dropLocation,
        };
      }

      const aspDetails = {
        aspReachedToBreakdownAt: serviceDetail.activity.dataValues
          .aspReachedToBreakdownAt
          ? moment
            .tz(
              serviceDetail.activity.dataValues.aspReachedToBreakdownAt,
              "Asia/Kolkata"
            )
            .format("DD/MM/YYYY hh:mm A")
          : null,
        aspVehicleRegistrationNumber: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail
            .aspVehicleRegistrationNumber
          : null,
        aspServiceAcceptedAt: serviceDetail.activity.dataValues
          .aspServiceAcceptedAt
          ? moment
            .tz(
              serviceDetail.activity.dataValues.aspServiceAcceptedAt,
              "Asia/Kolkata"
            )
            .format("DD/MM/YYYY hh:mm A")
          : null,
        aspServiceRejectedAt: serviceDetail.activity.dataValues
          .aspServiceRejectedAt
          ? moment
            .tz(
              serviceDetail.activity.dataValues.aspServiceRejectedAt,
              "Asia/Kolkata"
            )
            .format("DD/MM/YYYY hh:mm A")
          : null,
        aspServiceCanceledAt: serviceDetail.activity.dataValues
          .aspServiceCanceledAt
          ? moment
            .tz(
              serviceDetail.activity.dataValues.aspServiceCanceledAt,
              "Asia/Kolkata"
            )
            .format("DD/MM/YYYY hh:mm A")
          : null,
      };

      const traveledKmDetails = {
        estimatedTotalKm: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.estimatedTotalKm
          : null,
        estimatedAspToBreakdownKm: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.estimatedAspToBreakdownKm
          : null,
        estimatedBreakdownToAspKm: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.estimatedBreakdownToAspKm
          : null,
        estimatedBreakdownToDropKm: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.estimatedBreakdownToDropKm
          : null,
        estimatedDropToAspKm: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.estimatedDropToAspKm
          : null,
        actualTotalKm: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.actualTotalKm
          : null,
        actualClientWaitingCharge: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.actualClientWaitingCharge
          : null,
      };

      const masterLevelDetails = {
        dispositionId: serviceDetail.activity.caseDetail.callInitiation
          ? serviceDetail.activity.caseDetail.callInitiation.dispositionId
          : null,
        activityStatusId: serviceDetail.activity.activityStatusId,
        subServiceId: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.subServiceId
          : null,
        dropDealerId:
          serviceDetail.activity.caseDetail.caseInformation.dropDealerId,
        dropLocationTypeId:
          serviceDetail.activity.caseDetail.caseInformation.dropLocationTypeId,
        customerPreferredLocationId:
          serviceDetail.activity.caseDetail.caseInformation
            .customerPreferredLocationId,
        aspId: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.aspId
          : null,
        aspMechanicId: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.aspMechanicId
          : null,
        rejectReasonId: serviceDetail.activity.activityAspDetail
          ? serviceDetail.activity.activityAspDetail.rejectReasonId
          : null,
        activityCharges: serviceDetail.activity.activityCharges
          ? serviceDetail.activity.activityCharges
          : null,
      };

      const masterLevelDetailResponse = await axios.post(
        `${masterService}/${endpointMaster.getServiceDetailMaster}`,
        masterLevelDetails
      );
      if (!masterLevelDetailResponse.data.success) {
        return res.status(200).json(masterLevelDetailResponse.data);
      }

      return res.status(200).json({
        success: true,
        data: {
          serviceDetails,
          dropLocationDetails,
          aspDetails,
          traveledKmDetails,
          // activityCharges,
          masterDetails: masterLevelDetailResponse.data.data,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function rsaUpdateActivityActualKmAndCost(
    req: Request,
    res: Response
  ) {
    let lockAcquired = false;
    // CUSTOM VALIDATIONS WITHOUT TRANSACTION
    if (
      req?.validBody?.caseDetailId &&
      req.validBody.caseDetailId !== null &&
      req.validBody.caseDetailId !== undefined &&
      req.validBody.caseDetailId !== ""
    ) {
      lockAcquired = await Utils.tryAcquireCaseProcessingLock(
        req.validBody.caseDetailId
      );
      if (!lockAcquired) {
        return res.status(200).json({
          success: false,
          error: "Another update is in progress. Please try again in 5 minutes",
        });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}`;
      if (inData.authUserRoleId == 3) {
        //AGENT
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${inData.aspId}&setParanoidFalse=true`;
      }

      const [activity, activityAspDetail, getASPDetail]: any =
        await Promise.all([
          Activities.findOne({
            where: {
              id: inData.activityId,
              activityStatusId: {
                [Op.in]: [3, 4, 7, 11, 12], // 3-In Progress, 4-Cancelled, 7-Successful, 11-Balance Payment Pending, 12-Excess Amount Credit Pending
              },
            },
            include: {
              model: CaseDetails,
              where: {
                statusId: 2, //In Progress
              },
              attributes: ["id", "clientId"],
              required: true,
            },
          }),
          ActivityAspDetails.findOne({
            where: { activityId: inData.activityId, aspId: inData.aspId },
          }),
          // GET ASP DETAILS
          axios.get(aspApiUrl),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP Detail not found",
        });
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      const caseDetail: any = await CaseDetails.findOne({
        where: {
          id: activity.dataValues.caseDetailId,
        },
        include: {
          model: CaseInformation,
          attributes: [
            "id",
            "caseDetailId",
            "customerContactName",
            "customerMobileNumber",
            "customerCurrentContactName",
            "customerCurrentMobileNumber",
            "policyNumber",
            "serviceEligibility",
            "breakdownLocation",
            "breakdownLat",
            "breakdownLong",
            "breakdownAreaId",
            "nearestCity",
            "dropLocationTypeId",
            "dropDealerId",
            "dropLocationLat",
            "dropLocationLong",
            "dropLocation",
          ],
          required: true,
        },
      });

      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case Detail not found",
        });
      }

      const [getAgentDetail, advanceActivityTransaction] = await Promise.all([
        // GET Agent DETAILS
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: caseDetail.dataValues.agentId,
        }),
        ActivityTransactions.findOne({
          attributes: ["id", "amount", "paidByDealerId"],
          where: {
            activityId: inData.activityId,
            dealerId: null,
            paymentTypeId: 174, // ONE TIME SERVICE
            transactionTypeId: 181, // DEBIT
            paymentStatusId: 191, // SUCCESS
          },
        }),
      ]);

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      let actualServiceCost = inData.actualServiceCost;
      let actualTotalTax = inData.actualTotalTax;
      let actualTotalAmount = inData.actualTotalAmount;
      let actualAspServiceCost = inData.actualAspServiceCost;
      let actualAspTotalTax = inData.actualAspTotalTax;
      let actualAspTotalAmount = inData.actualAspTotalAmount;

      let actualTotalKmReason = null;
      if (inData.actualTotalKmReason) {
        const currentDateTime = moment()
          .tz("Asia/Kolkata")
          .format("DD-MM-YYYY hh:mm A");
        let actualTotalKmReasonContent = "";
        if (inData.logTypeId == 240) {
          //WEB
          actualTotalKmReasonContent = `Reason: ${inData.actualTotalKmReason}. By: Agent at: ${currentDateTime}`;
        } else if (inData.logTypeId == 241) {
          //MOBILE
          actualTotalKmReasonContent = `Reason: ${inData.actualTotalKmReason}. By: ASP at: ${currentDateTime}`;
        }

        actualTotalKmReason = activityAspDetail.dataValues.actualTotalKmReason
          ? activityAspDetail.dataValues.actualTotalKmReason +
          ` , ${actualTotalKmReasonContent}`
          : actualTotalKmReasonContent;
      }

      const updateData: any = {
        actualTotalKm: inData.actualTotalKm,
        // actualTotalKmReason: inData.actualTotalKmReason
        //   ? inData.actualTotalKmReason
        //   : activityAspDetail.dataValues.actualTotalKmReason,
        actualServiceCost: actualServiceCost.toFixed(2),
        actualTotalTax: actualTotalTax.toFixed(2),
        actualTotalAmount: actualTotalAmount.toFixed(2),
        actualAspServiceCost: actualAspServiceCost.toFixed(2),
        actualAspTotalTax: actualAspTotalTax.toFixed(2),
        actualAspTotalAmount: actualAspTotalAmount.toFixed(2),
      };
      if (actualTotalKmReason) {
        updateData.actualTotalKmReason = actualTotalKmReason;
      }

      //CREATE ACTIVITY TRANSACTION BASED ON DIFFERENCE AMOUNT
      const actualTotalAmountForPayment = actualTotalAmount;
      // const estimatedTotalAmountForPayment =
      //   activityAspDetail.dataValues.estimatedTotalAmount;
      const estimatedTotalAmountPaid = advanceActivityTransaction
        ? advanceActivityTransaction.dataValues.amount
        : 0;

      //ACTUAL AMOUNT GREATER THAN ESTIMATED AMOUNT SO DEALER HAS TO PAY BALANCE AMOUNT
      const activityStatusId = 7; //SUCCESSFUL
      const aspActivityStatusId = 9; // ACTIVITY ENDED
      const activityAppStatusId = 19; // ACTIVITY ENDED

      //IF IT IS PAID SERVICE
      if (activity.dataValues.customerNeedToPay) {
        if (
          parseFloat(actualTotalAmountForPayment) >
          parseFloat(estimatedTotalAmountPaid)
        ) {
          const amount =
            parseFloat(actualTotalAmountForPayment) -
            parseFloat(estimatedTotalAmountPaid);
          const activityTransactionData = {
            activityId: inData.activityId,
            dealerId: null,
            date: new Date(),
            paymentTypeId: 171, // BALANCE
            amount: amount,
            transactionTypeId: 181, // DEBIT
            paymentStatusId: 190, // PENDING
          };

          const activityTransactionExist = await ActivityTransactions.findOne({
            where: {
              activityId: inData.activityId,
              dealerId: null,
              paymentTypeId: 171, // BALANCE
              transactionTypeId: 181, // DEBIT
              paymentStatusId: 190, // PENDING
            },
            order: [["id", "desc"]],
          });
          if (activityTransactionExist) {
            await ActivityTransactions.update(activityTransactionData, {
              where: {
                id: activityTransactionExist.dataValues.id,
              },
              transaction,
            });
          } else {
            await ActivityTransactions.create(activityTransactionData, {
              transaction,
            });
          }
        } else if (
          parseFloat(actualTotalAmountForPayment) <
          parseFloat(estimatedTotalAmountPaid)
        ) {
          //ESTIMATED AMOUNT GREATER THAN ACTUAL AMOUNT SO WE NEED TO PAY THE EXCESS AMOUNT
          const amount =
            parseFloat(estimatedTotalAmountPaid) -
            parseFloat(actualTotalAmountForPayment);
          const activityTransactionData = {
            activityId: inData.activityId,
            dealerId: null,
            date: new Date(),
            paymentTypeId: 172, // EXCESS
            amount: amount,
            transactionTypeId: 180, // CREDIT
            paymentStatusId: 190, // PENDING
          };

          const activityTransactionExist = await ActivityTransactions.findOne({
            where: {
              activityId: inData.activityId,
              dealerId: null,
              paymentTypeId: 172, // EXCESS
              transactionTypeId: 180, // CREDIT
              paymentStatusId: 190, // PENDING
            },
            order: [["id", "desc"]],
          });
          if (activityTransactionExist) {
            await ActivityTransactions.update(activityTransactionData, {
              where: {
                id: activityTransactionExist.dataValues.id,
              },
              transaction,
            });
          } else {
            await ActivityTransactions.create(activityTransactionData, {
              transaction,
            });
          }
        }
      }

      let financeStatusId = 1; //MATURED
      //IF FINANCE STATUS IS MATURED EMPTY RETURN THEN WE SHOULD CHANGE IT TO MATURED
      if (activity.dataValues.financeStatusId == 2) {
        financeStatusId = 2; //MATURED EMPTY RETURN
      }

      await Promise.all([
        Activities.update(
          {
            activityStatusId: activityStatusId,
            aspActivityStatusId: aspActivityStatusId,
            activityAppStatusId: activityAppStatusId,
            financeStatusId: financeStatusId,
          },
          {
            where: { id: inData.activityId },
            transaction,
          }
        ),
        ActivityAspDetails.update(
          { ...updateData },
          {
            where: { activityId: inData.activityId },
            transaction,
          }
        ),
        //UPDATE ACTIVITY ASP RATE CARD
        ActivityAspRateCards.update(
          { ...inData.aspRateCard },
          {
            where: { activityId: inData.activityId },
            transaction,
          }
        ),
        //UPDATE ACTIVITY CLIENT RATE CARD
        inData.clientRateCard &&
        ActivityClientRateCards.update(
          { ...inData.clientRateCard },
          {
            where: { activityId: inData.activityId },
            transaction,
          }
        ),
      ]);

      //FCM PUSH NOTIFICATIONS
      let fcmDetails: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
      };

      //SAVE ACTIVITY LOG
      let activityLogTitle = null;
      //WEB
      if (inData.logTypeId == 240) {
        activityLogTitle = `The agent "${getAgentDetail.data.user.name}" has updated the actual KM.`;

        // CRM Notification
        fcmDetails.templateId = 18;
        fcmDetails.agentName = getAgentDetail.data.user.name;
        fcmDetails.notificationType = "CRM";
        fcmDetails.aspDetail = inData.aspId;
      } else {
        //MOBILE
        activityLogTitle = `The service provider "${getASPDetail.data.data.workshopName}" has updated the actual KM and ended the service.`;

        // CRM Notification
        fcmDetails.templateId = 17;
        fcmDetails.workshopName = getASPDetail.data.data.workshopName;
        fcmDetails.notificationType = "CRM";
        fcmDetails.sourceFrom = 2; //Mobile
      }

      //ACTUAL KM UPDATE NOTIFICATIONS
      notificationController.sendNotification(fcmDetails);

      //ASP ACTIVITY ACCEPT OR REJECT CC DETAILS AND PUSH CASE, ACTIVITY TO ASP PORTAL
      if (
        inData.isAspAcceptedCcDetail == 1 ||
        inData.isAspAcceptedCcDetail == 0
      ) {
        //ACTIVITY UPDATED COLUMNS USED FOR PUSHING INVOICE TO ASP PORTAL
        activity.activityStatusId = activityStatusId;
        activity.aspActivityStatusId = aspActivityStatusId;
        activity.financeStatusId = financeStatusId;

        //ACTIVITY ASP DETAIL UPDATED COLUMNS USED FOR PUSHING INVOICE TO ASP PORTAL
        activityAspDetail.actualTotalKm = inData.actualTotalKm;

        const updateAspActivityAcceptOrRejectCcDetailResponse =
          await updateAspActivityAcceptOrRejectCcDetail(
            caseDetail,
            activity,
            activityAspDetail,
            inData.isAspAcceptedCcDetail,
            inData.aspRejectedCcDetailReasonId,
            inData.authUserId,
            transaction
          );
        if (!updateAspActivityAcceptOrRejectCcDetailResponse.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: updateAspActivityAcceptOrRejectCcDetailResponse.error,
          });
        }
      }

      await ActivityLogs.create(
        {
          activityId: inData.activityId,
          typeId: inData.logTypeId,
          title: activityLogTitle,
        },
        { transaction }
      );

      await transaction.commit();

      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      if (lockAcquired) {
        await Utils.releaseCaseProcessingLock(req.validBody.caseDetailId);
      }

      //IF actual km update then sync asp auto allocated details for crm report.
      if (activity.isAspAutoAllocated) {
        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          [inData.activityId]
        );
      }

      // Sync client report details, client report with mobile number details
      if (caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [activity.dataValues.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (caseDetail.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [inData.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Actual KM updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    } finally {
      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      if (lockAcquired) {
        try {
          await Utils.releaseCaseProcessingLock(req.validBody.caseDetailId);
        } catch (err: any) {
          console.error(
            "Error releasing isActivityProcessing in KM Update finally",
            err
          );
        }
      }
    }
  }

  export async function routeDeviationKmUpdate(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      const activityExist: any = await Activities.findOne({
        attributes: ["id"],
        where: {
          id: inData.activityId,
          activityStatusId: 2, //Assigned
        },
        include: [
          {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            attributes: ["id", "agentId"],
            required: true,
          },
          {
            model: ActivityAspDetails,
            attributes: ["id", "estimatedTotalKm"],
            required: true,
          },
        ],
      });
      if (!activityExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: activityExist.caseDetail.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      await Promise.all([
        ActivityAspDetails.update(
          {
            estimatedRouteDeviationKm: inData.routeDeviationKm,
            estimatedTotalKm: inData.totalKm,
            estimatedServiceCost: inData.serviceCost,
            estimatedTotalTax: inData.totalTax,
            estimatedTotalAmount: inData.totalAmount,
            estimatedAspServiceCost: inData.aspServiceCost,
            estimatedAspTotalTax: inData.aspTotalTax,
            estimatedAspTotalAmount: inData.aspTotalAmount,
          },
          {
            where: { id: activityExist.activityAspDetail.id },
            transaction: transaction,
          }
        ),
        //SAVE ACTIVITY LOG
        ActivityLogs.create(
          {
            activityId: activityExist.dataValues.id,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name
              }" has updated the route deviation KM (${parseFloat(
                inData.routeDeviationKm
              )}).`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The route deviation KM updated successfully",
        data: {
          totalKm: parseFloat(inData.totalKm).toFixed(2),
          serviceCost: parseFloat(inData.serviceCost).toFixed(2),
          totalAmount: parseFloat(inData.totalAmount).toFixed(2),
        },
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateAgentPickedActivity(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      const activityExist: any = await Activities.findOne({
        attributes: ["id", "agentPickedAt"],
        where: {
          id: inData.activityId,
          activityStatusId: {
            [Op.in]: [1, 2, 8], //1-OPEN, 2-ASSIGNED, 8-REJECTED
          },
        },
        include: [
          {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            attributes: ["id", "agentId", "typeId"],
            required: true,
            include: [
              {
                model: CaseInformation,
                attributes: ["customerContactName", "customerMobileNumber"],
                required: true,
              },
            ],
          },
        ],
      });
      if (!activityExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (activityExist.agentPickedAt) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent picked already",
        });
      }

      // GET AGENT DETAILS
      const getAgentDetail: any = await Utils.getUserDetail(
        activityExist.caseDetail.dataValues.agentId
      );

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      await Activities.update(
        {
          agentPickedAt: new Date(),
          updatedById: inData.authUserId,
        },
        {
          where: { id: inData.activityId },
          transaction: transaction,
        }
      );

      //RSA CRM -> L2 AGENT PICK TIME SLA VIOLATED THEN UPDATE SLA VIOLATE REASON.
      if (activityExist.caseDetail.typeId == 31) {
        const slaViolateRequests = {
          caseDetailId: activityExist.caseDetail.id,
          activityId: activityExist.id,
          typeId: 366, //L2 Agent Pick time SLA - L1
          date: moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
          slaViolateReasonId: inData.slaViolateReasonId
            ? inData.slaViolateReasonId
            : null,
          slaViolateReasonComments: inData.slaViolateReasonComments
            ? inData.slaViolateReasonComments
            : null,
          authUserRoleId: inData.authUserRoleId,
          authUserId: inData.authUserId,
          transaction: transaction,
          authUserPermissions: inData.authUserData.permissions,
        };

        const slaViolateReasonProcessResponse =
          await crmSlaController.processSlaViolateReason(slaViolateRequests);
        if (!slaViolateReasonProcessResponse.success) {
          await transaction.rollback();
          return res.status(200).json(slaViolateReasonProcessResponse);
        }
      }

      const templateReplacements = {
        "{cur_contact_name}":
          activityExist.caseDetail.caseInformation.dataValues
            .customerContactName,
        "{asp_name}": getAgentDetail.data.user.name,
      };
      sendEscalationSms(
        activityExist.caseDetail.caseInformation.dataValues
          .customerMobileNumber,
        templateReplacements,
        952, //ACTIVITY
        activityExist.dataValues.id,
        inData.authUserId,
        115, //Agent Picked the case
        null
      );

      await transaction.commit();

      // Sync client report details, client report with mobile number details
      if (activityExist.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [activityExist.caseDetail.id]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (activityExist.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [inData.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Agent picked successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export const latestPositiveActivity = async (req: any, res: any) => {
    try {
      let caseDetail: any = await CaseDetails.findOne({
        where: {
          id: req.body.caseId,
        },
        attributes: ["id", "createdAt"],
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
              "caseDetailId",
              "isInitiallyCreated",
              "isImmediateService",
              "serviceInitiatingAt",
              "createdAt",
            ],
            order: [["createdAt", "DESC"]],
            limit: 1,
          },
        ],
      });
      caseDetail.dataValues.serviceInitiatingAtInMilliSeconds = caseDetail
        ?.activities[0]?.serviceInitiatingAt
        ? moment
          .tz(caseDetail.activities[0].serviceInitiatingAt, "Asia/Kolkata")
          .valueOf()
        : null;
      caseDetail.dataValues.activityCreatedAtInMilliSeconds = caseDetail
        ?.activities[0]?.createdAt
        ? moment
          .tz(caseDetail.activities[0].createdAt, "Asia/Kolkata")
          .valueOf()
        : null;
      caseDetail.dataValues.caseDetail = {};
      caseDetail.dataValues.caseDetail.createdAtInMilliSeconds =
        caseDetail?.createdAt
          ? moment.tz(caseDetail?.createdAt, "Asia/Kolkata").valueOf()
          : null;
      return res.status(200).json({
        success: true,
        message: "Latest Positive Activity fetched successfully",
        data: caseDetail,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  export async function serviceProviderIdCardDetail(
    req: Request,
    res: Response
  ) {
    try {
      const inData = req.validBody;
      let link: any = await links.findOne({
        where: { token: inData.token },
        attributes: ["id", "expiryDateTime", "status"],
      });
      if (!link) {
        return res.status(200).json({
          success: false,
          error: "Link detail not found",
        });
      }

      const expiryDateTime = new Date(link.expiryDateTime);
      const currentDateTime = new Date();
      if (currentDateTime > expiryDateTime) {
        return res.status(200).json({
          success: false,
          error: "Link expired",
        });
      }

      const serviceProviderIdCardAndTrackLinkResponse: any =
        await Utils.serviceProviderIdCardAndTrackLinkResponse(inData);
      if (!serviceProviderIdCardAndTrackLinkResponse.success) {
        return res.status(200).json(serviceProviderIdCardAndTrackLinkResponse);
      }

      return res.status(200).json({
        success: true,
        data: serviceProviderIdCardAndTrackLinkResponse.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function processCashPaymentMethod(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const [activity, getMasterDetail]: any = await Promise.all([
        Activities.findOne({
          attributes: ["id"],
          where: {
            id: payload.activityId,
            activityStatusId: 2, //ASSIGNED
          },
          include: [
            {
              model: CaseDetails,
              attributes: ["id", "agentId", "typeId"],
              required: true,
              where: {
                statusId: 2, //INPROGRESS
              },
            },
            {
              model: ActivityAspDetails,
              attributes: [
                "id",
                "estimatedServiceCost",
                "estimatedAdditionalCharge",
              ],
            },
          ],
        }),
        axios.post(`${masterService}/${endpointMaster.getMasterDetails}`, {
          getIgstTax: true,
        }),
      ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity details not found",
        });
      }

      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: getMasterDetail.data.error,
        });
      }

      //DISCOUNT PROCESS
      const taxPercentage =
        getMasterDetail?.data?.data?.igstTax?.percentage || 0;
      const newNetAmount =
        parseFloat(activity.activityAspDetail.estimatedServiceCost || 0) +
        parseFloat(activity.activityAspDetail.estimatedAdditionalCharge || 0) -
        parseFloat(payload.discountAmount || 0);
      const newTaxAmount = newNetAmount * (taxPercentage / 100);

      await Promise.all([
        //UPDATE ACTIVITY PAYMENT DETAILS
        Activities.update(
          {
            advancePaymentMethodId: 1069, //CASH
            advancePaymentPaidToId: 1080, //ASP
            sendPaymentLinkTo: null,
            activityStatusId: 14, //ADVANCE PAY LATER
            aspActivityStatusId: 2, //WAITING FOR SERVICE INITIATION
            activityAppStatusId: 3, //WAITING FOR SERVICE INITIATION
            updatedById: payload.authUserId,
          },
          {
            where: { id: payload.activityId },
            transaction: transaction,
          }
        ),
        //CREATE ACTIVITY LOG
        ActivityLogs.create(
          {
            activityId: payload.activityId,
            typeId: 240, //Web
            title: `The advance payment method has been mapped as "Cash"`,
          },
          { transaction }
        ),
        ActivityAspDetails.update(
          {
            discountPercentage: payload.discountPercentage
              ? parseFloat(payload.discountPercentage).toFixed(2)
              : null,
            discountAmount: payload.discountAmount
              ? parseFloat(payload.discountAmount).toFixed(2)
              : null,
            discountReasonId: payload.discountReasonId
              ? payload.discountReasonId
              : null,
            discountReason: payload.discountReason
              ? payload.discountReason
              : null,
            estimatedTotalTax: newTaxAmount.toFixed(2),
            estimatedTotalAmount: (newNetAmount + newTaxAmount).toFixed(2),
          },
          {
            where: {
              id: activity.activityAspDetail.id,
            },
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();

      if (activity.caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          [payload.activityId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "Activity updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function uploadServiceProviderImage(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      const activity: any = await Activities.findOne({
        attributes: ["id"],
        where: {
          id: payload.activityId,
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: ["id"],
          },
        ],
      });

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      //Removing existing id card image
      const existingIdCardAttachments = await attachments.findAll({
        where: {
          attachmentTypeId: 607, //Technician ID Card Image
          attachmentOfId: 102, //Activity
          entityId: payload.activityId,
        },
        attributes: ["id"],
      });

      for (const existingIdCardAttachment of existingIdCardAttachments) {
        const deleteAttachmentResponse = await axios.post(
          `${apiGatewayService}/${config.apiGatewayService.serviceAccess.case}/${endpointApiGateway.deleteAttachment}`,
          {
            attachmentId: existingIdCardAttachment.dataValues.id,
          }
        );

        if (!deleteAttachmentResponse.data.success) {
          await transaction.rollback();
          return { ...deleteAttachmentResponse.data };
        }

        await attachments.destroy({
          where: { id: existingIdCardAttachment.dataValues.id },
          transaction: transaction,
        });
      }

      await attachments.create(
        {
          attachmentTypeId: 607, //Technician ID Card Image
          attachmentOfId: 102, //Activity
          entityId: payload.activityId,
          fileName: payload.files[0].filename,
          originalName: payload.files[0].originalname,
        },
        { transaction }
      );

      await ActivityLogs.create(
        {
          activityId: payload.activityId,
          typeId: 241, //Mobile
          title: `The service provider image for ID card has been uploaded.`,
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The service provider image uploaded successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //FOR ASP AUTO ASSIGNMENT PURPOSE - IF NO ASP AVAILABLE CREATE NEW ACTIVITY WITH REJECTED ACTIVITY DETAILS
  export async function createActivityForAspManualAssignment(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const { activityId, authUserId } = req.body;
      const activity: any = await Activities.findOne({
        where: {
          id: activityId,
          activityStatusId: 8, //REJECTED
        },
        attributes: [
          "id",
          "caseDetailId",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "serviceExpectedAt",
          "aspAutoAllocation",
        ],
        include: [
          {
            model: CaseDetails,
            attributes: [
              "id",
              "clientId",
              "vin",
              "registrationNumber",
              "caseNumber",
              "typeId"
            ],
            required: true,
            where: {
              statusId: 2, //In Progress
            },
            include: [
              {
                model: CaseInformation,
                required: true,
                attributes: [
                  "id",
                  "customerContactName",
                  "policyTypeId",
                  "policyStartDate",
                  "policyEndDate",
                  "policyNumber",
                  "caseTypeId",
                  "breakdownLat",
                  "breakdownLong",
                  "breakdownToDropLocationDistance",
                  "serviceEligibilityId",
                  "serviceId",
                  "subServiceId",
                ],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            attributes: ["id", "subServiceId"],
            required: true,
          },
        ],
      });
      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          subServiceId: activity.activityAspDetail.subServiceId,
        }
      );
      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json(getMasterDetail.data);
      }

      //CREATE ACTIVITY FOR ADDITIONAL SERVICE REQUESTED
      const createNewActivityResponse =
        await createActivityAndActivityAspDetail(
          activity.caseDetail,
          activity.caseDetail.caseInformation,
          authUserId,
          getMasterDetail.data.data.subService.serviceId,
          activity.activityAspDetail.dataValues.subServiceId,
          activity?.caseDetail?.caseInformation
            ?.breakdownToDropLocationDistance || null,
          activity.dataValues.isInitiallyCreated,
          activity.dataValues.isImmediateService,
          activity.dataValues.serviceInitiatingAt,
          activity.dataValues.serviceExpectedAt,
          activity.dataValues.aspAutoAllocation,
          transaction
        );
      if (!createNewActivityResponse.success) {
        await transaction.rollback();
        return res.status(200).json(createNewActivityResponse);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The new activity has been created successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateDropLocation(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const activity: any = await Activities.findOne({
        where: {
          id: payload.activityId,
          activityStatusId: 1, //OPEN
        },
        attributes: ["id", "caseDetailId"],
        include: [
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "subServiceId"],
          },
        ],
      });
      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const [caseDetail, caseInformation]: any = await Promise.all([
        CaseDetails.findOne({
          attributes: ["id", "clientId", "vin", "registrationNumber"],
          where: {
            id: activity.caseDetailId,
            statusId: 2, //In Progress
          },
        }),
        CaseInformation.findOne({
          where: {
            caseDetailId: activity.caseDetailId,
          },
          attributes: [
            "id",
            "customerContactName",
            "policyTypeId",
            "policyStartDate",
            "policyEndDate",
            "policyNumber",
            "caseTypeId",
            "breakdownLat",
            "breakdownLong",
            "breakdownToDropLocationDistance",
            "serviceEligibilityId",
            "serviceId",
            "subServiceId",
          ],
        }),
      ]);

      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case information not found",
        });
      }

      if (
        (payload.dropLocationTypeId == 452 ||
          payload.customerPreferredLocationId == 461) &&
        !payload.dropDealerId
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Drop dealer is required",
        });
      }

      //IF CUSTOMER PREFERRED IS HOME OR GARAGE OR CHARGING STATION THEN DROP AREA IS REQUIRED
      if (
        [462, 463, 464].includes(payload.customerPreferredLocationId) &&
        !payload.dropAreaId
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Drop area is required",
        });
      }

      //Get sub service detail
      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          subServiceId: activity.activityAspDetail.subServiceId,
        }
      );
      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: getMasterDetail.data.error,
        });
      }

      const caseInformationUpdateFields: any = {};
      caseInformationUpdateFields.dropLocationTypeId =
        payload.dropLocationTypeId;
      caseInformationUpdateFields.customerPreferredLocationId =
        payload.customerPreferredLocationId
          ? payload.customerPreferredLocationId
          : null;
      caseInformationUpdateFields.dropDealerId = payload.dropDealerId
        ? payload.dropDealerId
        : null;
      caseInformationUpdateFields.dropLocation = payload.dropLocation;
      caseInformationUpdateFields.dropAreaId = payload.dropAreaId
        ? payload.dropAreaId
        : null;
      caseInformationUpdateFields.dropLocationStateId = payload.dropStateId
        ? payload.dropStateId
        : null;
      caseInformationUpdateFields.dropLocationLat = payload.dropLocationLat;
      caseInformationUpdateFields.dropLocationLong = payload.dropLocationLong;
      caseInformationUpdateFields.breakdownToDropLocationDistance =
        payload.breakdownToDropDistance;

      await CaseInformation.update(caseInformationUpdateFields, {
        where: {
          caseDetailId: activity.caseDetailId,
        },
        transaction: transaction,
      });

      const notesResponse = await getNotes(
        caseDetail,
        caseInformation,
        getMasterDetail.data.data.subService.serviceId,
        activity.activityAspDetail.subServiceId,
        payload.breakdownToDropDistance
      );
      if (notesResponse && notesResponse.success) {
        await Activities.update(
          {
            notes: JSON.stringify(notesResponse.notes),
            customerNeedToPay: notesResponse.notes.customerNeedToPay,
            nonMembershipType: notesResponse.notes.nonMembershipType,
            additionalChargeableKm: notesResponse.notes.additionalChargeableKm,
          },
          {
            where: {
              id: payload.activityId,
            },
            transaction: transaction,
          }
        );
      }

      await ActivityLogs.create(
        {
          activityId: payload.activityId,
          typeId: 240, //Web
          title: `The ${payload.authUserData.role.name} "${payload.authUserData.name}" has updated the drop location details.`,
        },
        { transaction }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Drop location details updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getServiceProviderLiveLocation(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const serviceProviderLiveLocationResponse: any =
        await Utils.serviceProviderIdCardAndTrackLinkResponse(payload);
      if (!serviceProviderLiveLocationResponse.success) {
        return res.status(200).json(serviceProviderLiveLocationResponse);
      }

      return res.status(200).json({
        success: true,
        data: serviceProviderLiveLocationResponse.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getSubServiceRejectedAsps(req: Request, res: Response) {
    try {
      const payload = req.body;
      const rejectedActivities: any = await ActivityAspDetails.findAll({
        where: {
          subServiceId: payload.subServiceId,
        },
        attributes: ["id", "activityId", "aspId"],
        include: [
          {
            model: Activities,
            attributes: ["id"],
            required: true,
            where: {
              caseDetailId: payload.caseDetailId,
              activityStatusId: 8, // Rejected
            },
          },
        ],
      });

      let rejectedAspIds = [];
      if (rejectedActivities.length > 0) {
        for (const rejectedActivity of rejectedActivities) {
          rejectedAspIds.push(rejectedActivity.aspId);
        }
        //REMOVE NULL AND GET UNIQUE VALUE
        rejectedAspIds = [...new Set(rejectedAspIds)].filter(
          (value: any) => value !== null
        );
      }

      return res.status(200).json({
        success: true,
        data: rejectedAspIds,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function checkPaymentStatus(req: Request, res: Response) {
    try {
      const payload = req.body;

      // Find the specific transaction
      const activityTransaction: any = await ActivityTransactions.findOne({
        where: {
          id: payload.transactionId,
          paymentTypeId: 174, //One time service
        },
        attributes: ["id", "activityId", "razorpayOrderId", "membershipId"],
        include: [
          {
            model: Activities,
            attributes: ["id"],
            required: true,
          },
        ],
      });

      if (!activityTransaction) {
        return res.status(200).json({
          success: false,
          error: "Transaction not found",
        });
      }

      // Check payment status for the specific transaction
      const checkPaymentStatusResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/checkPaymentStatus`,
        {
          customerInvRazorpayOrderId: activityTransaction.razorpayOrderId || null,
          nonMembershipId: activityTransaction.membershipId || null,
        }
      );
      return res.status(200).json(checkPaymentStatusResponse.data);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateDealerDocumentComments(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      const activityExist: any = await Activities.findOne({
        attributes: ["id"],
        where: {
          id: inData.activityId,
          activityStatusId: {
            [Op.in]: [3, 7, 10, 11, 12], //3) IN PROGRESS, 7) SUCCESSFUL, 10) ADVANCE PAYMENT PAID, 11) BALANCE PAYMENT PENDING, 12) EXCESS AMOUNT CREDIT PENDING
          },
        },
        include: [
          {
            model: CaseDetails,
            where: {
              statusId: 2, //In Progress
            },
            attributes: ["id", "agentId"],
            required: true,
          },
        ],
      });
      if (!activityExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: activityExist.caseDetail.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      await Promise.all([
        Activities.update(
          {
            dealerDocumentComments: inData.dealerDocumentComments,
          },
          {
            where: { id: inData.activityId },
            transaction: transaction,
          }
        ),
        //SAVE ACTIVITY LOG
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name}" has made the comments against the dealer documents.`,
            description: `Comments: ${inData.dealerDocumentComments}`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The dealer document comments updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspMechanicOverallScheduledActivities(
    req: Request,
    res: Response
  ) {
    try {
      const { aspMechanicId } = req.body;
      const aspMechanicScheduledActivities: any =
        await ActivityAspDetails.findAll({
          where: { aspMechanicId: aspMechanicId },
          attributes: ["id"],
          include: [
            {
              model: Activities,
              attributes: ["id"],
              required: true,
              where: {
                activityStatusId: {
                  [Op.notIn]: [1, 4, 5, 7, 8], // 1) Open, 4) Cancelled, 5) Failure, 7) Successful, 8) Rejected
                },
              },
              include: [
                {
                  model: caseDetails,
                  attributes: ["id"],
                  required: true,
                  where: {
                    statusId: 2, //INPROGRESS
                  },
                },
              ],
            },
          ],
        });

      return res.status(200).json({
        success: true,
        message: "success",
        data: aspMechanicScheduledActivities,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getAspMechanicInProgressActivities(
    req: Request,
    res: Response
  ) {
    try {
      const { aspMechanicIds, serviceScheduledDate } = req.body;

      if (aspMechanicIds.length === 0) {
        return res.status(200).json({
          success: false,
          error: "ASP Mechanic IDs are required",
        });
      }

      let aspMechanicInProgressActivities = [];
      for (const aspMechanicId of aspMechanicIds) {
        const inProgressCheckResponse = await Utils.checkCocoAspInProgressActivities(aspMechanicId, serviceScheduledDate);
        if (inProgressCheckResponse.success) {
          aspMechanicInProgressActivities.push({
            aspMechanicId: aspMechanicId,
            assignedCount: (inProgressCheckResponse.mechanicActivitiesCount || 0) + (inProgressCheckResponse.towingActivitiesCount || 0),
          });
        }
      }

      return res.status(200).json({
        success: true,
        aspMechanicInProgressActivities: aspMechanicInProgressActivities,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function initiateCancellation(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      // Get transaction with activity details
      const activityTransaction: any = await ActivityTransactions.findOne({
        where: {
          id: payload.transactionId,
          paymentTypeId: 174, //One time service
        },
        attributes: ["id", "activityId", "membershipId", "amount", "refundStatusId", "paymentStatusId"],
        include: [
          {
            model: Activities,
            attributes: ["id", "caseDetailId"],
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id", "estimatedTotalAmount"],
                required: true,
              },
            ],
          },
        ],
        transaction: transaction,
      });

      if (!activityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Transaction not found",
        });
      }

      // Check if refund already exists and is not failed
      if (activityTransaction.refundStatusId != null && activityTransaction.refundStatusId != 1303) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Refund has already been processed for this transaction",
        });
      }

      // Check if payment was successful
      if (activityTransaction.paymentStatusId !== 191) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Payment must be successful before initiating refund",
        });
      }

      if (!activityTransaction.membershipId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Membership ID not found in transaction",
        });
      }

      // Get customer paid amount from activityAspDetails
      const customerPaidAmount = parseFloat(
        activityTransaction.activity.activityAspDetail.estimatedTotalAmount || 0
      );

      if (!customerPaidAmount || customerPaidAmount <= 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "No payment found for this activity",
        });
      }

      // Calculate refund amount
      let refundAmount = 0;
      const descriptionParts: string[] = [];
      descriptionParts.push(
        `Type: <span style="color:#999">${payload.refundTypeName}</span>`
      );
      if (payload.refundTypeId === 1201) {
        // Full refund - use transaction amount
        refundAmount = parseFloat(activityTransaction.amount || 0);
      } else {
        // Partial refund
        refundAmount = parseFloat(payload.refundAmount || 0);
        if (!refundAmount || refundAmount <= 0) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Refund amount is required for partial refund",
          });
        }

        const transactionAmount = parseFloat(activityTransaction.amount || 0);
        if (refundAmount > transactionAmount) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Refund amount cannot exceed transaction amount (${transactionAmount})`,
          });
        }
      }

      descriptionParts.push(
        `Amount: <span style="color:#999">${refundAmount}</span>`
      );
      descriptionParts.push(
        `Reason: <span style="color:#999">${payload.refundReason.trim()}</span>`
      );

      // Update this specific transaction with refund details
      await ActivityTransactions.update(
        {
          refundTypeId: payload.refundTypeId,
          refundStatusId: 1301, // Pending
          refundReason: payload.refundReason.trim(),
          refundAmount: refundAmount,
          cancellationStatusId: 1311, // Waiting for BO Approval
          cancellationRejectedReason: null,
          updatedById: payload.authUserId,
        },
        {
          where: { id: payload.transactionId },
          transaction: transaction,
        }
      );

      // Prepare vendor API payload
      const refundPayload = {
        membership_id: activityTransaction.membershipId,
        refund_type_id: payload.refundTypeId === 1201 ? 1151 : 1150,
        refund_amount: refundAmount,
        cancellation_reason: payload.refundReason.trim(),
      };

      const refundResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/non-membership/cancellation`,
        refundPayload
      );
      if (!refundResponse.data.success) {
        await transaction.rollback();
        return res.status(200).json(refundResponse.data);
      }

      // Update refundId if returned from RSA
      if (refundResponse.data.refundId) {
        await ActivityTransactions.update(
          {
            refundId: refundResponse.data.refundId,
          },
          {
            where: { id: payload.transactionId },
            transaction: transaction,
          }
        );
      }

      await ActivityLogs.create(
        {
          activityId: activityTransaction.activityId,
          typeId: 240, // Web
          title: `Refund initiated for transaction # ${payload.transactionId}`,
          description: descriptionParts.join('<br />'),
          createdById: payload.authUserId,
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Refund initiated successfully",
        transactionId: payload.transactionId,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateCancellationStatus(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      if (!payload.razorpayOrderId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Razorpay order ID is required",
        });
      }

      // Find the specific transaction by razorpayOrderId
      const activityTransaction: any = await ActivityTransactions.findOne({
        where: {
          razorpayOrderId: payload.razorpayOrderId,
          paymentTypeId: 174, // One time service
          membershipId: { [Op.ne]: null }, // Membership ID is required
          razorpayTransactionId: { [Op.ne]: null }, // Payment captured in Razorpay
        },
        attributes: ["id", "activityId"],
        transaction: transaction,
      });

      if (!activityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Transaction not found for the given Razorpay order ID",
        });
      }

      const activityId = activityTransaction.dataValues.activityId;

      // Get activity details
      const activityExists: any = await Activities.findOne({
        attributes: ["id", "caseDetailId"],
        where: {
          id: activityId,
        },
        transaction: transaction,
      });

      if (!activityExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found for this transaction",
        });
      }

      const descriptionParts: string[] = [];
      descriptionParts.push(
        `Status: <span style="color:#999">${payload.type === 1 ? "Rejected" : "Approved"}</span>`
      );

      // Prepare update columns for activityTransactions
      const transactionUpdateColumns: any = {};
      if (payload.type === 1) {
        // Reject
        transactionUpdateColumns.cancellationStatusId = 1312; // Cancellation Rejected
        transactionUpdateColumns.cancellationRejectedReason = payload.cancellationRejectedReason.trim();
        transactionUpdateColumns.refundId = null;
        transactionUpdateColumns.refundStatusId = null;
        transactionUpdateColumns.refundTypeId = null;
        transactionUpdateColumns.refundAmount = null;
        transactionUpdateColumns.refundReason = null;

        descriptionParts.push(
          `Reason: <span style="color:#999">${payload.cancellationRejectedReason.trim()}</span>`
        );
      } else if (payload.type === 2) {
        // Approve
        // Note: Cancellation invoice is now handled separately at case level via updateCaseCancellationInvoice
        // This function only handles refund-related updates and status updates
        transactionUpdateColumns.cancellationStatusId = 1313; // Cancelled
        transactionUpdateColumns.cancellationRejectedReason = null;

        // Update refund information in transactions
        if (payload.refundStatusId) {
          transactionUpdateColumns.refundStatusId = payload.refundStatusId;
          const refundStatusMap: any = {
            1301: "Pending",
            1302: "Processed",
            1303: "Failed",
          };
          descriptionParts.push(
            `Refund Status: <span style="color:#999">${refundStatusMap[payload.refundStatusId] || "Unknown"}</span>`
          );
        }
        if (payload.refundTypeId) {
          transactionUpdateColumns.refundTypeId = payload.refundTypeId;
          const refundTypeMap: any = {
            1201: "Full Refund",
            1202: "Partial Refund",
          };
          descriptionParts.push(
            `Refund Type: <span style="color:#999">${refundTypeMap[payload.refundTypeId] || "Unknown"}</span>`
          );
        }
        if (payload.refundAmount) {
          transactionUpdateColumns.refundAmount = payload.refundAmount;
          descriptionParts.push(
            `Refund Amount: <span style="color:#999">₹${payload.refundAmount}</span>`
          );
        }
        if (payload.refundReason) {
          transactionUpdateColumns.refundReason = payload.refundReason;
          descriptionParts.push(
            `Refund Reason: <span style="color:#999">${payload.refundReason}</span>`
          );
        }
        if (payload.refundId) {
          transactionUpdateColumns.refundId = payload.refundId;
        }
      }

      await Promise.all([
        ActivityTransactions.update(
          transactionUpdateColumns,
          {
            where: {
              id: activityTransaction.dataValues.id,
            },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 240, // Web
            title: "Refund Status Updated",
            description: descriptionParts.join('<br />'),
            createdById: payload.authUserId || null,
          },
          { transaction: transaction }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: `Refund status updated successfully`,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateRefundStatus(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      // Find transaction by refundId
      const activityTransaction: any = await ActivityTransactions.findOne({
        where: {
          refundId: payload.refundId,
          paymentTypeId: 174, //One time service
        },
        attributes: ["id", "activityId", "refundStatusId", "membershipId"],
        transaction: transaction,
      });

      if (!activityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Transaction not found for the given refund ID",
        });
      }

      // Validate that refund is already initiated
      if (!activityTransaction.refundStatusId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Refund has not been initiated for this transaction",
        });
      }

      // Update refund status for this specific transaction
      await ActivityTransactions.update(
        {
          refundStatusId: payload.refundStatusId,
          updatedById: payload.authUserId || null,
        },
        {
          where: { id: activityTransaction.id },
          transaction: transaction,
        }
      );

      const descriptionParts: string[] = [];
      descriptionParts.push(
        `Status: <span style="color:#999">${payload.refundStatusName}</span>`
      );

      await ActivityLogs.create(
        {
          activityId: activityTransaction.activityId,
          typeId: 240, // Web
          title: "Refund Status Updated",
          description: descriptionParts.join('<br />'),
          createdById: payload.authUserId || null,
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Refund status updated successfully",
        transactionId: activityTransaction.id,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function checkRefundStatus(req: Request, res: Response) {
    try {
      const payload = req.body;

      // Get transaction by transactionId
      const activityTransaction: any = await ActivityTransactions.findOne({
        where: {
          id: payload.transactionId,
          paymentTypeId: 174, //One time service
        },
        attributes: ["id", "membershipId", "razorpayOrderId", "razorpayTransactionId", "refundStatusId", "refundId", "activityId"],
      });

      if (!activityTransaction) {
        return res.status(200).json({
          success: false,
          error: "Transaction not found",
        });
      }
      if (!activityTransaction.razorpayOrderId) {
        return res.status(200).json({
          success: false,
          error: "Razorpay order ID not found in transaction",
        });
      }

      if (!activityTransaction.membershipId) {
        return res.status(200).json({
          success: false,
          error: "Membership ID not found in transaction",
        });
      }

      if (!activityTransaction.razorpayTransactionId) {
        return res.status(200).json({
          success: false,
          error: "Razorpay transaction ID not found in transaction",
        });
      }

      // Check refund status from RSA application
      const checkRefundStatusResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/check/refundStatus`,
        {
          nonMembershipId: activityTransaction.membershipId,
        }
      );
      return res.status(200).json(checkRefundStatusResponse.data);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // GET ACTIVITY TRANSACTIONS FOR FRONTEND DISPLAY
  export async function getActivityTransactions(req: Request, res: Response) {
    try {
      const { activityId } = req.query;

      if (!activityId) {
        return res.status(200).json({
          success: false,
          error: "Activity ID is required",
        });
      }

      const activityTransactions: any = await ActivityTransactions.findAll({
        where: {
          activityId: activityId,
          paymentTypeId: 174, //One time service
        },
        attributes: [
          "id",
          "activityId",
          "membershipId",
          "razorpayOrderId",
          "razorpayTransactionId",
          "amount",
          "paymentStatusId",
          "paidAt",
          "refundTypeId",
          "refundAmount",
          "refundReason",
          "refundId",
          "refundStatusId",
          "cancellationStatusId",
          "cancellationRejectedReason",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: Activities,
            attributes: [
              "id",
              "customerNeedToPay",
              "sendPaymentLinkTo",
            ],
            include: [
              {
                model: CaseDetails,
                attributes: [
                  "id",
                  "isCustomerInvoiced",
                  "customerInvoiceNumber",
                ],
              },
            ],
          },
        ],
        order: [["id", "DESC"]],
      });

      // Get unique membershipIds from all activityTransactions for enableRefund check
      const uniqueMembershipIds: number[] = Array.from(new Set(
        activityTransactions
          .map((txn: any) => txn.membershipId)
          .filter((id: any): id is number => typeof id === 'number' && !isNaN(id))
      ));

      // Fetch enableRefund for each unique membershipId
      const enableRefundMap: { [key: number]: boolean } = {};
      const enableRefundPromises = uniqueMembershipIds.map(async (membershipId: number) => {
        try {
          const nonMembershipDetail = await axios.post(
            `${process.env.RSA_BASE_URL}/crm/get/nonMembership/cancellationInfo`,
            { nonMembershipId: membershipId }
          );
          if (nonMembershipDetail?.data?.success && nonMembershipDetail?.data?.enableRefund) {
            enableRefundMap[membershipId] = nonMembershipDetail.data.enableRefund;
          } else {
            enableRefundMap[membershipId] = false;
          }
        } catch (error) {
          // Silently fail - enableRefund will remain false
          enableRefundMap[membershipId] = false;
        }
      });

      // Wait for all enableRefund checks to complete
      await Promise.all(enableRefundPromises);

      // Get unique config IDs to fetch
      const refundTypeIds: number[] = Array.from(new Set(
        activityTransactions
          .map((txn: any) => txn.refundTypeId)
          .filter((id: any): id is number => typeof id === 'number' && !isNaN(id))
      ));
      const refundStatusIds: number[] = Array.from(new Set(
        activityTransactions
          .map((txn: any) => txn.refundStatusId)
          .filter((id: any): id is number => typeof id === 'number' && !isNaN(id))
      ));
      const cancellationStatusIds: number[] = Array.from(new Set(
        activityTransactions
          .map((txn: any) => txn.cancellationStatusId)
          .filter((id: any): id is number => typeof id === 'number' && !isNaN(id))
      ));

      // Fetch configs from Master Service
      const configPromises: any[] = [];
      const configMap: {
        refundTypes: { [key: number]: string };
        refundStatuses: { [key: number]: string };
        cancellationStatuses: { [key: number]: string };
      } = {
        refundTypes: {},
        refundStatuses: {},
        cancellationStatuses: {},
      };

      // Fetch refund types
      for (const refundTypeId of refundTypeIds) {
        configPromises.push(
          axios
            .get(`${masterService}/${endpointMaster.configs.getConfigById}?id=${refundTypeId}`)
            .then((res) => {
              if (res?.data?.success && res?.data?.data) {
                configMap.refundTypes[refundTypeId] = res.data.data.name;
              }
            })
            .catch(() => {
              // Silently fail
            })
        );
      }

      // Fetch refund statuses
      for (const refundStatusId of refundStatusIds) {
        configPromises.push(
          axios
            .get(`${masterService}/${endpointMaster.configs.getConfigById}?id=${refundStatusId}`)
            .then((res) => {
              if (res?.data?.success && res?.data?.data) {
                configMap.refundStatuses[refundStatusId] = res.data.data.name;
              }
            })
            .catch(() => {
              // Silently fail
            })
        );
      }

      // Fetch cancellation statuses
      for (const cancellationStatusId of cancellationStatusIds) {
        configPromises.push(
          axios
            .get(`${masterService}/${endpointMaster.configs.getConfigById}?id=${cancellationStatusId}`)
            .then((res) => {
              if (res?.data?.success && res?.data?.data) {
                configMap.cancellationStatuses[cancellationStatusId] = res.data.data.name;
              }
            })
            .catch(() => {
              // Silently fail
            })
        );
      }

      // Wait for all config fetches to complete
      await Promise.all(configPromises);

      // Map transactions with config lookups and enableRefund (per transaction membershipId)
      const mappedTransactions = activityTransactions.map((transaction: any) => {
        const paymentStatusId = transaction.paymentStatusId as number | null;
        const refundTypeId = transaction.refundTypeId as number | null;
        const refundStatusId = transaction.refundStatusId as number | null;
        const cancellationStatusId = transaction.cancellationStatusId as number | null;
        const membershipId = transaction.membershipId as number | null;

        // Get enableRefund for this transaction's membershipId
        const enableRefund = membershipId && enableRefundMap[membershipId] != null
          ? enableRefundMap[membershipId]
          : false;

        // Extract fields from related models
        const activity = transaction.activity;
        const caseDetail = activity?.caseDetail;

        const customerNeedToPay = activity?.customerNeedToPay == 1 ? true : false;
        const sendPaymentLinkTo = activity?.sendPaymentLinkTo || null;
        const isCustomerInvoiced = caseDetail?.isCustomerInvoiced == 1 ? true : false;
        const customerInvoiceNumber = caseDetail?.customerInvoiceNumber || null;

        // Get transaction JSON and remove nested objects
        const transactionJson = transaction.toJSON();
        delete transactionJson.activity;
        delete transactionJson.Activity;

        return {
          ...transactionJson,
          enableRefund: enableRefund,
          customerNeedToPay: customerNeedToPay,
          sendPaymentLinkTo: sendPaymentLinkTo,
          isCustomerInvoiced: isCustomerInvoiced,
          customerInvoiceNumber: customerInvoiceNumber,
          refundType: refundTypeId
            ? configMap.refundTypes[refundTypeId] || null
            : null,
          refundStatus: refundStatusId
            ? configMap.refundStatuses[refundStatusId] || null
            : null,
          cancellationStatus: cancellationStatusId
            ? configMap.cancellationStatuses[cancellationStatusId] || null
            : null,
        };
      });

      return res.status(200).json({
        success: true,
        data: mappedTransactions,
        count: mappedTransactions.length,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateCaseCancellationInvoice(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      if (!payload.activityId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ID is required",
        });
      }

      // Get caseDetailId from activity
      const activity: any = await Activities.findOne({
        where: {
          id: payload.activityId,
        },
        attributes: ["id", "caseDetailId"],
        transaction: transaction,
      });

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activity.caseDetailId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case Detail ID not found for this activity",
        });
      }

      const updateColumns: any = {
        isCancellationInvoiced: 1,
        cancellationInvoiceNumber: payload.cancellationInvoiceNumber,
        cancellationInvoiceDate: moment
          .tz(payload.cancellationInvoiceDate, "Asia/Kolkata")
          .format("YYYY-MM-DD"),
        cancellationInvoicePath: payload.cancellationInvoicePath,
      };

      await CaseDetails.update(updateColumns, {
        where: { id: activity.caseDetailId },
        transaction: transaction,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Case cancellation invoice updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

function calculateGSTAmount(price: number, gstPercentage: number): number {
  const gstAmount = price * (gstPercentage / 100);
  return gstAmount;
}

//USED IN ADD REMINDER & ADD/EDIT INVENTORY
export const checkActivity = async (id: any) => {
  try {
    const Activity = await Activities.findOne({
      where: { id: id },
      include: [
        {
          model: ActivityAspDetails,
          required: false,
          attributes: ["id", "aspId", "aspMechanicId"],
        },
        {
          model: CaseDetails,
          required: false,
          attributes: ["id", "clientId", "statusId", "typeId"],
        },
      ],
    });
    if (!Activity) {
      return {
        success: false,
        error: "Activity Not Found",
      };
    }
    return {
      success: true,
      data: Activity,
      message: "Data Fetched Successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

// Helper function to check if ASP mechanic is available (can be used directly without HTTP call)
export const checkAspMechanicWorkStatus = async (
  aspMechanicId: number,
  serviceScheduledDate: string
): Promise<{ success: boolean; data: { aspMechanicAvailable: boolean } }> => {
  try {
    let aspMechanicAvailable = true;
    const activityStatusIds = [1, 4, 5, 7, 8]; // 1) Open, 4) Cancelled, 5) Failure, 7) Successful, 8) Rejected
    const [
      scheduledVdmActivities,
      scheduledCrmInitialAndImmediateActivities,
      scheduledCrmInitialAndLaterActivities,
      scheduledCrmNotInitialActivities,
    ]: any = await Promise.all([
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          null,
          aspMechanicId,
          activityStatusIds,
          serviceScheduledDate,
          null,
          null
        )
      ),
      // INITIAL CREATED & IMMEDIATE SERVICE
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          null,
          aspMechanicId,
          activityStatusIds,
          serviceScheduledDate,
          1,
          1
        )
      ),
      // INITIAL CREATED & LATER SERVICE
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          null,
          aspMechanicId,
          activityStatusIds,
          serviceScheduledDate,
          1,
          0
        )
      ),
      // NOT INITIAL CREATED CASE
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          null,
          aspMechanicId,
          activityStatusIds,
          serviceScheduledDate,
          0,
          null
        )
      ),
    ]);

    // Merge all responses into a single array
    const aspMechanicScheduledActivities = [
      ...scheduledVdmActivities,
      ...scheduledCrmInitialAndImmediateActivities,
      ...scheduledCrmInitialAndLaterActivities,
      ...scheduledCrmNotInitialActivities,
    ];

    if (aspMechanicScheduledActivities.length > 0) {
      aspMechanicAvailable = false;
    }

    return {
      success: true,
      data: {
        aspMechanicAvailable: aspMechanicAvailable,
      },
    };
  } catch (error: any) {
    console.log(error);
    return {
      success: false,
      data: {
        aspMechanicAvailable: true, // Default to available on error
      },
    };
  }
};

export const getNotes: any = async (
  caseDetail: any,
  caseInformation: any,
  serviceId: number,
  subServiceId: number,
  breakdownToDropDistance: string
) => {
  try {
    const customerServiceExists = await getCustomerService({
      clientId: caseDetail.dataValues.clientId,
      vin: caseDetail.dataValues.vin ? caseDetail.dataValues.vin.trim() : null,
      vehicleRegistrationNumber: caseDetail.dataValues.registrationNumber
        ? caseDetail.dataValues.registrationNumber.trim()
        : null,
      serviceId: serviceId,
      policyTypeId: caseInformation.dataValues.policyTypeId
        ? caseInformation.dataValues.policyTypeId
        : null,
      policyNumber: caseInformation.dataValues.policyNumber
        ? String(caseInformation.dataValues.policyNumber).trim()
        : null,
      membershipTypeId: caseInformation.dataValues.serviceEligibilityId
        ? caseInformation.dataValues.serviceEligibilityId
        : null,
    });

    const parameters = {
      policyTypeId: caseInformation.dataValues.policyTypeId
        ? caseInformation.dataValues.policyTypeId
        : null,
      policyStartDate: caseInformation.dataValues.policyStartDate
        ? caseInformation.dataValues.policyStartDate
        : null,
      policyEndDate: caseInformation.dataValues.policyEndDate
        ? caseInformation.dataValues.policyEndDate
        : null,
      subServiceId: subServiceId,
      caseTypeId: caseInformation.dataValues.caseTypeId,
      bdLat: caseInformation.dataValues.breakdownLat,
      bdLong: caseInformation.dataValues.breakdownLong,
      serviceId: serviceId,
      breakdownToDropDistance: breakdownToDropDistance,
      clientId: caseDetail.dataValues.clientId,
    };
    let notes = await getNotesInformation(parameters, customerServiceExists);
    return {
      success: true,
      notes: notes,
    };
  } catch (error: any) {
    throw error;
  }
};

export const createActivityAndActivityAspDetail: any = async (
  caseDetail: any,
  caseInformation: any,
  authUserId: number,
  serviceId: number,
  subServiceId: number,
  breakdownToDropDistance: string,
  isInitiallyCreated: any = null,
  isImmediateService: any = null,
  serviceInitiatingAt: any = null,
  serviceExpectedAt: any = null,
  aspAutoAllocation: number = 0,
  transaction: any
) => {
  try {
    //GENERATE ACTIVITY NUMBER BASED ON SERIAL NUMBER
    const [generateActivityNumber, getMasterDetail] = await Promise.all([
      Utils.generateActivityNumber(),
      axios.post(`${masterService}/${endpointMaster.getMasterDetails}`, {
        subServiceId: subServiceId,
      }),
    ]);

    if (!generateActivityNumber.success) {
      return generateActivityNumber;
    }

    const newActivity: any = await Activities.create(
      {
        caseDetailId: caseDetail.id,
        activityStatusId: 1, //OPEN
        financeStatusId: 3, // NOT MATURED
        createdById: authUserId,
        isInitiallyCreated: isInitiallyCreated,
        isImmediateService: isImmediateService,
        serviceInitiatingAt: serviceInitiatingAt
          ? moment.tz(serviceInitiatingAt, "Asia/Kolkata").toDate()
          : null,
        serviceExpectedAt: serviceExpectedAt
          ? moment.tz(serviceExpectedAt, "Asia/Kolkata").toDate()
          : null,
        aspAutoAllocation: aspAutoAllocation,
      },
      { transaction: transaction }
    );
    newActivity.activityNumber = generateActivityNumber.number;
    await newActivity.save({ transaction: transaction });

    await ActivityAspDetails.create(
      {
        activityId: newActivity.dataValues.id,
        subServiceId: subServiceId,
        subServiceHasAspAssignment:
          getMasterDetail?.data?.data?.subService?.hasAspAssignment || null,
        serviceId: getMasterDetail?.data?.data?.subService?.serviceId || null,
        createdById: authUserId,
      },
      { transaction: transaction }
    );

    //Additional service activity notes
    const notesResponse = await getNotes(
      caseDetail,
      caseInformation,
      serviceId,
      subServiceId,
      breakdownToDropDistance
    );
    if (notesResponse && notesResponse.success) {
      newActivity.notes = JSON.stringify(notesResponse.notes);
      newActivity.customerNeedToPay = notesResponse.notes.customerNeedToPay;
      newActivity.nonMembershipType = notesResponse.notes.nonMembershipType;
      newActivity.additionalChargeableKm =
        notesResponse.notes.additionalChargeableKm;
      await newActivity.save({ transaction: transaction });
    }

    //CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
    if (caseDetail.typeId == 31) {
      Utils.createReportSyncTableRecord(
        ["financialReportDetails", "activityReportDetails"],
        [newActivity.dataValues.id]
      );
    }

    return {
      success: true,
      activityId: newActivity.dataValues.id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const updateAspWaitingTimeAndCharge: any = async (
  aspId: number,
  activity: any,
  activityAspDetail: any,
  aspRateCard: any,
  waitingTimeInMinutes: number,
  transaction: any
) => {
  try {
    //ASP WAITING TIME CHARGE CALCULATION BASED ON MASTER DATA
    let aspWaitingCharge = null;
    if (aspRateCard && aspRateCard.waitingChargePerHour > 0) {
      const aspWaitingTimeInHours = waitingTimeInMinutes / 60;
      aspWaitingCharge =
        aspWaitingTimeInHours * aspRateCard.waitingChargePerHour;
      //MASTER DATA UPDATION FOR ACTIVITY ASP RATE CARD
      const activityAspRateCardData = {
        rangeLimit: aspRateCard.rangeLimit,
        belowRangePrice: aspRateCard.belowRangePrice,
        aboveRangePrice: aspRateCard.aboveRangePrice,
        waitingChargePerHour: aspRateCard.waitingChargePerHour,
        emptyReturnRangePrice: aspRateCard.emptyReturnRangePrice,
      };
      await ActivityAspRateCards.update(
        { ...activityAspRateCardData },
        {
          where: { activityId: activity.dataValues.id, aspId: aspId },
          transaction: transaction,
        }
      );
    }

    let clientWaitingCharge = null;
    //ONLY VDM CASE
    if (activity.caseDetail.dataValues.typeId == 32) {
      //CLIENT WAITING TIME CALCULATION
      const clientDeliveryRequestPriceResponse = await axios({
        method: "get",
        url: `${masterService}/${endpointMaster.getPriceBaseClientId}?clientId=${activity.caseDetail.dataValues.clientId}`,
      });
      if (!clientDeliveryRequestPriceResponse.data.success) {
        return clientDeliveryRequestPriceResponse.data;
      }

      //CLIENT WAITING TIME CHARGE CALCULATION BASED ON MASTER DATA
      const clientWaitingChargeMasterData =
        clientDeliveryRequestPriceResponse.data.data;
      if (
        clientWaitingChargeMasterData &&
        clientWaitingChargeMasterData.waitingChargePerHour > 0
      ) {
        const clientWaitingTimeInHours = waitingTimeInMinutes / 60;
        clientWaitingCharge =
          clientWaitingTimeInHours *
          clientWaitingChargeMasterData.waitingChargePerHour;

        //MASTER DATA UPDATION FOR ACTIVITY CLIENT RATE CARD
        await ActivityClientRateCards.update(
          { ...clientWaitingChargeMasterData },
          {
            where: { activityId: activity.dataValues.id },
            transaction: transaction,
          }
        );
      }
    }

    await Promise.all([
      Activities.update(
        {
          aspWaitingTime: waitingTimeInMinutes,
          clientWaitingTime: waitingTimeInMinutes,
        },
        {
          where: { id: activity.dataValues.id },
          transaction: transaction,
        }
      ),
      ActivityAspDetails.update(
        {
          actualAspWaitingCharge: aspWaitingCharge,
          actualClientWaitingCharge: clientWaitingCharge,
        },
        {
          where: { id: activityAspDetail.dataValues.id },
          transaction: transaction,
        }
      ),
    ]);

    return {
      success: true,
      message: "Asp waiting time updated successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

const updateAspActivityAcceptOrRejectCcDetail: any = async (
  caseDetail: any,
  activity: any,
  activityAspDetail: any,
  isAspAcceptedCcDetail: number,
  aspRejectedCcDetailReasonId: number,
  authUserId: number,
  transaction: any
) => {
  try {
    //CASE PUSH
    const aspInvoiceCaseResponse = await Utils.createAspInvoiceCase(
      caseDetail.dataValues
    );
    if (!aspInvoiceCaseResponse.success) {
      return {
        success: false,
        error: aspInvoiceCaseResponse.error,
      };
    }

    //ACTIVITY PUSH
    activity.dataValues.isAspAcceptedCcDetail = isAspAcceptedCcDetail;
    activity.dataValues.aspRejectedCcDetailReasonId =
      aspRejectedCcDetailReasonId ? aspRejectedCcDetailReasonId : null;
    const aspInvoiceActivityResponse = await Utils.createAspInvoiceActivity(
      caseDetail.dataValues,
      activity.dataValues,
      activityAspDetail.dataValues
    );
    if (!aspInvoiceActivityResponse.success) {
      return {
        success: false,
        error: aspInvoiceActivityResponse.error,
      };
    }

    const message =
      isAspAcceptedCcDetail == 1
        ? "ASP activity CC detail accepted successfully"
        : "ASP activity CC detail rejected successfully";

    await Promise.all([
      Activities.update(
        {
          isAspAcceptedCcDetail: isAspAcceptedCcDetail,
          updatedById: authUserId,
          aspRejectedCcDetailReasonId: aspRejectedCcDetailReasonId,
        },
        {
          where: { id: activity.dataValues.id },
          transaction: transaction,
        }
      ),
      CaseDetails.update(
        { isCasePushedToAspPortal: 1, updatedById: authUserId },
        {
          where: { id: caseDetail.dataValues.id },
          transaction: transaction,
        }
      ),
    ]);

    return {
      success: true,
      message: message,
    };
  } catch (error: any) {
    throw error;
  }
};

const getNotesAndCreateActivity: any = async (
  bearerToken: string,
  serviceId: number,
  subServiceId: number,
  aspId: number,
  caseDetail: any,
  activity: any,
  caseInformation: any,
  assignedTo: number,
  authUserId: number,
  transaction: any
) => {
  try {
    let rsaActivityResponse = null;
    //ASSIGNED TO MYSELF
    if (assignedTo == 1) {
      let assignedToSelfActivityDetails = {
        customerNeedToPay: 0,
        nonMembershipType: null,
        additionalChargeableKm: null,
        notes: "",
      };

      const assignedToSelfNotesResponse = await getNotes(
        caseDetail,
        caseInformation,
        serviceId,
        subServiceId,
        null
      );
      if (assignedToSelfNotesResponse && assignedToSelfNotesResponse.success) {
        assignedToSelfActivityDetails.customerNeedToPay =
          assignedToSelfNotesResponse.notes.customerNeedToPay;
        assignedToSelfActivityDetails.nonMembershipType =
          assignedToSelfNotesResponse.notes.nonMembershipType;
        assignedToSelfActivityDetails.additionalChargeableKm =
          assignedToSelfNotesResponse.notes.additionalChargeableKm;
        assignedToSelfActivityDetails.notes = JSON.stringify(
          assignedToSelfNotesResponse.notes
        );
      }

      const rsaActivityRequestResponse = await axios.post(
        `${apiGatewayService}/${config.apiGatewayService.serviceAccess.case}/${endpointApiGateway.rsaActivityRequest}`,
        {
          caseDetailId: activity.dataValues.caseDetailId,
          aspId: aspId,
          activityStatusId: 1,
          serviceId: serviceId,
          subServiceId: subServiceId,
          ignoreActiveActivityExistsCondition: true,
          isSelf: 1,
          assignedToSelfActivityDetails: assignedToSelfActivityDetails,
        },
        {
          headers: {
            Authorization: bearerToken,
          },
        }
      );
      if (!rsaActivityRequestResponse.data.success) {
        return rsaActivityRequestResponse.data;
      }
      rsaActivityResponse = rsaActivityRequestResponse.data;
    } else {
      //ASSIGNED TO OTHERS
      const additionalSubServiceCreationResponse =
        await createActivityAndActivityAspDetail(
          caseDetail,
          caseInformation,
          authUserId,
          serviceId,
          subServiceId,
          null,
          0, //NOT INITIALLY CREATED
          1, //IMMEDIATE SERVICE
          null, //SERVICE INITIATING AT
          null, //SERVICE EXPECTED AT
          0, //ASP AUTO ALLOCATION
          transaction
        );
      if (!additionalSubServiceCreationResponse.success) {
        return additionalSubServiceCreationResponse;
      }
    }

    return {
      success: true,
      message: "Additional service request processed",
      rsaActivityResponse: rsaActivityResponse,
    };
  } catch (error: any) {
    throw error;
  }
};

const updateActivityAndActivityAspDetails: any = async (
  rsaActivityRequestActivityIds: any,
  aspId: number,
  transaction: any
) => {
  try {
    let updateDetails: any = {
      activityStatusId: 2, //Assigned
      aspActivityStatusId: 1, //Accepted
      activityAppStatusId: 1, //Accepted
      agentPickedAt: new Date(),
      aspServiceAcceptedAt: new Date(),
      serviceAcceptedInApp: 1,
    };
    await Promise.all([
      //UPDATE ACTIVITY STATUS INPROGRESS AND ASP ACTIVITY STATUS AS ACCEPTED
      Activities.update(
        { ...updateDetails },
        {
          where: {
            id: {
              [Op.in]: rsaActivityRequestActivityIds,
            },
          },
          transaction: transaction,
        }
      ),
      //UPDATE SERVICE AS ACCEPTED
      ActivityAspDetails.update(
        { aspServiceAccepted: 1 },
        {
          where: {
            activityId: {
              [Op.in]: rsaActivityRequestActivityIds,
            },
            aspId: aspId,
          },
          transaction: transaction,
        }
      ),
    ]);

    return {
      success: true,
      message: "Update completed",
    };
  } catch (error: any) {
    throw error;
  }
};

const getAssignedCountBaseQuery = (
  aspId: any,
  activityStatusIds: any,
  serviceScheduledDate: any,
  isInitiallyCreated: any,
  isImmediateService: any
) => ({
  where: {
    ...(aspId !== null && { aspId }),
  },
  include: [
    {
      model: Activities,
      attributes: [],
      required: true,
      where: {
        activityStatusId: {
          [Op.notIn]: activityStatusIds,
        },
        ...(isInitiallyCreated !== null && { isInitiallyCreated }),
        ...(isImmediateService !== null && { isImmediateService }),
        ...(isInitiallyCreated === 1 &&
          isImmediateService === 0 && {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("DATE", Sequelize.col("serviceInitiatingAt")),
              serviceScheduledDate
            ),
          ],
        }),
        ...(isInitiallyCreated === 0 && {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("DATE", Sequelize.col("activity.createdAt")),
              serviceScheduledDate
            ),
          ],
        }),
      },
      include: [
        {
          model: caseDetails,
          attributes: [],
          required: true,
          where: {
            statusId: {
              [Op.ne]: 3, //CANCELLED
            },
            ...(isInitiallyCreated === null &&
              isImmediateService === null && {
              deliveryRequestPickupDate: serviceScheduledDate,
            }),
            ...(isInitiallyCreated === 1 &&
              isImmediateService === 1 && {
              date: serviceScheduledDate,
            }),
          },
        },
      ],
    },
  ],
});

const getWorkStatusBaseQuery = (
  aspId: any,
  aspMechanicId: any,
  activityStatusIds: any,
  serviceScheduledDate: any,
  isInitiallyCreated: any,
  isImmediateService: any
) => ({
  where: {
    ...(aspId !== null && { aspId }),
    ...(aspMechanicId !== null && { aspMechanicId }),
  },
  attributes: ["id", "activityId", "aspId", "aspMechanicId"],
  include: [
    {
      model: Activities,
      attributes: ["id", "aspActivityStatusId"],
      required: true,
      where: {
        activityStatusId: {
          [Op.notIn]: activityStatusIds,
        },
        ...(isInitiallyCreated !== null && { isInitiallyCreated }),
        ...(isImmediateService !== null && { isImmediateService }),
        ...(isInitiallyCreated === 1 &&
          isImmediateService === 0 && {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("DATE", Sequelize.col("serviceInitiatingAt")),
              serviceScheduledDate
            ),
          ],
        }),
        ...(isInitiallyCreated === 0 && {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("DATE", Sequelize.col("activity.createdAt")),
              serviceScheduledDate
            ),
          ],
        }),
      },
      include: [
        {
          model: caseDetails,
          attributes: ["id"],
          required: true,
          where: {
            statusId: {
              [Op.ne]: 3, //CANCELLED
            },
            ...(isInitiallyCreated === null &&
              isImmediateService === null && {
              deliveryRequestPickupDate: serviceScheduledDate,
            }),
            ...(isInitiallyCreated === 1 &&
              isImmediateService === 1 && {
              date: serviceScheduledDate,
            }),
          },
        },
      ],
    },
  ],
});

const getServiceDetails = async (activityId: any) => {
  try {
    const [activity, dropActivityInventory]: any = await Promise.all([
      Activities.findOne({
        where: { id: activityId },
        attributes: [
          "id",
          "serviceStartDateTime",
          "serviceEndDateTime",
          "activityStatusId",
          "aspReachedToBreakdownAt",
          "aspServiceAcceptedAt",
          "aspServiceRejectedAt",
          "aspServiceCanceledAt",
          "additionalChargeableKm",
        ],
        include: [
          {
            model: ActivityAspDetails,
            attributes: [
              "id",
              "aspId",
              "subServiceId",
              "aspMechanicId",
              "aspVehicleRegistrationNumber",
              "estimatedTotalKm",
              "estimatedAspToBreakdownKm",
              "estimatedBreakdownToAspKm",
              "estimatedBreakdownToDropKm",
              "estimatedDropToAspKm",
              "rejectReasonId",
              "actualTotalKm",
              "actualClientWaitingCharge",
            ],
            required: true,
          },
          {
            model: ActivityCharges,
            attributes: ["id", "chargeId", "typeId", "amount"],
            required: false,
          },
          {
            model: CaseDetails,
            attributes: ["id"],
            required: true,
            include: [
              {
                model: CallInitiation,
                as: "callInitiation",
                attributes: ["id", "dispositionId"],
                required: false,
              },
              {
                model: CaseInformation,
                attributes: [
                  "id",
                  "breakdownLocation",
                  "dropLocationTypeId",
                  "customerPreferredLocationId",
                  "dropDealerId",
                  "dropLocationLat",
                  "dropLocationLong",
                  "dropLocation",
                ],
                required: true,
              },
            ],
          },
        ],
      }),
      RsaActivityInventory.findOne({
        attributes: ["id", "vehicleAcknowledgedBy", "mobileNumberOfReceiver"],
        where: {
          activityId: activityId,
          typeId: 161, //DROP
        },
      }),
    ]);
    if (!activity) {
      return {
        success: false,
        error: "Activity not found",
      };
    }

    return {
      success: true,
      activity: activity,
      dropActivityInventory: dropActivityInventory,
    };
  } catch (error: any) {
    throw error;
  }
};

export const getAspDetails = async (activityId: any) => {
  try {
    return await ActivityAspDetails.findOne({
      where: { activityId: activityId },
      attributes: {
        exclude: [
          "createdById",
          "updatedById",
          "deletedById",
          "createdAt",
          "updatedAt",
          "deletedAt",
        ],
      },
    });
  } catch (error: any) {
    throw error;
  }
};

const clientWaitingTimeProcess: any = async (activity: any) => {
  try {
    let clientWaitingTime = null;
    const pickupOtpVerifiedAt = moment.tz(
      activity.dataValues.pickupOtpVerifiedAt,
      "Asia/Kolkata"
    );
    const pickupSignatureSubmittedAt = moment.tz(
      activity.dataValues.pickupSignatureSubmittedAt,
      "Asia/Kolkata"
    );

    const dropInventorySubmittedAt = moment.tz(
      activity.dataValues.dropInventorySubmittedAt,
      "Asia/Kolkata"
    );
    const dropOtpVerifiedAt = moment.tz(
      activity.dataValues.dropOtpVerifiedAt,
      "Asia/Kolkata"
    );

    const pickupOtpVerifiedAndSignatureSubmitInterval =
      pickupSignatureSubmittedAt.diff(pickupOtpVerifiedAt, "minutes");
    const dropInventoryAndOtpVerifiedInterval = dropOtpVerifiedAt.diff(
      dropInventorySubmittedAt,
      "minutes"
    );

    const initialWaitingTime =
      pickupOtpVerifiedAndSignatureSubmitInterval +
      dropInventoryAndOtpVerifiedInterval;

    //COMPLIMENTARY WAITING TIME
    const complimentaryWaitingTimeResponse = await axios({
      method: "get",
      url: `${masterService}/${endpointMaster.configs.getConfigById}?id=371`,
    });
    if (!complimentaryWaitingTimeResponse.data.success) {
      return {
        success: false,
        error: "Complimentary waiting time not found",
      };
    }

    const complimentaryWaitingTime =
      +complimentaryWaitingTimeResponse.data.data.name;

    //CLIENT WAITING TIME CALCULATED BASED ON CONFIGURABLE COMPLIMENTARY WAITING TIME
    if (initialWaitingTime > complimentaryWaitingTime) {
      clientWaitingTime = initialWaitingTime - complimentaryWaitingTime;
    }

    if (!clientWaitingTime) {
      return {
        success: false,
        error: "Not need to process client waiting time",
      };
    }

    return {
      success: true,
      message: "Success",
    };
  } catch (error: any) {
    throw error;
  }
};

export const getAspsWorkStatusDetails = async (payload: any) => {
  try {
    const { aspId, hasMechanic, aspMechanics, serviceScheduledDate } = payload;
    let aspAvailable = true;

    const activityStatusIds = [1, 4, 5, 7, 8]; // 1) Open, 4) Cancelled, 5) Failure, 7) Successful, 8) Rejected
    const [
      scheduledVdmActivities,
      scheduledCrmInitialAndImmediateActivities,
      scheduledCrmInitialAndLaterActivities,
      scheduledCrmNotInitialActivities,
    ] = await Promise.all([
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          aspId,
          null,
          activityStatusIds,
          serviceScheduledDate,
          null,
          null
        )
      ),
      // INITIAL CREATED & IMMEDIATE SERVICE
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          aspId,
          null,
          activityStatusIds,
          serviceScheduledDate,
          1,
          1
        )
      ),
      // INITIAL CREATED & LATER SERVICE
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          aspId,
          null,
          activityStatusIds,
          serviceScheduledDate,
          1,
          0
        )
      ),
      // NOT INITIAL CREATED CASE
      ActivityAspDetails.findAll(
        getWorkStatusBaseQuery(
          aspId,
          null,
          activityStatusIds,
          serviceScheduledDate,
          0,
          null
        )
      ),
    ]);

    // Merge all responses into a single array
    const aspScheduledActivities = [
      ...scheduledVdmActivities,
      ...scheduledCrmInitialAndImmediateActivities,
      ...scheduledCrmInitialAndLaterActivities,
      ...scheduledCrmNotInitialActivities,
    ];

    if (aspScheduledActivities.length > 0) {
      //HAS MECHANICS
      if (hasMechanic) {
        const aspScheduledMechanics = aspScheduledActivities.map(
          (aspHasScheduledActivity: any) =>
            aspHasScheduledActivity.dataValues.aspMechanicId
        );
        const uniqueAspScheduledMechanics = [
          ...new Set(aspScheduledMechanics),
        ].filter((value: any) => value !== null);

        // // IF ASP SCHEDULED MECHANICS COUNT MATCHED WITH TOTAL ASP MECHANICS LENGTH THEN HE IS BUSY
        // if (uniqueAspScheduledMechanics.length === aspMechanics.length) {
        //   aspAvailable = false;
        // }

        // GET UNSHEDULED ASP MECHANICS BY COMPARING THE ASP MECHANICS FROM MASTER WITH SCHEDULED ASP MECHANICS
        const unsheduledAspMechanics = aspMechanics
          .map((aspMechanic: any) => {
            if (!uniqueAspScheduledMechanics.includes(aspMechanic.id)) {
              return aspMechanic.id;
            }
            return null;
          })
          .filter((value: any) => value !== null);

        // IF UNSHEDULED ASP MECHANICS NOT AVAILABLE THEN ASP NOT AVAILABLE
        if (unsheduledAspMechanics.length == 0) {
          aspAvailable = false;
        }
      } else {
        aspAvailable = false;
      }
    }

    return {
      success: true,
      aspAvailable: aspAvailable,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const serviceProviderIdCardLinkSendToCustomer = async (payload: any) => {
  const transaction = await sequelize.transaction();
  try {
    const smsRequests = {
      smsType: "serviceProviderIdCard",
      entityId: payload.activityId,
      entityTypeId: 702, //ACTIVITY
      target: payload.customerMobileNumber,
      frontEndUrl: process.env.SERVICE_PROVIDER_ID_CARD_URL,
      urlExpiryMins: process.env.SERVICE_PROVIDER_ID_CARD_URL_EXPIRY_MINS, // 3 DAYS
      message:
        "Dear Customer, Kindly click on the below link to view service provider id card: {url} Team TVS Auto Assist",
      //confirm sms content with ram.
      existingLinkId: payload.existingLinkId,
    };

    const linkResponse = await createLinkAndSendSmsToTarget(
      smsRequests,
      transaction
    );

    if (!linkResponse.success) {
      await transaction.rollback();
      return {
        success: false,
        error: linkResponse.error,
      };
    }

    await Promise.all([
      Activities.update(
        {
          technicianIdCardLinkId: linkResponse.linkId,
        },
        {
          where: { id: payload.activityId },
          transaction: transaction,
        }
      ),
      ActivityLogs.create(
        {
          activityId: payload.activityId,
          typeId: 241, //Mobile
          title: `Service provider id card SMS sent to customer.`,
        },
        {
          transaction: transaction,
        }
      ),
    ]);

    await transaction.commit();
    return {
      success: true,
      message: "ID card link sms sent successfully",
    };
  } catch (error: any) {
    await transaction.rollback();
    return {
      success: false,
      error: error?.message,
    };
  }
};

const activityCancelAutoEscalation = async (
  activity: any,
  activityAspDetail: any,
  authUserId: number
) => {
  try {
    //GET MASTER DETAILS
    const [getMasterDetail, getUserDetail] = await Promise.all([
      axios.post(`${masterService}/${endpointMaster.getMasterDetails}`, {
        aspId: activityAspDetail.aspId,
        clientId: activity.caseDetail.clientId,
      }),
      axios.post(
        `${userServiceBaseUrl}/${userServiceBaseEndpoint.commonGetMasterDetails}`,
        {
          regionalManagerId: activity.caseDetail.rmId,
        }
      ),
    ]);

    let aspDetail = null;
    let clientDetail = null;
    if (getMasterDetail?.data?.success) {
      aspDetail = getMasterDetail.data.data.asp;
      clientDetail = getMasterDetail.data.data.client;
    }

    let regionalManager = null;
    let zonalManager = null;
    if (getUserDetail?.data?.success) {
      if (getUserDetail.data.data.regionalManager) {
        regionalManager = getUserDetail.data.data.regionalManager;
      }

      if (
        getUserDetail.data.data.regionalManager &&
        getUserDetail.data.data.regionalManager.serviceZm
      ) {
        zonalManager = getUserDetail.data.data.regionalManager.serviceZm;
      }
    }

    if (aspDetail && aspDetail.contactNumber) {
      const templateReplacements = {
        "{asp_name}": aspDetail.name,
        "{ticket_no}": activity.caseDetail.caseNumber,
      };

      sendEscalationSms(
        aspDetail.contactNumber,
        templateReplacements,
        952, //Activity
        activity.id,
        authUserId,
        118, //Case Cancelled By Customer To ASP
        null
      );
    }

    if (regionalManager && regionalManager.mobileNumber) {
      const templateReplacements = {
        "{ticket_no}": activity.caseDetail.caseNumber,
        "{asp_name}": aspDetail ? aspDetail.name : "",
      };

      sendEscalationSms(
        regionalManager.mobileNumber,
        templateReplacements,
        952, //Activity
        activity.id,
        authUserId,
        119, //Case Cancellation
        null
      );
    }

    if (zonalManager && zonalManager.mobileNumber) {
      const templateReplacements = {
        "{ticket_no}": activity.caseDetail.caseNumber,
        "{asp_name}": aspDetail ? aspDetail.name : "",
        "{rm_name}": regionalManager.name,
      };

      sendEscalationSms(
        zonalManager.mobileNumber,
        templateReplacements,
        952, //Activity
        activity.id,
        authUserId,
        120, //Case Cancellation Informed To RM
        null
      );
    }

    if (activity.caseDetail.caseInformation.customerMobileNumber) {
      const templateReplacements = {
        "{cur_contact_name}":
          activity.caseDetail.caseInformation.customerContactName,
        "{ticket_no}": activity.caseDetail.caseNumber,
        "{asp_name}": aspDetail ? aspDetail.name : "",
        "{asp_toll_free}": clientDetail ? clientDetail.aspTollFreeNumber : "",
      };

      sendEscalationSms(
        activity.caseDetail.caseInformation.customerMobileNumber,
        templateReplacements,
        952, //Activity
        activity.id,
        authUserId,
        123, //Customer Cancelling
        null
      );
    }

    return {
      success: true,
      message: "Escalation processed successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

const activityAcceptAutoEscalation = async (aspName: any, activity: any) => {
  try {
    const replacements = {
      "{cur_contact_name}":
        activity.caseDetail.caseInformation.customerContactName,
      "{asp_name}": aspName,
      "{AspWithCustomerMap_url}": process.env.SERVICE_PROVIDER_TRACK_URL,
    };

    const escalationResponse: any = await sendEscalationSms(
      activity.caseDetail.caseInformation.customerMobileNumber,
      replacements,
      952, //Activity
      activity.id,
      null,
      117, //ASP Details To Customer With MAP
      activity.caseDetail.clientId
    );
    if (escalationResponse && escalationResponse.success) {
      await Activities.update(
        {
          serviceProviderTrackLinkId: escalationResponse.linkId,
        },
        {
          where: { id: activity.id },
        }
      );
    }

    return {
      success: true,
      message: "Escalation processed successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

export default activitiesController;
