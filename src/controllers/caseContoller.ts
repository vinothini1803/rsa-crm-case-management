import { Request, Response } from "express";
import {
  Activities,
  ActivityAspDetails,
  ActivityAspLiveLocations,
  CaseDetails,
  ActivityLogs,
  ActivityTransactions,
  CaseInformation,
  PolicyInterestedCustomers,
  TempCaseFormDetail,
  links,
  ActivityAspRateCards,
  ActivityClientRateCards,
  CrmSla,
  CaseSla,
  CaseQuestionnaireAnswer,
} from "../database/models/index";
import { Op, where, Sequelize } from "sequelize";
import activityAspDetails from "../database/models/activityAspDetails";
import caseDetails from "../database/models/caseDetails";
import fs from "fs";
import attachments from "../database/models/attachments";
import sequelize from "../database/connection";
import ActivityChargeAttachments from "../database/models/activityChargeAttachments";
import Utils from "../lib/utils";
import axios from "axios";
import caseCreateSendEmail from "../lib/caseCreateEmailNotification";
import moment from "moment-timezone";
import dotenv from "dotenv";
import caseInformation from "../database/models/caseInformation";
import { log } from "handlebars";
import notificationController from "./notificationController";
import { generateXLSXAndXLSExport } from "../middlewares/excel.middleware";
import {
  createActivityAndActivityAspDetail,
  getNotes,
  getAspsWorkStatusDetails,
  checkAspMechanicWorkStatus,
} from "./activitiesContoller";
import { caseSlaController } from "./caseSla";
import { crmSlaController, getComparisionDate, getSLATime, getTimeDifference } from "./crmSla";
import { updateCaseInElk } from "../elasticsearch/sync/case";
import { sendEscalationSms } from "../controllers/template";

dotenv.config();
const config = require("../config/config.json");

const defaultLimit = 10;
const defaultOffset = 0;

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

//API with endpoint (API Gateway);
const apiGatewayService = `${config.apiGatewayService.host}:${config.apiGatewayService.port}/${config.apiGatewayService.version}`;
const endpointApiGateway = config.apiGatewayService.endpoint;

export namespace caseController {
  //SubMaster (Master) Access;
  const subMasterDealers = `${config.MasterService.serviceAccess.dealers}`;
  const subMasterClients = `${config.MasterService.serviceAccess.clients}`;

  //Create New Case
  export async function addCase(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const { data, pickupDealerData, dropDealerData } = req.validBody;
      //ALLOW NEW REQUEST FOR THE SAME VIN IN DEALER SCHEME IS FALSE || TRUE WITH OEM SCHEME
      //THEN CHECK DELIVERY REQUEST ALREADY CREATED FOR THE VIN
      const allowNewRequestForSameVinInDealerScheme =
        process.env.ALLOW_NEW_REQUEST_FOR_THE_SAME_VIN_IN_DEALER_SCHEME;
      if (
        allowNewRequestForSameVinInDealerScheme == "false" ||
        (allowNewRequestForSameVinInDealerScheme == "true" &&
          data.deliveryRequestSchemeId == 21)
      ) {
        if (
          await deliveryRequestAlreadyCreatedForVin(
            data.clientId,
            data.vin,
            null
          )
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error:
              "The delivery request for the vehicle has already been created.",
          });
        }
      }

      // //CHECK PICKUP TIME ALREADY SCHEDULED FOR THE PICKUP DEALER
      // const pickupTimeAlreadyScheduled = await CaseDetails.findOne({
      //   where: {
      //     statusId: {
      //       [Op.ne]: 3, //EXCEPT CANCELLED
      //     },
      //     dealerId: data.dealerId,
      //     deliveryRequestPickupDate: data.deliveryRequestPickupDate,
      //     deliveryRequestPickupTime: data.deliveryRequestPickupTime,
      //   },
      // });

      // if (pickupTimeAlreadyScheduled) {
      //   return res.status(200).json({
      //     success: false,
      //     error:
      //       "The selected pickup date & time has already been scheduled. Kindly select an alternative date & time.",
      //   });
      // }

      const financialYear = Utils.getCurrentFinancialYear();
      const [
        activity,
        generateSerialNumber,
        getDealerDetail,
        getNewCaseEmailReceivers,
      ]: any = await Promise.all([
        //CHECK CREATED DEALER HAS NOT MADE PAYMENT FOR THE BALANCE AMOUNT OF THE PREVIOUS DELIVERY REQUEST
        Activities.findOne({
          where: { activityStatusId: 11 }, //BALANCE PAYMENT PENDING
          include: {
            model: caseDetails,
            required: true,
            where: {
              deliveryRequestCreatedDealerId:
                data.deliveryRequestCreatedDealerId,
            },
          },
        }),
        // GENERATE SERIAL NUMBER
        axios.get(
          `${masterService}/${endpointMaster.generateCaseSerialNumber}?clientId=${data.clientId}&financialYear=${financialYear}`
        ),
        // GET CREATED DEALER DETAILS
        axios.get(
          `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${data.deliveryRequestCreatedDealerId}`
        ),
        // GET NEW CASE EMAIL RECEIVERS
        axios.get(`${masterService}/${endpointMaster.newCaseEmailReceivers}`),
      ]);

      if (activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error:
            "The created dealer has not made payment for the balance amount of the previous delivery request",
        });
      }

      if (!generateSerialNumber.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: generateSerialNumber.data.error,
        });
      }

      if (!getDealerDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Dealer not found",
        });
      }

      //CHECK GENERATED SERIAL NUMBER ALREADY TAKEN OR NOT
      const serialNumbreExist = await caseDetails.findOne({
        where: { caseNumber: generateSerialNumber.data.data },
        attributes: ["id"],
      });
      if (serialNumbreExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `The case number ${generateSerialNumber.data.data} is already taken`,
        });
      }

      let pickUpData = null;
      //CUSTOMER
      if (data.locationTypeId && data.locationTypeId == 451) {
        pickUpData = {
          deliveryRequestPickUpLocation: data.pickupLocation,
          deliveryRequestPickUpStateId: data.pickupStateId,
          deliveryRequestPickUpCityId: data.pickupCityId,
          pickupLocationPinCode: data.pickupLocationPinCode,
        };
      } else {
        //DEALER
        pickUpData = {
          pickupLatitude: pickupDealerData.lat,
          pickupLongitude: pickupDealerData.long,
          deliveryRequestPickUpLocation: pickupDealerData.correspondenceAddress,
          deliveryRequestPickUpStateId: pickupDealerData.stateId,
          deliveryRequestPickUpCityId: pickupDealerData.cityId,
          pickupLocationPinCode: pickupDealerData.pincode,
        };
      }

      let dropData = null;
      //CUSTOMER
      if (data.locationTypeId && data.locationTypeId == 451) {
        dropData = {
          deliveryRequestDropLocation: data.dropLocation,
          deliveryRequestDropStateId: data.dropStateId,
          deliveryRequestDropCityId: data.dropCityId,
          dropLocationPinCode: data.dropLocationPinCode,
        };
      } else {
        //DEALER
        dropData = {
          dropLatitude: dropDealerData.lat,
          dropLongitude: dropDealerData.long,
          deliveryRequestDropLocation: dropDealerData.correspondenceAddress,
          deliveryRequestDropStateId: dropDealerData.stateId,
          deliveryRequestDropCityId: dropDealerData.cityId,
          dropLocationPinCode: dropDealerData.pincode,
        };
      }

      //FOR SLA AUDIT PURPOSE
      data.deliveryRequestPickupInitialDate = data.deliveryRequestPickupDate;
      data.deliveryRequestPickupInitialTime = data.deliveryRequestPickupTime;

      //GET CITY MASTER DETAILS
      const getCaseRequestData = await axios.post(
        `${masterService}/${endpointMaster.getCaseRequestMasterData}`,
        {
          pickUpCityId: pickUpData.deliveryRequestPickUpCityId,
        }
      );
      if (!getCaseRequestData.data.success) {
        await transaction.rollback();
        return res.status(200).json(getCaseRequestData.data);
      }
      const rmId = getCaseRequestData.data.data.pickUpCityData
        ? getCaseRequestData.data.data.pickUpCityData.rmId
        : null;

      const addData = await CaseDetails.create(
        {
          ...data,
          caseNumber: generateSerialNumber.data.data,
          ...pickUpData,
          ...dropData,
          date: new Date(),
          rmId: rmId,
        },
        {
          transaction: transaction,
        }
      );

      if (data.attachmentId) {
        await attachments.update(
          { id: data.attachmentId },
          {
            where: { entityId: addData.dataValues.id },
            transaction: transaction,
          }
        );
      }

      //SEND EMAIL NOTIFICATIONS TO STAKEHOLDERS
      if (addData && getNewCaseEmailReceivers.data.success) {
        const deliveryRequestCreatedAt = moment
          .tz(addData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD MMM YYYY hh:mm A");
        const deliveryRequestPickupDate = moment
          .tz(addData.dataValues.deliveryRequestPickupDate, "Asia/Kolkata")
          .format("DD MMM YYYY");
        const emailList = getNewCaseEmailReceivers.data.data;
        // Email Subject
        const emailSubject = `Reg: New Delivery Request ${addData.dataValues.caseNumber} has created on ${deliveryRequestCreatedAt}`;

        const viewCaseUrl = `${process.env.FRONT_END_URL}delivery-request/view/${addData.dataValues.id}`;

        const portalLogoUrl = `${process.env.API_GATEWAY_URL}images/portalLogo.png`;

        //Email data's;
        const emailData = {
          emailSubject: emailSubject,
          dateAndTime: deliveryRequestCreatedAt,
          createdBy: data.createdBy,
          pickUpDate: deliveryRequestPickupDate,
          pickUpTime: data.deliveryRequestPickupTime,
          vehicleMakeAndModel: data.vehicleMake + " " + data.vehicleModel,
          vehicleNumber: data.registrationNumber,
          pickupLocation: pickUpData.deliveryRequestPickUpLocation,
          dropLocation: dropData.deliveryRequestDropLocation,
          viewCaseUrl: viewCaseUrl,
          portalLogoUrl: portalLogoUrl,
        };

        // Email Send
        caseCreateSendEmail(emailData, emailList);
        // await Promise.all([caseCreateSendEmail(emailData, emailList)]).then(
        //   ([sendMailResponse]) => {
        //     // Email Error Handle
        //     if (!sendMailResponse.success) {
        //       console.log(sendMailResponse.error);
        //     }
        //   }
        // );
      }

      //DELIVERY REQUEST CREATION
      await ActivityLogs.create(
        {
          caseDetailId: addData.dataValues.id,
          typeId: 240, //WEB
          title: `The dealer "${getDealerDetail.data.data.name}" has created a delivery request.`,
          createdAt: addData.dataValues.createdAt,
        },
        {
          transaction: transaction,
        }
      );

      //SAVE QUESTIONNAIRE ANSWERS
      if (data.questionnaireAnswers && Array.isArray(data.questionnaireAnswers)) {
        for (const answer of data.questionnaireAnswers) {
          if (answer.questionnaireId && answer.answer !== undefined && answer.answer !== null) {
            await CaseQuestionnaireAnswer.create(
              {
                caseId: addData.dataValues.id,
                questionnaireId: answer.questionnaireId,
                answer: typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer),
                createdById: data.createdById,
                updatedById: data.createdById,
              },
              {
                transaction: transaction,
              }
            );
          }
        }
      }

      await transaction.commit();

      // FCM PUSH NOTIFICATIONS
      const details = {
        caseDetailId: addData.dataValues.id,
        templateId: 1,
        notifyToAll: [""],
      };
      notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc
      return res.status(200).json({
        success: true,
        message: "Delivery Request Created Successfully",
        caseDetailId: addData.dataValues.id,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //Update Case
  export async function updateCase(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      const [checkCaseIdExists, getAgentDetail]: any = await Promise.all([
        CaseDetails.findOne({
          where: {
            id: inData.caseDetailId,
            statusId: 1, //Open
          },
          include: [
            {
              model: CaseInformation,
              required: false,
              attributes: ["id", "customerMobileNumber"],
            },
          ],
        }),
        // FCM PUSH NOTIFICATIONS
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: inData.agentId,
        }),
      ]);
      if (!checkCaseIdExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      // if (checkCaseIdExists.typeId == 31) {
      //   //RSA
      //   const authUserPermissions = inData.authUserData.permissions;
      //   if (
      //     !Utils.hasPermission(authUserPermissions, "agent-assign-manual-web")
      //   ) {
      //     await transaction.rollback();
      //     return res.status(200).json({
      //       success: false,
      //       error: "Permission not found",
      //     });
      //   }
      // }

      if (checkCaseIdExists.dataValues.agentId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent already assigned for this case",
        });
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json(getAgentDetail.data);
      }

      //VDM
      if (checkCaseIdExists.dataValues.typeId == 32) {
        // SLA VIOLATE REASON PROCESS
        const agentAssignmentViolationCheckRequest = {
          caseDetailId: inData.caseDetailId,
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

        const agentAssignmentViolationCheckResponse: any =
          await caseSlaController.agentAssignViolationCheck(
            agentAssignmentViolationCheckRequest
          );

        if (!agentAssignmentViolationCheckResponse.success) {
          await transaction.rollback();
          return res.status(200).json(agentAssignmentViolationCheckResponse);
        }
      }

      await Promise.all([
        CaseDetails.update(
          {
            ...inData,
            statusId: 2,
            agentAssignedAt: new Date(),
          },
          {
            where: { id: inData.caseDetailId },
            transaction,
          }
        ),
        ActivityLogs.create(
          {
            caseDetailId: inData.caseDetailId,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name}" has been assigned to this request.`,
            createdAt: new Date(),
          },
          { transaction }
        ),
      ]);

      //VDM
      let details = {};
      if (checkCaseIdExists.dataValues.typeId == 32) {
        details = {
          caseDetailId: inData.caseDetailId,
          templateId: 2,
          notifyToAll: [""],
          notificationType: "VDM",
          agentName: getAgentDetail.data.user.name,
        };
      } else {
        details = {
          caseDetailId: inData.caseDetailId,
          templateId: 1,
          notifyToAll: [""],
          agentName: getAgentDetail.data.user.name,
          notificationType: "CRM",
        };

        //Send escalation sms only for ICICIL client
        const templateReplacements = {
          "{agent_name}": getAgentDetail.data.user.name,
        };
        sendEscalationSms(
          checkCaseIdExists.caseInformation.customerMobileNumber,
          templateReplacements,
          951, //Case Detail
          inData.caseDetailId,
          inData.authUserId,
          126, //Only Once When Ticket ID Assigned To Agent
          checkCaseIdExists.clientId
        );
      }
      notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc

      await transaction.commit();

      axios.put(`${userServiceUrl}/${userServiceEndpoint.updateUserLogin}`, {
        userId: inData.agentId,
        pendingCaseCount: 1,
        assignedCasesCount: 1,
        lastAllocatedCaseTime: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: "Agent Assigned Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Get All case list;
  export async function listCases(req: Request, res: Response) {
    try {
      const { limit, offset, search, startDate, endDate, ...inputData } =
        req.body;
      const caseStatusId = parseInt(inputData.caseStatusId as string);
      const userId = inputData.userId
        ? parseInt(inputData.userId as string)
        : null;
      const userTypeId = inputData.userTypeId
        ? parseInt(inputData.userTypeId as string)
        : null;
      const roleId = parseInt(inputData.roleId as string);
      const activityStatusId = parseInt(inputData.activityStatusId as string);
      const aspActivityStatusId = parseInt(
        inputData.aspActivityStatusId as string
      );

      //USER TYPE ID REQUIRED EXCEPT SUPER ADMIN AND TEAM LEADER ROLE
      if (!userTypeId && roleId != 1 && roleId != 7 && roleId != 31) {
        return res.status(200).json({
          success: false,
          error: "User Type ID is required",
        });
      }

      //USER ID REQUIRED EXCEPT SUPER ADMIN ROLE
      if (!userId && roleId != 1 && roleId != 7 && roleId != 31) {
        return res.status(200).json({
          success: false,
          error: "User ID is required",
        });
      }

      //USER IDS (DEALER IDS) REQUIRED FOR FINANCE ADMIN USER
      if (roleId == 31 && inputData.userIds.length == 0) {
        return res.status(200).json({
          success: false,
          error: "User IDs required",
        });
      }

      let searchWhereQuery: any = [];
      const activityWhereClause: any = {};
      let activitiesRequired = false;

      activityWhereClause.activityStatusId = {
        [Op.notIn]: [4, 5, 8], // 4) Cancelled, 5) Failure, 8) Rejected
      };
      if (activityStatusId) {
        activityWhereClause.activityStatusId = activityStatusId;
        activitiesRequired = true;
      }
      if (aspActivityStatusId) {
        activityWhereClause.aspActivityStatusId = aspActivityStatusId;
        activitiesRequired = true;
      }

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      where.typeId = 32; // Delivery Request

      if (caseStatusId) {
        where.statusId = caseStatusId;
      }
      //AGENT USER
      if (userTypeId === 141 && userId) {
        const agentWhereClause = {
          [Op.or]: [{ [Op.is]: null }, { [Op.eq]: userId }],
        };
        where.agentId = agentWhereClause;
      }

      //FILTER BASED ON SELECTED DEALER ID
      if (inputData.dealerId) {
        where.deliveryRequestCreatedDealerId = inputData.dealerId;
      }

      //DEALER USER (BASED ON PICKUP DEALER LOGIN OR REQUEST CREATED DEALER LOGIN)
      if (userTypeId === 140 && userId) {
        where[Op.or] = [
          { dealerId: userId }, //PICKUP DEALER
          { deliveryRequestDropDealerId: userId }, //DROP DEALER
          { deliveryRequestCreatedDealerId: userId }, //REQUEST CREATED DEALER
        ];
      }

      // DEALER FINANCE ADMIN (DEALERS THAT COMES UNDER FINANCE ADMIN USER)
      if (roleId == 31 && inputData.userIds.length > 0) {
        where[Op.or] = [
          { dealerId: { [Op.in]: inputData.userIds } }, // PICKUP DEALER
          { deliveryRequestDropDealerId: { [Op.in]: inputData.userIds } }, // DROP DEALER
          { deliveryRequestCreatedDealerId: { [Op.in]: inputData.userIds } }, // REQUEST CREATED DEALER
        ];
      }

      // Limitation value setup
      let limitValue: number = defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit as string);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset as string);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      // Check if a search query is provided
      if (search) {
        const searchDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getCrmListSearchData}`,
          {
            search: search,
          }
        );

        let masterSearchDetails = [];
        if (searchDataResponse?.data?.success) {
          for (const searchDetail of searchDataResponse.data.searchDetails) {
            if (searchDetail.type == "caseSubject") {
              masterSearchDetails.push({
                subjectID: {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "subService") {
              masterSearchDetails.push({
                deliveryRequestSubServiceId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "caseStatus") {
              masterSearchDetails.push({
                statusId: { [Op.in]: searchDetail.ids },
              });
            }
          }
        }

        searchWhereQuery = [
          { caseNumber: { [Op.like]: `%${search}%` } },
          { vin: { [Op.like]: `%${search}%` } },
        ];

        if (masterSearchDetails && masterSearchDetails.length > 0) {
          searchWhereQuery.push(...masterSearchDetails);
        }
      }

      let dateFilterQuery: any = [];
      // Check if a date query is provided
      if (startDate && endDate) {
        dateFilterQuery = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      where[Op.and] = {
        [Op.and]: [
          ...(dateFilterQuery.length > 0
            ? [{ [Op.and]: dateFilterQuery }]
            : []),
          ...(searchWhereQuery.length > 0
            ? [{ [Op.or]: searchWhereQuery }]
            : []),
        ],
      };

      const caseList: any = await CaseDetails.findAndCountAll({
        where,
        attributes: [
          "id",
          "caseNumber",
          "subjectID",
          "deliveryRequestSubServiceId",
          "statusId",
          "deliveryRequestPickupDate",
          "deliveryRequestPickupTime",
          "locationTypeId",
          "dealerId",
          "pickupLatitude",
          "pickupLongitude",
          "deliveryRequestPickupLocation",
          "deliveryRequestDropDealerId",
          "deliveryRequestSchemeId",
          "dropLatitude",
          "dropLongitude",
          "deliveryRequestDropLocation",
          "createdAt",
          "psfStatus",
        ],
        order: [["id", "desc"]],
        limit: limitValue,
        offset: offsetValue,
        include: [
          {
            model: Activities,
            attributes: ["id", "activityStatusId", "aspActivityStatusId"],
            where: activityWhereClause,
            required: activitiesRequired,
            separate: true,
            order: [["id", "DESC"]],
            include: [
              {
                model: ActivityAspDetails,
                attributes: [
                  "activityId",
                  "aspId",
                  "estimatedTotalAmount",
                  "actualTotalAmount",
                ],
                required: false,
              },
              {
                model: ActivityTransactions,
                attributes: ["activityId", "amount"],
                where: {
                  paymentTypeId: 170, //ADVANCE
                  transactionTypeId: 181, //DEBIT
                },
                limit: 1,
                required: false,
              },
              {
                model: ActivityAspLiveLocations,
                attributes: ["latitude", "longitude"],
                required: false,
                limit: 1,
                separate: true,
                order: [["id", "DESC"]],
              },
            ],
          },
        ],
      });

      if (caseList.count === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      if (userTypeId) {
        caseList.userTypeId = userTypeId;
      }
      if (roleId) {
        caseList.roleId = roleId;
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //GET CASE DETAIL
  export async function getCaseDetail(req: Request, res: Response) {
    try {
      const { caseDetailId, activityId } = req.validBody;

      const caseDetail = await CaseDetails.findOne({
        where: {
          id: caseDetailId,
        },
        include: [
          {
            model: Activities,
            attributes: ["id", "activityStatusId", "aspActivityStatusId"],
            required: false,
          },
          {
            model: CaseInformation,
            attributes: [
              "id",
              "customerContactName",
              "customerMobileNumber",
              "breakdownLocation",
              "breakdownLat",
              "breakdownLong",
              "dropDealerId",
              "dropLocationLat",
              "dropLocationLong",
              "dropLocationTypeId",
              "dropLocation",
              "serviceId",
              "subServiceId",
              "customerNeedToPay",
              "nonMembershipType",
              "additionalChargeableKm",
            ],
            required: false,
          },
        ],
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      let activityDetail = null;
      if (activityId) {
        activityDetail = await Activities.findOne({
          attributes: [
            "id",
            "customerNeedToPay",
            "nonMembershipType",
            "additionalChargeableKm",
            "isInitiallyCreated",
            "isImmediateService",
            "serviceInitiatingAt",
            "agentPickedAt",
            "createdAt",
          ],
          where: { id: activityId },
          include: [
            {
              model: activityAspDetails,
              attributes: ["id", "aspId", "subServiceId"],
              required: true,
            },
          ],
        });
      }
      caseDetail.dataValues.positiveActivityExists =
        await Utils.positiveActivityExists(caseDetailId);

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseDetail,
        activityDetail: activityDetail,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function handleUpload(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;

      if (parseInt(inData.attachmentOfId) === 102) {
        //ACTIVITY
        const activityData = await Activities.findOne({
          where: {
            id: inData.entityId,
            activityStatusId: 3, //In Progress
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
        if (!activityData) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Activity not found",
          });
        }
      }

      //DELETE ATTACHMENT ENRTY ONLY FOR SPECIFIC ATTACHMENT TYPES
      const allowedAttachmentTypeIdsToDeleteExistingAttachment = [
        63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 602,
        608, 609, 610, 611, 614, 615, 616
      ];

      if (
        allowedAttachmentTypeIdsToDeleteExistingAttachment.includes(
          inData.attachmentTypeId
        )
      ) {
        // Check if files with the same entityId and attachmentTypeId already exist
        const existingAttachments = await attachments.findAll({
          where: {
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.entityId,
          },
        });

        // Delete the existing entries
        for (const attachment of existingAttachments) {
          // DELETE ATTACHMENT
          const deleteAttachmentResponse = await axios.post(
            `${apiGatewayService}/${config.apiGatewayService.serviceAccess.case}/${endpointApiGateway.deleteAttachment}`,
            {
              attachmentId: attachment.dataValues.id,
            }
          );
          if (!deleteAttachmentResponse.data.success) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: deleteAttachmentResponse.data.error,
            });
          }

          await attachments.destroy({
            where: { id: attachment.dataValues.id },
            transaction: transaction,
          });
        }
      }

      if (inData.files.length > 0) {
        const batchInsertions = [];
        for (const file of inData.files) {
          batchInsertions.push({
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.entityId,
            fileName: file.filename,
            originalName: file.originalname,
          });
        }
        await attachments.bulkCreate(batchInsertions, { transaction });
      }

      // IF ATTACHMENT TYPE IS ACTIVITY
      if (parseInt(inData.attachmentOfId) === 102) {
        const activityAspDetailExists: any = await ActivityAspDetails.findOne({
          where: { activityId: inData.entityId },
          attributes: ["id", "aspId", "aspMechanicId"],
          include: [
            {
              model: Activities,
              attributes: ["id", "caseDetailId"],
            },
          ],
        });
        if (!activityAspDetailExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            message: "Activity ASP detail not found",
          });
        }

        // GET ASP DETAILS
        const getASPDetail = await axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activityAspDetailExists.dataValues.aspId}`
        );
        if (!getASPDetail.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "ASP not found",
          });
        }

        //FCM PUSH NOTIFICATION
        let details: any = {
          caseDetailId:
            activityAspDetailExists.activity.dataValues.caseDetailId,
          notifyToAll: [""],
          workshopName: getASPDetail.data.data.workshopName,
        };

        const caseDetail: any = await CaseDetails.findOne({
          where: {
            id: activityAspDetailExists.activity.dataValues.caseDetailId,
          },
          attributes: ["typeId"],
        });

        let sendFcmPushNotification = false;

        let activityAppStatusId = null;
        let activityLogTitle = null;
        if (parseInt(inData.attachmentTypeId) === 62) {
          activityAppStatusId = 8; // PICKUP INVENTORY DOCUMENT UPLOADED
          activityLogTitle = `The pickup inventory documents have been uploaded by the service provider "${getASPDetail.data.data.workshopName}".`;
        } else if (parseInt(inData.attachmentTypeId) === 70 || parseInt(inData.attachmentTypeId) === 614) {
          sendFcmPushNotification = true;
          if (caseDetail.dataValues.typeId == 32) {
            // VDM Notifications
            details.templateId = 25;
            details.aspDetail = activityAspDetailExists.dataValues.aspId;
            details.mechanicDetail =
              activityAspDetailExists.dataValues.aspMechanicId;
            details.sourceFrom = 2; //Mobile
          } else {
            details.templateId = 15;
            details.notificationType = "CRM";
            details.aspDetail = activityAspDetailExists.dataValues.aspId;
            details.mechanicDetail =
              activityAspDetailExists.dataValues.aspMechanicId;
            details.sourceFrom = 2; //Mobile
          }

          activityAppStatusId = 9; // BEFORE SERVICE PHOTOS CAPTURED
          activityLogTitle = `The before service photos have been uploaded by the service provider "${getASPDetail.data.data.workshopName}".`;
        } else if (parseInt(inData.attachmentTypeId) === 78 || parseInt(inData.attachmentTypeId) === 615) {
          sendFcmPushNotification = true;
          if (caseDetail.dataValues.typeId == 32) {
            // VDM Notifications
            details.templateId = 29;
            details.aspDetail = activityAspDetailExists.dataValues.aspId;
            details.mechanicDetail =
              activityAspDetailExists.dataValues.aspMechanicId;
            details.sourceFrom = 2; //Mobile
          } else {
            details.templateId = 16;
            details.notificationType = "CRM";
            details.aspDetail = activityAspDetailExists.dataValues.aspId;
            details.mechanicDetail =
              activityAspDetailExists.dataValues.aspMechanicId;
            details.sourceFrom = 2; //Mobile
          }

          activityAppStatusId = 12; // AFTER SERVICE PHOTOS CAPTURED
          activityLogTitle = `The after service photos have been uploaded by the service provider "${getASPDetail.data.data.workshopName}".`;
        } else if (parseInt(inData.attachmentTypeId) === 79) {
          activityAppStatusId = 15; // DROP INVENTORY DOCUMENT UPLOADED
          activityLogTitle = `The drop inventory documents have been uploaded by the service provider "${getASPDetail.data.data.workshopName}".`;
        } else if (parseInt(inData.attachmentTypeId) === 616) {
          // DIGITAL INVENTORY FOR CRM
          activityLogTitle = `The inventory document have been uploaded by the service provider "${getASPDetail.data.data.workshopName}".`;
        }

        // UPDATE ACTIVITY APP STATUS
        if (activityAppStatusId) {
          await Activities.update(
            {
              activityAppStatusId: activityAppStatusId,
              //Activity Driver Signature - Before
              ...(parseInt(inData.attachmentTypeId) === 70 && {
                pickupSignatureSubmittedAt: new Date(),
              }),
            },
            {
              where: { id: inData.entityId },
              transaction: transaction,
            }
          );
        }

        if (sendFcmPushNotification) {
          notificationController.sendNotification(details);
        }

        //SAVE ACTIVITY LOG
        if (activityLogTitle) {
          await ActivityLogs.create(
            {
              activityId: inData.entityId,
              typeId: 241, //MOBILE
              title: activityLogTitle,
            },
            {
              transaction: transaction,
            }
          );
        }
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Attachments uploaded successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function caseClose(req: Request, res: Response) {
    const { caseDetailId } = req.body;
    const lockAcquired = await Utils.tryAcquireCaseProcessingLock(caseDetailId);
    if (!lockAcquired) {
      return res.status(200).json({
        success: false,
        error: "Another update is in progress. Please try again in 5 minutes",
      });
    }

    const transaction = await sequelize.transaction();
    try {
      const authUserData = req.body.authUserData;
      const caseDetailExist: any = await CaseDetails.findOne({
        where: {
          id: caseDetailId,
          statusId: {
            [Op.in]: [1, 2], // 1-Open, 2-In Progress
          },
        },
        attributes: [
          "id",
          "typeId",
          "agentId",
          "rmId",
          "vin",
          "caseNumber",
          "cancelReasonId",
          "callCenterId",
          "clientId",
          "vehicleMakeId",
          "vehicleModelId",
          "subjectID",
          "deliveryRequestSchemeId",
          "locationTypeId",
          "pickupLatitude",
          "pickupLongitude",
          "dealerId",
          "deliveryRequestPickUpStateId",
          "deliveryRequestPickUpCityId",
          "dropLatitude",
          "dropLongitude",
          "deliveryRequestDropDealerId",
          "deliveryRequestDropStateId",
          "deliveryRequestDropCityId",
          "statusId",
          "description",
          "registrationNumber",
          "deliveryRequestPickUpLocation",
          "deliveryRequestDropLocation",
          "contactNameAtPickUp",
          "contactNumberAtPickUp",
          "contactNameAtDrop",
          "contactNumberAtDrop",
          "deliveryRequestPickupDate",
          "deliveryRequestPickupTime",
          "isCasePushedToAspPortal",
          "pickupLocationPinCode",
          "dropLocationPinCode",
          "createdAt",
        ],
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
            "irateCustomer",
            "womenAssist",
            "policyTypeId",
            "policyStartDate",
            "policyEndDate",
          ],
          required: false,
        },
      });

      if (!caseDetailExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      // if (caseDetailExist.typeId == 31) {
      //   //RSA
      //   const authUserPermissions = authUserData.permissions;
      //   if (!Utils.hasPermission(authUserPermissions, "case-close-web")) {
      //     await transaction.rollback();
      //     return res.status(200).json({
      //       success: false,
      //       error: "Permission not found",
      //     });
      //   }
      // }

      //IF CASE HAVE IN PROGRESS ACTIVITY THEN VALIDATE
      const caseHaveInprogressActivity = await Activities.findOne({
        attributes: ["id"],
        where: {
          caseDetailId: caseDetailId,
          activityStatusId: {
            [Op.notIn]: [4, 7, 8, 12], //4-Cancelled,7-Successful,8-Rejected, 12-Excess Amount Credit Pending
          },
        },
      });
      if (caseHaveInprogressActivity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Not eligible to close the case",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: caseDetailExist.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      //RSA CRM -> On case close, if sla violated then update sla violation reason.
      if (caseDetailExist.typeId == 31) {
        const slaViolateRequests = {
          caseDetailId: caseDetailExist.id,
          typeId: 874, //Financial entry and Case closure - L1
          date: moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
          slaViolateReasonId: req.body.slaViolateReasonId
            ? req.body.slaViolateReasonId
            : null,
          slaViolateReasonComments: req.body.slaViolateReasonComments
            ? req.body.slaViolateReasonComments
            : null,
          authUserRoleId: req.body.authUserRoleId
            ? req.body.authUserRoleId
            : null,
          authUserId: req.body.authUserId,
          transaction: transaction,
        };

        const slaViolateReasonProcessResponse =
          await crmSlaController.processSlaViolateReason(slaViolateRequests);
        if (!slaViolateReasonProcessResponse.success) {
          await transaction.rollback();
          return res.status(200).json(slaViolateReasonProcessResponse);
        }
      }

      const maturedEmptyReturnFinanceStatusWithActualKmNotUpdatedActivityExists =
        await ActivityAspDetails.findOne({
          attributes: ["id", "activityId"],
          where: {
            actualTotalKm: {
              [Op.is]: null,
            },
          },
          include: [
            {
              model: Activities,
              where: {
                caseDetailId: caseDetailId,
                financeStatusId: 2, //Matured - Empty Return
              },
            },
          ],
        });

      if (maturedEmptyReturnFinanceStatusWithActualKmNotUpdatedActivityExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error:
            "The actual KM is not updated for the Matured - Empty Return activity. Kindly update it.",
        });
      }

      const unbilledActivityTransactions: any =
        await ActivityTransactions.findAll({
          attributes: ["paidByDealerId"],
          where: {
            paymentTypeId: 170, //ADVANCE
            transactionTypeId: 181, //DEBIT
            paymentStatusId: 191, //SUCCESS
          },
          group: "paidByDealerId",
          include: [
            {
              model: Activities,
              attributes: [],
              required: true,
              where: {
                financeStatusId: {
                  [Op.in]: [1, 2], //MATURED AND MATURED EMPTY RETURN
                },
                caseDetailId: caseDetailId,
                isDealerInvoiced: 0,
              },
            },
          ],
        });

      //ONLY FOR VDM
      if (
        caseDetailExist.typeId == 32 &&
        unbilledActivityTransactions.length > 0
      ) {
        //GET DEALERS WHO PAID ADVANCE AMOUNT
        const unbilledDealerIds = [
          ...new Set(
            unbilledActivityTransactions.map(
              (unbilledActivityTransaction: any) =>
                unbilledActivityTransaction.dataValues.paidByDealerId
            )
          ),
        ];

        for (const unbilledDealerId of unbilledDealerIds) {
          // GET DEALER DETAILS
          const getDealerDetail = await axios.get(
            `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${unbilledDealerId}`
          );

          if (!getDealerDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: `Dealer (${unbilledDealerId}) not found`,
            });
          }

          // GET DEALER INVOICE DETAILS
          const getDealerInvoiceDetail = await axios.post(
            `${process.env.RSA_BASE_URL}/crm/dealer/getData`,
            {
              dealerCode: getDealerDetail.data.data.code,
            }
          );

          if (!getDealerInvoiceDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: `Dealer (${getDealerDetail.data.data.code}) : ${getDealerInvoiceDetail.data.error}`,
            });
          }

          //IF DEALER INVOICE PAYMENT METHOD IS "IMMEDIATE" THEN GENERATE INVOICE, OTHERWISE IGNORE IT
          if (
            getDealerInvoiceDetail.data.success &&
            getDealerInvoiceDetail.data.dealer.is_invoice_required == 1 &&
            getDealerInvoiceDetail.data.dealer.invoice_payment_method_id == 791
          ) {
            // GET CLIENT DETAILS
            const getClientDetail = await axios.get(
              `${masterService}/${subMasterClients}/${endpointMaster.clients.getDetail}?clientId=${getDealerDetail.data.data.clientId}`
            );
            if (!getClientDetail.data.success) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: `Client (${getDealerDetail.data.data.clientId}) not found`,
              });
            }

            //GET DELIVERY REQUESTS OF DEALER WHO DID THE ADVANCE PAYMENT - NEED TO GENERATE INVOICE ONLY FOR THESE DEALERS
            const unbilledDealerDeliveryRequests: any =
              await caseDetails.findAndCountAll({
                where: {
                  id: caseDetailId,
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
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: `Dealer (${getDealerDetail.data.data.code}) has no vehicle delivery requests`,
              });
            }

            let unbilledDealerDeliveryRequestTotalRate = 0;
            const unbilledDeliveryRequestForOracle: any = [];
            for (const unbilledDealerDeliveryRequest of unbilledDealerDeliveryRequests.rows) {
              // CALCULATE INDIVIDUAL DELIVERY REQUEST RATE BY LOOPING ITS ACTIVITIES
              let unbilledDealerDeliveryRequestIndividualRate = 0;
              const unbilledDealerDeliveryRequestActivityIds: any = [];
              unbilledDealerDeliveryRequest.activities.forEach(
                (activity: any) => {
                  if (activity.activityAspDetail.dataValues.actualServiceCost) {
                    unbilledDealerDeliveryRequestIndividualRate += activity
                      .activityAspDetail.dataValues.actualAdditionalCharge
                      ? +activity.activityAspDetail.dataValues
                        .actualServiceCost +
                      +activity.activityAspDetail.dataValues
                        .actualAdditionalCharge +
                      +activity.activityAspDetail.dataValues
                        .actualClientWaitingCharge
                      : +activity.activityAspDetail.dataValues
                        .actualServiceCost +
                      +activity.activityAspDetail.dataValues
                        .actualClientWaitingCharge;
                  } else if (
                    activity.activityAspDetail.dataValues.estimatedServiceCost
                  ) {
                    unbilledDealerDeliveryRequestIndividualRate += activity
                      .activityAspDetail.dataValues.estimatedAdditionalCharge
                      ? +activity.activityAspDetail.dataValues
                        .estimatedServiceCost +
                      +activity.activityAspDetail.dataValues
                        .estimatedAdditionalCharge
                      : +activity.activityAspDetail.dataValues
                        .estimatedServiceCost;
                  }
                  unbilledDealerDeliveryRequestActivityIds.push(
                    activity.dataValues.id
                  );
                }
              );
              // CALCULATE COMBINED DELIVERY REQUEST RATE - MAY CONTAINS MULTIPLE ACTIVITIES
              unbilledDealerDeliveryRequestTotalRate +=
                unbilledDealerDeliveryRequestIndividualRate;

              // PUSH INDIVIDUAL DELIVERY REQUESTS FOR ORACLE REPORT PURPOSE - MAY CONTAINS MULTIPLE ACTIVITIES
              unbilledDeliveryRequestForOracle.push({
                caseDetailId: unbilledDealerDeliveryRequest.dataValues.id,
                rate: unbilledDealerDeliveryRequestIndividualRate.toString(),
                amount: unbilledDealerDeliveryRequestIndividualRate.toString(),
                closingDate: moment().tz("Asia/Kolkata").format("YYYY-MM-DD"),
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
              headerLevelDescription: "Towards vehicle transfer fee",
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

            const createDealerInvoiceResponse: any = await axios.post(
              `${process.env.RSA_BASE_URL}/crm/dealerInvoice/create`,
              unbilledDealerDeliveryRequestData
            );
            if (!createDealerInvoiceResponse.data.success) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: createDealerInvoiceResponse.data.error,
              });
            }
          }
        }
      }

      // GET ACTIVITIES THAT ARE IN EXCESS AMOUNT CREDIT PENDING STATUS
      const excessAmountCreditPendingActivityTransactions =
        await ActivityTransactions.findAll({
          attributes: ["id", "activityId", "amount"],
          where: {
            paymentTypeId: 172, //EXCESS
            transactionTypeId: 180, //CREDIT
            paymentStatusId: 190, //PENDING
          },
          include: [
            {
              model: Activities,
              attributes: [],
              required: true,
              where: {
                financeStatusId: {
                  [Op.in]: [1, 2], //MATURED AND MATURED EMPTY RETURN
                },
                caseDetailId: caseDetailId,
                activityStatusId: 12, //EXCESS AMOUNT CREDIT PENDING
              },
            },
          ],
        });

      //ONLY FOR VDM
      if (
        caseDetailExist.typeId == 32 &&
        excessAmountCreditPendingActivityTransactions.length > 0
      ) {
        for (const excessAmountCreditPendingActivityTransaction of excessAmountCreditPendingActivityTransactions) {
          //GET DEALER WHO DID THE ADVANCE PAYMENT
          const advancePaidActivityTransaction: any =
            await ActivityTransactions.findOne({
              attributes: ["id", "paidByDealerId"],
              where: {
                paymentTypeId: 170, //ADVANCE
                transactionTypeId: 181, //DEBIT
                paymentStatusId: 191, //SUCCESS
                activityId:
                  excessAmountCreditPendingActivityTransaction.dataValues
                    .activityId,
              },
            });
          if (advancePaidActivityTransaction) {
            const advancePaidByDealerId =
              advancePaidActivityTransaction.dataValues.paidByDealerId;
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
                amount:
                  excessAmountCreditPendingActivityTransaction.dataValues
                    .amount,
                vin: caseDetailExist.dataValues.vin,
                requestId: caseDetailExist.dataValues.caseNumber,
                type: "excessRefund",
              }
            );

            if (!creditDealerWalletResponse.data.success) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: creditDealerWalletResponse.data.error,
              });
            }

            const [excessActivity, excessActivityAspDetail]: any =
              await Promise.all([
                Activities.findOne({
                  where: {
                    id: excessAmountCreditPendingActivityTransaction.dataValues
                      .activityId,
                  },
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
                    activityId:
                      excessAmountCreditPendingActivityTransaction.dataValues
                        .activityId,
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
                    "estimatedTotalAmount",
                    "rejectReasonId",
                    "actualTotalKm",
                    "actualChargeCollectedFromCustomer",
                  ],
                }),
              ]);

            if (!excessActivity) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: "Excess Activity not found",
              });
            }

            if (!excessActivityAspDetail) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: "Excess Activity ASP Detail not found",
              });
            }

            const excessAmount = Utils.convertToIndianCurrencyFormat(
              parseFloat(
                excessAmountCreditPendingActivityTransaction.dataValues.amount
              )
            );

            await Promise.all([
              //UPDATE EXCESS AMOUNT CREDIT PAYMENT STATUS AS SUCCESS AND PAYMENT METHOD AS WALLET
              ActivityTransactions.update(
                {
                  paymentMethodId: 1, //WALLET
                  paymentStatusId: 191, //SUCCESS
                  paidAt: new Date(),
                },
                {
                  where: {
                    id: excessAmountCreditPendingActivityTransaction.dataValues
                      .id,
                  },
                  transaction,
                }
              ),
              //UPDATE ACTIVITY STATUS AS SUCCESSFULL
              Activities.update(
                { activityStatusId: 7 }, //SUCCESSFULL
                {
                  where: {
                    id: excessAmountCreditPendingActivityTransaction.dataValues
                      .activityId,
                  },
                  transaction,
                }
              ),
              //SAVE ACTIVITY LOG
              ActivityLogs.create(
                {
                  activityId:
                    excessAmountCreditPendingActivityTransaction.dataValues
                      .activityId,
                  typeId: 240, //WEB
                  title: `The excess amount(${excessAmount}) has been refunded to the dealer "${getDealerDetail.data.data.name}" wallet`,
                },
                { transaction }
              ),
            ]);

            //IF CASE INITIALLY PUSHED TO ASP PORTAL THEN PUSH CASE CLOSE ALSO TO ASP PORTAL
            if (
              excessActivity.caseDetail.dataValues.isCasePushedToAspPortal == 1
            ) {
              excessActivity.dataValues.activityStatusId = 7; //SUCCESSFULL
              const aspInvoiceActivityResponse =
                await Utils.createAspInvoiceActivity(
                  excessActivity.caseDetail,
                  excessActivity.dataValues,
                  excessActivityAspDetail.dataValues
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
              caseDetailId: caseDetailId,
              notifyToAll: [""],
              templateId: 43,
              paidByDealerDetail: advancePaidByDealerId,
              paidByDealerOnly: true,
            });
          }
        }
      }

      // Generate customer invoice at case closure for CRM non-membership payments
      if (caseDetailExist.dataValues.typeId == 31) {
        // Collect all positive activities and their non-membership transactions
        const positiveActivities: any = await Activities.findAll({
          where: {
            caseDetailId: caseDetailId,
            activityStatusId: {
              [Op.notIn]: [1, 4, 8], // Exclude Open (1), Cancelled (4), Rejected (8)
            },
          },
          attributes: ["id"],
        });

        if (positiveActivities.length > 0) {
          const positiveActivityIds = positiveActivities.map((act: any) => act.id);

          // Get all non-membership transactions for positive activities
          const nonMembershipTransactions: any = await ActivityTransactions.findAll({
            where: {
              activityId: {
                [Op.in]: positiveActivityIds,
              },
              paymentTypeId: 174, //One time service
              paymentStatusId: 191, //SUCCESS
              membershipId: {
                [Op.ne]: null,
              },
              razorpayTransactionId: {
                [Op.ne]: null, //PAYMENT CAPTURED
              },
              cancellationStatusId: {
                [Op.or]: [
                  {
                    [Op.is]: null, //NOT CANCELLED
                  },
                  {
                    [Op.eq]: 1312, //CANCELLATION REJECTED
                  },
                ],
              },
            },
            attributes: ["membershipId"],
            group: ["membershipId"],
          });

          if (nonMembershipTransactions.length > 0) {
            const membershipIds = nonMembershipTransactions
              .map((t: any) => t.membershipId)
              .filter((id: any) => id !== null);

            if (membershipIds.length > 0) {
              // Call RSA API to generate consolidated invoice
              const invoiceResponse = await axios.post(
                `${process.env.RSA_BASE_URL}/crm/generate/caseCustomerInvoice`,
                {
                  membershipIds: membershipIds,
                  caseDetailId: caseDetailId,
                }
              );

              if (invoiceResponse.data.success) {
                // Update caseDetails with invoice information
                await CaseDetails.update(
                  {
                    isCustomerInvoiced: 1,
                    customerInvoiceNumber: invoiceResponse.data.data.customerInvoiceNumber,
                    customerInvoiceDate: invoiceResponse.data.data.customerInvoiceDate,
                    customerInvoicePath: invoiceResponse.data.data.customerInvoicePath,
                  },
                  {
                    where: { id: caseDetailId },
                    transaction: transaction,
                  }
                );
              } else {
                await transaction.rollback();
                return res.status(200).json({
                  success: false,
                  error: invoiceResponse.data.error,
                });
              }
            }
          }
        }
      }

      //IF CASE INITIALLY PUSHED TO ASP PORTAL THEN PUSH CASE CLOSE ALSO TO ASP PORTAL
      if (caseDetailExist.dataValues.isCasePushedToAspPortal == 1) {
        caseDetailExist.dataValues.statusId = 4; //Closed
        const aspInvoiceCaseResponse = await Utils.createAspInvoiceCase(
          caseDetailExist.dataValues
        );
        if (!aspInvoiceCaseResponse.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: aspInvoiceCaseResponse.error,
          });
        }
      }

      const updateData: any = {
        statusId: 4,
        closedAt: new Date(),
      };

      //RSA CASE
      if (caseDetailExist.dataValues.typeId == 31) {
        updateData.serviceDescriptionId = req.body.serviceDescriptionId;
        updateData.closureRemarks = req.body.closureRemarks;
        updateData.closureRating = req.body.closureRating;
      }
      await CaseDetails.update(
        updateData, //CLOSED
        { where: { id: caseDetailId }, transaction }
      );

      // GET ONE ACTIVITY THAT HAS ADVANCE AMOUNT PAID AGAINST THE CASE
      const advancePaidDealerActivityTransaction =
        await ActivityTransactions.findOne({
          attributes: ["id", "paidByDealerId"],
          where: {
            paymentTypeId: 170, //ADVANCE
            transactionTypeId: 181, //DEBIT
            paymentStatusId: 191, //SUCCESS
          },
          include: [
            {
              model: Activities,
              attributes: [],
              required: true,
              where: {
                caseDetailId: caseDetailId,
              },
            },
          ],
        });

      // SEND CASE CLOSE FCM PUSH NOTIFICATION
      //VDM
      if (caseDetailExist.dataValues.typeId == 32) {
        notificationController.sendNotification({
          caseDetailId: caseDetailId,
          notifyToAll: [""],
          templateId: 41,
          agentName: getAgentDetail.data.user.name,
          paidByDealerDetail: advancePaidDealerActivityTransaction
            ? advancePaidDealerActivityTransaction.dataValues.paidByDealerId
            : "",
        });
      } else {
        //CRM
        notificationController.sendNotification({
          caseDetailId: caseDetailId,
          notifyToAll: [""],
          templateId: 31,
          agentName: getAgentDetail.data.user.name,
          notificationType: "CRM",
        });
      }

      await Promise.all([
        //SAVE ACTIVITY LOG
        ActivityLogs.create(
          {
            caseDetailId: caseDetailId,
            typeId: 240, //WEB
            // title: `The agent "${getAgentDetail.data.user.name}" has closed the request.`,
            title: `The ${authUserData.role.name} "${authUserData.name}" has closed the request.`,
          },
          { transaction }
        ),
      ]);

      //UPDATE CASE IN ELK - CRM CASE
      if (caseDetailExist.dataValues.typeId == 31) {
        const caseInfo: any = (caseDetailExist as any).caseInformation;
        updateCaseInElk({
          caseId: caseDetailExist.dataValues.id,
          statusId: 4, //CLOSED

          caseNumber: caseDetailExist.dataValues.caseNumber,
          subject: caseDetailExist.dataValues.subjectID,
          status: 4, //CLOSED
          customerContactName: caseInfo ? caseInfo.customerContactName : null,
          customerMobileNumber: caseInfo ? caseInfo.customerMobileNumber : null,
          breakdownLocation: caseInfo ? caseInfo.breakdownLocation : null,
          clientId: caseDetailExist.dataValues.clientId,
          vehicleNumber: caseDetailExist.dataValues.registrationNumber,
          vin: caseDetailExist.dataValues.vin,
          irateCustomer: caseInfo.irateCustomer ? "Yes" : "No",
          dropLocation: caseInfo ? caseInfo.dropLocation : null,
          callCenter: caseDetailExist.dataValues.callCenterId,
          agent: caseDetailExist.dataValues.agentId,
          rmName: caseDetailExist.dataValues.rmId,
          womenAssist: caseInfo.womenAssist ? "Yes" : "No",
          policyType: caseInfo ? caseInfo.policyTypeId : null,
          policyNumber: caseInfo ? caseInfo.policyNumber : null,
          policyStartDate: caseInfo ? caseInfo.policyStartDate : null,
          policyEndDate: caseInfo ? caseInfo.policyEndDate : null,
        });

        // update agent in user login
        axios.put(`${userServiceUrl}/${userServiceEndpoint.updateUserLogin}`, {
          userId: caseDetailExist.dataValues.agentId,
          pendingCaseCount: -1,
          successCasesCount: 1,
        });
      }

      await transaction.commit();

      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      await Utils.releaseCaseProcessingLock(caseDetailId);

      //EXPIRY SERVICE PROVIDER TRACK LINK ONCE CASE CLOSE FOR CRM CASE
      if (caseDetailExist.dataValues.typeId == 31) {
        expiryServiceProviderTrackLink(caseDetailExist.dataValues.id);
      }

      //IF case close then sync asp auto allocated details for crm report.
      const aspAutoAllocatedActivities: any = await Activities.findAll({
        attributes: ["id"],
        where: {
          caseDetailId: caseDetailId,
          isAspAutoAllocated: 1,
        },
      });

      if (
        caseDetailExist.dataValues.typeId == 31 &&
        aspAutoAllocatedActivities.length > 0
      ) {
        const aspAutoAllocatedActivityIds = aspAutoAllocatedActivities.map(
          (aspAutoAllocatedActivity: any) => aspAutoAllocatedActivity.id
        );

        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          aspAutoAllocatedActivityIds
        );
      }

      // Sync client report details, client report with mobile number details
      if (caseDetailExist.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (caseDetailExist.dataValues.typeId == 31) {
        // Get all activities for the case
        const allActivities: any = await Activities.findAll({
          attributes: ["id"],
          where: {
            caseDetailId: caseDetailId,
          },
        });

        if (allActivities.length > 0) {
          const activityIds = allActivities.map((activity: any) => activity.id);

          Utils.createReportSyncTableRecord(
            ["financialReportDetails", "activityReportDetails"],
            activityIds
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Case closed successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    } finally {
      // UPDATE IS ACTIVITY PROCESSING AS FALSE IN CASE DETAILS
      try {
        await Utils.releaseCaseProcessingLock(caseDetailId);
      } catch (err: any) {
        console.error(
          "Error releasing isActivityProcessing in Case Close finally",
          err
        );
      }
    }
  }

  export async function caseCancelled(req: Request, res: Response) {
    try {
      const { caseDetailId, authUserId, cancelReasonId } = req.body;
      const getAuthUserDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: authUserId,
        }
      );
      if (!getAuthUserDetail.data.success) {
        return res.status(200).json({
          success: false,
          error: "User not found",
        });
      }
      const caseDetailExist = await CaseDetails.findOne({
        where: {
          [Op.and]: [
            { id: caseDetailId },
            {
              statusId: {
                [Op.in]: [1, 2], //1-Open,2-Inprogress
              },
            },
          ],
        },
        attributes: [
          "id",
          "agentId",
          "rmId",
          "caseNumber",
          "typeId",
          "clientId",
          "registrationNumber",
          "subjectID",
          "callCenterId",
          "statusId",
        ],
        include: {
          model: CaseInformation,
          attributes: [
            "id",
            "customerMobileNumber",
            "dropLocation",
            "irateCustomer",
            "womenAssist",
            "policyTypeId",
            "policyNumber",
            "policyStartDate",
            "policyEndDate",
          ],
          required: false,
        },
      });

      if (!caseDetailExist) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      // if (caseDetailExist.dataValues.typeId == 31) {
      //   //RSA
      //   const authUserPermissions = getAuthUserDetail.data.user.permissions;
      //   if (!Utils.hasPermission(authUserPermissions, "case-cancel-web")) {
      //     return res.status(200).json({
      //       success: false,
      //       error: "Permission not found",
      //     });
      //   }
      // }

      // GET Agent DETAILS
      if (caseDetailExist.dataValues.agentId) {
        const getAgentDetail = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUser}`,
          {
            id: caseDetailExist.dataValues.agentId,
          }
        );
        if (!getAgentDetail.data.success) {
          return res.status(200).json({
            success: false,
            error: "Agent not found",
          });
        }
      }

      const cancelUpdateData: any = {
        statusId: 3,
        cancelReasonId: cancelReasonId,
        cancelDate: new Date(),
      };
      if (req.body.cancelRemarks) {
        cancelUpdateData.cancelRemarks = req.body.cancelRemarks;
      }
      await CaseDetails.update(
        cancelUpdateData, //CANCELLED
        { where: { id: caseDetailId } }
      );

      // GET ONE ACTIVITY THAT HAS ADVANCE AMOUNT PAID AGAINST THE CASE
      const advancePaidDealerActivityTransaction =
        await ActivityTransactions.findOne({
          attributes: ["id", "paidByDealerId"],
          where: {
            paymentTypeId: 170, //ADVANCE
            transactionTypeId: 181, //DEBIT
            paymentStatusId: 191, //SUCCESS
          },
          include: [
            {
              model: Activities,
              attributes: [],
              required: true,
              where: {
                caseDetailId: caseDetailId,
              },
            },
          ],
        });

      let activityLogTitle = null;
      //VDM
      if (caseDetailExist.dataValues.typeId == 32) {
        //FCM PUSH NOTIFICATIONS
        let details: any = {
          caseDetailId: caseDetailId,
          notifyToAll: [""],
          paidByDealerDetail: advancePaidDealerActivityTransaction
            ? advancePaidDealerActivityTransaction.dataValues.paidByDealerId
            : "",
        };

        if (getAuthUserDetail.data.user.roleId == 2) {
          details.templateId = 44;
          details.caseCanceledDealerName = getAuthUserDetail.data.user.name;
          //DEALER
          activityLogTitle = `The dealer "${getAuthUserDetail.data.user.name}" has cancelled the request.`;
        } else if (getAuthUserDetail.data.user.roleId == 3) {
          details.templateId = 42;
          details.agentName = getAuthUserDetail.data.user.name;

          //AGENT
          activityLogTitle = `The agent "${getAuthUserDetail.data.user.name}" has cancelled the request.`;
        }
        //FCM PUSH NOTIFICATIONS
        notificationController.sendNotification(details);
      } else {
        //CRM
        // if (getAuthUserDetail.data.user.roleId == 3) {
        //   //AGENT
        //   activityLogTitle = `The agent "${getAuthUserDetail.data.user.name}" has cancelled the request.`;
        // }

        activityLogTitle = `The ${getAuthUserDetail.data.user.role.name} "${getAuthUserDetail.data.user.name}" has cancelled the request.`;
      }

      //SAVE ACTIVITY LOG
      await ActivityLogs.create({
        caseDetailId: caseDetailId,
        typeId: 240, //WEB
        title: activityLogTitle,
      });

      //UPDATE CASE IN ELK - CRM CASE
      if (caseDetailExist.dataValues.typeId == 31) {
        const caseInfo: any = (caseDetailExist as any).caseInformation;
        updateCaseInElk({
          caseId: caseDetailExist.dataValues.id,
          statusId: 3, //Cancelled
          caseNumber: caseDetailExist.dataValues.caseNumber,
          subject: caseDetailExist.dataValues.subjectID,
          status: 3,
          customerContactName: caseInfo ? caseInfo.customerContactName : null,
          customerMobileNumber: caseInfo ? caseInfo.customerMobileNumber : null,
          breakdownLocation: caseInfo ? caseInfo.breakdownLocation : null,
          clientId: caseDetailExist.dataValues.clientId,
          vehicleNumber: caseDetailExist.dataValues.registrationNumber,
          vin: caseDetailExist.dataValues.vin,
          irateCustomer: caseInfo.irateCustomer ? "Yes" : "No",
          dropLocation: caseInfo ? caseInfo.dropLocation : null,
          callCenter: caseDetailExist.dataValues.callCenterId,
          agent: caseDetailExist.dataValues.agentId,
          rmName: caseDetailExist.dataValues.rmId,
          womenAssist: caseInfo.womenAssist ? "Yes" : "No",
          policyType: caseInfo ? caseInfo.policyTypeId : null,
          policyNumber: caseInfo ? caseInfo.policyNumber : null,
          policyStartDate: caseInfo ? caseInfo.policyStartDate : null,
          policyEndDate: caseInfo ? caseInfo.policyEndDate : null,
        });

        // update agent in user login
        axios.put(`${userServiceUrl}/${userServiceEndpoint.updateUserLogin}`, {
          userId: caseDetailExist.dataValues.agentId,
          pendingCaseCount: -1,
          cancelledCaseCount: 1,
        });
      }

      //Need to check only isuzu client cases will receive this SMS - CRM CASE
      if (caseDetailExist.dataValues.typeId == 31) {
        caseCancelAutoEscalation(caseDetailExist, authUserId);
      }

      //IF case cancel then sync asp auto allocated details for crm report.
      const aspAutoAllocatedActivities: any = await Activities.findAll({
        attributes: ["id"],
        where: {
          caseDetailId: caseDetailId,
          isAspAutoAllocated: 1,
        },
      });

      if (
        caseDetailExist.dataValues.typeId == 31 &&
        aspAutoAllocatedActivities.length > 0
      ) {
        const aspAutoAllocatedActivityIds = aspAutoAllocatedActivities.map(
          (aspAutoAllocatedActivity: any) => aspAutoAllocatedActivity.id
        );

        Utils.createReportSyncTableRecord(
          "autoAllocatedAspReportDetails",
          aspAutoAllocatedActivityIds
        );
      }

      // Sync client report details, client report with mobile number details
      if (caseDetailExist.dataValues.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (caseDetailExist.dataValues.typeId == 31) {
        // Get all activities for the case
        const allActivities: any = await Activities.findAll({
          attributes: ["id"],
          where: {
            caseDetailId: caseDetailId,
          },
        });

        if (allActivities.length > 0) {
          const activityIds = allActivities.map((activity: any) => activity.id);

          Utils.createReportSyncTableRecord(
            ["financialReportDetails", "activityReportDetails"],
            activityIds
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Case cancelled successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function handleUploadAdditionalCharge(
    req: Request,
    res: Response
  ) {
    try {
      const inData = req.validBody;

      const activityExist = await Activities.findOne({
        attributes: ["id"],
        where: {
          id: inData.activityId,
          activityStatusId: {
            [Op.in]: [3], // 3-In Progress
          },
        },
        include: {
          model: CaseDetails,
          where: {
            statusId: 2, //In Progress
          },
          attributes: ["id"],
          required: true,
        },
      });
      if (!activityExist) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }
      if (inData.files.length > 0) {
        const batchInsertions = [];
        for (const file of inData.files) {
          batchInsertions.push({
            activityId: inData.activityId,
            chargeId: inData.chargeId,
            fileName: file.filename,
            originalName: file.originalname,
          });
        }
        await ActivityChargeAttachments.bulkCreate(batchInsertions);
      }

      return res.status(200).json({
        success: true,
        message: "Attachments uploaded successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateDeliveryRequestPickupDateAndTime(
    req: Request,
    res: Response
  ) {
    try {
      const inData = req.validBody;

      const caseDetail: any = await CaseDetails.findOne({
        attributes: ["id", "dealerId", "agentId"],
        where: {
          id: inData.caseDetailId,
          statusId: {
            [Op.in]: [1, 2], //OPEN || INPROGRESS
          },
        },
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: caseDetail.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      // CHECK PICKUP TIME ALREADY SCHEDULED FOR THE PICKUP DEALER (DISABLED NOW)
      // const pickupTimeAlreadyScheduled = await CaseDetails.findOne({
      //   where: {
      //     id: {
      //       [Op.ne]: inData.caseDetailId, //EXCEPT THIS CASE
      //     },
      //     statusId: {
      //       [Op.ne]: 3, //EXCEPT CANCELLED
      //     },
      //     dealerId: caseDetail.dataValues.dealerId,
      //     deliveryRequestPickupDate: inData.deliveryRequestPickupDate,
      //     deliveryRequestPickupTime: inData.deliveryRequestPickupTime,
      //   },
      // });

      // if (pickupTimeAlreadyScheduled) {
      //   return res.status(200).json({
      //     success: false,
      //     error:
      //       "The selected pickup date & time has already been scheduled. Kindly select an alternative date & time.",
      //   });
      // }

      const updateData = {
        deliveryRequestPickupDate: inData.deliveryRequestPickupDate,
        deliveryRequestPickupTime: inData.deliveryRequestPickupTime,
      };

      await CaseDetails.update(updateData, {
        where: {
          id: inData.caseDetailId,
        },
      });

      //SAVE ACTIVITY LOG
      await ActivityLogs.create({
        caseDetailId: inData.caseDetailId,
        typeId: 240, //WEB
        title: `The agent "${getAgentDetail.data.user.name}" has updated the delivery request pickup date and time.`,
      });

      // FCM PUSH NOTIFICATIONS
      const details = {
        caseDetailId: inData.caseDetailId,
        templateId: 3,
        notifyToAll: [""],
        agentName: getAgentDetail.data.user.name,
      };

      notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc

      return res.status(200).json({
        success: true,
        message: "The pickup date and time updated successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function addInteraction(req: Request, res: Response) {
    try {
      const inData = req.validBody;
      let caseTypeId: any = null;

      // If caseDetailId is provided (from Header), validate case exists
      if (inData.caseDetailId) {
        const caseExists: any = await CaseDetails.findOne({
          where: { id: inData.caseDetailId },
          attributes: ["id", "typeId"],
        });
        if (!caseExists) {
          return res.status(200).json({
            success: false,
            error: "Case not found",
          });
        }
        // Set activityId to null when called from Header
        inData.activityId = null;

        caseTypeId = caseExists.dataValues.typeId;
      } else if (inData.activityId) {
        // If activityId is provided (from ServiceTab), validate activity exists
        const activityExists: any = await Activities.findOne({
          where: { id: inData.activityId },
          attributes: ["id", "caseDetailId"],
          include: {
            model: CaseDetails,
            required: true,
            attributes: ["id", "typeId"],
          },
        });
        if (!activityExists) {
          return res.status(200).json({
            success: false,
            error: "Activity not found",
          });
        }
        // Set caseDetailId from activity's case relationship
        inData.caseDetailId = activityExists.caseDetailId;

        caseTypeId = activityExists.caseDetail.dataValues.typeId;
      }

      // if (caseTypeId == 31) {
      //   //RSA
      //   const authUserPermissions = inData.authUserData.permissions;

      //   if (
      //     !Utils.hasPermission(authUserPermissions, "activity-add-interaction")
      //   ) {
      //     return res.status(200).json({
      //       success: false,
      //       error: "Permission not found",
      //     });
      //   }
      // }

      // Create activity log with interaction details (similar to customer feedback)
      const descriptionParts: string[] = [];

      // Fetch master details in a single API call (order matches form: Channel, To, Call Type)
      const masterDetailsPayload: any = {};
      if (inData.channelId) {
        masterDetailsPayload.getChannelsWithoutValidation = [inData.channelId];
      }
      if (inData.toId) {
        masterDetailsPayload.getTosWithoutValidation = [inData.toId];
      }
      if (inData.callTypeId) {
        masterDetailsPayload.getCallTypesWithoutValidation = [inData.callTypeId];
      }

      let masterDetailsResponse: any = null;
      if (Object.keys(masterDetailsPayload).length > 0) {
        try {
          masterDetailsResponse = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            masterDetailsPayload
          );
        } catch (error: any) {
          // If master details fetch fails, continue without them
        }
      }

      // 1. Channel (order matches form)
      if (masterDetailsResponse?.data?.success && masterDetailsResponse.data.data?.channelsWithoutValidation?.length > 0) {
        const channelName = masterDetailsResponse.data.data.channelsWithoutValidation[0].name;
        descriptionParts.push(
          `Channel: <span style="color:#999">${channelName}</span>`
        );
      }

      // 2. To (order matches form)
      if (masterDetailsResponse?.data?.success && masterDetailsResponse.data.data?.tosWithoutValidation?.length > 0) {
        const toName = masterDetailsResponse.data.data.tosWithoutValidation[0].name;
        descriptionParts.push(
          `To: <span style="color:#999">${toName}</span>`
        );
      }

      // 3. Call Type (order matches form)
      if (masterDetailsResponse?.data?.success && masterDetailsResponse.data.data?.callTypesWithoutValidation?.length > 0) {
        const callTypeName = masterDetailsResponse.data.data.callTypesWithoutValidation[0].name;
        descriptionParts.push(
          `Call Type: <span style="color:#999">${callTypeName}</span>`
        );
      }

      // 4. Subject (order matches form)
      if (inData.title) {
        descriptionParts.push(
          `Subject: <span style="color:#999">${inData.title}</span>`
        );
      }

      // 5. Description (order matches form)
      if (inData.description) {
        descriptionParts.push(
          `Description: <span style="color:#999">${inData.description}</span>`
        );
      }

      // 6. Created By (User who added the interaction)
      const authUserData = inData.authUserData;
      if (authUserData?.name) {
        descriptionParts.push(
          `Created By: <span style="color:#999">${authUserData.name}</span>`
        );
      }

      const createdInteraction = await ActivityLogs.create({
        caseDetailId: inData.caseDetailId,
        activityId: inData.activityId || null,
        typeId: 242, // INTERACTION
        channelId: inData.channelId,
        toId: inData.toId,
        callTypeId: inData.callTypeId,
        title: "Interaction Added",
        description: descriptionParts.join('<br />'),
        createdById: inData.createdById,
      });

      //If interaction created then sync this details for crm comments data report.
      if (caseTypeId == 31) {
        Utils.createReportSyncTableRecord("commentsDataReportDetails", [
          createdInteraction.dataValues.id,
        ]);
      }

      return res.status(200).json({
        success: true,
        message: "Interaction added successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //QUICK SEARCH
  export async function getCaseList(req: any, res: any) {
    try {
      const {
        limit,
        offset,
        vehicleOrVinNumber,
        policyNumber,
        caseId,
        mobileNo,
      } = req.query;
      let limitValue: number = defaultLimit;
      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }
      let offsetValue: number = defaultOffset;
      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }
      const whereCaseDetail: any = {};
      const whereCaseInfo: any = {};
      if (vehicleOrVinNumber) {
        whereCaseDetail[Op.or] = [
          { vin: { [Op.like]: `%${vehicleOrVinNumber}%` } },
          { registrationNumber: { [Op.like]: `%${vehicleOrVinNumber}%` } },
        ];
      }
      if (policyNumber) {
        whereCaseInfo.policyNumber = { [Op.like]: `%${policyNumber}%` };
      }
      if (caseId) {
        whereCaseDetail.caseNumber = { [Op.like]: `%${caseId}%` };
      }
      if (mobileNo) {
        whereCaseInfo.customerCurrentMobileNumber = {
          [Op.like]: `%${mobileNo}%`,
        };
      }
      const caseList = await CaseDetails.findAll({
        where: whereCaseDetail,
        attributes: [
          "caseNumber",
          "registrationNumber",
          "vin",
          "subjectID",
          "statusId",
        ],
        order: [["id", "asc"]],
        limit: limitValue,
        offset: offsetValue,
        include: [
          {
            model: CaseInformation,
            attributes: [
              "customerContactName",
              "customerCurrentContactName",
              "customerCurrentMobileNumber",
              "breakdownLocation",
            ],
            where: whereCaseInfo,
            required: true,
          },
        ],
      });
      if (caseList.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
  // Search Cases for Interaction Form
  export async function searchCasesForInteraction(req: any, res: any) {
    try {
      const { searchKey, levelId, userId, authUserRoleId } = req.query;

      if (!searchKey || searchKey.trim() === "") {
        return res.status(200).json({
          success: true,
          message: "Data Fetched Successfully",
          data: [],
        });
      }

      const whereCaseDetail: any = {
        caseNumber: { [Op.like]: `%${searchKey}%` },
        statusId: { [Op.ne]: 4 }, // Exclude closed cases
      };

      // Filter cases based on agent levelId - Only apply if user is agent (authUserRoleId === 3)
      if (authUserRoleId && parseInt(authUserRoleId) === 3 && levelId && userId) {
        const levelIdNum = parseInt(levelId);
        const userIdNum = parseInt(userId);

        if (levelIdNum == 1045) {
          //L1 AGENT
          whereCaseDetail.l1AgentId = userIdNum;
        } else if (levelIdNum == 1046) {
          //L2 AGENT
          whereCaseDetail.agentId = userIdNum;
        } else if (levelIdNum == 1047) {
          //L1 & L2 AGENT
          whereCaseDetail[Op.or] = [
            {
              l1AgentId: userIdNum,
            },
            {
              agentId: userIdNum,
            },
          ];
        }
      }

      const caseList = await CaseDetails.findAll({
        where: whereCaseDetail,
        attributes: ["id", "caseNumber"],
        order: [["id", "desc"]],
        limit: 20,
      });

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getCaseInformation(req: any, res: any) {
    try {
      const payload = req.body;
      const caseDetail: any = await CaseDetails.findOne({
        where: { id: payload.caseId, typeId: 31 },
        attributes: [
          "id",
          "caseNumber",
          "l1AgentId",
          "agentId",
          "callCenterId",
          "registrationNumber",
          "vin",
          "clientId",
          "subjectID",
          "vehicleTypeId",
          "vehicleMakeId",
          "vehicleModelId",
          "statusId",
          "createdAt",
          "psfStatus",
          "isCustomerInvoiced",
          "customerInvoiceNumber",
          "customerInvoiceDate",
          "customerInvoicePath",
          "isCancellationInvoiced",
          "cancellationInvoiceNumber",
          "cancellationInvoiceDate",
          "cancellationInvoicePath",
        ],
        include: [
          {
            model: Activities,
            attributes: ["id", "activityStatusId", "aspActivityStatusId"],
            required: false,
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id", "serviceId", "subServiceId", "aspId"],
                required: false,
              },
            ],
          },
          {
            model: CaseInformation,
          },
        ],
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      //POLICY INTERESTED CUSTOMER
      const policyInterestedCustomer: any =
        await PolicyInterestedCustomers.findOne({
          where: {
            caseDetailId: caseDetail.dataValues.id,
          },
          attributes: ["id"],
        });
      caseDetail.dataValues.policyInterestedCustomer = policyInterestedCustomer
        ? true
        : false;

      const accidentalAttachments: any = await attachments.findAll({
        where: {
          attachmentTypeId: 82,
          attachmentOfId: 101,
          entityId: caseDetail.dataValues.id,
        },
        attributes: ["id", "fileName", "originalName"],
      });

      for (const accidentalAttachment of accidentalAttachments) {
        accidentalAttachment.dataValues.filePath = `${process.env.API_GATEWAY_URL}uploads/${accidentalAttachment.fileName}`;
      }
      caseDetail.dataValues.accidentalAttachments = accidentalAttachments;

      //ACCIDENTAL DOCUMENT LINK
      caseDetail.dataValues.accidentalDocumentLink = null;
      if (
        caseDetail.caseInformation &&
        caseDetail.caseInformation.accidentalDocLinkId
      ) {
        caseDetail.dataValues.accidentalDocumentLink = await links.findOne({
          where: {
            id: caseDetail.caseInformation.accidentalDocLinkId,
          },
        });
      }

      //ACTIVITY LOGS
      let activityIds = [];
      if (caseDetail.activities.length > 0) {
        activityIds = caseDetail.activities.map((activity: any) => activity.id);
      }

      const activityLogs: any = await ActivityLogs.findAll({
        where: {
          [Op.or]: [
            { caseDetailId: caseDetail.dataValues.id },
            { activityId: activityIds },
          ],
        },
        attributes: {
          exclude: ["updatedById", "deletedById", "updatedAt", "deletedAt"],
        },
        order: [["id", "ASC"]],
      });

      caseDetail.dataValues.activityLogs = activityLogs;

      //BREAK DOWN VEHICLE IMAGES
      let breakdownVehicleAttachments = null;
      if (caseDetail.caseInformation.locationLogId) {
        breakdownVehicleAttachments = await attachments.findAll({
          where: {
            attachmentTypeId: 605, //Breakdown Vehicle Image
            attachmentOfId: 104, //Location Log
            entityId: caseDetail.caseInformation.locationLogId,
          },
          attributes: ["id", "fileName", "originalName"],
        });
        for (const breakdownVehicleAttachment of breakdownVehicleAttachments) {
          breakdownVehicleAttachment.dataValues.filePath = `${process.env.API_GATEWAY_URL}uploads/${breakdownVehicleAttachment.dataValues.fileName}`;
        }
      }
      caseDetail.dataValues.breakdownVehicleAttachments =
        breakdownVehicleAttachments;
      caseDetail.dataValues.positiveActivityExists =
        await Utils.positiveActivityExists(caseDetail.dataValues.id);

      // Check if any activity has reached breakdown location
      // Exclude cancelled (4) and rejected (8) activities
      const hasReachedBreakdown: any = await Activities.findOne({
        where: {
          caseDetailId: caseDetail.dataValues.id,
          activityStatusId: {
            [Op.notIn]: [4, 8], // Exclude Cancelled and Rejected
          },
          aspReachedToBreakdownAt: { [Op.ne]: null },
        },
        attributes: ["id"],
      });
      caseDetail.dataValues.hasReachedBreakdown = hasReachedBreakdown
        ? true
        : false;

      // Get last positive activity for mechanical (serviceId=2) or towing (serviceId=1) services
      const lastPositiveActivity: any = await Activities.findOne({
        where: {
          caseDetailId: caseDetail.dataValues.id,
          activityStatusId: {
            [Op.notIn]: [4, 5, 8], // Exclude Cancelled, Failure, Rejected
          },
        },
        attributes: [
          "id",
          "aspReachedToBreakdownAt",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "createdAt",
        ],
        include: [
          {
            model: ActivityAspDetails,
            attributes: ["id", "serviceId"],
            required: true,
            where: {
              serviceId: {
                [Op.in]: [1, 2], // Towing (1) or Mechanical (2)
              },
            },
          },
        ],
        order: [["id", "DESC"]],
        limit: 1,
      });

      // Calculate breakdown reach time SLA
      // If positive activity found, use it; otherwise use case createdAt
      caseDetail.dataValues.breakdownReachTimeSLA = null;
      if (lastPositiveActivity) {
        const breakdownReachTimeSLA = await calculateBreakdownReachTimeSLA(
          caseDetail,
          lastPositiveActivity
        );
        caseDetail.dataValues.breakdownReachTimeSLA = breakdownReachTimeSLA;
      } else {
        // When no positive activity found, use case createdAt as comparison time
        // Create a minimal activity object for calculateBreakdownReachTimeSLA
        const fallbackActivity = {
          id: null,
          aspReachedToBreakdownAt: null,
          isInitiallyCreated: false,
          isImmediateService: false,
          serviceInitiatingAt: null,
          createdAt: caseDetail.dataValues.createdAt,
        };
        const breakdownReachTimeSLA = await calculateBreakdownReachTimeSLA(
          caseDetail,
          fallbackActivity
        );
        caseDetail.dataValues.breakdownReachTimeSLA = breakdownReachTimeSLA;
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseDetail,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
  export async function getVehicleList(req: any, res: any) {
    try {
      const {
        limit,
        offset,
        vehicleOrVinNumber,
        policyNumber,
        caseId,
        mobileNo,
      } = req.query;
      let limitValue: number = defaultLimit;
      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }
      let offsetValue: number = defaultOffset;
      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }
      const whereCaseDetail: any = {};
      const whereCaseInfo: any = {};
      if (vehicleOrVinNumber) {
        whereCaseDetail[Op.or] = [
          { vin: { [Op.like]: `%${vehicleOrVinNumber}%` } },
          { registrationNumber: { [Op.like]: `%${vehicleOrVinNumber}%` } },
        ];
      }

      if (policyNumber) {
        whereCaseInfo.policyNumber = { [Op.like]: `%${policyNumber}%` };
      }

      if (caseId) {
        whereCaseDetail.caseNumber = { [Op.like]: `%${caseId}%` };
      }

      if (mobileNo) {
        whereCaseInfo.customerCurrentMobileNumber = {
          [Op.like]: `%${mobileNo}%`,
        };
      }
      const vehicleList = await CaseDetails.findAll({
        where: whereCaseDetail,
        attributes: ["registrationNumber", "vin"],
        order: [["id", "asc"]],
        limit: limitValue,
        offset: offsetValue,
        include: [
          {
            model: CaseInformation,
            attributes: [
              "policyNumber",
              "customerContactName",
              "runningKm",
              "serviceEligibility",
              "policyEndDate",
            ],
            where: whereCaseInfo,
            required: true,
          },
        ],
      });
      if (vehicleList.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
      const transformedData = vehicleList.map((vehicle: any) => {
        const caseInformation = vehicle.caseInformations[0] || {};
        return {
          vehicleNo: vehicle.registrationNumber,
          vin: vehicle.vin,
          policyNumber: caseInformation.policyNumber,
          currentContactName: caseInformation.customerContactName,
          runKm: caseInformation.runningKm,
          serviceEligibility: caseInformation.serviceEligibility,
          policyEndDate: caseInformation.policyEndDate
            ? moment
              .tz(caseInformation.policyEndDate, "Asia/Kolkata")
              .format("DD/MM/YYYY")
            : null,
        };
      });
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: transformedData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //RSA CASE LIST
  export async function caseListForCrm(req: Request, res: Response) {
    try {
      const { limit, offset, search, startDate, endDate, ...inputData } =
        req.body;
      const userPermissions = inputData.authUserData.permissions;

      const caseStatusId = parseInt(inputData.caseStatusId as string);
      const psfStatus = inputData.psfStatus
        ? parseInt(inputData.psfStatus as string)
        : null;
      const userId = inputData.userId
        ? parseInt(inputData.userId as string)
        : null;
      const roleId = parseInt(inputData.roleId as string);

      //USER ID REQUIRED EXCEPT SUPER ADMIN ROLE AND NATIONAL HEAD ROLE.
      if (!userId && roleId != 1 && roleId != 15) {
        return res.status(200).json({
          success: false,
          error: "User ID is required",
        });
      }

      // Set default values if parameters are not provided or are invalid
      let where: any = {};
      let roleCityIds = [];
      const caseDetailWhere: any = {};
      caseDetailWhere.typeId = 31; //RSA

      if (caseStatusId) {
        caseDetailWhere.statusId = caseStatusId;
      }

      if (psfStatus) {
        caseDetailWhere.psfStatus = psfStatus;
      }

      if (
        Utils.hasPermission(userPermissions, "case-list-agent-view-own-web")
      ) {
        if (!userId) {
          return res.status(200).json({
            success: false,
            error: "User ID is required",
          });
        }

        if (!inputData.levelId) {
          return res.status(200).json({
            success: false,
            error: "User Level ID is required",
          });
        }

        if (inputData.levelId == 1045) {
          //L1 AGENT
          where = {
            "$caseDetail.l1AgentId$": userId,
          };
        } else if (inputData.levelId == 1046) {
          //L2 AGENT
          where = {
            "$caseDetail.agentId$": userId,
          };
        } else if (inputData.levelId == 1047) {
          //L1 & L2 AGENT
          where[Op.or] = [
            {
              "$caseDetail.l1AgentId$": userId,
            },
            {
              "$caseDetail.agentId$": userId,
            },
          ];
        }
      } else if (
        userId &&
        (Utils.hasPermission(userPermissions, "case-list-bo-head-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "case-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-service-head-own-web"
          ))
      ) {
        //If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
        const apiParams: any = {};
        if (Utils.hasPermission(userPermissions, "case-list-bo-head-own-web")) {
          //BO head
          apiParams.where = {
            boHeadId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "case-list-network-head-own-web")
        ) {
          //Network head
          apiParams.where = {
            networkHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "case-list-customer-experience-head-own-web"
          )
        ) {
          //Customer Experience Head
          apiParams.where = {
            customerExperienceHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "case-list-command-centre-head-own-web"
          )
        ) {
          //Command Centre Head
          apiParams.where = {
            commandCentreHeadId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "case-list-service-head-own-web")
        ) {
          //Service Head
          apiParams.where = {
            serviceHeadId: userId,
          };
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCitiesByRole}`,
          apiParams
        );

        for (const cityMasterDetail of masterDetailResponse?.data?.data) {
          if (
            inputData.breakdownAreaStateIds?.length > 0 &&
            inputData.breakdownLocationCategoryIds?.length > 0
          ) {
            if (
              inputData.breakdownAreaStateIds.includes(
                cityMasterDetail.stateId
              ) &&
              inputData.breakdownLocationCategoryIds.includes(
                cityMasterDetail.locationCategoryId
              )
            ) {
              roleCityIds.push(cityMasterDetail.id);
            }
          } else if (inputData.breakdownAreaStateIds?.length > 0) {
            if (
              inputData.breakdownAreaStateIds.includes(cityMasterDetail.stateId)
            ) {
              roleCityIds.push(cityMasterDetail.id);
            }
          } else if (inputData.breakdownLocationCategoryIds?.length > 0) {
            if (
              inputData.breakdownLocationCategoryIds.includes(
                cityMasterDetail.locationCategoryId
              )
            ) {
              roleCityIds.push(cityMasterDetail.id);
            }
          } else {
            roleCityIds.push(cityMasterDetail.id);
          }
        }
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "case-list-call-centre-manager-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-head-own-web"
          )) &&
        userId
      ) {
        //If call centre manager (or ) call centre head role then. Get cases by its call centres
        const apiParams: any = {};
        apiParams.userId = userId;
        if (
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-head-own-web"
          )
        ) {
          //Call centre head
          apiParams.type = 1;
        }

        if (
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-manager-own-web"
          )
        ) {
          //Call centre manager
          apiParams.type = 2;
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCallCentersByRole}`,
          apiParams
        );

        let callCenterIds = [];
        if (masterDetailResponse.data.success) {
          callCenterIds = masterDetailResponse.data.data.map(
            (callCenterDetail: any) => {
              return callCenterDetail.id;
            }
          );
        }

        where = {
          "$caseDetail.callCenterId$": {
            [Op.in]: callCenterIds,
          },
        };
      } else if (
        Utils.hasPermission(userPermissions, "case-list-tvs-spoc-own-web") &&
        userId
      ) {
        //If tvs spoc role then. Get cases by its clients.
        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getClientsByRole}`,
          {
            where: {
              spocUserId: userId,
            },
          }
        );

        let clientIds = [];
        if (masterDetailResponse.data.success) {
          clientIds = masterDetailResponse.data.data.map(
            (clientDetail: any) => {
              return clientDetail.id;
            }
          );
        }

        where = {
          "$caseDetail.clientId$": {
            [Op.in]: clientIds,
          },
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "case-list-team-leader-agents-own-web"
        ) ||
          Utils.hasPermission(userPermissions, "case-list-sme-own-web")) &&
        userId
      ) {
        //If team leader (or) sme role then. Get cases by its agents
        const apiParams: any = {};
        apiParams.roleId = 3; //Agent
        if (
          Utils.hasPermission(
            userPermissions,
            "case-list-team-leader-agents-own-web"
          )
        ) {
          //Team leader
          apiParams.where = {
            tlId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "case-list-sme-own-web")
        ) {
          //SME
          apiParams.where = {
            smeUserId: userId,
          };
        }

        const agentDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
          apiParams
        );

        let agentIds = [];
        if (agentDetails.data.success) {
          agentIds = agentDetails.data.data.map((agentDetail: any) => {
            return agentDetail.id;
          });
        }

        where = {
          "$caseDetail.createdById$": {
            [Op.in]: agentIds,
          },
        };
      }

      if (inputData.serviceIds?.length > 0) {
        where.serviceId = {
          [Op.in]: inputData.serviceIds,
        };
      }

      if (inputData.caseNumber) {
        caseDetailWhere.caseNumber = inputData.caseNumber;
      }

      if (inputData.caseVehicleRegistrationNumber) {
        caseDetailWhere.registrationNumber =
          inputData.caseVehicleRegistrationNumber;
      }

      let filterBreakdownAreaIds: any = [];
      if (
        inputData.caseSubjectNames?.length > 0 ||
        inputData.breakdownAreaStateIds?.length > 0 ||
        inputData.breakdownLocationCategoryIds?.length > 0
      ) {
        const filterDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getCrmListFilterData}`,
          {
            caseSubjectNames: inputData.caseSubjectNames,
            breakdownAreaStateIds: inputData.breakdownAreaStateIds,
            breakdownLocationCategoryIds:
              inputData.breakdownLocationCategoryIds,
          }
        );

        if (filterDataResponse.data.success) {
          let breakdownAreaStateCityIds = [];
          if (inputData.breakdownAreaStateIds?.length > 0) {
            breakdownAreaStateCityIds =
              filterDataResponse.data.data.breakdownAreaStateCityIds;
          }

          let breakdownLocationCategoryCityIds = [];
          if (inputData.breakdownLocationCategoryIds?.length > 0) {
            breakdownLocationCategoryCityIds =
              filterDataResponse.data.data.breakdownLocationCategoryCityIds;
          }

          if (
            (breakdownAreaStateCityIds.length > 0 &&
              breakdownLocationCategoryCityIds.length > 0) ||
            breakdownLocationCategoryCityIds.length > 0
          ) {
            filterBreakdownAreaIds = breakdownLocationCategoryCityIds;
          } else if (breakdownAreaStateCityIds.length > 0) {
            filterBreakdownAreaIds = breakdownAreaStateCityIds;
          }

          if (inputData.caseSubjectNames?.length > 0) {
            caseDetailWhere.subjectID = {
              [Op.in]: filterDataResponse.data.data.caseSubjectIds,
            };
          }
        }
      }

      // If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
      if (roleCityIds.length > 0) {
        if (filterBreakdownAreaIds.length > 0) {
          filterBreakdownAreaIds = roleCityIds.filter((roleCityId: any) => {
            return filterBreakdownAreaIds.includes(roleCityId);
          });
        } else {
          filterBreakdownAreaIds = roleCityIds;
        }
      }

      if (filterBreakdownAreaIds.length > 0) {
        where.breakdownAreaId = {
          [Op.in]: filterBreakdownAreaIds,
        };
      }

      // Limitation value setup
      let limitValue: number = defaultLimit;

      if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = defaultOffset;

      if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      // Check if a search query is provided
      let searchWhereQuery: any = [];
      if (search) {
        const searchLower = search.toLowerCase().trim();

        // Handle PSF status search - if search is exactly "completed" or "not completed", filter only by PSF status
        if (searchLower === "completed") {
          caseDetailWhere.psfStatus = 2;
        } else if (searchLower === "not completed") {
          caseDetailWhere.psfStatus = {
            [Op.or]: [
              { [Op.is]: null },
              { [Op.ne]: 2 },
            ],
          };
        } else {
          // Normal text search - fetch master search data
          const searchDataResponse = await axios.post(
            `${masterService}/${endpointMaster.getCrmListSearchData}`,
            {
              search: search,
            }
          );
          let masterSearchDetails = [];
          if (searchDataResponse?.data?.success) {
            for (const searchDetail of searchDataResponse.data.searchDetails) {
              if (searchDetail.type == "customerType") {
                masterSearchDetails.push({
                  caseTypeId: { [Op.in]: searchDetail.ids },
                });
              } else if (searchDetail.type == "caseSubject") {
                masterSearchDetails.push({
                  "$caseDetail.subjectID$": { [Op.in]: searchDetail.ids },
                });
              } else if (searchDetail.type == "service") {
                masterSearchDetails.push({
                  serviceId: { [Op.in]: searchDetail.ids },
                });
              } else if (searchDetail.type == "policyType") {
                masterSearchDetails.push({
                  policyTypeId: { [Op.in]: searchDetail.ids },
                });
              } else if (searchDetail.type == "channel") {
                masterSearchDetails.push({
                  channelId: { [Op.in]: searchDetail.ids },
                });
              } else if (searchDetail.type == "caseStatus") {
                masterSearchDetails.push({
                  "$caseDetail.statusId$": { [Op.in]: searchDetail.ids },
                });
              }
            }
          }

          searchWhereQuery = [
            {
              "$caseDetail.caseNumber$": { [Op.like]: `%${search}%` },
            },
            {
              "$caseDetail.vin$": { [Op.like]: `%${search}%` },
            },
            {
              "$caseDetail.registrationNumber$": { [Op.like]: `%${search}%` },
            },
            { customerCurrentContactName: { [Op.like]: `%${search}%` } },
            { customerContactName: { [Op.like]: `%${search}%` } },
            { customerCurrentMobileNumber: { [Op.like]: `%${search}%` } },
            { customerMobileNumber: { [Op.like]: `%${search}%` } },
          ];

          if (masterSearchDetails.length > 0) {
            searchWhereQuery.push(...masterSearchDetails);
          }
        }
      }

      // Check if a date query is provided
      let dateFilterQuery: any = [];
      if (startDate && endDate) {
        dateFilterQuery = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      where[Op.and] = [
        searchWhereQuery.length > 0 ? { [Op.or]: searchWhereQuery } : {},
        dateFilterQuery.length > 0 ? { [Op.and]: dateFilterQuery } : {},
      ];

      const caseList = await CaseInformation.findAndCountAll({
        where,
        order: [["id", "desc"]],
        limit: limitValue,
        offset: offsetValue,
        attributes: [
          "id",
          "caseDetailId",
          "customerContactName",
          "customerMobileNumber",
          "customerCurrentContactName",
          "customerCurrentMobileNumber",
          "caseTypeId",
          "accidentTypeId",
          "serviceId",
          "irateCustomer",
          "womenAssist",
          "channelId",
          "policyTypeId",
        ],
        include: [
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "subjectID",
              "vin",
              "registrationNumber",
              "statusId",
              "createdAt",
              "psfStatus",
            ],
            where: caseDetailWhere,
          },
        ],
      });

      if (caseList.count === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //REFUND CASE LIST FOR CRM
  export async function refundCaseListForCrm(req: Request, res: Response) {
    try {
      const { limit, offset, search, startDate, endDate, ...inputData } =
        req.body;
      const userPermissions = inputData.authUserData.permissions;

      const caseStatusId = parseInt(inputData.caseStatusId as string);
      const userId = inputData.userId
        ? parseInt(inputData.userId as string)
        : null;
      const roleId = parseInt(inputData.roleId as string);

      //USER ID REQUIRED EXCEPT SUPER ADMIN ROLE, TEAM LEADER ROLE AND NATIONAL HEAD ROLE.
      if (!userId && roleId != 1 && roleId != 7 && roleId != 15) {
        return res.status(200).json({
          success: false,
          error: "User ID is required",
        });
      }

      // Allow super admin and team leader to access without specific permission checks
      const isSuperAdminOrTeamLeader = roleId == 1 || roleId == 7;

      // Set default values if parameters are not provided or are invalid
      let where: any = {};
      let roleCityIds = [];
      const caseDetailWhere: any = {};
      caseDetailWhere.typeId = 31; //RSA

      if (caseStatusId) {
        caseDetailWhere.statusId = caseStatusId;
      }

      // Permission checks similar to caseListForCrm
      // Super admin and team leader can access without specific permission
      if (
        !isSuperAdminOrTeamLeader &&
        Utils.hasPermission(userPermissions, "refund-cases-list-agent-view-own-web")
      ) {
        if (!userId) {
          return res.status(200).json({
            success: false,
            error: "User ID is required",
          });
        }

        if (!inputData.levelId) {
          return res.status(200).json({
            success: false,
            error: "User Level ID is required",
          });
        }

        if (inputData.levelId == 1045) {
          //L1 AGENT
          where = {
            "$caseDetail.l1AgentId$": userId,
          };
        } else if (inputData.levelId == 1046) {
          //L2 AGENT
          where = {
            "$caseDetail.agentId$": userId,
          };
        } else if (inputData.levelId == 1047) {
          //L1 & L2 AGENT
          where[Op.or] = [
            {
              "$caseDetail.l1AgentId$": userId,
            },
            {
              "$caseDetail.agentId$": userId,
            },
          ];
        }
      } else if (
        (isSuperAdminOrTeamLeader || userId) &&
        (isSuperAdminOrTeamLeader ||
          Utils.hasPermission(userPermissions, "refund-cases-list-bo-head-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-service-head-own-web"
          ))
      ) {
        //If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
        const apiParams: any = {};
        if (isSuperAdminOrTeamLeader) {
          // Super admin or team leader - no city filter needed
        } else if (Utils.hasPermission(userPermissions, "refund-cases-list-bo-head-own-web")) {
          //BO head
          apiParams.where = {
            boHeadId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "refund-cases-list-network-head-own-web")
        ) {
          //Network head
          apiParams.where = {
            networkHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-customer-experience-head-own-web"
          )
        ) {
          //Customer Experience Head
          apiParams.where = {
            customerExperienceHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-command-centre-head-own-web"
          )
        ) {
          //Command Centre Head
          apiParams.where = {
            commandCentreHeadId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "refund-cases-list-service-head-own-web")
        ) {
          //Service Head
          apiParams.where = {
            serviceHeadId: userId,
          };
        }

        // Only fetch cities if not super admin or team leader
        if (!isSuperAdminOrTeamLeader) {

          const masterDetailResponse: any = await axios.post(
            `${masterService}/${endpointMaster.getCitiesByRole}`,
            apiParams
          );

          for (const cityMasterDetail of masterDetailResponse?.data?.data) {
            if (
              inputData.breakdownAreaStateIds?.length > 0 &&
              inputData.breakdownLocationCategoryIds?.length > 0
            ) {
              if (
                inputData.breakdownAreaStateIds.includes(
                  cityMasterDetail.stateId
                ) &&
                inputData.breakdownLocationCategoryIds.includes(
                  cityMasterDetail.locationCategoryId
                )
              ) {
                roleCityIds.push(cityMasterDetail.id);
              }
            } else if (inputData.breakdownAreaStateIds?.length > 0) {
              if (
                inputData.breakdownAreaStateIds.includes(cityMasterDetail.stateId)
              ) {
                roleCityIds.push(cityMasterDetail.id);
              }
            } else if (inputData.breakdownLocationCategoryIds?.length > 0) {
              if (
                inputData.breakdownLocationCategoryIds.includes(
                  cityMasterDetail.locationCategoryId
                )
              ) {
                roleCityIds.push(cityMasterDetail.id);
              }
            } else {
              roleCityIds.push(cityMasterDetail.id);
            }
          }
        }
      } else if (
        (isSuperAdminOrTeamLeader ||
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-call-centre-manager-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-call-centre-head-own-web"
          )) &&
        (isSuperAdminOrTeamLeader || userId)
      ) {
        //If call centre manager (or ) call centre head role then. Get cases by its call centres
        if (!isSuperAdminOrTeamLeader) {
          const apiParams: any = {};
          apiParams.userId = userId;
          if (
            Utils.hasPermission(
              userPermissions,
              "refund-cases-list-call-centre-head-own-web"
            )
          ) {
            //Call centre head
            apiParams.type = 1;
          }

          if (
            Utils.hasPermission(
              userPermissions,
              "refund-cases-list-call-centre-manager-own-web"
            )
          ) {
            //Call centre manager
            apiParams.type = 2;
          }

          const masterDetailResponse: any = await axios.post(
            `${masterService}/${endpointMaster.getCallCentersByRole}`,
            apiParams
          );

          let callCenterIds = [];
          if (masterDetailResponse.data.success) {
            callCenterIds = masterDetailResponse.data.data.map(
              (callCenterDetail: any) => {
                return callCenterDetail.id;
              }
            );
          }

          where = {
            "$caseDetail.callCenterId$": {
              [Op.in]: callCenterIds,
            },
          };
        }
      } else if (
        (isSuperAdminOrTeamLeader ||
          Utils.hasPermission(userPermissions, "refund-cases-list-tvs-spoc-own-web")) &&
        (isSuperAdminOrTeamLeader || userId)
      ) {
        //If tvs spoc role then. Get cases by its clients.
        if (!isSuperAdminOrTeamLeader) {
          const masterDetailResponse: any = await axios.post(
            `${masterService}/${endpointMaster.getClientsByRole}`,
            {
              where: {
                spocUserId: userId,
              },
            }
          );

          let clientIds = [];
          if (masterDetailResponse.data.success) {
            clientIds = masterDetailResponse.data.data.map(
              (clientDetail: any) => {
                return clientDetail.id;
              }
            );
          }

          where = {
            "$caseDetail.clientId$": {
              [Op.in]: clientIds,
            },
          };
        }
      } else if (
        (isSuperAdminOrTeamLeader ||
          Utils.hasPermission(
            userPermissions,
            "refund-cases-list-team-leader-agents-own-web"
          ) ||
          Utils.hasPermission(userPermissions, "refund-cases-list-sme-own-web")) &&
        (isSuperAdminOrTeamLeader || userId)
      ) {
        //If team leader (or) sme role then. Get cases by its agents
        if (!isSuperAdminOrTeamLeader) {
          const apiParams: any = {};
          apiParams.roleId = 3; //Agent
          if (
            Utils.hasPermission(
              userPermissions,
              "refund-cases-list-team-leader-agents-own-web"
            )
          ) {
            //Team leader
            apiParams.where = {
              tlId: userId,
            };
          } else if (
            Utils.hasPermission(userPermissions, "refund-cases-list-sme-own-web")
          ) {
            //SME
            apiParams.where = {
              smeUserId: userId,
            };
          }

          const agentDetails = await axios.post(
            `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
            apiParams
          );

          let agentIds = [];
          if (agentDetails.data.success) {
            agentIds = agentDetails.data.data.map((agentDetail: any) => {
              return agentDetail.id;
            });
          }

          where = {
            "$caseDetail.createdById$": {
              [Op.in]: agentIds,
            },
          };
        }
      }

      if (inputData.serviceIds?.length > 0) {
        where.serviceId = {
          [Op.in]: inputData.serviceIds,
        };
      }

      if (inputData.caseNumber) {
        caseDetailWhere.caseNumber = inputData.caseNumber;
      }

      if (inputData.caseVehicleRegistrationNumber) {
        caseDetailWhere.registrationNumber =
          inputData.caseVehicleRegistrationNumber;
      }

      let filterBreakdownAreaIds: any = [];
      if (
        inputData.caseSubjectNames?.length > 0 ||
        inputData.breakdownAreaStateIds?.length > 0 ||
        inputData.breakdownLocationCategoryIds?.length > 0
      ) {
        const filterDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getCrmListFilterData}`,
          {
            caseSubjectNames: inputData.caseSubjectNames,
            breakdownAreaStateIds: inputData.breakdownAreaStateIds,
            breakdownLocationCategoryIds:
              inputData.breakdownLocationCategoryIds,
          }
        );

        if (filterDataResponse.data.success) {
          let breakdownAreaStateCityIds = [];
          if (inputData.breakdownAreaStateIds?.length > 0) {
            breakdownAreaStateCityIds =
              filterDataResponse.data.data.breakdownAreaStateCityIds;
          }

          let breakdownLocationCategoryCityIds = [];
          if (inputData.breakdownLocationCategoryIds?.length > 0) {
            breakdownLocationCategoryCityIds =
              filterDataResponse.data.data.breakdownLocationCategoryCityIds;
          }

          if (
            (breakdownAreaStateCityIds.length > 0 &&
              breakdownLocationCategoryCityIds.length > 0) ||
            breakdownLocationCategoryCityIds.length > 0
          ) {
            filterBreakdownAreaIds = breakdownLocationCategoryCityIds;
          } else if (breakdownAreaStateCityIds.length > 0) {
            filterBreakdownAreaIds = breakdownAreaStateCityIds;
          }

          if (inputData.caseSubjectNames?.length > 0) {
            caseDetailWhere.subjectID = {
              [Op.in]: filterDataResponse.data.data.caseSubjectIds,
            };
          }
        }
      }

      // If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
      if (roleCityIds.length > 0) {
        if (filterBreakdownAreaIds.length > 0) {
          filterBreakdownAreaIds = roleCityIds.filter((roleCityId: any) => {
            return filterBreakdownAreaIds.includes(roleCityId);
          });
        } else {
          filterBreakdownAreaIds = roleCityIds;
        }
      }

      if (filterBreakdownAreaIds.length > 0) {
        where.breakdownAreaId = {
          [Op.in]: filterBreakdownAreaIds,
        };
      }

      // Limitation value setup
      let limitValue: number = defaultLimit;

      if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = defaultOffset;

      if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      // Check if a search query is provided
      let searchWhereQuery: any = [];
      if (search) {
        const searchLower = search.toLowerCase().trim();

        // Normal text search - fetch master search data
        const searchDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getCrmListSearchData}`,
          {
            search: search,
          }
        );
        let masterSearchDetails = [];
        if (searchDataResponse?.data?.success) {
          for (const searchDetail of searchDataResponse.data.searchDetails) {
            if (searchDetail.type == "customerType") {
              masterSearchDetails.push({
                caseTypeId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "caseSubject") {
              masterSearchDetails.push({
                "$caseDetail.subjectID$": { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "service") {
              masterSearchDetails.push({
                serviceId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "policyType") {
              masterSearchDetails.push({
                policyTypeId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "channel") {
              masterSearchDetails.push({
                channelId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "caseStatus") {
              masterSearchDetails.push({
                "$caseDetail.statusId$": { [Op.in]: searchDetail.ids },
              });
            }
          }
        }

        searchWhereQuery = [
          {
            "$caseDetail.caseNumber$": { [Op.like]: `%${search}%` },
          },
          {
            "$caseDetail.vin$": { [Op.like]: `%${search}%` },
          },
          {
            "$caseDetail.registrationNumber$": { [Op.like]: `%${search}%` },
          },
          { customerCurrentContactName: { [Op.like]: `%${search}%` } },
          { customerContactName: { [Op.like]: `%${search}%` } },
          { customerCurrentMobileNumber: { [Op.like]: `%${search}%` } },
          { customerMobileNumber: { [Op.like]: `%${search}%` } },
        ];

        if (masterSearchDetails.length > 0) {
          searchWhereQuery.push(...masterSearchDetails);
        }
      }

      // Check if a date query is provided
      let dateFilterQuery: any = [];
      if (startDate && endDate) {
        dateFilterQuery = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      where[Op.and] = [
        searchWhereQuery.length > 0 ? { [Op.or]: searchWhereQuery } : {},
        dateFilterQuery.length > 0 ? { [Op.and]: dateFilterQuery } : {},
      ];

      // Filter for refund initiated cases - include Activities with ActivityTransactions that have refundStatusId
      const caseList = await CaseInformation.findAndCountAll({
        where,
        order: [["id", "desc"]],
        limit: limitValue,
        offset: offsetValue,
        distinct: true, // Use distinct to avoid duplicate cases when multiple transactions have refunds
        attributes: [
          "id",
          "caseDetailId",
          "customerContactName",
          "customerMobileNumber",
          "customerCurrentContactName",
          "customerCurrentMobileNumber",
          "caseTypeId",
          "accidentTypeId",
          "serviceId",
          "irateCustomer",
          "womenAssist",
          "channelId",
          "policyTypeId",
        ],
        include: [
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "subjectID",
              "vin",
              "registrationNumber",
              "statusId",
              "createdAt",
              "psfStatus",
            ],
            where: caseDetailWhere,
            include: [
              {
                model: Activities,
                attributes: ["id", "activityStatusId", "aspActivityStatusId"],
                required: true, // Required to filter only cases with activities
                separate: true,
                order: [["id", "DESC"]],
                include: [
                  {
                    model: ActivityTransactions,
                    attributes: [
                      "activityId",
                      "amount",
                      "refundStatusId",
                      "refundId",
                      "refundAmount",
                      "refundReason",
                    ],
                    where: {
                      refundStatusId: {
                        [Op.ne]: null, // Filter for transactions with refundStatusId IS NOT NULL
                      },
                    },
                    required: true, // Required to filter only cases with refund transactions
                  },
                ],
              },
            ],
          },
        ],
      });

      if (caseList.count === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateCaseVehicleNumber(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const caseDetailExists: any = await CaseDetails.findOne({
        attributes: ["id", "agentId"],
        where: {
          id: payload.caseDetailId,
          statusId: {
            [Op.in]: [1, 2], //OPEN || INPROGRESS
          },
        },
      });
      if (!caseDetailExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `Case detail not found`,
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: caseDetailExists.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      caseDetailExists.updatedById = payload.updatedById;
      caseDetailExists.registrationNumber =
        payload.vehicleRegistrationNumber.trim();
      await caseDetailExists.save();

      await ActivityLogs.create({
        caseDetailId: payload.caseDetailId,
        typeId: 240,
        title: `The delivery vehicle registration number has been updated by the agent "${getAgentDetail.data.user.name}".`,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message:
          "The delivery vehicle registration number has been updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateCaseVin(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const caseDetailExists: any = await CaseDetails.findOne({
        attributes: ["id", "agentId", "clientId", "deliveryRequestSchemeId"],
        where: {
          id: payload.caseDetailId,
          statusId: {
            [Op.in]: [1, 2], //OPEN || INPROGRESS
          },
        },
      });
      if (!caseDetailExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `Case detail not found`,
        });
      }

      //ALLOW NEW REQUEST FOR THE SAME VIN IN DEALER SCHEME IS FALSE || TRUE WITH OEM SCHEME
      //THEN CHECK DELIVERY REQUEST ALREADY CREATED FOR THE VIN
      const allowNewRequestForSameVinInDealerScheme =
        process.env.ALLOW_NEW_REQUEST_FOR_THE_SAME_VIN_IN_DEALER_SCHEME;
      if (
        allowNewRequestForSameVinInDealerScheme == "false" ||
        (allowNewRequestForSameVinInDealerScheme == "true" &&
          caseDetailExists.dataValues.deliveryRequestSchemeId == 21)
      ) {
        if (
          await deliveryRequestAlreadyCreatedForVin(
            caseDetailExists.dataValues.clientId,
            payload.vin.trim(),
            payload.caseDetailId
          )
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error:
              "The delivery request for the vehicle has already been created.",
          });
        }
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: caseDetailExists.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      caseDetailExists.updatedById = payload.updatedById;
      caseDetailExists.vin = payload.vin.trim();
      await caseDetailExists.save();

      await ActivityLogs.create({
        caseDetailId: payload.caseDetailId,
        typeId: 240,
        title: `The delivery vehicle VIN has been updated by the agent "${getAgentDetail.data.user.name}".`,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The delivery vehicle VIN has been updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateCaseVehicleType(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const caseDetailExists: any = await CaseDetails.findOne({
        attributes: ["id", "agentId"],
        where: {
          id: payload.caseDetailId,
          statusId: {
            [Op.in]: [1, 2], //OPEN || INPROGRESS
          },
        },
      });
      if (!caseDetailExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `Case detail not found`,
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: caseDetailExists.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      caseDetailExists.updatedById = payload.updatedById;
      caseDetailExists.vehicleTypeId = payload.vehicleTypeId;
      await caseDetailExists.save();

      await ActivityLogs.create({
        caseDetailId: payload.caseDetailId,
        typeId: 240,
        title: `The delivery vehicle type has been updated by the agent "${getAgentDetail.data.user.name}".`,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The delivery vehicle type has been updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateCaseVehicleModel(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const caseDetailExists: any = await CaseDetails.findOne({
        attributes: ["id", "agentId"],
        where: {
          id: payload.caseDetailId,
          statusId: {
            [Op.in]: [1, 2], //OPEN || INPROGRESS
          },
        },
      });
      if (!caseDetailExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `Case detail not found`,
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: caseDetailExists.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      caseDetailExists.updatedById = payload.updatedById;
      caseDetailExists.vehicleModelId = payload.vehicleModelId;
      await caseDetailExists.save();

      await ActivityLogs.create({
        caseDetailId: payload.caseDetailId,
        typeId: 240,
        title: `The delivery vehicle model has been updated by the agent "${getAgentDetail.data.user.name}".`,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The delivery vehicle model has been updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function saveTempCaseFormDetail(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const tempCaseFormDetail = await TempCaseFormDetail.create(
        {
          payload: JSON.stringify(payload),
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: tempCaseFormDetail,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getTempCaseFormDetail(req: Request, res: Response) {
    try {
      const payload = req.body;
      const tempCaseFormDetail = await TempCaseFormDetail.findOne({
        where: { id: payload.id },
      });
      if (!tempCaseFormDetail) {
        return res.status(200).json({
          success: false,
          error: "Case form data not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: tempCaseFormDetail,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function removeTempCaseFormDetail(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const oneDayAgo = moment()
        .tz("Asia/Kolkata")
        .subtract(1, "days")
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
      await TempCaseFormDetail.destroy({
        where: {
          createdAt: {
            [Op.lt]: oneDayAgo,
          },
        },
        force: true,
        transaction: transaction,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Temporary case form detail removed successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function processPolicyInterestedCustomer(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      // const authUserPermissions = payload.authUserData.permissions;
      // if (!Utils.hasPermission(authUserPermissions, "upgrade-policy-web")) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Permission not found",
      //   });
      // }

      const caseDetail: any = await CaseDetails.findOne({
        where: {
          id: payload.caseDetailId,
          statusId: 2, //In Progress
        },
      });
      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      const policyInterestedCustomer: any =
        await PolicyInterestedCustomers.findOne({
          where: { caseDetailId: payload.caseDetailId },
        });

      //INTERESTED
      if (payload.typeId == 1) {
        if (!policyInterestedCustomer) {
          await PolicyInterestedCustomers.create(
            {
              caseDetailId: payload.caseDetailId,
              remarks: payload.remarks,
              createdById: payload.createdById,
            },
            {
              transaction: transaction,
            }
          );
        }
      } else {
        //NOT INTERESTED
        if (policyInterestedCustomer) {
          await PolicyInterestedCustomers.destroy({
            where: {
              caseDetailId: payload.caseDetailId,
            },
            force: true,
            transaction: transaction,
          });
        }
      }
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Customer interest updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getPolicyInterestedCustomer(
    req: Request,
    res: Response
  ) {
    try {
      const oneDayAgo = moment()
        .tz("Asia/Kolkata")
        .subtract(1, "days")
        .format("YYYY-MM-DD");
      const policyInterestedCustomers: any =
        await PolicyInterestedCustomers.findAll({
          where: sequelize.where(
            sequelize.fn(
              "DATE",
              sequelize.col("policyInterestedCustomers.createdAt")
            ),
            "=",
            oneDayAgo
          ),
          attributes: ["id", "caseDetailId", "remarks"],
          include: {
            model: caseDetails,
            required: true,
            attributes: ["id", "caseNumber"],
            include: [
              {
                model: CaseInformation,
                required: true,
                attributes: [
                  "id",
                  "customerContactName",
                  "customerMobileNumber",
                ],
              },
            ],
          },
        });
      if (policyInterestedCustomers.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Policy interested customers not available",
        });
      }

      const policyInterestedCustomerArray = await Promise.all(
        policyInterestedCustomers.map(async (policyInterestedCustomer: any) => {
          return {
            "Case Number": policyInterestedCustomer.caseDetail.caseNumber,
            "Customer Contact Name":
              policyInterestedCustomer.caseDetail.caseInformation
                .customerContactName,
            "Customer Mobile Number":
              policyInterestedCustomer.caseDetail.caseInformation
                .customerMobileNumber,
            Remarks: policyInterestedCustomer.remarks,
          };
        })
      );

      const headers = [
        "Case Number",
        "Customer Contact Name",
        "Customer Mobile Number",
        "Remarks",
      ];

      let buffer = generateXLSXAndXLSExport(
        policyInterestedCustomerArray,
        headers,
        "xlsx",
        "Policy Interested Customers"
      );

      const debugResponse: any = await Utils.mailDebug();
      let debugDetails = null;
      if (
        debugResponse &&
        debugResponse.success &&
        debugResponse.debugDetails
      ) {
        debugDetails = debugResponse.debugDetails;
      }

      return res.status(200).json({
        success: true,
        data: buffer,
        format: "xlsx",
        debugDetails: debugDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function addService(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const {
        caseDetailId,
        agentId,
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
        authUserId,
        authUserData,
      } = req.body;

      // if (authUserId != agentId) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Invalid agent details",
      //   });
      // }
      // const userPermissions = authUserData.permissions;
      // if (!Utils.hasPermission(userPermissions, "case-add-service-web")) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Permission not found",
      //   });
      // }

      const [
        caseDetail,
        caseInformation,
        getAgentDetail,
        getMasterDetail,
      ]: any = await Promise.all([
        CaseDetails.findOne({
          where: {
            id: caseDetailId,
            statusId: 2, //In Progress
          },
          attributes: ["id", "clientId", "vin", "registrationNumber", "typeId"],
        }),
        CaseInformation.findOne({
          where: {
            caseDetailId: caseDetailId,
          },
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
        }),
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: agentId,
        }),
        //GET MASTER DETAILS
        axios.post(`${masterService}/${endpointMaster.getMasterDetails}`, {
          subServiceId: additionalSubServiceId,
          additionalServiceId: additionalServiceId,
        }),
      ]);

      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case information not found",
        });
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case agent not found",
        });
      }

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

      //IF CUSTOMER PREFERRED IS HOME OR GARAGE OR CHARGING STATION THEN DROP AREA IS REQUIRED
      if (
        [462, 463, 464].includes(customerPreferredLocationId) &&
        !dropAreaId
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Drop area is required",
        });
      }

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
      const serviceBasedSubServiceIds =
        getMasterDetail?.data?.data?.serviceBasedSubServices?.map(
          (subService: any) => subService.id
        ) || [];

      if (serviceBasedSubServiceIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }

      // EXCEPT OTHER SERVICE - DO NOT ALLOW TO ADD ANOTHER SUB SERVICE AGAINST SAME SERVICE
      if (additionalServiceId != 3) {
        const postiveActivityExistsForService = await Activities.findOne({
          where: {
            caseDetailId: caseDetailId,
            activityStatusId: {
              [Op.notIn]: [4, 8], //EXCEPT CANCELED OR REJECTED
            },
          },
          attributes: ["id"],
          include: [
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id"],
              where: {
                subServiceId: {
                  [Op.in]: serviceBasedSubServiceIds,
                },
              },
            },
          ],
        });
        if (postiveActivityExistsForService) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "The service has already been activated.",
          });
        }
      }

      const caseInformationUpdateFields: any = {
        additionalServiceRequested: 1,
      };
      //Towing
      if (additionalServiceId == 1) {
        caseInformationUpdateFields.dropLocationTypeId = dropLocationTypeId;
        caseInformationUpdateFields.customerPreferredLocationId =
          customerPreferredLocationId ? customerPreferredLocationId : null;
        caseInformationUpdateFields.dropDealerId = dropDealerId
          ? dropDealerId
          : null;
        caseInformationUpdateFields.dropLocation = dropLocation;
        caseInformationUpdateFields.dropAreaId = dropAreaId ? dropAreaId : null;
        caseInformationUpdateFields.dropLocationLat = dropLocationLat;
        caseInformationUpdateFields.dropLocationLong = dropLocationLong;
        caseInformationUpdateFields.breakdownToDropLocationDistance =
          breakdownToDropDistance;
      }

      await Promise.all([
        CaseInformation.update(caseInformationUpdateFields, {
          where: {
            caseDetailId: caseDetailId,
          },
          transaction: transaction,
        }),
        ActivityLogs.create(
          {
            caseDetailId: caseDetailId,
            typeId: 240, //WEB
            // title: `The agent "${getAgentDetail.data.user.name}" has created the additional service "${getMasterDetail.data.data.subService.service.name}".`,
            title: `The ${authUserData.role.name} "${authUserData.name}" has created the additional service "${getMasterDetail.data.data.subService.service.name}".`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      const additionalServiceCreateActivityResponse =
        await createActivityAndActivityAspDetail(
          caseDetail,
          caseInformation,
          authUserId,
          additionalServiceId,
          additionalSubServiceId,
          breakdownToDropDistance,
          0, //NOT INITIALLY CREATED
          1, //IMMEDIATE SERVICE
          null, //SERVICE INITIATING AT
          null, //SERVICE EXPECTED AT
          0, //ASP AUTO ALLOCATION
          transaction
        );
      if (!additionalServiceCreateActivityResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: additionalServiceCreateActivityResponse.error,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Additional service created successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Helper function to check if date filter is current day
  function isCurrentDayFilter(startDate: string | undefined, endDate: string | undefined): boolean {
    if (!startDate || !endDate) {
      return false;
    }
    const currentDay = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const startDay = moment.tz(startDate, "Asia/Kolkata").format("YYYY-MM-DD");
    // const endDay = moment.tz(endDate, "Asia/Kolkata").format("YYYY-MM-DD");
    // return startDay === currentDay && endDay === currentDay;
    return startDay === currentDay; // WE ARE CHECKING ONLY START DATE SINCE WE ARE FETCHING THE ATTENDANCE BASED ON START DATE
  }

  // Helper function to check if case-related filters exist
  function hasCaseRelatedFilters(payload: any): boolean {
    return !!(
      (payload.statusIds && payload.statusIds.length > 0) ||
      (payload.caseSubjectNames && payload.caseSubjectNames.length > 0) ||
      payload.caseNumber ||
      (payload.activityStatusIds && payload.activityStatusIds.length > 0) ||
      (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) ||
      (payload.unAssignmentReasonIds && payload.unAssignmentReasonIds.length > 0) ||
      (payload.slaStatusIds && payload.slaStatusIds.length > 0)
    );
  }

  // Helper function to get breakdown reach SLA status ID for an activity
  // Returns: 1=Achieved, 2=Not Achieved, 3=Exceeded Expectation, 4=Performance In Progress, null if cannot determine
  async function getBreakdownReachSlaStatusId(
    activity: any,
    caseDetail: any,
    rsaSlaDetails: any[],
    exceededExpectationSlaMins: number
  ): Promise<number | null> {
    try {
      if (!caseDetail?.caseInformation?.breakdownAreaId || !rsaSlaDetails || rsaSlaDetails.length === 0) {
        return null;
      }

      // Get SLA base date
      let slaBaseDate = null;
      if (activity.isInitiallyCreated && !activity.isImmediateService) {
        slaBaseDate = activity.serviceInitiatingAt;
      } else {
        slaBaseDate = caseDetail.createdAt;
      }

      // Get city SLA detail
      const citySlaDetail = rsaSlaDetails.find(
        (rsaSlaDetail: any) =>
          rsaSlaDetail.id == caseDetail.caseInformation.breakdownAreaId
      );
      if (!citySlaDetail || !citySlaDetail.slaTime) {
        return null;
      }

      const slaTime = citySlaDetail.slaTime;
      const slaDateTime = moment
        .tz(slaBaseDate, "Asia/Kolkata")
        .add(slaTime, "seconds")
        .format("YYYY-MM-DD HH:mm:ss");

      // If ASP already reached to breakdown
      if (activity.aspReachedToBreakdownAt) {
        const formattedAspReachedToBreakdownAt = moment
          .tz(activity.aspReachedToBreakdownAt, "Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss");

        if (formattedAspReachedToBreakdownAt > slaDateTime) {
          return 2; // Not Achieved
        } else {
          const momentSlaDateTime = moment.tz(slaDateTime, "Asia/Kolkata");
          const slaDateTimeMinusExpectedSlaMin = momentSlaDateTime.subtract(
            exceededExpectationSlaMins,
            "minutes"
          );
          const formattedSlaDateTimeMinusExpectedSlaMin =
            slaDateTimeMinusExpectedSlaMin.format("YYYY-MM-DD HH:mm:ss");

          // If ASP reached breakdown before SLA exceeded time (10 mins before)
          if (
            formattedAspReachedToBreakdownAt <=
            formattedSlaDateTimeMinusExpectedSlaMin
          ) {
            return 3; // Exceeded Expectation
          } else {
            return 1; // Achieved
          }
        }
      } else {
        // ASP hasn't reached breakdown yet
        const currentTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
        if (currentTime > slaDateTime) {
          return 2; // Not Achieved (time exceeded)
        } else {
          return 4; // Performance In Progress
        }
      }
    } catch (error: any) {
      console.error("Error calculating breakdown reach SLA status:", error);
      return null;
    }
  }

  export async function rsaAspOverAllMapViewStatusDetail(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;

      // Extract startDate and endDate
      const startDate = payload.startDate;
      const endDate = payload.endDate;
      const isCurrentDay = isCurrentDayFilter(startDate, endDate);
      const hasCaseFilters = hasCaseRelatedFilters(payload);

      // Build filter conditions from payload
      const activityWhere: any = {};
      const activityAspDetailWhere: any = {};
      const caseDetailsWhere: any = {};

      // Activity Status filter
      if (payload.activityStatusIds && payload.activityStatusIds.length > 0) {
        activityWhere.activityStatusId = {
          [Op.in]: payload.activityStatusIds,
        };
      }

      // ASP Activity Status filter
      if (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) {
        activityWhere.aspActivityStatusId = {
          [Op.in]: payload.aspActivityStatusIds,
        };
      }

      // Un-Assignment Reasons filter (mapped to rejectReasonId in ActivityAspDetails)
      if (payload.unAssignmentReasonIds && payload.unAssignmentReasonIds.length > 0) {
        activityAspDetailWhere.rejectReasonId = {
          [Op.in]: payload.unAssignmentReasonIds,
        };
      }

      // Case Status filter
      if (payload.statusIds && payload.statusIds.length > 0) {
        caseDetailsWhere.statusId = {
          [Op.in]: payload.statusIds,
        };
      }


      // Case Number filter
      if (payload.caseNumber) {
        caseDetailsWhere.caseNumber = {
          [Op.like]: `%${payload.caseNumber}%`,
        };
      }

      // Problem/Case Subject filter - convert caseSubjectNames to IDs
      let caseSubjectIds: any[] = [];
      if (payload.caseSubjectNames && payload.caseSubjectNames.length > 0) {
        // Get CaseSubject IDs from Master Service based on names
        try {
          const caseSubjectResponse = await axios.post(
            `${masterService}/${endpointMaster.getCrmListFilterData}`,
            {
              caseSubjectNames: payload.caseSubjectNames,
            }
          );
          if (caseSubjectResponse.data.success && caseSubjectResponse.data.data.caseSubjectIds) {
            caseSubjectIds = caseSubjectResponse.data.data.caseSubjectIds;
          }
        } catch (error) {
          console.error("Error fetching case subject IDs:", error);
        }
      }
      if (caseSubjectIds.length > 0) {
        caseDetailsWhere.subjectID = {
          [Op.in]: caseSubjectIds,
        };
      }

      for (const asp of payload.asps) {
        let aspColorStatus = null;
        let caseDetailId = null;
        let caseTypeId = null;

        //LOGGED IN
        if (asp.loginStatus == 1) {
          // If NOT current day, use simplified logic (attendance only)
          if (!isCurrentDay) {
            aspColorStatus = "green"; // Available
          } else {
            // Current day - use existing logic with work status checks
            const aspWorkStatusPayload: any = {};
            aspWorkStatusPayload.aspId = asp.id;
            aspWorkStatusPayload.hasMechanic = asp.hasMechanic;
            aspWorkStatusPayload.aspMechanics = asp.aspMechanics;
            aspWorkStatusPayload.serviceScheduledDate = moment()
              .tz("Asia/Kolkata")
              .format("YYYY-MM-DD");
            const aspWorkStatus = await getAspsWorkStatusDetails(
              aspWorkStatusPayload
            );
            if (aspWorkStatus.success) {
              //BUSY
              if (!aspWorkStatus.aspAvailable) {
                // Build where clause for busy activity (In Progress)
                const busyActivityWhere: any = {
                  activityStatusId: 3, //In Progress
                  ...activityWhere,
                };

                // Build ActivityAspDetails where clause
                const busyAspDetailWhere: any = {
                  aspId: asp.id,
                  ...activityAspDetailWhere,
                };

                // CASE ASSIGNED AND WORK IS IN PROGRESS
                let busyActivity: any = await Activities.findOne({
                  attributes: ["id", "activityStatusId", "caseDetailId", "aspReachedToBreakdownAt", "isInitiallyCreated", "isImmediateService", "serviceInitiatingAt", "createdAt"],
                  where: busyActivityWhere,
                  include: [
                    {
                      model: CaseDetails,
                      required: true,
                      attributes: ["id", "typeId", "createdAt"],
                      where: Object.keys(caseDetailsWhere).length > 0 ? caseDetailsWhere : undefined,
                      include: [
                        {
                          model: CaseInformation,
                          attributes: ["id", "breakdownAreaId"],
                          required: false,
                        },
                      ],
                    },
                    {
                      model: ActivityAspDetails,
                      attributes: ["id"],
                      required: true,
                      where: busyAspDetailWhere,
                    },
                    {
                      model: ActivityAspLiveLocations,
                      attributes: ["latitude", "longitude"],
                      required: false,
                      limit: 1,
                      separate: true,
                      order: [["id", "DESC"]],
                    },
                  ],
                  order: [["id", "desc"]],
                });

                // Check SLA status if slaStatusIds filter is present
                if (busyActivity && payload.slaStatusIds && payload.slaStatusIds.length > 0) {
                  // Fetch SLA details for this activity's breakdown area
                  let activityRsaSlaDetails: any[] = [];
                  let activityExceededExpectationSlaMins: number = 10;
                  if (busyActivity.caseDetail?.caseInformation?.breakdownAreaId) {
                    try {
                      const breakdownCities = [{
                        id: busyActivity.caseDetail.caseInformation.breakdownAreaId,
                        typeId: 870, // ASP Breakdown Reach Time SLA - L1
                      }];
                      const filterDataResponse = await axios.post(
                        `${masterService}/${endpointMaster.getCrmListFilterData}`,
                        { breakdownCities }
                      );
                      if (filterDataResponse.data.success) {
                        activityRsaSlaDetails = filterDataResponse.data.data.breakdownCitySlaSettings || [];
                        activityExceededExpectationSlaMins = filterDataResponse.data.data.exceededExpectationSlaMins?.name || 10;
                      }
                    } catch (error) {
                      console.error("Error fetching SLA details for activity:", error);
                    }
                  }

                  const slaStatusId = await getBreakdownReachSlaStatusId(
                    busyActivity,
                    busyActivity.caseDetail,
                    activityRsaSlaDetails,
                    activityExceededExpectationSlaMins
                  );

                  // If SLA status doesn't match filter, treat as no matching activity
                  if (slaStatusId === null || !payload.slaStatusIds.includes(slaStatusId)) {
                    busyActivity = null;
                  }
                }

                if (busyActivity) {
                  if (
                    busyActivity.activityAspLiveLocations &&
                    busyActivity.activityAspLiveLocations[0]
                  ) {
                    asp.latitude =
                      busyActivity.activityAspLiveLocations[0].latitude;
                    asp.longitude =
                      busyActivity.activityAspLiveLocations[0].longitude;
                  }

                  aspColorStatus = "red";
                  caseDetailId = busyActivity.caseDetailId;
                  caseTypeId = busyActivity.caseDetail.typeId;
                } else {
                  // Build where clause for blue activity (Assigned but not started)
                  const blueStatusIds = [2, 9, 10, 14]; //2-Assigned,9-Waiting for Dealer Approval,10-Advance Payment Paid, 14-Advance Pay Later
                  let shouldQueryBlueActivity = true;
                  const blueActivityWhere: any = {
                    activityStatusId: { [Op.in]: blueStatusIds },
                  };

                  // Apply activity filters if provided
                  if (payload.activityStatusIds && payload.activityStatusIds.length > 0) {
                    // If activityStatusIds filter is provided, intersect with blue status IDs
                    const filteredStatusIds = blueStatusIds.filter((id) =>
                      payload.activityStatusIds.includes(id)
                    );
                    if (filteredStatusIds.length > 0) {
                      blueActivityWhere.activityStatusId = { [Op.in]: filteredStatusIds };
                    } else {
                      // No matching status, skip this activity type
                      shouldQueryBlueActivity = false;
                    }
                  }

                  // Apply other activity filters if not filtering by activityStatusIds
                  if (shouldQueryBlueActivity) {
                    if (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) {
                      blueActivityWhere.aspActivityStatusId = {
                        [Op.in]: payload.aspActivityStatusIds,
                      };
                    }
                  }

                  // Build ActivityAspDetails where clause
                  const blueAspDetailWhere: any = {
                    aspId: asp.id,
                    ...activityAspDetailWhere,
                  };

                  //BLUE - CASE ASSIGNED BUT WORK NOT YET STARTED
                  let blueActivity: any = null;
                  if (shouldQueryBlueActivity) {
                    blueActivity = await Activities.findOne({
                      attributes: ["id", "activityStatusId", "caseDetailId", "aspReachedToBreakdownAt", "isInitiallyCreated", "isImmediateService", "serviceInitiatingAt", "createdAt"],
                      where: blueActivityWhere,
                      include: [
                        {
                          model: CaseDetails,
                          attributes: ["id", "typeId", "createdAt"],
                          required: true,
                          where: Object.keys(caseDetailsWhere).length > 0 ? caseDetailsWhere : undefined,
                          include: [
                            {
                              model: CaseInformation,
                              attributes: ["id", "breakdownAreaId"],
                              required: false,
                            },
                          ],
                        },
                        {
                          model: ActivityAspDetails,
                          attributes: ["id"],
                          required: true,
                          where: blueAspDetailWhere,
                        },
                      ],
                      order: [["id", "desc"]],
                    });

                    // Check SLA status if slaStatusIds filter is present
                    if (blueActivity && payload.slaStatusIds && payload.slaStatusIds.length > 0) {
                      // Fetch SLA details for this activity's breakdown area
                      let activityRsaSlaDetails: any[] = [];
                      let activityExceededExpectationSlaMins: number = 10;
                      if (blueActivity.caseDetail?.caseInformation?.breakdownAreaId) {
                        try {
                          const breakdownCities = [{
                            id: blueActivity.caseDetail.caseInformation.breakdownAreaId,
                            typeId: 870, // ASP Breakdown Reach Time SLA - L1
                          }];
                          const filterDataResponse = await axios.post(
                            `${masterService}/${endpointMaster.getCrmListFilterData}`,
                            { breakdownCities }
                          );
                          if (filterDataResponse.data.success) {
                            activityRsaSlaDetails = filterDataResponse.data.data.breakdownCitySlaSettings || [];
                            activityExceededExpectationSlaMins = filterDataResponse.data.data.exceededExpectationSlaMins?.name || 10;
                          }
                        } catch (error) {
                          console.error("Error fetching SLA details for activity:", error);
                        }
                      }

                      const slaStatusId = await getBreakdownReachSlaStatusId(
                        blueActivity,
                        blueActivity.caseDetail,
                        activityRsaSlaDetails,
                        activityExceededExpectationSlaMins
                      );

                      // If SLA status doesn't match filter, treat as no matching activity
                      if (slaStatusId === null || !payload.slaStatusIds.includes(slaStatusId)) {
                        blueActivity = null;
                      }
                    }
                  }

                  if (blueActivity) {
                    aspColorStatus = "blue";
                    caseDetailId = blueActivity.caseDetailId;
                    caseTypeId = blueActivity.caseDetail.typeId;
                  } else {
                    //AVAILABLE
                    aspColorStatus = "green";
                  }
                }
              } else if (aspWorkStatus.aspAvailable) {
                //AVAILABLE
                aspColorStatus = "green";
              }
            } else {
              aspColorStatus = "black"; //OFFLINE
            }
          } // End of else block for isCurrentDay
        } else {
          aspColorStatus = "black"; //OFFLINE
        }

        asp.colorStatus = aspColorStatus;
        asp.caseDetailId = caseDetailId;
        asp.caseTypeId = caseTypeId;
      }

      // Filter out ASPs without matching cases when case filters are applied
      let filteredAsps = payload.asps;
      if (hasCaseFilters) {
        filteredAsps = payload.asps.filter((asp: any) => asp.caseDetailId != null);
      }

      return res.status(200).json({
        success: true,
        data: filteredAsps,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function rsaTechnicianOverAllMapViewStatusDetail(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;

      // Extract startDate and endDate
      const startDate = payload.startDate;
      const endDate = payload.endDate;
      const isCurrentDay = isCurrentDayFilter(startDate, endDate);
      const hasCaseFilters = hasCaseRelatedFilters(payload);

      // Build filter conditions from payload
      const activityWhere: any = {};
      const activityAspDetailWhere: any = {};
      const caseDetailsWhere: any = {};

      // Activity Status filter
      if (payload.activityStatusIds && payload.activityStatusIds.length > 0) {
        activityWhere.activityStatusId = {
          [Op.in]: payload.activityStatusIds,
        };
      }

      // ASP Activity Status filter
      if (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) {
        activityWhere.aspActivityStatusId = {
          [Op.in]: payload.aspActivityStatusIds,
        };
      }

      // Un-Assignment Reasons filter (mapped to rejectReasonId in ActivityAspDetails)
      if (payload.unAssignmentReasonIds && payload.unAssignmentReasonIds.length > 0) {
        activityAspDetailWhere.rejectReasonId = {
          [Op.in]: payload.unAssignmentReasonIds,
        };
      }

      // Case Status filter
      if (payload.statusIds && payload.statusIds.length > 0) {
        caseDetailsWhere.statusId = {
          [Op.in]: payload.statusIds,
        };
      }

      // Case Number filter
      if (payload.caseNumber) {
        caseDetailsWhere.caseNumber = {
          [Op.like]: `%${payload.caseNumber}%`,
        };
      }

      // Problem/Case Subject filter - convert caseSubjectNames to IDs
      let caseSubjectIds: any[] = [];
      if (payload.caseSubjectNames && payload.caseSubjectNames.length > 0) {
        // Get CaseSubject IDs from Master Service based on names
        try {
          const caseSubjectResponse = await axios.post(
            `${masterService}/${endpointMaster.getCrmListFilterData}`,
            {
              caseSubjectNames: payload.caseSubjectNames,
            }
          );
          if (caseSubjectResponse.data.success && caseSubjectResponse.data.data.caseSubjectIds) {
            caseSubjectIds = caseSubjectResponse.data.data.caseSubjectIds;
          }
        } catch (error) {
          console.error("Error fetching case subject IDs:", error);
        }
      }
      if (caseSubjectIds.length > 0) {
        caseDetailsWhere.subjectID = {
          [Op.in]: caseSubjectIds,
        };
      }

      for (const technician of payload.technicians) {
        let technicianColorStatus = null;
        let caseDetailId = null;
        let caseTypeId = null;

        //LOGGED IN
        if (technician.loginStatus == 1) {
          // If NOT current day, use simplified logic (attendance only)
          if (!isCurrentDay) {
            technicianColorStatus = "green"; // Available
          } else {
            // Current day - use existing logic with work status checks
            // Check technician work status using aspMechanicId - directly call the function
            const serviceScheduledDate = moment()
              .tz("Asia/Kolkata")
              .format("YYYY-MM-DD");

            const technicianWorkStatusResponse = await checkAspMechanicWorkStatus(
              technician.id,
              serviceScheduledDate
            );

            if (technicianWorkStatusResponse.success) {
              const technicianAvailable = technicianWorkStatusResponse.data.aspMechanicAvailable;

              //BUSY
              if (!technicianAvailable) {
                // Build where clause for busy activity (In Progress)
                const busyActivityWhere: any = {
                  activityStatusId: 3, //In Progress
                  ...activityWhere,
                };

                // Build ActivityAspDetails where clause - filter by aspMechanicId
                const busyAspDetailWhere: any = {
                  aspMechanicId: technician.id,
                  ...activityAspDetailWhere,
                };

                // CASE ASSIGNED AND WORK IS IN PROGRESS
                let busyActivity: any = await Activities.findOne({
                  attributes: ["id", "activityStatusId", "caseDetailId", "aspReachedToBreakdownAt", "isInitiallyCreated", "isImmediateService", "serviceInitiatingAt", "createdAt"],
                  where: busyActivityWhere,
                  include: [
                    {
                      model: CaseDetails,
                      required: true,
                      attributes: ["id", "typeId", "createdAt"],
                      where: Object.keys(caseDetailsWhere).length > 0 ? caseDetailsWhere : undefined,
                      include: [
                        {
                          model: CaseInformation,
                          attributes: ["id", "breakdownAreaId"],
                          required: false,
                        },
                      ],
                    },
                    {
                      model: ActivityAspDetails,
                      attributes: ["id"],
                      required: true,
                      where: busyAspDetailWhere,
                    },
                    {
                      model: ActivityAspLiveLocations,
                      attributes: ["latitude", "longitude"],
                      required: false,
                      limit: 1,
                      separate: true,
                      order: [["id", "DESC"]],
                    },
                  ],
                  order: [["id", "desc"]],
                });

                // Check SLA status if slaStatusIds filter is present
                if (busyActivity && payload.slaStatusIds && payload.slaStatusIds.length > 0) {
                  // Fetch SLA details for this activity's breakdown area
                  let activityRsaSlaDetails: any[] = [];
                  let activityExceededExpectationSlaMins: number = 10;
                  if (busyActivity.caseDetail?.caseInformation?.breakdownAreaId) {
                    try {
                      const breakdownCities = [{
                        id: busyActivity.caseDetail.caseInformation.breakdownAreaId,
                        typeId: 870, // ASP Breakdown Reach Time SLA - L1
                      }];
                      const filterDataResponse = await axios.post(
                        `${masterService}/${endpointMaster.getCrmListFilterData}`,
                        { breakdownCities }
                      );
                      if (filterDataResponse.data.success) {
                        activityRsaSlaDetails = filterDataResponse.data.data.breakdownCitySlaSettings || [];
                        activityExceededExpectationSlaMins = filterDataResponse.data.data.exceededExpectationSlaMins?.name || 10;
                      }
                    } catch (error) {
                      console.error("Error fetching SLA details for activity:", error);
                    }
                  }

                  const slaStatusId = await getBreakdownReachSlaStatusId(
                    busyActivity,
                    busyActivity.caseDetail,
                    activityRsaSlaDetails,
                    activityExceededExpectationSlaMins
                  );

                  // If SLA status doesn't match filter, treat as no matching activity
                  if (slaStatusId === null || !payload.slaStatusIds.includes(slaStatusId)) {
                    busyActivity = null;
                  }
                }

                if (busyActivity) {
                  if (
                    busyActivity.activityAspLiveLocations &&
                    busyActivity.activityAspLiveLocations[0]
                  ) {
                    technician.latitude =
                      busyActivity.activityAspLiveLocations[0].latitude;
                    technician.longitude =
                      busyActivity.activityAspLiveLocations[0].longitude;
                  }

                  technicianColorStatus = "red";
                  caseDetailId = busyActivity.caseDetailId;
                  caseTypeId = busyActivity.caseDetail.typeId;
                } else {
                  // Build where clause for blue activity (Assigned but not started)
                  const blueStatusIds = [2, 9, 10, 14]; //2-Assigned,9-Waiting for Dealer Approval,10-Advance Payment Paid, 14-Advance Pay Later
                  let shouldQueryBlueActivity = true;
                  const blueActivityWhere: any = {
                    activityStatusId: { [Op.in]: blueStatusIds },
                  };

                  // Apply activity filters if provided
                  if (payload.activityStatusIds && payload.activityStatusIds.length > 0) {
                    // If activityStatusIds filter is provided, intersect with blue status IDs
                    const filteredStatusIds = blueStatusIds.filter((id) =>
                      payload.activityStatusIds.includes(id)
                    );
                    if (filteredStatusIds.length > 0) {
                      blueActivityWhere.activityStatusId = { [Op.in]: filteredStatusIds };
                    } else {
                      // No matching status, skip this activity type
                      shouldQueryBlueActivity = false;
                    }
                  }

                  // Apply other activity filters if not filtering by activityStatusIds
                  if (shouldQueryBlueActivity) {
                    if (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) {
                      blueActivityWhere.aspActivityStatusId = {
                        [Op.in]: payload.aspActivityStatusIds,
                      };
                    }
                  }

                  // Build ActivityAspDetails where clause - filter by aspMechanicId
                  const blueAspDetailWhere: any = {
                    aspMechanicId: technician.id,
                    ...activityAspDetailWhere,
                  };

                  //BLUE - CASE ASSIGNED BUT WORK NOT YET STARTED
                  let blueActivity: any = null;
                  if (shouldQueryBlueActivity) {
                    blueActivity = await Activities.findOne({
                      attributes: ["id", "activityStatusId", "caseDetailId", "aspReachedToBreakdownAt", "isInitiallyCreated", "isImmediateService", "serviceInitiatingAt", "createdAt"],
                      where: blueActivityWhere,
                      include: [
                        {
                          model: CaseDetails,
                          attributes: ["id", "typeId", "createdAt"],
                          required: true,
                          where: Object.keys(caseDetailsWhere).length > 0 ? caseDetailsWhere : undefined,
                          include: [
                            {
                              model: CaseInformation,
                              attributes: ["id", "breakdownAreaId"],
                              required: false,
                            },
                          ],
                        },
                        {
                          model: ActivityAspDetails,
                          attributes: ["id"],
                          required: true,
                          where: blueAspDetailWhere,
                        },
                      ],
                      order: [["id", "desc"]],
                    });

                    // Check SLA status if slaStatusIds filter is present
                    if (blueActivity && payload.slaStatusIds && payload.slaStatusIds.length > 0) {
                      // Fetch SLA details for this activity's breakdown area
                      let activityRsaSlaDetails: any[] = [];
                      let activityExceededExpectationSlaMins: number = 10;
                      if (blueActivity.caseDetail?.caseInformation?.breakdownAreaId) {
                        try {
                          const breakdownCities = [{
                            id: blueActivity.caseDetail.caseInformation.breakdownAreaId,
                            typeId: 870, // ASP Breakdown Reach Time SLA - L1
                          }];
                          const filterDataResponse = await axios.post(
                            `${masterService}/${endpointMaster.getCrmListFilterData}`,
                            { breakdownCities }
                          );
                          if (filterDataResponse.data.success) {
                            activityRsaSlaDetails = filterDataResponse.data.data.breakdownCitySlaSettings || [];
                            activityExceededExpectationSlaMins = filterDataResponse.data.data.exceededExpectationSlaMins?.name || 10;
                          }
                        } catch (error) {
                          console.error("Error fetching SLA details for activity:", error);
                        }
                      }

                      const slaStatusId = await getBreakdownReachSlaStatusId(
                        blueActivity,
                        blueActivity.caseDetail,
                        activityRsaSlaDetails,
                        activityExceededExpectationSlaMins
                      );

                      // If SLA status doesn't match filter, treat as no matching activity
                      if (slaStatusId === null || !payload.slaStatusIds.includes(slaStatusId)) {
                        blueActivity = null;
                      }
                    }
                  }

                  if (blueActivity) {
                    technicianColorStatus = "blue";
                    caseDetailId = blueActivity.caseDetailId;
                    caseTypeId = blueActivity.caseDetail.typeId;
                  } else {
                    //AVAILABLE
                    technicianColorStatus = "green";
                  }
                }
              } else if (technicianAvailable) {
                //AVAILABLE
                technicianColorStatus = "green";
              }
            } else {
              technicianColorStatus = "black"; //OFFLINE
            }
          } // End of else block for isCurrentDay
        } else {
          technicianColorStatus = "black"; //OFFLINE
        }

        technician.colorStatus = technicianColorStatus;
        technician.caseDetailId = caseDetailId;
        technician.caseTypeId = caseTypeId;
      }

      // Filter out technicians without matching cases when case filters are applied
      let filteredTechnicians = payload.technicians;
      if (hasCaseFilters) {
        filteredTechnicians = payload.technicians.filter((technician: any) => technician.caseDetailId != null);
      }

      return res.status(200).json({
        success: true,
        data: filteredTechnicians,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function aspInvoicePushOldCasesToAspPortal(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const fromDateTime = payload.fromDateTime;
      const toDateTime = payload.toDateTime;

      const caseDetails: any = await CaseDetails.findAll({
        attributes: [
          "id",
          "typeId",
          "cancelReasonId",
          "callCenterId",
          "clientId",
          "vehicleMakeId",
          "vehicleModelId",
          "subjectID",
          "dealerId",
          "deliveryRequestPickUpStateId",
          "deliveryRequestPickUpCityId",
          "deliveryRequestDropDealerId",
          "deliveryRequestDropStateId",
          "deliveryRequestDropCityId",
          "statusId",
          "caseNumber",
          "createdAt",
          "description",
          "registrationNumber",
          "vin",
          "deliveryRequestPickUpLocation",
          "deliveryRequestDropLocation",
          "contactNameAtPickUp",
          "contactNumberAtPickUp",
          "contactNameAtDrop",
          "contactNumberAtDrop",
          "deliveryRequestPickupDate",
          "deliveryRequestPickupTime",
          "deliveryRequestSubServiceId",
          "pickupLocationPinCode",
          "dropLocationPinCode",
        ],
        where: {
          statusId: [2, 4], //2-In Progress,4-Closed
          typeId: 32, // DELIVERY REQUEST
          isCasePushedToAspPortal: 0, //Not Synced
          createdAt: {
            [Op.between]: [fromDateTime, toDateTime],
          },
        },
        group: "id",
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
          {
            model: Activities,
            attributes: [
              "id",
              "caseDetailId",
              "slaAchievedDelayed",
              "advancePaymentMethodId",
              "advancePaymentPaidToId",
              "financeStatusId",
              "aspActivityStatusId",
              "activityStatusId",
              "aspRejectedCcDetailReasonId",
              "activityNumber",
              "isAspAcceptedCcDetail",
              "aspWaitingTime",
              "aspReachedToPickupAt",
              "aspReachedToBreakdownAt",
            ],
            where: {
              financeStatusId: [1, 2], //1-Matured,2-Matured - Empty Return
              activityStatusId: [7, 12, 11], //7-Successful,12-Excess Amount Credit Pending,11-Balance Payment Pending
              isOldAspInvoicePushedToAspPortal: 0, //Not Synced
            },
            required: true,
            include: [
              {
                model: ActivityAspDetails,
                attributes: [
                  "id",
                  "rejectReasonId",
                  "aspId",
                  "subServiceId",
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
          },
        ],
      });

      if (caseDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      for (const caseDetail of caseDetails) {
        //INITIAL CASE PUSH
        const actualCaseStatusId = caseDetail.dataValues.statusId;
        caseDetail.dataValues.statusId = 1; //Open
        const initialCasePushResponse = await Utils.createAspInvoiceCase(
          caseDetail.dataValues
        );
        if (!initialCasePushResponse.success) {
          continue;
        }

        const activityIds = caseDetail.activities.map(
          (activity: any) => activity.id
        );

        for (const activity of caseDetail.activities) {
          //ACTIVITY PUSH
          const activityPushResponse = await Utils.createAspInvoiceActivity(
            caseDetail,
            activity.dataValues,
            activity.activityAspDetail.dataValues
          );
          if (!activityPushResponse.success) {
            continue;
          }
        }

        caseDetail.dataValues.statusId = actualCaseStatusId;
        //IF CASE STATUS CLOSED THEN PUSH CASE
        if (actualCaseStatusId == 4) {
          //CLOSED
          const caseClosePushResponse = await Utils.createAspInvoiceCase(
            caseDetail.dataValues
          );
          if (!caseClosePushResponse.success) {
            continue;
          }
        }

        await Activities.update(
          { isOldAspInvoicePushedToAspPortal: 1 },
          {
            where: {
              id: {
                [Op.in]: activityIds,
              },
            },
          }
        );
      }

      return res.status(200).json({
        success: true,
        message: "Process completed successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function rsaUpdateLocation(req: Request, res: Response) {
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
            model: ActivityAspDetails,
            attributes: ["id", "aspId", "subServiceId", "serviceId"],
            required: true,
          },
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "clientId",
              "vin",
              "registrationNumber",
              "createdAt",
              "subjectID",
              "statusId",
              "callCenterId",
              "agentId",
              "rmId",
              "typeId",
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
                  "customerMobileNumber",
                  "customerCurrentContactName",
                  "breakdownLocation",
                  "breakdownLat",
                  "breakdownLong",
                  "dropDealerId",
                  "dropLocationLat",
                  "dropLocationLong",
                  "dropLocationTypeId",
                  "dropLocation",
                  "serviceId",
                  "subServiceId",
                  "customerNeedToPay",
                  "nonMembershipType",
                  "additionalChargeableKm",
                  "policyTypeId",
                  "policyStartDate",
                  "policyEndDate",
                  "policyNumber",
                  "caseTypeId",
                  "breakdownToDropLocationDistance",
                  "serviceEligibilityId",
                  "irateCustomer",
                  "womenAssist",
                  "additionalServiceRequested",
                ],
              },
            ],
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

      let message = null;
      //BREAKDOWN LOCATION
      if (payload.editType == 1) {
        // const authUserPermissions = payload.authUserData.permissions;
        // if (
        //   !Utils.hasPermission(
        //     authUserPermissions,
        //     "edit-breakdown-location-web"
        //   )
        // ) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: "Permission not found",
        //   });
        // }

        // PREVIOUS CODE - Check for positive activities
        // const positiveActivities = await Activities.findAll({
        //   attributes: ["id"],
        //   where: {
        //     caseDetailId: payload.caseDetailId,
        //     activityStatusId: {
        //       [Op.notIn]: [1, 4, 8], //Except open, cancelled, rejected
        //     },
        //   },
        // });
        // if (positiveActivities.length > 0) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error:
        //       "Case activity is currently in progress, so it is not possible to update the breakdown location.",
        //   });
        // } else {

        // Check if any activity has reached breakdown location
        // Exclude cancelled (4) and rejected (8) activities
        const hasReachedBreakdown: any = await Activities.findOne({
          where: {
            caseDetailId: payload.caseDetailId,
            activityStatusId: {
              [Op.notIn]: [4, 8], // Exclude Cancelled and Rejected
            },
            aspReachedToBreakdownAt: { [Op.ne]: null },
          },
          attributes: ["id"],
        });
        if (hasReachedBreakdown) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error:
              "Cannot update breakdown location as ASP has already reached breakdown location.",
          });
        } else {
          if (!payload.breakdownLocationReason) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Breakdown location reason is required",
            });
          }

          //GET MASTER DETAILS
          const getMasterDetail = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              breakdownAreaId: payload.breakdownAreaId,
            }
          );
          if (!getMasterDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json(getMasterDetail.data);
          }

          const activityRateCardUpdateResponse =
            await rsaActivitiesRateCardUpdate(
              payload,
              activity,
              null,
              transaction
            );
          if (!activityRateCardUpdateResponse.success) {
            await transaction.rollback();
            return res.status(200).json(activityRateCardUpdateResponse);
          }

          const caseInformationUpdateFields: any = {};
          caseInformationUpdateFields.breakdownLocationChangeReason =
            payload.breakdownLocationReason;
          caseInformationUpdateFields.breakdownLocationUpdatedAt = new Date();
          caseInformationUpdateFields.breakdownLocation =
            payload.breakdownLocation;
          caseInformationUpdateFields.breakdownLat = payload.breakdownLat;
          caseInformationUpdateFields.breakdownLong = payload.breakdownLong;
          caseInformationUpdateFields.breakdownAreaId = payload.breakdownAreaId;
          caseInformationUpdateFields.breakdownLocationStateId = payload.breakdownStateId
            ? payload.breakdownStateId
            : null;
          caseInformationUpdateFields.customerLocation =
            payload.breakdownLocation;
          caseInformationUpdateFields.customerStateId =
            payload.breakdownStateId;

          // Get nearest dealer for towing service
          caseInformationUpdateFields.nearestDealerId = null;
          if (activity.caseDetail.caseInformation.dropLocation != null && payload.breakdownLat && payload.breakdownLong) {
            const nearestDealerResponse = await Utils.getNearestDealerByBreakdownLocation({
              clientId: activity.caseDetail.clientId,
              caseTypeId: activity.caseDetail.caseInformation.caseTypeId,
              breakdownLat: payload.breakdownLat,
              breakdownLong: payload.breakdownLong,
            });
            if (nearestDealerResponse && nearestDealerResponse.success) {
              caseInformationUpdateFields.nearestDealerId = nearestDealerResponse.nearestDealerId;
            }
          }

          // Create activity log with breakdown location update details
          const breakdownDescriptionParts: string[] = [];

          // Location
          if (payload.breakdownLocation) {
            breakdownDescriptionParts.push(
              `Location: <span style="color:#999">${payload.breakdownLocation}</span>`
            );
          }

          // Reason
          if (payload.breakdownLocationReason) {
            breakdownDescriptionParts.push(
              `Reason: <span style="color:#999">${payload.breakdownLocationReason}</span>`
            );
          }

          // Updated By
          if (payload.authUserData?.name) {
            const roleName = payload.authUserData.role?.name || "";
            breakdownDescriptionParts.push(
              `Updated By: <span style="color:#999">${payload.authUserData.name}${roleName ? ` (${roleName})` : ""}</span>`
            );
          }

          await Promise.all([
            CaseDetails.update(
              { rmId: getMasterDetail.data.data.breakdownArea.rmId },
              {
                where: {
                  id: payload.caseDetailId,
                },
                transaction: transaction,
              }
            ),
            CaseInformation.update(caseInformationUpdateFields, {
              where: {
                caseDetailId: payload.caseDetailId,
              },
              transaction: transaction,
            }),
            ActivityLogs.create(
              {
                caseDetailId: payload.caseDetailId,
                typeId: 240, //WEB
                title: "Breakdown Location Updated",
                description: breakdownDescriptionParts.join('<br />'),
                createdById: payload.createdById || null,
              },
              {
                transaction: transaction,
              }
            ),
          ]);

          //UPDATE CASE IN ELK
          updateCaseInElk({
            caseId: payload.caseDetailId,
            statusId: activity.caseDetail.statusId,
            caseNumber: activity.caseDetail.caseNumber,
            subject: activity.caseDetail.subjectID,
            status: activity.caseDetail.statusId,
            customerContactName: activity.caseDetail.caseInformation.customerContactName,
            customerMobileNumber: activity.caseDetail.caseInformation.customerMobileNumber,
            breakdownLocation: payload.breakdownLocation,
            clientId: activity.caseDetail.clientId,
            vehicleNumber: activity.caseDetail.registrationNumber,
            vin: activity.caseDetail.vin,
            irateCustomer: activity.caseDetail.caseInformation.irateCustomer,
            dropLocation: activity.caseDetail.caseInformation.dropLocation,
            callCenter: activity.caseDetail.callCenterId,
            agent: activity.caseDetail.agentId,
            rmName: getMasterDetail.data.data.breakdownArea.rmId,
            womenAssist: activity.caseDetail.caseInformation.womenAssist,
            policyType: activity.caseDetail.caseInformation.policyTypeId,
            policyNumber: activity.caseDetail.caseInformation.policyNumber,
            policyStartDate: activity.caseDetail.caseInformation.policyStartDate,
            policyEndDate: activity.caseDetail.caseInformation.policyEndDate,
          });
        }
        message = "The breakdown location has been updated successfully";
      } else {
        //DROP LOCATION
        // const authUserPermissions = payload.authUserData.permissions;
        // if (
        //   !Utils.hasPermission(authUserPermissions, "edit-drop-location-web")
        // ) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: "Permission not found",
        //   });
        // }

        if (!payload.dropLocationReason) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Drop location reason is required",
          });
        }

        //GET MASTER DETAILS
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

        const towingSubServiceIds =
          getMasterDetail.data.data.towingSubServiceDetails.map(
            (towingSubServiceDetail: any) => towingSubServiceDetail.id
          );
        //TOWING SERVICE
        if (getMasterDetail.data.data.subService.service.id == 1) {
          if (!payload.dropLocationTypeId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop location type is required",
            });
          }

          if (!payload.dropLocationLat) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop location lat is required",
            });
          }

          if (!payload.dropLocationLong) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop location long is required",
            });
          }

          if (!payload.dropLocation) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop location is required",
            });
          }

          if (!payload.breakdownToDropDistance) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Breakdown to drop distance is required",
            });
          }

          //DROP LOCATION TYPE IS DEALER OR CUSTOMER PREFERRED LOCATION IS DEALER AND DEALER IS NOT SELECTED
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
        }

        // PREVIOUS CODE - Check for positive towing activities
        // const positiveTowingActivities = await Activities.findAll({
        //   attributes: ["id"],
        //   where: {
        //     caseDetailId: payload.caseDetailId,
        //     activityStatusId: {
        //       [Op.notIn]: [1, 4, 8], //Except open, cancelled, rejected
        //     },
        //   },
        //   include: {
        //     model: ActivityAspDetails,
        //     attributes: ["id"],
        //     required: true,
        //     where: {
        //       subServiceId: {
        //         [Op.in]: towingSubServiceIds,
        //       },
        //     },
        //   },
        // });
        // if (positiveTowingActivities.length > 0) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error:
        //       "Case activity is currently in progress, so it is not possible to update the drop location.",
        //   });
        // } else {

        // Check if any activity has reached breakdown location
        // Exclude cancelled (4) and rejected (8) activities
        const hasReachedBreakdown: any = await Activities.findOne({
          where: {
            caseDetailId: payload.caseDetailId,
            activityStatusId: {
              [Op.notIn]: [4, 8], // Exclude Cancelled and Rejected
            },
            aspReachedToBreakdownAt: { [Op.ne]: null },
          },
          attributes: ["id"],
        });
        // If ASP has reached breakdown location and additional service is not requested, then return error
        if (hasReachedBreakdown && !activity.caseDetail.caseInformation.additionalServiceRequested) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error:
              "Cannot update drop location as ASP has already reached breakdown location.",
          });
        } else {
          const activityRateCardUpdateResponse =
            await rsaActivitiesRateCardUpdate(
              payload,
              activity,
              towingSubServiceIds,
              transaction
            );
          if (!activityRateCardUpdateResponse.success) {
            await transaction.rollback();
            return res.status(200).json(activityRateCardUpdateResponse);
          }

          const caseInformationUpdateFields: any = {};
          caseInformationUpdateFields.dropLocationChangeReason =
            payload.dropLocationReason;
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
          caseInformationUpdateFields.dropLocationLat = payload.dropLocationLat;
          caseInformationUpdateFields.dropLocationLong =
            payload.dropLocationLong;
          caseInformationUpdateFields.dropAreaId = payload.dropAreaId
            ? payload.dropAreaId
            : null; //DROP AREA WILL COME ONLY IF CUSTOMER PREFERRED LOCATION IS HOME / GARAGE / CHARGING STATION
          caseInformationUpdateFields.dropLocationStateId = payload.dropStateId
            ? payload.dropStateId
            : null;
          caseInformationUpdateFields.breakdownToDropLocationDistance =
            payload.breakdownToDropDistance
              ? payload.breakdownToDropDistance
              : null;

          // Create activity log with drop location update details
          const dropDescriptionParts: string[] = [];

          // Location
          if (payload.dropLocation) {
            dropDescriptionParts.push(
              `Location: <span style="color:#999">${payload.dropLocation}</span>`
            );
          }

          // Fetch Drop Location Type Name
          let dropLocationTypeName = null;
          if (payload.dropLocationTypeId) {
            try {
              const dropLocationTypeResponse = await axios.post(
                `${masterService}/${endpointMaster.getMasterDetails}`,
                {
                  dropLocationTypeId: payload.dropLocationTypeId,
                }
              );
              if (dropLocationTypeResponse?.data?.success && dropLocationTypeResponse.data.data?.dropLocationType?.name) {
                dropLocationTypeName = dropLocationTypeResponse.data.data.dropLocationType.name;
              }
            } catch (error: any) {
              // If drop location type fetch fails, skip it
            }
          }

          // Drop Location Type
          if (dropLocationTypeName) {
            dropDescriptionParts.push(
              `Drop Location Type: <span style="color:#999">${dropLocationTypeName}</span>`
            );
          }

          // Fetch Drop Dealer Name
          let dropDealerName = null;
          if (payload.dropDealerId) {
            try {
              // Use the correct dealer detail API from master server config
              const dealerResponse = await axios.get(
                `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${payload.dropDealerId}`
              );
              if (dealerResponse?.data?.success && dealerResponse.data.data?.name) {
                dropDealerName = dealerResponse.data.data.name;
              }
            } catch (error: any) {
              // If dealer fetch fails, skip it
            }
          }

          // Drop Dealer (if applicable)
          if (dropDealerName) {
            dropDescriptionParts.push(
              `Drop Dealer: <span style="color:#999">${dropDealerName}</span>`
            );
          }

          // Reason
          if (payload.dropLocationReason) {
            dropDescriptionParts.push(
              `Reason: <span style="color:#999">${payload.dropLocationReason}</span>`
            );
          }

          // Updated By
          if (payload.authUserData?.name) {
            const roleName = payload.authUserData.role?.name || "";
            dropDescriptionParts.push(
              `Updated By: <span style="color:#999">${payload.authUserData.name}${roleName ? ` (${roleName})` : ""}</span>`
            );
          }

          await Promise.all([
            CaseInformation.update(caseInformationUpdateFields, {
              where: {
                caseDetailId: payload.caseDetailId,
              },
              transaction: transaction,
            }),
            ActivityLogs.create(
              {
                caseDetailId: payload.caseDetailId,
                typeId: 240, //WEB
                title: "Drop Location Updated",
                description: dropDescriptionParts.join('<br />'),
                createdById: payload.createdById || null,
              },
              {
                transaction: transaction,
              }
            ),
          ]);

          //UPDATE CASE IN ELK
          updateCaseInElk({
            caseId: activity.caseDetail.id,
            statusId: activity.caseDetail.statusId,
            caseNumber: activity.caseDetail.caseNumber,
            subject: activity.caseDetail.subjectID,
            status: activity.caseDetail.statusId,
            customerContactName: activity.caseDetail.caseInformation.customerContactName,
            customerMobileNumber: activity.caseDetail.caseInformation.customerMobileNumber,
            breakdownLocation: activity.caseDetail.caseInformation.breakdownLocation,
            clientId: activity.caseDetail.clientId,
            vehicleNumber: activity.caseDetail.registrationNumber,
            vin: activity.caseDetail.vin,
            irateCustomer: activity.caseDetail.caseInformation.irateCustomer,
            dropLocation: payload.dropLocation,
            callCenter: activity.caseDetail.callCenterId,
            agent: activity.caseDetail.agentId,
            rmName: activity.caseDetail.rmId,
            womenAssist: activity.caseDetail.caseInformation.womenAssist,
            policyType: activity.caseDetail.caseInformation.policyTypeId,
            policyNumber: activity.caseDetail.caseInformation.policyNumber,
            policyStartDate: activity.caseDetail.caseInformation.policyStartDate,
            policyEndDate: activity.caseDetail.caseInformation.policyEndDate,
          });
        }
        message = "The drop location has been updated successfully";
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

  export async function updateLocation(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      if (!payload.caseDetailId) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail is required",
        });
      }

      if (!payload.editType) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Edit type is required",
        });
      }

      const caseDetail: any = await CaseDetails.findOne({
        attributes: [
          "id",
          "clientId",
          "caseNumber",
          "deliveryRequestSchemeId",
          "locationTypeId",
          "pickupLatitude",
          "pickupLongitude",
          "dropLatitude",
          "dropLongitude",
          "createdAt",
        ],
        where: {
          id: payload.caseDetailId,
          statusId: 2, //In Progress
        },
      });
      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      const positiveActivities = await Activities.findAll({
        attributes: ["id"],
        where: {
          caseDetailId: payload.caseDetailId,
          activityStatusId: {
            [Op.notIn]: [1, 4, 8], //Except open, cancelled, rejected
          },
        },
      });

      if (positiveActivities.length > 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error:
            "Case activity is currently in progress, so it is not possible to update the location.",
        });
      }

      let message = null;
      //PICKUP
      if (payload.editType == 1) {
        if (!payload.pickupLocationReason) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Pickup location reason is required",
          });
        }

        //LOCATION TYPE IS CUSTOMER PREFERRED LOCATION
        if (caseDetail.locationTypeId == 451) {
          if (!payload.pickupLocation) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Pickup location is required",
            });
          }
          if (!payload.pickupLatitude) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Pickup latitude is required",
            });
          }
          if (!payload.pickupLongitude) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Pickup longitude is required",
            });
          }
          if (!payload.pickupStateId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Pickup state is required",
            });
          }
          if (!payload.pickupCityId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Pickup city is required",
            });
          }
          if (!payload.pickupLocationPinCode) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Pickup pin code is required",
            });
          }
        } else {
          //LOCATION TYPE IS DEALER
          if (!payload.pickupDealerId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Pickup dealer is required",
            });
          }
        }

        const caseDetailUpdateFields: any = {};
        caseDetailUpdateFields.pickupLocationChangeReason =
          payload.pickupLocationReason;
        //LOCATION TYPE IS CUSTOMER PREFERRED LOCATION
        if (caseDetail.locationTypeId && caseDetail.locationTypeId == 451) {
          const getMasterDetail = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              pickupCityId: payload.pickupCityId,
            }
          );
          if (!getMasterDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json(getMasterDetail.data);
          }

          caseDetailUpdateFields.pickupLatitude = payload.pickupLatitude;
          caseDetailUpdateFields.pickupLongitude = payload.pickupLongitude;
          caseDetailUpdateFields.deliveryRequestPickUpLocation =
            payload.pickupLocation;
          caseDetailUpdateFields.deliveryRequestPickUpStateId =
            payload.pickupStateId;
          caseDetailUpdateFields.deliveryRequestPickUpCityId =
            payload.pickupCityId;
          caseDetailUpdateFields.rmId =
            getMasterDetail.data?.data?.pickupCity?.rmId || null;
          caseDetailUpdateFields.pickupLocationPinCode =
            payload.pickupLocationPinCode;
        } else {
          //DEALER
          const getMasterDetail = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              pickupDealerId: payload.pickupDealerId,
            }
          );
          if (!getMasterDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json(getMasterDetail.data);
          }
          const pickupDealerData = getMasterDetail.data.data.pickupDealer;
          caseDetailUpdateFields.dealerId = pickupDealerData.id;
          caseDetailUpdateFields.pickupLatitude = pickupDealerData.lat;
          caseDetailUpdateFields.pickupLongitude = pickupDealerData.long;
          caseDetailUpdateFields.deliveryRequestPickUpLocation =
            pickupDealerData.correspondenceAddress;
          caseDetailUpdateFields.deliveryRequestPickUpStateId =
            pickupDealerData.stateId;
          caseDetailUpdateFields.deliveryRequestPickUpCityId =
            pickupDealerData.cityId;
          caseDetailUpdateFields.rmId = pickupDealerData?.city?.rmId || null;
          caseDetailUpdateFields.pickupLocationPinCode =
            pickupDealerData.pincode;
          payload.pickupDealerData = pickupDealerData;
        }

        const activityRateCardUpdateResponse =
          await vdmActivitiesRateCardUpdate(payload, caseDetail, transaction);
        if (!activityRateCardUpdateResponse.success) {
          await transaction.rollback();
          return res.status(200).json(activityRateCardUpdateResponse);
        }

        await Promise.all([
          CaseDetails.update(caseDetailUpdateFields, {
            where: {
              id: payload.caseDetailId,
            },
            transaction: transaction,
          }),
          ActivityLogs.create(
            {
              caseDetailId: payload.caseDetailId,
              typeId: 240, //WEB
              title: `The agent "${payload.authUserData.name}" has updated the pickup location for the case "${caseDetail.caseNumber}".`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);
        message = "The pickup location has been successfully updated.";
      } else {
        //DROP
        if (!payload.dropLocationReason) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Drop location reason is required",
          });
        }

        //LOCATION TYPE IS CUSTOMER PREFERRED LOCATION
        if (caseDetail.locationTypeId && caseDetail.locationTypeId == 451) {
          if (!payload.dropLocation) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop location is required",
            });
          }
          if (!payload.dropLatitude) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop latitude is required",
            });
          }
          if (!payload.dropLongitude) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop longitude is required",
            });
          }
          if (!payload.dropStateId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop state is required",
            });
          }
          if (!payload.dropCityId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop city is required",
            });
          }
          if (!payload.dropLocationPinCode) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop location pin code is required",
            });
          }
        } else {
          //LOCATION TYPE IS DEALER
          if (!payload.dropDealerId) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "Drop dealer is required",
            });
          }
        }

        const caseDetailUpdateFields: any = {};
        caseDetailUpdateFields.dropLocationChangeReason =
          payload.dropLocationReason;
        //LOCATION TYPE IS CUSTOMER PREFERRED LOCATION
        if (caseDetail.locationTypeId && caseDetail.locationTypeId == 451) {
          caseDetailUpdateFields.dropLatitude = payload.dropLatitude;
          caseDetailUpdateFields.dropLongitude = payload.dropLongitude;
          caseDetailUpdateFields.deliveryRequestDropLocation =
            payload.dropLocation;
          caseDetailUpdateFields.deliveryRequestDropStateId =
            payload.dropStateId;
          caseDetailUpdateFields.deliveryRequestDropCityId = payload.dropCityId;
          caseDetailUpdateFields.dropLocationPinCode =
            payload.dropLocationPinCode;
        } else {
          //DEALER
          const getMasterDetail = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              dropDealerId: payload.dropDealerId,
            }
          );
          if (!getMasterDetail.data.success) {
            await transaction.rollback();
            return res.status(200).json(getMasterDetail.data);
          }
          const dropDealerData = getMasterDetail.data.data.dropDealer;
          caseDetailUpdateFields.deliveryRequestDropDealerId =
            dropDealerData.id;
          caseDetailUpdateFields.dropLatitude = dropDealerData.lat;
          caseDetailUpdateFields.dropLongitude = dropDealerData.long;
          caseDetailUpdateFields.deliveryRequestDropLocation =
            dropDealerData.correspondenceAddress;
          caseDetailUpdateFields.deliveryRequestDropStateId =
            dropDealerData.stateId;
          caseDetailUpdateFields.deliveryRequestDropCityId =
            dropDealerData.cityId;
          caseDetailUpdateFields.dropLocationPinCode = dropDealerData.pincode;
          payload.dropDealerData = dropDealerData;
        }

        const activityRateCardUpdateResponse =
          await vdmActivitiesRateCardUpdate(payload, caseDetail, transaction);
        if (!activityRateCardUpdateResponse.success) {
          await transaction.rollback();
          return res.status(200).json(activityRateCardUpdateResponse);
        }

        await Promise.all([
          CaseDetails.update(caseDetailUpdateFields, {
            where: {
              id: payload.caseDetailId,
            },
            transaction: transaction,
          }),
          ActivityLogs.create(
            {
              caseDetailId: payload.caseDetailId,
              typeId: 240, //WEB
              title: `The agent "${payload.authUserData.name}" has updated the drop location for the case "${caseDetail.caseNumber}".`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);
        message = "The drop location has been successfully updated.";
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

  export async function rsaOverAllMapCaseViewDetails(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const currentDateTime = moment()
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD HH:mm:ss");
      const last24Hours = moment()
        .tz("Asia/Kolkata")
        .subtract(24, "hours")
        .format("YYYY-MM-DD HH:mm:ss");

      let where = Object();
      if (payload.searchKey) {
        where[Op.or] = [
          { caseNumber: { [Op.like]: `%${payload.searchKey}%` } },
          { registrationNumber: { [Op.like]: `%${payload.searchKey}%` } },
          { vin: { [Op.like]: `%${payload.searchKey}%` } },
        ];
      }

      // Date filter - use startDate/endDate if provided, otherwise default to last 24 hours
      if (payload.startDate && payload.endDate) {
        // Ensure dates are in correct format for database query
        const startDate = moment(payload.startDate).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
        const endDate = moment(payload.endDate).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
        where.createdAt = {
          [Op.between]: [startDate, endDate],
        };
      } else {
        where.createdAt = {
          [Op.between]: [last24Hours, currentDateTime],
        };
      }

      // Status filter
      if (payload.statusIds && payload.statusIds.length > 0) {
        where.statusId = {
          [Op.in]: payload.statusIds,
        };
      } else {
        where.statusId = { [Op.notIn]: [3, 4] }; //3-Cancelled,4-Closed
      }

      // Client filter
      if (payload.clientIds && payload.clientIds.length > 0) {
        where.clientId = {
          [Op.in]: payload.clientIds,
        };
      }

      // Case Number filter
      if (payload.caseNumber) {
        where.caseNumber = { [Op.like]: `%${payload.caseNumber}%` };
      }

      // State filter - filter directly by breakdownLocationStateId in CaseInformation
      let caseInformationWhere: any = {};
      if (payload.stateIds && payload.stateIds.length > 0) {
        caseInformationWhere.breakdownLocationStateId = {
          [Op.in]: payload.stateIds,
        };
      }

      // Problem/Case Subject filter - convert caseSubjectNames to IDs
      let caseSubjectIds: any[] = [];
      if (payload.caseSubjectNames && payload.caseSubjectNames.length > 0) {
        // Get CaseSubject IDs from Master Service based on names
        try {
          const caseSubjectResponse = await axios.post(
            `${masterService}/${endpointMaster.getCrmListFilterData}`,
            {
              caseSubjectNames: payload.caseSubjectNames,
            }
          );
          if (caseSubjectResponse.data.success && caseSubjectResponse.data.data.caseSubjectIds) {
            caseSubjectIds = caseSubjectResponse.data.data.caseSubjectIds;
          }
        } catch (error) {
          console.error("Error fetching case subject IDs:", error);
        }
      }
      if (caseSubjectIds.length > 0) {
        where.subjectID = {
          [Op.in]: caseSubjectIds,
        };
      }

      // Service filter - for delivery requests through CaseInformation
      if (payload.serviceIds && payload.serviceIds.length > 0) {
        caseInformationWhere.serviceId = {
          [Op.in]: payload.serviceIds,
        };
      }

      const crmHaversine = `(
        6371 * acos(
            cos(radians(${payload.lat}))
            * cos(radians(breakdownLat))
            * cos(radians(breakdownLong) - radians(${payload.long}))
            + sin(radians(${payload.lat})) * sin(radians(breakdownLat))
        )
      )`;

      const vdmHaversine = `(
        6371 * acos(
            cos(radians(${payload.lat}))
            * cos(radians(pickupLatitude))
            * cos(radians(pickupLongitude) - radians(${payload.long}))
            + sin(radians(${payload.lat})) * sin(radians(pickupLatitude))
        )
      )`;

      const [crmCaseDetails, vdmCaseDetails]: any = await Promise.all([
        CaseInformation.findAll({
          attributes: [
            "id",
            "caseDetailId",
            [sequelize.literal(crmHaversine), "distance"],
          ],
          where: Object.keys(caseInformationWhere).length > 0 ? caseInformationWhere : undefined,
          include: {
            model: CaseDetails,
            attributes: ["id"],
            where: where,
            required: true,
          },
          order: sequelize.col("distance"),
          // having: sequelize.literal(`distance <= ${payload.radius}`), // Uncomment this when the radius filter is required
        }),
        CaseDetails.findAll({
          attributes: ["id", [sequelize.literal(vdmHaversine), "distance"]],
          where: where,
          order: sequelize.col("distance"),
          // having: sequelize.literal(`distance <= ${payload.radius}`),
        }),
      ]);

      const crmCaseIds = crmCaseDetails.map(
        (crmCaseDetail: any) => crmCaseDetail.dataValues.caseDetailId
      );
      const vdmCaseIds = vdmCaseDetails.map(
        (vdmCaseDetail: any) => vdmCaseDetail.dataValues.id
      );
      const caseIds = [...crmCaseIds, ...vdmCaseIds];

      // Handle ASP Code filter - get ASP ID from code
      let aspIdsFromCode: number[] = [];
      if (payload.aspCode) {
        try {
          const aspResponse = await axios.get(
            `${masterService}/${endpointMaster.asps.getAspDetails}?aspCode=${payload.aspCode}&setParanoidFalse=true`
          );
          if (aspResponse.data.success && aspResponse.data.data && aspResponse.data.data.id) {
            aspIdsFromCode = [aspResponse.data.data.id];
          }
        } catch (error) {
          console.error("Error fetching ASP by code:", error);
        }
      }

      // Handle Service Organisation filter - get ASP IDs from COCO vehicles by service organisation IDs
      let aspIdsFromServiceOrganisation: number[] = [];
      if (payload.serviceOrganisationIds && payload.serviceOrganisationIds.length > 0) {
        try {
          // Get ASP IDs directly from COCO vehicles by service organisation IDs
          const aspIdsResponse = await axios.post(
            `${masterService}/${endpointMaster.ownPatrolVehicle.getAspIdsByServiceOrganisationIds}`,
            {
              serviceOrganisationIds: payload.serviceOrganisationIds,
            }
          );
          if (aspIdsResponse.data.success && aspIdsResponse.data.data) {
            aspIdsFromServiceOrganisation = Array.isArray(aspIdsResponse.data.data)
              ? aspIdsResponse.data.data
              : [];
          }
        } catch (error) {
          console.error("Error fetching ASP IDs by service organisation:", error);
        }
      }

      // Combine ASP IDs from both filters
      const allAspIds = [...aspIdsFromCode, ...aspIdsFromServiceOrganisation];
      const uniqueAspIds = Array.from(new Set(allAspIds));

      if (payload.aspCode || (payload.serviceOrganisationIds && payload.serviceOrganisationIds.length > 0)) {
        if (uniqueAspIds.length == 0) {
          return res.status(200).json({
            success: false,
            error: "No Case found",
          });
        }
      }

      // Build ActivityAspDetails where condition
      let activityAspDetailWhere: any = {};
      if (uniqueAspIds.length > 0) {
        activityAspDetailWhere.aspId = {
          [Op.in]: uniqueAspIds,
        };
      }
      // Un-Assignment Reasons filter (mapped to rejectReasonId in ActivityAspDetails)
      if (payload.unAssignmentReasonIds && payload.unAssignmentReasonIds.length > 0) {
        activityAspDetailWhere.rejectReasonId = {
          [Op.in]: payload.unAssignmentReasonIds,
        };
      }

      let activityWhere: any = {};
      if (payload.activityStatusIds && payload.activityStatusIds.length > 0) {
        activityWhere.activityStatusId = {
          [Op.in]: payload.activityStatusIds,
        };
      }
      if (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) {
        activityWhere.aspActivityStatusId = {
          [Op.in]: payload.aspActivityStatusIds,
        };
      }

      const caseDetails: any = await CaseDetails.findAll({
        attributes: [
          "id",
          "typeId",
          "clientId",
          "caseNumber",
          "registrationNumber",
          "vin",
          "vehicleTypeId",
          "vehicleMakeId",
          "vehicleModelId",
          "subjectID",
          "agentId",
          "pickupLatitude",
          "pickupLongitude",
          "statusId",
          "deliveryRequestPickupDate",
          "deliveryRequestPickupTime",
          "deliveryRequestSubServiceId",
          "createdAt",
        ],
        where: {
          id: {
            [Op.in]: caseIds,
          },
        },
        include: [
          {
            model: Activities,
            attributes: ["id", "activityStatusId", "aspReachedToBreakdownAt", "isInitiallyCreated", "isImmediateService", "serviceInitiatingAt", "createdAt"],
            required: Object.keys(activityAspDetailWhere).length > 0 || Object.keys(activityWhere).length > 0 ? true : false,
            where: Object.keys(activityWhere).length > 0 ? activityWhere : undefined,
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id", "aspId", "subServiceId"],
                required: Object.keys(activityAspDetailWhere).length > 0 ? true : false,
                where: Object.keys(activityAspDetailWhere).length > 0 ? activityAspDetailWhere : undefined,
              },
            ],
          },
          {
            model: CaseInformation,
            required: Object.keys(caseInformationWhere).length > 0 ? true : false,
            where: Object.keys(caseInformationWhere).length > 0 ? caseInformationWhere : undefined,
            attributes: [
              "id",
              "caseTypeId",
              "breakdownLat",
              "breakdownLong",
              "breakdownAreaId",
              "womenAssist",
              "irateCustomer",
              "dropLocationLat",
              "dropLocationLong",
            ],
          },
        ],
      });

      const details = [];
      for (const caseDetail of caseDetails) {
        const caseActivities = caseDetail.activities;

        // Check SLA status filter if present
        let shouldIncludeCase = true;
        if (payload.slaStatusIds && payload.slaStatusIds.length > 0 && caseDetail.caseInformation?.breakdownAreaId) {
          // Find the primary activity for SLA calculation (last positive flow activity with ASP assigned, or last positive activity)
          let primaryActivity = null;
          for (let i = caseActivities.length - 1; i >= 0; i--) {
            const caseActivity = caseActivities[i];
            const { activityAspDetail, activityStatusId } = caseActivity;
            const isPositiveFlow =
              activityAspDetail &&
              activityStatusId != 4 &&
              activityStatusId != 8;
            if (isPositiveFlow && activityAspDetail.aspId) {
              primaryActivity = caseActivity;
              break;
            }
          }
          // If no ASP assigned activity found, use last positive flow activity
          if (!primaryActivity) {
            for (let i = caseActivities.length - 1; i >= 0; i--) {
              const caseActivity = caseActivities[i];
              const { activityAspDetail, activityStatusId } = caseActivity;
              const isPositiveFlow =
                activityAspDetail &&
                activityStatusId != 4 &&
                activityStatusId != 8;
              if (isPositiveFlow) {
                primaryActivity = caseActivity;
                break;
              }
            }
          }

          if (primaryActivity) {
            // Fetch SLA details for this case's breakdown area
            let activityRsaSlaDetails: any[] = [];
            let activityExceededExpectationSlaMins: number = 10;
            try {
              const breakdownCities = [{
                id: caseDetail.caseInformation.breakdownAreaId,
                typeId: 870, // ASP Breakdown Reach Time SLA - L1
              }];
              const filterDataResponse = await axios.post(
                `${masterService}/${endpointMaster.getCrmListFilterData}`,
                { breakdownCities }
              );
              if (filterDataResponse.data.success) {
                activityRsaSlaDetails = filterDataResponse.data.data.breakdownCitySlaSettings || [];
                activityExceededExpectationSlaMins = filterDataResponse.data.data.exceededExpectationSlaMins?.name || 10;
              }
            } catch (error) {
              console.error("Error fetching SLA details for case:", error);
            }

            const slaStatusId = await getBreakdownReachSlaStatusId(
              primaryActivity,
              caseDetail,
              activityRsaSlaDetails,
              activityExceededExpectationSlaMins
            );

            // If SLA status doesn't match filter, exclude this case
            if (slaStatusId === null || !payload.slaStatusIds.includes(slaStatusId)) {
              shouldIncludeCase = false;
            }
          } else {
            // No positive flow activity found - exclude if SLA filter is present
            shouldIncludeCase = false;
          }
        }

        if (!shouldIncludeCase) {
          continue; // Skip this case
        }

        //CASE CREATED DETAIL
        if (!caseDetail.agentId) {
          details.push(await formCaseDetailForMapView(caseDetail, "yellow"));
        } else if (caseDetail.agentId) {
          let aspNotAssignedPositiveFlowActivities = [];
          let positiveFlowActivities = [];
          let aspAssignedPositiveFlowActivities = [];

          for (const caseActivity of caseActivities) {
            const { activityAspDetail, activityStatusId } = caseActivity;

            // ACTIVITY STATUS ID OTHER THAN CANCELED AND REJECTED CONSIDERED AS POSITIVE FLOW
            const isPositiveFlow =
              activityAspDetail &&
              activityStatusId != 4 &&
              activityStatusId != 8;

            if (isPositiveFlow) {
              positiveFlowActivities.push(caseActivity); // POSITIVE FLOW

              if (activityAspDetail.aspId) {
                aspAssignedPositiveFlowActivities.push(caseActivity); // ASP ASSIGNED
              } else {
                aspNotAssignedPositiveFlowActivities.push(caseActivity); // ASP NOT ASSIGNED
              }
            }
          }

          //ASP NOT ASSIGNED DETAIL
          if (
            caseActivities.length == 0 ||
            (aspNotAssignedPositiveFlowActivities &&
              aspNotAssignedPositiveFlowActivities.length > 0)
          ) {
            details.push(await formCaseDetailForMapView(caseDetail, "red"));
          } else if (
            positiveFlowActivities &&
            aspAssignedPositiveFlowActivities &&
            positiveFlowActivities.length ==
            aspAssignedPositiveFlowActivities.length
          ) {
            //ASP ASSIGNED DETAILS
            details.push(await formCaseDetailForMapView(caseDetail, "green"));
          }
        }
      }

      if (details.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No case found",
        });
      }

      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.overAllMapCaseViewMasterDetail}`,
        {
          caseDetails: details,
        }
      );
      if (!getMasterDetail.data.success) {
        return res.status(200).json(getMasterDetail.data);
      }

      return res.status(200).json({
        success: true,
        data: getMasterDetail.data.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Get Case Summary and Case Details for ASP/Vehicle in Map View
  export async function getMapViewVehicleCaseDetails(req: Request, res: Response) {
    try {
      const { aspId } = req.body;

      if (!aspId) {
        return res.status(200).json({
          success: false,
          error: "ASP ID is required",
        });
      }

      // Calculate date 30 days ago for filtering
      const thirtyDaysAgo = moment().tz("Asia/Kolkata").subtract(30, "days").startOf("day").toDate();

      // Get ALL case IDs for summary calculation (no filtering)
      const allActivitiesForSummary = await Activities.findAll({
        attributes: ["caseDetailId"],
        include: [
          {
            model: ActivityAspDetails,
            where: { aspId },
            attributes: [],
            required: true,
          },
          {
            model: CaseDetails,
            attributes: ["id"],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      });
      const allCaseIds = [...new Set(allActivitiesForSummary.map((act: any) => act.caseDetailId).filter((id: any) => id))];

      // Get activities assigned to this ASP - query Activities as primary table
      // Filter: Only cases created in last 30 days with status Open (1) or In Progress (2)
      const activitiesList = await Activities.findAll({
        attributes: [
          "id",
          "caseDetailId",
          "activityStatusId",
          // "estimatedTimeOfResolution",
          // "estimatedTimeOfCompletion",
          "createdAt",
        ],
        include: [
          {
            model: ActivityAspDetails,
            where: { aspId },
            attributes: ["id", "aspId", "serviceId", "subServiceId"],
            required: true,
          },
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "subjectID",
              "statusId",
              "typeId",
              "registrationNumber",
              "createdAt",
            ],
            required: true,
            where: {
              statusId: { [Op.in]: [1, 2] }, // Open (1) or In Progress (2)
              createdAt: { [Op.gte]: thirtyDaysAgo }, // Last 30 days
            },
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "serviceId", "subServiceId"],
                required: false,
              },
            ],
          },
        ],
        order: [["id", "DESC"]],
      });

      if (allCaseIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            summary: {
              open: 0,
              inProgress: 0,
              cancelled: 0,
              closed: 0,
            },
            caseDetails: [],
          },
        });
      }

      // Use allCaseIds for summary calculation (no filtering)
      const caseIds = allCaseIds;

      // Get case summary counts by status (all cases, no filtering for summary)
      const caseSummaryCounts = await CaseDetails.findAll({
        attributes: [
          "statusId",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        ],
        where: { id: { [Op.in]: caseIds } },
        group: ["statusId"],
        raw: true,
      });

      // Map status IDs to status names (1-Open, 2-In Progress, 3-Cancelled, 4-Closed)
      const summary = {
        open: 0,
        inProgress: 0,
        cancelled: 0,
        closed: 0,
      };

      caseSummaryCounts.forEach((item: any) => {
        if (item.statusId === 1) summary.open = parseInt(item.count);
        else if (item.statusId === 2) summary.inProgress = parseInt(item.count);
        else if (item.statusId === 3) summary.cancelled = parseInt(item.count);
        else if (item.statusId === 4) summary.closed = parseInt(item.count);
      });

      // Use activitiesList directly - no grouping, show all activities even if case ID is duplicated
      // Note: activitiesList is already filtered (last 30 days, status Open/In Progress) from the query above
      const caseDetailsList = activitiesList;

      // Collect IDs for master data
      const subjectIds = new Set();
      const activityStatusIds = new Set();
      const statusIds = new Set();
      const serviceIds = new Set();
      const subServiceIds = new Set();

      caseDetailsList.forEach((activity: any) => {
        const caseDetail = activity.caseDetail;
        if (caseDetail?.subjectID) subjectIds.add(caseDetail.subjectID);
        if (caseDetail?.statusId) statusIds.add(caseDetail.statusId);
        if (activity.activityStatusId) {
          activityStatusIds.add(activity.activityStatusId);
        }
        // Get service and subService from activity or case information
        const caseInfo = caseDetail?.caseInformation;
        const aspDetail = activity.activityAspDetail;

        // Priority: ActivityAspDetails > CaseInformation
        const serviceId = aspDetail?.serviceId || caseInfo?.serviceId;
        const subServiceId = aspDetail?.subServiceId || caseInfo?.subServiceId;

        if (serviceId) serviceIds.add(serviceId);
        if (subServiceId) subServiceIds.add(subServiceId);
      });

      // Fetch master data
      let subjectMasterData: any = {};
      let activityStatusMasterData: any = {};
      let statusMasterData: any = {};
      let serviceMasterData: any = {};
      let subServiceMasterData: any = {};

      if (subjectIds.size > 0 || activityStatusIds.size > 0 || statusIds.size > 0 || serviceIds.size > 0 || subServiceIds.size > 0) {
        const masterDetailResponse = await axios.post(
          `${masterService}/${endpointMaster.getMasterDetails}`,
          {
            subjectIds: Array.from(subjectIds),
            activityStatusIds: Array.from(activityStatusIds),
            caseStatusIds: Array.from(statusIds),
            serviceIds: Array.from(serviceIds),
            subServiceIds: Array.from(subServiceIds),
          }
        );

        if (masterDetailResponse.data.success) {
          if (masterDetailResponse.data.data.subjectsInformation) {
            masterDetailResponse.data.data.subjectsInformation.forEach((subject: any) => {
              subjectMasterData[subject.id] = subject.name;
            });
          }
          if (masterDetailResponse.data.data.activityStatusesInformation) {
            masterDetailResponse.data.data.activityStatusesInformation.forEach((status: any) => {
              activityStatusMasterData[status.id] = status.name;
            });
          }
          if (masterDetailResponse.data.data.caseStatusesInformation) {
            masterDetailResponse.data.data.caseStatusesInformation.forEach((status: any) => {
              statusMasterData[status.id] = status.name;
            });
          }
          if (masterDetailResponse.data.data.servicesInformation) {
            masterDetailResponse.data.data.servicesInformation.forEach((service: any) => {
              serviceMasterData[service.id] = service.name;
            });
          }
          if (masterDetailResponse.data.data.subServicesInformation) {
            masterDetailResponse.data.data.subServicesInformation.forEach((subService: any) => {
              subServiceMasterData[subService.id] = subService.name;
            });
          }
        }
      }

      // Format case details for response - based on Activities
      const formattedCaseDetails = caseDetailsList.map((activity: any) => {
        const caseDetail = activity.caseDetail;
        const caseInfo = caseDetail?.caseInformation;
        const aspDetail = activity.activityAspDetail;

        // Get service and subService - Priority: ActivityAspDetails > CaseInformation
        const serviceId = aspDetail?.serviceId || caseInfo?.serviceId;
        const subServiceId = aspDetail?.subServiceId || caseInfo?.subServiceId;

        return {
          caseNumber: caseDetail?.caseNumber || "--",
          caseId: caseDetail?.id || null,
          typeId: caseDetail?.typeId || null,
          subject: caseDetail?.subjectID ? (subjectMasterData[caseDetail.subjectID] || "--") : "--",
          service: serviceId ? (serviceMasterData[serviceId] || "--") : "--",
          subService: subServiceId ? (subServiceMasterData[subServiceId] || "--") : "--",
          activityStatus: activity.activityStatusId ? (activityStatusMasterData[activity.activityStatusId] || "--") : "--",
          caseStatus: caseDetail?.statusId ? (statusMasterData[caseDetail.statusId] || "--") : "--",
          caseStatusId: caseDetail?.statusId || null,
          createdAt: caseDetail?.createdAt
            ? moment(caseDetail.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss")
            : null,
          // etr: activity.estimatedTimeOfResolution
          //   ? moment(activity.estimatedTimeOfResolution).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm:ss")
          //   : "--",
          // etc: activity.estimatedTimeOfCompletion
          //   ? moment(activity.estimatedTimeOfCompletion).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm:ss")
          //   : "--",
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          summary,
          caseDetails: formattedCaseDetails,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Get Case Summary and Case Details for Technician in Map View
  export async function getMapViewTechnicianCaseDetails(req: Request, res: Response) {
    try {
      const { aspMechanicId } = req.body;

      if (!aspMechanicId) {
        return res.status(200).json({
          success: false,
          error: "Technician ID (aspMechanicId) is required",
        });
      }

      // Calculate date 30 days ago for filtering
      const thirtyDaysAgo = moment().tz("Asia/Kolkata").subtract(30, "days").startOf("day").toDate();

      // Get ALL case IDs for summary calculation (no filtering)
      const allActivitiesForSummary = await Activities.findAll({
        attributes: ["caseDetailId"],
        include: [
          {
            model: ActivityAspDetails,
            where: { aspMechanicId },
            attributes: [],
            required: true,
          },
          {
            model: CaseDetails,
            attributes: ["id"],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      });
      const allCaseIds = [...new Set(allActivitiesForSummary.map((act: any) => act.caseDetailId).filter((id: any) => id))];

      // Get activities assigned to this Technician - query Activities as primary table
      // Filter: Only cases created in last 30 days with status Open (1) or In Progress (2)
      const activitiesList = await Activities.findAll({
        attributes: [
          "id",
          "caseDetailId",
          "activityStatusId",
          // "estimatedTimeOfResolution",
          // "estimatedTimeOfCompletion",
          "createdAt",
        ],
        include: [
          {
            model: ActivityAspDetails,
            where: { aspMechanicId },
            attributes: ["id", "aspId", "aspMechanicId", "serviceId", "subServiceId"],
            required: true,
          },
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "subjectID",
              "statusId",
              "typeId",
              "registrationNumber",
              "createdAt",
            ],
            required: true,
            where: {
              statusId: { [Op.in]: [1, 2] }, // Open (1) or In Progress (2)
              createdAt: { [Op.gte]: thirtyDaysAgo }, // Last 30 days
            },
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "serviceId", "subServiceId"],
                required: false,
              },
            ],
          },
        ],
        order: [["id", "DESC"]],
      });

      if (allCaseIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            summary: {
              open: 0,
              inProgress: 0,
              cancelled: 0,
              closed: 0,
            },
            caseDetails: [],
          },
        });
      }

      // Use allCaseIds for summary calculation (no filtering)
      const caseIds = allCaseIds;

      // Get case summary counts by status (all cases, no filtering for summary)
      const caseSummaryCounts = await CaseDetails.findAll({
        attributes: [
          "statusId",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        ],
        where: { id: { [Op.in]: caseIds } },
        group: ["statusId"],
        raw: true,
      });

      // Map status IDs to status names (1-Open, 2-In Progress, 3-Cancelled, 4-Closed)
      const summary = {
        open: 0,
        inProgress: 0,
        cancelled: 0,
        closed: 0,
      };

      caseSummaryCounts.forEach((item: any) => {
        if (item.statusId === 1) summary.open = parseInt(item.count);
        else if (item.statusId === 2) summary.inProgress = parseInt(item.count);
        else if (item.statusId === 3) summary.cancelled = parseInt(item.count);
        else if (item.statusId === 4) summary.closed = parseInt(item.count);
      });

      // Use activitiesList directly - no grouping, show all activities even if case ID is duplicated
      // Note: activitiesList is already filtered (last 30 days, status Open/In Progress) from the query above
      const caseDetailsList = activitiesList;

      // Collect IDs for master data
      const subjectIds = new Set();
      const activityStatusIds = new Set();
      const statusIds = new Set();
      const serviceIds = new Set();
      const subServiceIds = new Set();

      caseDetailsList.forEach((activity: any) => {
        const caseDetail = activity.caseDetail;
        if (caseDetail?.subjectID) subjectIds.add(caseDetail.subjectID);
        if (caseDetail?.statusId) statusIds.add(caseDetail.statusId);
        if (activity.activityStatusId) {
          activityStatusIds.add(activity.activityStatusId);
        }
        // Get service and subService from activity or case information
        const caseInfo = caseDetail?.caseInformation;
        const aspDetail = activity.activityAspDetail;

        // Priority: ActivityAspDetails > CaseInformation
        const serviceId = aspDetail?.serviceId || caseInfo?.serviceId;
        const subServiceId = aspDetail?.subServiceId || caseInfo?.subServiceId;

        if (serviceId) serviceIds.add(serviceId);
        if (subServiceId) subServiceIds.add(subServiceId);
      });

      // Fetch master data
      let subjectMasterData: any = {};
      let activityStatusMasterData: any = {};
      let statusMasterData: any = {};
      let serviceMasterData: any = {};
      let subServiceMasterData: any = {};

      if (subjectIds.size > 0 || activityStatusIds.size > 0 || statusIds.size > 0 || serviceIds.size > 0 || subServiceIds.size > 0) {
        const masterDetailResponse = await axios.post(
          `${masterService}/${endpointMaster.getMasterDetails}`,
          {
            subjectIds: Array.from(subjectIds),
            activityStatusIds: Array.from(activityStatusIds),
            caseStatusIds: Array.from(statusIds),
            serviceIds: Array.from(serviceIds),
            subServiceIds: Array.from(subServiceIds),
          }
        );

        if (masterDetailResponse.data.success) {
          if (masterDetailResponse.data.data.subjectsInformation) {
            masterDetailResponse.data.data.subjectsInformation.forEach((subject: any) => {
              subjectMasterData[subject.id] = subject.name;
            });
          }
          if (masterDetailResponse.data.data.activityStatusesInformation) {
            masterDetailResponse.data.data.activityStatusesInformation.forEach((status: any) => {
              activityStatusMasterData[status.id] = status.name;
            });
          }
          if (masterDetailResponse.data.data.caseStatusesInformation) {
            masterDetailResponse.data.data.caseStatusesInformation.forEach((status: any) => {
              statusMasterData[status.id] = status.name;
            });
          }
          if (masterDetailResponse.data.data.servicesInformation) {
            masterDetailResponse.data.data.servicesInformation.forEach((service: any) => {
              serviceMasterData[service.id] = service.name;
            });
          }
          if (masterDetailResponse.data.data.subServicesInformation) {
            masterDetailResponse.data.data.subServicesInformation.forEach((subService: any) => {
              subServiceMasterData[subService.id] = subService.name;
            });
          }
        }
      }

      // Format case details for response - based on Activities
      const formattedCaseDetails = caseDetailsList.map((activity: any) => {
        const caseDetail = activity.caseDetail;
        const caseInfo = caseDetail?.caseInformation;
        const aspDetail = activity.activityAspDetail;

        // Get service and subService - Priority: ActivityAspDetails > CaseInformation
        const serviceId = aspDetail?.serviceId || caseInfo?.serviceId;
        const subServiceId = aspDetail?.subServiceId || caseInfo?.subServiceId;

        return {
          caseNumber: caseDetail?.caseNumber || "--",
          caseId: caseDetail?.id || null,
          typeId: caseDetail?.typeId || null,
          subject: caseDetail?.subjectID ? (subjectMasterData[caseDetail.subjectID] || "--") : "--",
          service: serviceId ? (serviceMasterData[serviceId] || "--") : "--",
          subService: subServiceId ? (subServiceMasterData[subServiceId] || "--") : "--",
          activityStatus: activity.activityStatusId ? (activityStatusMasterData[activity.activityStatusId] || "--") : "--",
          caseStatus: caseDetail?.statusId ? (statusMasterData[caseDetail.statusId] || "--") : "--",
          caseStatusId: caseDetail?.statusId || null,
          createdAt: caseDetail?.createdAt
            ? moment(caseDetail.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss")
            : null,
          // etr: activity.estimatedTimeOfResolution
          //   ? moment(activity.estimatedTimeOfResolution).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm:ss")
          //   : "--",
          // etc: activity.estimatedTimeOfCompletion
          //   ? moment(activity.estimatedTimeOfCompletion).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm:ss")
          //   : "--",
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          summary,
          caseDetails: formattedCaseDetails,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Get Service Details for Case in Map View
  export async function getMapViewCaseServiceDetails(req: Request, res: Response) {
    try {
      const { caseId } = req.body;

      if (!caseId) {
        return res.status(200).json({
          success: false,
          error: "Case ID is required",
        });
      }

      // Get case details with all required information
      const caseDetail: any = await CaseDetails.findOne({
        where: { id: caseId },
        attributes: [
          "id",
          "caseNumber",
          "registrationNumber",
          "clientId",
          "subjectID",
          "statusId",
          "typeId",
          "agentId",
          "createdAt",
        ],
        include: [
          {
            model: CaseInformation,
            attributes: [
              "id",
              "customerCurrentContactName",
              "customerCurrentMobileNumber",
              "breakdownLocation",
              "breakdownAreaId",
              "serviceId",
              "subServiceId",
            ],
            required: false,
          },
          {
            model: Activities,
            attributes: [
              "id",
              "activityStatusId",
              "aspActivityStatusId",
              "aspReachedToBreakdownAt",
              "isInitiallyCreated",
              "isImmediateService",
              "serviceInitiatingAt",
              "agentPickedAt",
              "createdAt",
            ],
            required: false,
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id", "aspId", "subServiceId", "serviceId"],
                required: false,
              },
            ],
            order: [["id", "DESC"]],
          },
        ],
      });

      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      // Get last positive activity for SLA calculation
      const lastPositiveActivity: any = await Activities.findOne({
        where: {
          caseDetailId: caseId,
          activityStatusId: {
            [Op.notIn]: [4, 5, 8], // Exclude Cancelled, Failure, Rejected
          },
        },
        attributes: [
          "id",
          "aspReachedToBreakdownAt",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "createdAt",
        ],
        include: [
          {
            model: ActivityAspDetails,
            attributes: ["id", "serviceId"],
            required: true,
            where: {
              serviceId: {
                [Op.in]: [1, 2], // Towing (1) or Mechanical (2)
              },
            },
          },
        ],
        order: [["id", "DESC"]],
        limit: 1,
      });

      // Calculate breakdown reach time SLA
      let breakdownReachTimeSLA: any = null;
      if (lastPositiveActivity) {
        breakdownReachTimeSLA = await calculateBreakdownReachTimeSLA(
          caseDetail,
          lastPositiveActivity
        );
      } else {
        const fallbackActivity = {
          id: null,
          aspReachedToBreakdownAt: null,
          isInitiallyCreated: false,
          isImmediateService: false,
          serviceInitiatingAt: null,
          createdAt: caseDetail.createdAt,
        };
        breakdownReachTimeSLA = await calculateBreakdownReachTimeSLA(
          caseDetail,
          fallbackActivity
        );
      }

      // Collect IDs for master data
      // Single values for case-level data
      const clientId = caseDetail.clientId || null;
      const statusId = caseDetail.statusId || null;
      const subjectId = caseDetail.subjectID || null;
      const agentId = caseDetail.agentId || null;

      // Sets for activity-level data (can have multiple)
      const aspIds = new Set();
      const subServiceIds = new Set();
      const serviceIds = new Set();
      const activityStatusIds = new Set();
      const aspActivityStatusIds = new Set();

      // Get activities for service details
      const activities = caseDetail.activities || [];
      activities.forEach((activity: any) => {
        const aspDetail = activity.activityAspDetail;
        const caseInfo = caseDetail.caseInformation;

        if (aspDetail?.aspId) aspIds.add(aspDetail.aspId);
        if (aspDetail?.subServiceId) subServiceIds.add(aspDetail.subServiceId);
        if (aspDetail?.serviceId) serviceIds.add(aspDetail.serviceId);
        if (caseInfo?.serviceId) serviceIds.add(caseInfo.serviceId);
        if (caseInfo?.subServiceId) subServiceIds.add(caseInfo.subServiceId);
        if (activity.activityStatusId) activityStatusIds.add(activity.activityStatusId);
        if (activity.aspActivityStatusId) aspActivityStatusIds.add(activity.aspActivityStatusId);
      });

      // Fetch master data
      let clientMasterData: any = {};
      let statusMasterData: any = {};
      let subjectMasterData: any = {};
      let agentMasterData: any = {};
      let aspMasterData: any = {};
      let subServiceMasterData: any = {};
      let serviceMasterData: any = {};
      let activityStatusMasterData: any = {};
      let aspActivityStatusMasterData: any = {};
      let locationTypeName: string = "--";

      // Fetch client, status, and subject names - use getMasterDetails with single values
      if (clientId || statusId || subjectId) {
        try {
          const masterDetailPayload: any = {};
          if (clientId) {
            masterDetailPayload.clientId = clientId;
          }
          if (statusId) {
            masterDetailPayload.caseStatusId = statusId;
          }
          if (subjectId) {
            masterDetailPayload.subjectId = subjectId;
          }

          const masterDetailResponse = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            masterDetailPayload
          );

          if (masterDetailResponse.data.success) {
            if (masterDetailResponse.data.data.client) {
              const client = masterDetailResponse.data.data.client;
              clientMasterData[client.id] = client.name || "--";
            }
            if (masterDetailResponse.data.data.caseStatus) {
              const status = masterDetailResponse.data.data.caseStatus;
              statusMasterData[status.id] = status.name || "--";
            }
            if (masterDetailResponse.data.data.subject) {
              const subject = masterDetailResponse.data.data.subject;
              subjectMasterData[subject.id] = subject.name || "--";
            }
          }
        } catch (error) {
          console.error("Error fetching client/status/subject data:", error);
        }
      }

      // Fetch agent name from user service
      if (agentId) {
        try {
          const agentResponse = await axios.post(
            `${userServiceUrl}/${userServiceEndpoint.getUser}`,
            { id: agentId }
          );
          if (agentResponse.data.success && agentResponse.data.user) {
            agentMasterData[agentResponse.data.user.id] = agentResponse.data.user.name;
          }
        } catch (error) {
          console.error("Error fetching agent data:", error);
        }
      }

      // Fetch location type
      if (caseDetail.caseInformation?.breakdownAreaId) {
        try {
          const cityResponse = await axios.post(
            `${masterService}/${endpointMaster.getCityData}`,
            { cityId: caseDetail.caseInformation.breakdownAreaId }
          );
          if (cityResponse.data.success && cityResponse.data.data?.locationTypeId) {
            const configResponse = await axios.get(
              `${masterService}/${endpointMaster.configs.getConfigById}?id=${cityResponse.data.data.locationTypeId}`
            );
            if (configResponse.data.success && configResponse.data.data) {
              locationTypeName = configResponse.data.data.name || "--";
            }
          }
        } catch (error) {
          console.error("Error fetching location type:", error);
        }
      }

      // Fetch ASP, Service, SubService, and Activity Status data
      if (aspIds.size > 0 || subServiceIds.size > 0 || serviceIds.size > 0 || activityStatusIds.size > 0 || aspActivityStatusIds.size > 0) {
        const masterDetailResponse = await axios.post(
          `${masterService}/${endpointMaster.getMasterDetails}`,
          {
            aspIds: Array.from(aspIds),
            subServiceIds: Array.from(subServiceIds),
            serviceIds: Array.from(serviceIds),
            activityStatusIds: Array.from(activityStatusIds),
            aspActivityStatusIds: Array.from(aspActivityStatusIds),
          }
        );

        if (masterDetailResponse.data.success) {
          if (masterDetailResponse.data.data.aspsInformation) {
            masterDetailResponse.data.data.aspsInformation.forEach((asp: any) => {
              aspMasterData[asp.id] = { name: asp.name, code: asp.code };
            });
          }
          if (masterDetailResponse.data.data.subServicesInformation) {
            masterDetailResponse.data.data.subServicesInformation.forEach((subService: any) => {
              subServiceMasterData[subService.id] = subService.name;
            });
          }
          if (masterDetailResponse.data.data.servicesInformation) {
            masterDetailResponse.data.data.servicesInformation.forEach((service: any) => {
              serviceMasterData[service.id] = service.name;
            });
          }
          if (masterDetailResponse.data.data.activityStatusesInformation) {
            masterDetailResponse.data.data.activityStatusesInformation.forEach((status: any) => {
              activityStatusMasterData[status.id] = status.name;
            });
          }
          if (masterDetailResponse.data.data.aspActivityStatusesInformation) {
            masterDetailResponse.data.data.aspActivityStatusesInformation.forEach((status: any) => {
              aspActivityStatusMasterData[status.id] = status.name;
            });
          }
        }
      }

      // Format case details for response
      const caseInfo = caseDetail.caseInformation;
      const slaStatus = breakdownReachTimeSLA?.slaStatus
        ? (breakdownReachTimeSLA.slaStatus === "SLA Achieved" ? "Met"
          : breakdownReachTimeSLA.slaStatus === "SLA Violated" ? "Not Met"
            : breakdownReachTimeSLA.slaStatus || "Inprogress")
        : "--";

      const slaEstimatedTime = breakdownReachTimeSLA?.slaTime
        ? moment(breakdownReachTimeSLA.slaTime).tz("Asia/Kolkata").format("DD/MM/YYYY hh:mm A")
        : "--";

      const caseDetails = {
        id: caseDetail.caseNumber, // Case ID is caseNumber
        caseNumber: caseDetail.caseNumber,
        typeId: caseDetail.typeId || null,
        currentContactName: caseInfo?.customerCurrentContactName || "--",
        clientName: clientId ? (clientMasterData[clientId] || "--") : "--",
        caseStatusName: statusId ? (statusMasterData[statusId] || "--") : "--",
        registrationNumber: caseDetail.registrationNumber || "--",
        slaStatusName: slaStatus,
        caseSubjectName: subjectId ? (subjectMasterData[subjectId] || "--") : "--",
        currentContactNumber: caseInfo?.customerCurrentMobileNumber || "--",
        breakdownLocation: caseInfo?.breakdownLocation || "--",
        createdAt: caseDetail.createdAt
          ? moment(caseDetail.createdAt).tz("Asia/Kolkata").format("DD/MM/YYYY hh:mm A")
          : "--",
        ownerName: agentId ? (agentMasterData[agentId] || "--") : "--",
        slaEstimatedTime: slaEstimatedTime,
        breakdownLocationType: locationTypeName,
      };

      // Format service details for response
      const serviceDetails = activities.map((activity: any) => {
        const aspDetail = activity.activityAspDetail;
        const caseInfo = caseDetail.caseInformation;
        const aspId = aspDetail?.aspId;
        const subServiceId = aspDetail?.subServiceId || caseInfo?.subServiceId;
        const serviceId = aspDetail?.serviceId || caseInfo?.serviceId;

        return {
          activityId: activity.id || null,
          caseDetailId: caseDetail.id || null,
          typeId: caseDetail.typeId || null,
          agentId: caseDetail.agentId || null,
          serviceId: serviceId || null,
          serviceName: serviceId ? (serviceMasterData[serviceId] || "--") : "--",
          subServiceId: subServiceId || null,
          subServiceName: subServiceId ? (subServiceMasterData[subServiceId] || "--") : "--",
          aspActivityStatusId: activity.aspActivityStatusId || null,
          aspActivityStatusName: activity.aspActivityStatusId
            ? (aspActivityStatusMasterData[activity.aspActivityStatusId] || "--")
            : "--",
          aspId: aspId || null,
          aspName: aspId ? (aspMasterData[aspId]?.name || "--") : "--",
          aspCode: aspId ? (aspMasterData[aspId]?.code || "--") : "--",
          activityStatusId: activity.activityStatusId || null,
          activityStatusName: activity.activityStatusId
            ? (activityStatusMasterData[activity.activityStatusId] || "--")
            : "--",
          agentPickedAt: activity.agentPickedAt || null,
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          caseDetails: caseDetails,
          serviceDetails: serviceDetails,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function subServiceList(req: Request, res: Response) {
    try {
      const { limit, offset, search, startDate, endDate, ...inputData } =
        req.body;
      const userPermissions = inputData.authUserData.permissions;

      const activityStatusId = parseInt(inputData.activityStatusId as string);
      const caseStatusId = parseInt(inputData.caseStatusId as string);
      const userId = inputData.userId
        ? parseInt(inputData.userId as string)
        : null;
      const roleId = parseInt(inputData.roleId as string);

      //USER ID REQUIRED EXCEPT SUPER ADMIN ROLE AND NATIONAL HEAD.
      if (!userId && roleId != 1 && roleId != 15) {
        return res.status(200).json({
          success: false,
          error: "User ID is required",
        });
      }

      const activityAspDetailWhere: any = {};
      const activityWhere: any = {};
      activityWhere.activityStatusId = {
        [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
      };
      const caseDetailWhere: any = {};
      caseDetailWhere.typeId = 31; //RSA
      const caseInformationWhere: any = {};

      if (activityStatusId) {
        activityWhere.activityStatusId = activityStatusId;
      }

      if (caseStatusId) {
        caseDetailWhere.statusId = caseStatusId;
      }

      if (
        Utils.hasPermission(
          userPermissions,
          "sub-service-list-agent-view-own-web"
        )
      ) {
        if (!userId) {
          return res.status(200).json({
            success: false,
            error: "User ID is required",
          });
        }

        if (!inputData.levelId) {
          return res.status(200).json({
            success: false,
            error: "User Level ID is required",
          });
        }

        if (inputData.levelId == 1045) {
          //L1 AGENT
          caseDetailWhere.l1AgentId = userId;
        } else if (inputData.levelId == 1046) {
          //L2 AGENT
          caseDetailWhere.agentId = userId;
        } else if (inputData.levelId == 1047) {
          //L1 & L2 AGENT
          caseDetailWhere[Op.or] = [{ l1AgentId: userId }, { agentId: userId }];
        }
      } else if (
        userId &&
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-bo-head-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-service-head-own-web"
          ))
      ) {
        //If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
        const apiParams: any = {};
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-bo-head-own-web"
          )
        ) {
          //BO head
          apiParams.where = {
            boHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-network-head-own-web"
          )
        ) {
          //Network head
          apiParams.where = {
            networkHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-customer-experience-head-own-web"
          )
        ) {
          //Customer Experience Head
          apiParams.where = {
            customerExperienceHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-command-centre-head-own-web"
          )
        ) {
          //Command Centre Head
          apiParams.where = {
            commandCentreHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-service-head-own-web"
          )
        ) {
          //Service Head
          apiParams.where = {
            serviceHeadId: userId,
          };
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCitiesByRole}`,
          apiParams
        );

        let roleCityIds = [];
        if (masterDetailResponse.data.success) {
          roleCityIds = masterDetailResponse.data.data.map(
            (cityDetail: any) => {
              return cityDetail.id;
            }
          );
        }

        caseInformationWhere.breakdownAreaId = {
          [Op.in]: roleCityIds,
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-call-centre-manager-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-head-own-web"
          )) &&
        userId
      ) {
        //If call centre manager (or ) call centre head role then. Get cases by its call centres
        const apiParams: any = {};
        apiParams.userId = userId;
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-head-own-web"
          )
        ) {
          //Call centre head
          apiParams.type = 1;
        }

        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-manager-own-web"
          )
        ) {
          //Call centre manager
          apiParams.type = 2;
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCallCentersByRole}`,
          apiParams
        );

        let callCenterIds = [];
        if (masterDetailResponse.data.success) {
          callCenterIds = masterDetailResponse.data.data.map(
            (callCenterDetail: any) => {
              return callCenterDetail.id;
            }
          );
        }

        caseDetailWhere.callCenterId = {
          [Op.in]: callCenterIds,
        };
      } else if (
        Utils.hasPermission(
          userPermissions,
          "sub-service-list-tvs-spoc-own-web"
        ) &&
        userId
      ) {
        //If tvs spoc role then. Get cases by its clients.
        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getClientsByRole}`,
          {
            where: {
              spocUserId: userId,
            },
          }
        );

        let clientIds = [];
        if (masterDetailResponse.data.success) {
          clientIds = masterDetailResponse.data.data.map(
            (clientDetail: any) => {
              return clientDetail.id;
            }
          );
        }

        caseDetailWhere.clientId = {
          [Op.in]: clientIds,
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-team-leader-agents-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-sme-own-web"
          )) &&
        userId
      ) {
        //If team leader (or) sme role then. Get cases by its agents
        const apiParams: any = {};
        apiParams.roleId = 3; //Agent
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-team-leader-agents-own-web"
          )
        ) {
          //Team leader
          apiParams.where = {
            tlId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "sub-service-list-sme-own-web")
        ) {
          //SME
          apiParams.where = {
            smeUserId: userId,
          };
        }

        const agentDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
          apiParams
        );

        let agentIds = [];
        if (agentDetails.data.success) {
          agentIds = agentDetails.data.data.map((agentDetail: any) => {
            return agentDetail.id;
          });
        }

        caseDetailWhere.createdById = {
          [Op.in]: agentIds,
        };
      }

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

      if (search) {
        activityAspDetailWhere[Op.or] = [
          {
            "$activity.caseDetail.caseNumber$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.vin$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.registrationNumber$": {
              [Op.like]: `%${search}%`,
            },
          },

          {
            "$activity.caseDetail.caseInformation.customerCurrentContactName$":
            {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.caseInformation.customerContactName$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.caseInformation.customerCurrentMobileNumber$":
            {
              [Op.like]: `%${search}%`,
            },
          },

          {
            "$activity.caseDetail.caseInformation.customerMobileNumber$": {
              [Op.like]: `%${search}%`,
            },
          },
        ];
      }

      if (startDate && endDate) {
        activityWhere[Op.and] = [
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

      const activityAspDetailsList = await ActivityAspDetails.findAndCountAll({
        where: activityAspDetailWhere,
        attributes: [
          "id",
          "subServiceId",
          [Sequelize.col("activity.agentPickedAt"), "activityAgentPickedAt"],
          [Sequelize.col("activity.activityStatusId"), "activityStatusId"],
          [Sequelize.col("activity.createdAt"), "activityCreatedAt"],
          [Sequelize.col("activity.caseDetail.id"), "caseDetailId"],
          [Sequelize.col("activity.caseDetail.caseNumber"), "caseNumber"],
          [Sequelize.col("activity.caseDetail.subjectID"), "caseSubjectId"],
          [Sequelize.col("activity.caseDetail.vin"), "caseVin"],
          [
            Sequelize.col("activity.caseDetail.registrationNumber"),
            "caseRegistrationNumber",
          ],
          [Sequelize.col("activity.caseDetail.statusId"), "caseDetailStatusId"],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerContactName"
            ),
            "caseCustomerContactName",
          ],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerMobileNumber"
            ),
            "caseCustomerMobileNumber",
          ],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerCurrentContactName"
            ),
            "caseCustomerCurrentContactName",
          ],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerCurrentMobileNumber"
            ),
            "caseCustomerCurrentMobileNumber",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.caseTypeId"),
            "caseTypeId",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.accidentTypeId"),
            "caseAccidentTypeId",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.irateCustomer"),
            "caseIrateCustomer",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.womenAssist"),
            "caseWomenAssist",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.channelId"),
            "caseChannelId",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.policyTypeId"),
            "casePolicyTypeId",
          ],
        ],
        include: [
          {
            model: Activities,
            required: true,
            where: activityWhere,
            attributes: ["id"],
            include: [
              {
                model: CaseDetails,
                required: true,
                attributes: ["id"],
                where: caseDetailWhere,
                include: [
                  {
                    model: CaseInformation,
                    required: true,
                    where: caseInformationWhere,
                    attributes: ["id"],
                  },
                ],
              },
              {
                model: CrmSla,
                limit: 1,
                order: [["id", "DESC"]],
                attributes: ["slaConfigId", "slaStatus", "statusColor"],
              },
            ],
          },
        ],
        limit: limitValue,
        offset: offsetValue,
        order: [["id", "desc"]],
      });
      if (activityAspDetailsList.count === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: activityAspDetailsList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function subServiceGridList(req: Request, res: Response) {
    try {
      const { limit, offset, search, startDate, endDate, ...inputData } =
        req.body;

      const userPermissions = inputData.authUserData.permissions;
      const userId = inputData.userId
        ? parseInt(inputData.userId as string)
        : null;
      const roleId = parseInt(inputData.roleId as string);

      //USER ID REQUIRED EXCEPT SUPER ADMIN ROLE AND NATIONAL HEAD.
      if (!userId && roleId != 1 && roleId != 15) {
        return res.status(200).json({
          success: false,
          error: "User ID is required",
        });
      }

      let activityAspDetailWhere: any = {};
      const activityWhere: any = {};
      const caseDetailWhere: any = {};
      const caseInformationWhere: any = {};
      let searchWhereClause: any = [];

      caseDetailWhere.typeId = 31; //RSA

      if (inputData?.activityStatusIds?.length > 0) {
        activityWhere.activityStatusId = {
          [Op.in]: inputData.activityStatusIds,
        };
      }

      if (inputData?.aspActivityStatusIds?.length > 0) {
        activityWhere.aspActivityStatusId = {
          [Op.in]: inputData.aspActivityStatusIds,
        };
      }

      if (inputData?.caseStatusIds?.length > 0) {
        caseDetailWhere.statusId = {
          [Op.in]: inputData.caseStatusIds,
        };
      }

      if (inputData?.clientIds?.length > 0) {
        caseDetailWhere.clientId = {
          [Op.in]: inputData.clientIds,
        };
      }

      if (inputData.caseNumber) {
        caseDetailWhere.caseNumber = inputData.caseNumber;
      }

      if (inputData.caseVehicleRegistrationNumber) {
        caseDetailWhere.registrationNumber =
          inputData.caseVehicleRegistrationNumber;
      }

      let filterBreakdownAreaIds: any = [];
      if (
        inputData.caseSubjectNames?.length > 0 ||
        inputData.breakdownAreaStateIds?.length > 0 ||
        inputData.serviceIds?.length > 0 ||
        inputData.breakdownLocationCategoryIds?.length > 0
      ) {
        const filterDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getCrmListFilterData}`,
          {
            breakdownAreaStateIds: inputData.breakdownAreaStateIds,
            serviceIds: inputData.serviceIds,
            breakdownLocationCategoryIds:
              inputData.breakdownLocationCategoryIds,
            caseSubjectNames: inputData.caseSubjectNames,
          }
        );

        if (filterDataResponse.data.success) {
          let breakdownAreaStateCityIds = [];
          if (inputData.breakdownAreaStateIds?.length > 0) {
            breakdownAreaStateCityIds =
              filterDataResponse.data.data.breakdownAreaStateCityIds;
          }

          let breakdownLocationCategoryCityIds = [];
          if (inputData.breakdownLocationCategoryIds?.length > 0) {
            breakdownLocationCategoryCityIds =
              filterDataResponse.data.data.breakdownLocationCategoryCityIds;
          }

          if (inputData.serviceIds?.length > 0) {
            activityAspDetailWhere.subServiceId = {
              [Op.in]: filterDataResponse.data.data.serviceSubServiceIds,
            };
          }

          if (
            (breakdownAreaStateCityIds.length > 0 &&
              breakdownLocationCategoryCityIds.length > 0) ||
            breakdownLocationCategoryCityIds.length > 0
          ) {
            filterBreakdownAreaIds = breakdownLocationCategoryCityIds;
            caseInformationWhere.breakdownAreaId = {
              [Op.in]: breakdownLocationCategoryCityIds,
            };
          } else if (breakdownAreaStateCityIds.length > 0) {
            filterBreakdownAreaIds = breakdownAreaStateCityIds;
            caseInformationWhere.breakdownAreaId = {
              [Op.in]: breakdownAreaStateCityIds,
            };
          }

          if (inputData.caseSubjectNames?.length > 0) {
            caseDetailWhere.subjectID = {
              [Op.in]: filterDataResponse.data.data.caseSubjectIds,
            };
          }
        }
      }

      //AGENT PERMISSION
      if (
        Utils.hasPermission(
          userPermissions,
          "sub-service-list-agent-view-own-web"
        )
      ) {
        if (!userId) {
          return res.status(200).json({
            success: false,
            error: "User ID is required",
          });
        }

        if (!inputData.levelId) {
          return res.status(200).json({
            success: false,
            error: "User Level ID is required",
          });
        }

        if (!inputData.authUserData.callCenterId) {
          return res.status(200).json({
            success: false,
            error: "Call Center is required",
          });
        }

        //AGENT UNASSIGNED
        if (inputData.statusType == 1) {
          if (inputData.levelId == 1045) {
            //L1 AGENT
            activityAspDetailWhere = {
              "$activity.caseDetail.statusId$": 1, //OPEN
              "$activity.caseDetail.callCenterId$":
                inputData.authUserData.callCenterId,
              "$activity.caseDetail.l1AgentId$": userId,
              "$activity.caseDetail.agentId$": {
                [Op.is]: null,
              },
            };
          } else if (inputData.levelId == 1046) {
            //L2 AGENT
            activityAspDetailWhere = {
              "$activity.caseDetail.statusId$": 1, //OPEN
              "$activity.caseDetail.callCenterId$":
                inputData.authUserData.callCenterId,
              "$activity.caseDetail.agentId$": {
                [Op.is]: null,
              },
            };
          } else if (inputData.levelId == 1047) {
            //L1 & L2 AGENT
            activityAspDetailWhere = {
              "$activity.caseDetail.statusId$": 1, //OPEN
              "$activity.caseDetail.callCenterId$":
                inputData.authUserData.callCenterId,
              [Op.or]: [
                {
                  "$activity.caseDetail.l1AgentId$": userId,
                  "$activity.caseDetail.agentId$": { [Op.is]: null },
                },
                { "$activity.caseDetail.agentId$": { [Op.is]: null } },
              ],
            };
          }
        } else if (inputData.statusType != 1 && inputData.statusType != 8) {
          //OTHER THAN AGENT UNASSIGNED AND ALL

          //L1 AGENT
          if (inputData.levelId == 1045) {
            activityAspDetailWhere = {
              "$activity.caseDetail.callCenterId$":
                inputData.authUserData.callCenterId,
              "$activity.caseDetail.l1AgentId$": userId,
            };
          } else if (inputData.levelId == 1046) {
            //L2 AGENT
            activityAspDetailWhere = {
              "$activity.caseDetail.callCenterId$":
                inputData.authUserData.callCenterId,
              "$activity.caseDetail.agentId$": userId,
            };
          } else if (inputData.levelId == 1047) {
            //L1 & L2 AGENT
            activityAspDetailWhere = {
              "$activity.caseDetail.callCenterId$":
                inputData.authUserData.callCenterId,
              [Op.or]: [
                {
                  "$activity.caseDetail.l1AgentId$": userId,
                },
                { "$activity.caseDetail.agentId$": userId },
              ],
            };
          }
        }
      } else if (
        userId &&
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-bo-head-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-service-head-own-web"
          ))
      ) {
        //If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
        const apiParams: any = {};
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-bo-head-own-web"
          )
        ) {
          //BO head
          apiParams.where = {
            boHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-network-head-own-web"
          )
        ) {
          //Network head
          apiParams.where = {
            networkHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-customer-experience-head-own-web"
          )
        ) {
          //Customer Experience Head
          apiParams.where = {
            customerExperienceHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-command-centre-head-own-web"
          )
        ) {
          //Command Centre Head
          apiParams.where = {
            commandCentreHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-service-head-own-web"
          )
        ) {
          //Service Head
          apiParams.where = {
            serviceHeadId: userId,
          };
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCitiesByRole}`,
          apiParams
        );

        let roleCityIds = [];
        if (masterDetailResponse.data.success) {
          roleCityIds = masterDetailResponse.data.data.map(
            (cityDetail: any) => {
              return cityDetail.id;
            }
          );
        }

        if (roleCityIds.length > 0 && filterBreakdownAreaIds.length > 0) {
          roleCityIds = roleCityIds.filter((roleCityId: any) => {
            return filterBreakdownAreaIds.includes(roleCityId);
          });
        }

        activityAspDetailWhere = {
          "$activity.caseDetail.caseInformation.breakdownAreaId$": {
            [Op.in]: roleCityIds,
          },
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-call-centre-manager-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-head-own-web"
          )) &&
        userId
      ) {
        //If call centre manager (or ) call centre head role then. Get cases by its call centres
        const apiParams: any = {};
        apiParams.userId = userId;
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-head-own-web"
          )
        ) {
          //Call centre head
          apiParams.type = 1;
        }

        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-manager-own-web"
          )
        ) {
          //Call centre manager
          apiParams.type = 2;
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCallCentersByRole}`,
          apiParams
        );

        let callCenterIds = [];
        if (masterDetailResponse.data.success) {
          callCenterIds = masterDetailResponse.data.data.map(
            (callCenterDetail: any) => {
              return callCenterDetail.id;
            }
          );
        }

        activityAspDetailWhere = {
          "$activity.caseDetail.callCenterId$": {
            [Op.in]: callCenterIds,
          },
        };
      } else if (
        Utils.hasPermission(
          userPermissions,
          "sub-service-list-tvs-spoc-own-web"
        ) &&
        userId
      ) {
        //If tvs spoc role then. Get cases by its clients.
        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getClientsByRole}`,
          {
            where: {
              spocUserId: userId,
            },
          }
        );

        let clientIds = [];
        if (masterDetailResponse.data.success) {
          clientIds = masterDetailResponse.data.data.map(
            (clientDetail: any) => {
              return clientDetail.id;
            }
          );
        }

        activityAspDetailWhere = {
          "$activity.caseDetail.clientId$": {
            [Op.in]: clientIds,
          },
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-team-leader-agents-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-sme-own-web"
          )) &&
        userId
      ) {
        //If team leader (or) sme role then. Get cases by its agents
        const apiParams: any = {};
        apiParams.roleId = 3; //Agent
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-team-leader-agents-own-web"
          )
        ) {
          //Team leader
          apiParams.where = {
            tlId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "sub-service-list-sme-own-web")
        ) {
          //SME
          apiParams.where = {
            smeUserId: userId,
          };
        }

        const agentDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
          apiParams
        );

        let agentIds = [];
        if (agentDetails.data.success) {
          agentIds = agentDetails.data.data.map((agentDetail: any) => {
            return agentDetail.id;
          });
        }

        activityAspDetailWhere = {
          "$activity.caseDetail.createdById$": {
            [Op.in]: agentIds,
          },
        };
      }

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

      if (search) {
        const searchDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getCrmListSearchData}`,
          {
            search: search,
          }
        );
        let masterSearchDetails = [];
        if (searchDataResponse?.data?.success) {
          for (const searchDetail of searchDataResponse.data.searchDetails) {
            if (searchDetail.type == "customerType") {
              masterSearchDetails.push({
                "$activity.caseDetail.caseInformation.caseTypeId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "caseSubject") {
              masterSearchDetails.push({
                "$activity.caseDetail.subjectID$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "serviceSubService") {
              masterSearchDetails.push({
                subServiceId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "subService") {
              masterSearchDetails.push({
                subServiceId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "policyType") {
              masterSearchDetails.push({
                "$activity.caseDetail.caseInformation.policyTypeId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "channel") {
              masterSearchDetails.push({
                "$activity.caseDetail.caseInformation.channelId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "caseStatus") {
              masterSearchDetails.push({
                "$activity.caseDetail.statusId$": { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "activityStatus") {
              masterSearchDetails.push({
                "$activity.activityStatusId$": { [Op.in]: searchDetail.ids },
              });
            }
          }
        }

        searchWhereClause = [
          {
            "$activity.caseDetail.caseNumber$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.vin$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.registrationNumber$": {
              [Op.like]: `%${search}%`,
            },
          },

          {
            "$activity.caseDetail.caseInformation.customerCurrentContactName$":
            {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.caseInformation.customerContactName$": {
              [Op.like]: `%${search}%`,
            },
          },
          {
            "$activity.caseDetail.caseInformation.customerCurrentMobileNumber$":
            {
              [Op.like]: `%${search}%`,
            },
          },

          {
            "$activity.caseDetail.caseInformation.customerMobileNumber$": {
              [Op.like]: `%${search}%`,
            },
          },
        ];

        if (masterSearchDetails.length > 0) {
          searchWhereClause.push(...masterSearchDetails);
        }
      }

      if (startDate && endDate) {
        activityWhere[Op.and] = [
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

      if (searchWhereClause.length > 0) {
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          [Op.and]: [
            {
              [Op.or]: searchWhereClause,
            },
          ],
        };
      }

      let crmSlaRequired = false;
      //AGENT UNASSIGNED
      if (
        inputData.statusType == 1 &&
        !Utils.hasPermission(
          userPermissions,
          "sub-service-list-agent-view-own-web"
        )
      ) {
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": {
            [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
          },
          "$activity.caseDetail.agentId$": {
            [Op.is]: null,
          },
          "$activity.caseDetail.statusId$": 1, //OPEN
        };
      } else if (inputData.statusType == 2) {
        //AGENT NOT PICKED
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": {
            [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
          },
          "$activity.agentPickedAt$": {
            [Op.is]: null,
          },
          aspId: {
            [Op.is]: null,
          },
          "$activity.caseDetail.statusId$": 2, //INPROGRESS
        };
      } else if (inputData.statusType == 3) {
        //ASP NOT ASSIGNED
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": {
            [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
          },
          "$activity.agentPickedAt$": {
            [Op.ne]: null,
          },
          aspId: {
            [Op.is]: null,
          },
          "$activity.caseDetail.statusId$": 2, //INPROGRESS
          "$activity.isReimbursement$": 0,
          subServiceHasAspAssignment: 1,
        };
      } else if (inputData.statusType == 4) {
        //INPROGRESS
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": {
            [Op.in]: [2, 3, 7, 9, 10, 11, 12, 14], //ASSIGNED, IN PROGRESS, SUCCESSFUL, WAITING FOR DEALER APPROVAL, ADVANCE PAYMENT PAID, BALANCE PAYMENT PENDING, EXCESS AMOUNT CREDIT PENDING, ADVANCE PAY LATER
          },
          "$activity.caseDetail.statusId$": 2, //INPROGRESS
        };
      } else if (inputData.statusType == 5) {
        //CANCELED
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": 4,
          "$activity.caseDetail.statusId$": {
            [Op.in]: [2, 3, 4], //INPROGRESS, CANCELED, //CLOSED
          },
        };
      } else if (inputData.statusType == 6) {
        //REJECTED
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": 8,
          "$activity.caseDetail.statusId$": {
            [Op.in]: [2, 3, 4], //INPROGRESS, CANCELED, //CLOSED
          },
        };
      } else if (inputData.statusType == 7) {
        //CLOSED
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": 7, //SUCCESSFUL
          "$activity.caseDetail.statusId$": 4,
        };
      } else if (inputData.statusType == 8) {
        // ALL
        const allWhereClause = [
          // AGENT NOT PICKED
          {
            "$activity.activityStatusId$": {
              [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
            },
            "$activity.agentPickedAt$": { [Op.is]: null },
            aspId: { [Op.is]: null },
            "$activity.caseDetail.statusId$": 2, // INPROGRESS
          },
          // ASP NOT ASSIGNED
          {
            "$activity.activityStatusId$": {
              [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
            },
            "$activity.agentPickedAt$": { [Op.ne]: null },
            aspId: { [Op.is]: null },
            "$activity.caseDetail.statusId$": 2, // INPROGRESS
            "$activity.isReimbursement$": 0,
            subServiceHasAspAssignment: 1,
          },
          // INPROGRESS
          {
            "$activity.activityStatusId$": {
              [Op.in]: [2, 3, 7, 9, 10, 11, 12, 14], //ASSIGNED, IN PROGRESS, SUCCESSFUL, WAITING FOR DEALER APPROVAL, ADVANCE PAYMENT PAID, BALANCE PAYMENT PENDING, EXCESS AMOUNT CREDIT PENDING, ADVANCE PAY LATER
            },
            "$activity.caseDetail.statusId$": 2, // INPROGRESS
          },
          // CANCELED
          {
            "$activity.activityStatusId$": 4,
            "$activity.caseDetail.statusId$": {
              [Op.in]: [2, 3, 4], //INPROGRESS, CANCELED, //CLOSED
            },
          },
          // REJECTED
          {
            "$activity.activityStatusId$": 8,
            "$activity.caseDetail.statusId$": {
              [Op.in]: [2, 3, 4], //INPROGRESS, CANCELED, //CLOSED
            },
          },
          // CLOSED
          {
            "$activity.activityStatusId$": 7, // SUCCESSFUL
            "$activity.caseDetail.statusId$": 4,
          },
          //ASP NOT REACHED BEYOND SLA
          {
            "$activity.activityStatusId$": 3, //In Progress
            "$activity.caseDetail.statusId$": 2, //In Progress
            "$activity.aspActivityStatusId$": 14, //Started To BD
            aspId: { [Op.ne]: null },
            "$activity.activityCrmSla.slaConfigId$": 870, //ASP Breakdown Reach Time SLA - L1
            "$activity.activityCrmSla.slaStatus$": "SLA Violated", //ASP Breakdown Reach Time SLA - L1
          },
        ];

        //OTHER THAN AGENT PERMISSION
        if (
          !Utils.hasPermission(
            userPermissions,
            "sub-service-list-agent-view-own-web"
          )
        ) {
          activityAspDetailWhere = {
            ...activityAspDetailWhere,
            [Op.and]: [
              ...(activityAspDetailWhere[Op.and] || []), // INCLUDE SEARCH WHERE CLAUSE IF PRESENT
              {
                [Op.or]: [
                  // AGENT UNASSIGNED
                  {
                    "$activity.activityStatusId$": {
                      [Op.notIn]: [4, 8], // OTHER THAN CANCELED AND REJECTED
                    },
                    "$activity.caseDetail.agentId$": { [Op.is]: null },
                    "$activity.caseDetail.statusId$": 1, // OPEN
                  },
                  ...allWhereClause,
                ],
              },
            ],
          };
        } else {
          //AGENT PERMISSION
          switch (inputData.levelId) {
            case 1045: // L1 Agent
              activityAspDetailWhere = {
                ...activityAspDetailWhere,
                [Op.and]: [
                  ...(activityAspDetailWhere[Op.and] || []), // INCLUDE SEARCH WHERE CLAUSE IF PRESENT
                  {
                    [Op.or]: [
                      //AGENT UNASSIGNED
                      {
                        "$activity.activityStatusId$": {
                          [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
                        },
                        "$activity.caseDetail.l1AgentId$": userId,
                        "$activity.caseDetail.agentId$": { [Op.is]: null },
                        "$activity.caseDetail.statusId$": 1, // OPEN
                      },
                      //OTHERS - INCLUDE BELOW LOGIC AT FIRST
                      ...allWhereClause.map((condition) => ({
                        "$activity.caseDetail.l1AgentId$": userId,
                        ...condition,
                      })),
                    ],
                  },
                ],
              };

              break;
            case 1046: // L2 Agent
              activityAspDetailWhere = {
                ...activityAspDetailWhere,
                [Op.and]: [
                  ...(activityAspDetailWhere[Op.and] || []), // INCLUDE SEARCH WHERE CLAUSE IF PRESENT
                  {
                    [Op.or]: [
                      //AGENT UNASSIGNED
                      {
                        "$activity.activityStatusId$": {
                          [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
                        },
                        "$activity.caseDetail.agentId$": { [Op.is]: null },
                        "$activity.caseDetail.statusId$": 1, // OPEN
                      },
                      //OTHERS - INCLUDE BELOW LOGIC AT FIRST
                      ...allWhereClause.map((condition) => ({
                        "$activity.caseDetail.agentId$": userId,
                        ...condition,
                      })),
                    ],
                  },
                ],
              };

              break;
            case 1047: // L1 & L2 AGENT
              activityAspDetailWhere = {
                ...activityAspDetailWhere,
                [Op.and]: [
                  ...(activityAspDetailWhere[Op.and] || []), // INCLUDE SEARCH WHERE CLAUSE IF PRESENT
                  {
                    [Op.or]: [
                      //AGENT UNASSIGNED
                      {
                        "$activity.activityStatusId$": {
                          [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
                        },
                        "$activity.caseDetail.l1AgentId$": userId,
                        "$activity.caseDetail.agentId$": { [Op.is]: null },
                        "$activity.caseDetail.statusId$": 1, // OPEN
                      },
                      //AGENT UNASSIGNED
                      {
                        "$activity.activityStatusId$": {
                          [Op.notIn]: [4, 8], //OTHER THAN CANCELED AND REJECTED
                        },
                        "$activity.caseDetail.agentId$": { [Op.is]: null },
                        "$activity.caseDetail.statusId$": 1, // OPEN
                      },
                      //OTHERS - INCLUDE BELOW LOGIC AT FIRST
                      ...allWhereClause.map((condition) => ({
                        [Op.or]: [
                          { "$activity.caseDetail.l1AgentId$": userId },
                          { "$activity.caseDetail.agentId$": userId },
                        ],
                        ...condition,
                      })),
                    ],
                  },
                ],
              };

              break;
          }
        }
      } else if (inputData.statusType == 9) {
        //ASP NOT REACHED BEYOND SLA
        activityAspDetailWhere = {
          ...activityAspDetailWhere,
          "$activity.activityStatusId$": 3, //In Progress
          "$activity.caseDetail.statusId$": 2, //In Progress
          "$activity.aspActivityStatusId$": 14, //Started To BDs
          aspId: { [Op.ne]: null },
          "$activity.activityCrmSla.slaConfigId$": 870, //ASP Breakdown Reach Time SLA - L1
          "$activity.activityCrmSla.slaStatus$": "SLA Violated",
        };
        crmSlaRequired = true;
      }

      //If sla status ids are provided then get sla detail for each activity and filter accordingly.
      if (inputData.slaStatusIds?.length > 0) {
        const activitySlaDetails: any = await ActivityAspDetails.findAll({
          where: activityAspDetailWhere,
          attributes: ["id"],
          include: [
            {
              model: Activities,
              required: true,
              where: activityWhere,
              attributes: [
                "id",
                "isInitiallyCreated",
                "isImmediateService",
                "serviceInitiatingAt",
                "aspReachedToBreakdownAt",
                "createdAt",
              ],
              include: [
                {
                  model: CaseDetails,
                  required: true,
                  attributes: ["id", "createdAt"],
                  where: caseDetailWhere,
                  include: [
                    {
                      model: CaseInformation,
                      required: true,
                      where: caseInformationWhere,
                      attributes: ["id", "breakdownAreaId"],
                    },
                  ],
                },
                {
                  model: CrmSla,
                  limit: 1,
                  order: [["id", "DESC"]],
                  attributes: ["slaConfigId", "slaStatus", "statusColor"],
                },
                //ASP NOT REACHED BEYOND SLA
                {
                  model: CrmSla,
                  as: "activityCrmSla",
                  attributes: ["id"],
                  required: crmSlaRequired,
                },
              ],
            },
          ],
          // group: ["id"],
          order: [["id", "desc"]],
        });

        const activitySlaDetailResponse = await getActivitySlaDetails(
          activitySlaDetails,
          inputData.slaStatusIds
        );
        if (activitySlaDetailResponse.success) {
          activityWhere.id = {
            [Op.in]: activitySlaDetailResponse.slaActivityIds,
          };
        }
      }

      const activityAspDetailsListQuery: any = {
        where: activityAspDetailWhere,
        attributes: [
          "id",
          "subServiceId",
          [Sequelize.col("activity.agentPickedAt"), "activityAgentPickedAt"],
          [Sequelize.col("activity.activityStatusId"), "activityStatusId"],
          [
            Sequelize.col("activity.aspActivityStatusId"),
            "aspActivityStatusId",
          ],
          [
            Sequelize.col("activity.activityAppStatusId"),
            "activityAppStatusId",
          ],
          [Sequelize.col("activity.createdAt"), "activityCreatedAt"],
          [Sequelize.col("activity.caseDetail.id"), "caseDetailId"],
          [Sequelize.col("activity.caseDetail.caseNumber"), "caseNumber"],
          [Sequelize.col("activity.caseDetail.subjectID"), "caseSubjectId"],
          [Sequelize.col("activity.caseDetail.vin"), "caseVin"],
          [
            Sequelize.col("activity.caseDetail.registrationNumber"),
            "caseRegistrationNumber",
          ],
          [Sequelize.col("activity.caseDetail.createdAt"), "caseCreatedAt"],
          [Sequelize.col("activity.caseDetail.statusId"), "caseDetailStatusId"],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.voiceOfCustomer"
            ),
            "caseVoiceOfCustomer",
          ],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerContactName"
            ),
            "caseCustomerContactName",
          ],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerMobileNumber"
            ),
            "caseCustomerMobileNumber",
          ],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerCurrentContactName"
            ),
            "caseCustomerCurrentContactName",
          ],
          [
            Sequelize.col(
              "activity.caseDetail.caseInformation.customerCurrentMobileNumber"
            ),
            "caseCustomerCurrentMobileNumber",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.caseTypeId"),
            "caseTypeId",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.accidentTypeId"),
            "caseAccidentTypeId",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.irateCustomer"),
            "caseIrateCustomer",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.womenAssist"),
            "caseWomenAssist",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.channelId"),
            "caseChannelId",
          ],
          [
            Sequelize.col("activity.caseDetail.caseInformation.policyTypeId"),
            "casePolicyTypeId",
          ],
        ],
        include: [
          {
            model: Activities,
            required: true,
            where: activityWhere,
            attributes: ["id"],
            include: [
              {
                model: CaseDetails,
                required: true,
                attributes: ["id"],
                where: caseDetailWhere,
                include: [
                  {
                    model: CaseInformation,
                    required: true,
                    where: caseInformationWhere,
                    attributes: ["id"],
                  },
                ],
              },
              {
                model: CrmSla,
                limit: 1,
                order: [["id", "DESC"]],
                attributes: ["slaConfigId", "slaStatus", "statusColor"],
              },
              //ASP NOT REACHED BEYOND SLA
              {
                model: CrmSla,
                as: "activityCrmSla",
                attributes: ["id"],
                required: crmSlaRequired,
              },
            ],
          },
        ],
        // group: ["id"],
        order: [["id", "desc"]],
      };

      const activityAspDetailsList: any = await ActivityAspDetails.findAll({
        ...activityAspDetailsListQuery,
        limit: limitValue,
        offset: offsetValue,
      });

      if (activityAspDetailsList.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const totalActivityAspDetailsList: any = await ActivityAspDetails.findAll(
        {
          ...activityAspDetailsListQuery,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: {
          count: totalActivityAspDetailsList.length,
          rows: activityAspDetailsList,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function caseInformationGridList(req: Request, res: Response) {
    try {
      const { limit, offset, search, startDate, endDate, ...inputData } =
        req.body;
      const userPermissions = inputData.authUserData.permissions;
      const userId = inputData.userId
        ? parseInt(inputData.userId as string)
        : null;
      const roleId = parseInt(inputData.roleId as string);

      //USER ID REQUIRED EXCEPT SUPER ADMIN ROLE AND NATIONAL HEAD
      if (!userId && roleId != 1 && roleId != 15) {
        return res.status(200).json({
          success: false,
          error: "User ID is required",
        });
      }

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      const caseDetailWhere: any = {};
      caseDetailWhere.typeId = 31; //RSA
      caseDetailWhere.statusId = inputData.statusType;

      if (
        Utils.hasPermission(userPermissions, "case-list-agent-view-own-web")
      ) {
        if (!userId) {
          return res.status(200).json({
            success: false,
            error: "User ID is required",
          });
        }

        if (!inputData.levelId) {
          return res.status(200).json({
            success: false,
            error: "User Level ID is required",
          });
        }

        if (inputData.levelId == 1045) {
          //L1 AGENT
          caseDetailWhere.l1AgentId = userId;
        } else if (inputData.levelId == 1046) {
          //L2 AGENT
          caseDetailWhere.agentId = userId;
        } else if (inputData.levelId == 1047) {
          //L1 & L2 AGENT
          caseDetailWhere[Op.or] = [{ l1AgentId: userId }, { agentId: userId }];
        }
      } else if (
        userId &&
        (Utils.hasPermission(userPermissions, "case-list-bo-head-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "case-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-service-head-own-web"
          ))
      ) {
        //If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
        const apiParams: any = {};
        if (Utils.hasPermission(userPermissions, "case-list-bo-head-own-web")) {
          //BO head
          apiParams.where = {
            boHeadId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "case-list-network-head-own-web")
        ) {
          //Network head
          apiParams.where = {
            networkHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "case-list-customer-experience-head-own-web"
          )
        ) {
          //Customer Experience Head
          apiParams.where = {
            customerExperienceHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "case-list-command-centre-head-own-web"
          )
        ) {
          //Command Centre Head
          apiParams.where = {
            commandCentreHeadId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "case-list-service-head-own-web")
        ) {
          //Service Head
          apiParams.where = {
            serviceHeadId: userId,
          };
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCitiesByRole}`,
          apiParams
        );

        let roleCityIds = [];
        if (masterDetailResponse.data.success) {
          roleCityIds = masterDetailResponse.data.data.map(
            (cityDetail: any) => {
              return cityDetail.id;
            }
          );
        }

        where.breakdownAreaId = {
          [Op.in]: roleCityIds,
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "case-list-call-centre-manager-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-head-own-web"
          )) &&
        userId
      ) {
        //If call centre manager (or ) call centre head role then. Get cases by its call centres
        const apiParams: any = {};
        apiParams.userId = userId;
        if (
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-head-own-web"
          )
        ) {
          //Call centre head
          apiParams.type = 1;
        }

        if (
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-manager-own-web"
          )
        ) {
          //Call centre manager
          apiParams.type = 2;
        }

        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getCallCentersByRole}`,
          apiParams
        );

        let callCenterIds = [];
        if (masterDetailResponse.data.success) {
          callCenterIds = masterDetailResponse.data.data.map(
            (callCenterDetail: any) => {
              return callCenterDetail.id;
            }
          );
        }

        caseDetailWhere.callCenterId = {
          [Op.in]: callCenterIds,
        };
      } else if (
        Utils.hasPermission(userPermissions, "case-list-tvs-spoc-own-web") &&
        userId
      ) {
        //If tvs spoc role then. Get cases by its clients.
        const masterDetailResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getClientsByRole}`,
          {
            where: {
              spocUserId: userId,
            },
          }
        );

        let clientIds = [];
        if (masterDetailResponse.data.success) {
          clientIds = masterDetailResponse.data.data.map(
            (clientDetail: any) => {
              return clientDetail.id;
            }
          );
        }

        caseDetailWhere.clientId = {
          [Op.in]: clientIds,
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "case-list-team-leader-agents-own-web"
        ) ||
          Utils.hasPermission(userPermissions, "case-list-sme-own-web")) &&
        userId
      ) {
        //If team leader (or) sme role then. Get cases by its agents
        const apiParams: any = {};
        apiParams.roleId = 3; //Agent
        if (
          Utils.hasPermission(
            userPermissions,
            "case-list-team-leader-agents-own-web"
          )
        ) {
          //Team leader
          apiParams.where = {
            tlId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "case-list-sme-own-web")
        ) {
          //SME
          apiParams.where = {
            smeUserId: userId,
          };
        }

        const agentDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
          apiParams
        );

        let agentIds = [];
        if (agentDetails.data.success) {
          agentIds = agentDetails.data.data.map((agentDetail: any) => {
            return agentDetail.id;
          });
        }

        caseDetailWhere.createdById = {
          [Op.in]: agentIds,
        };
      }

      // Limitation value setup
      let limitValue: number = defaultLimit;

      if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = defaultOffset;

      if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      // Check if a search query is provided
      if (search) {
        where[Op.or] = [
          {
            "$caseDetail.caseNumber$": { [Op.like]: `%${search}%` },
          },
          {
            "$caseDetail.vin$": { [Op.like]: `%${search}%` },
          },
          {
            "$caseDetail.registrationNumber$": { [Op.like]: `%${search}%` },
          },
          { customerCurrentContactName: { [Op.like]: `%${search}%` } },
          { customerContactName: { [Op.like]: `%${search}%` } },
          { customerCurrentMobileNumber: { [Op.like]: `%${search}%` } },
          { customerMobileNumber: { [Op.like]: `%${search}%` } },
        ];
      }

      // Check if a date query is provided
      if (startDate && endDate) {
        where[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      const caseList = await CaseInformation.findAndCountAll({
        where,
        order: [["id", "desc"]],
        limit: limitValue,
        offset: offsetValue,
        attributes: [
          "id",
          "caseDetailId",
          "customerContactName",
          "customerMobileNumber",
          "customerCurrentContactName",
          "customerCurrentMobileNumber",
          "caseTypeId",
          "accidentTypeId",
          "serviceId",
          "irateCustomer",
          "womenAssist",
          "channelId",
          "policyTypeId",
          "voiceOfCustomer",
        ],
        include: [
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "subjectID",
              "vin",
              "registrationNumber",
              "statusId",
              "createdAt",
            ],
            where: caseDetailWhere,
          },
        ],
      });

      if (caseList.count === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function agentReplacement(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const [caseExists, getAgentDetail]: any = await Promise.all([
        CaseDetails.findOne({
          where: {
            id: payload.caseDetailId,
            statusId: {
              [Op.in]: [1, 2], //1-OPEN, 2-INPROGRESS
            },
          },
        }),
        // GET AGENT DETAILS
        Utils.getUserDetail(payload.agentId),
      ]);

      if (!caseExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      await Promise.all([
        caseDetails.update(
          {
            agentId: payload.agentId,
            callCenterId: getAgentDetail.data.user.callCenterId,
            agentReplacedAt: new Date(),
            previousAgentId: caseExists.agentId, // Store old agent ID
          },
          {
            where: { id: payload.caseDetailId },
            transaction,
          }
        ),
        ActivityLogs.create(
          {
            caseDetailId: payload.caseDetailId,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name}" has been replaced to this request".`,
          },
          {
            transaction,
          }
        ),
        axios.put(`${userServiceUrl}/${userServiceEndpoint.updateUserLogin}`, {
          userId: payload.agentId,
          pendingCaseCount: 1,
          assignedCasesCount: 1,
        }),
        axios.put(`${userServiceUrl}/${userServiceEndpoint.updateUserLogin}`, {
          userId: caseExists.agentId,
          pendingCaseCount: -1,
          assignedCasesCount: -1,
          nullLastAllocatedCaseTime: true,
        }),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The agent has been updated successfully.",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getLorryReceiptDetail(req: Request, res: Response) {
    try {
      const payload = req.body;
      const activity: any = await Activities.findOne({
        attributes: ["id", "aspReachedToPickupAt"],
        where: {
          id: payload.activityId,
        },
        include: [
          {
            model: CaseDetails,
            attributes: [
              "id",
              "caseNumber",
              "dealerId",
              "deliveryRequestDropDealerId",
              "vin",
              "vehicleModelId",
              "locationTypeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "deliveryRequestPickUpLocation",
              "deliveryRequestDropLocation",
              "approximateVehicleValue",
            ],
            required: true,
          },
          {
            model: ActivityAspDetails,
            attributes: ["id", "aspVehicleRegistrationNumber"],
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

      return res.status(200).json({
        success: true,
        data: activity,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function uploadDealerDocument(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;

      const activityExists: any = await Activities.findOne({
        attributes: ["id"],
        where: {
          id: inData.entityId,
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
      if (!activityExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      //IF AUTH USER AVAILABLE THEN GET AUTH USER PERMISSION AND VALIDATE.
      let authUserRole = "";
      let authUserName = "";
      if (inData.authUserId) {
        const getAuthUserResponse = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUser}`,
          {
            id: inData.authUserId,
          }
        );
        if (!getAuthUserResponse.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Auth user not found",
          });
        }

        authUserRole = getAuthUserResponse?.data?.user?.role?.name || "";
        authUserName = getAuthUserResponse?.data?.user?.name || "";
      }

      //REMOVE EXISTING ACCIDENTAL DOCUMENTS
      const existingAttachments = await attachments.findAll({
        where: {
          attachmentTypeId: inData.attachmentTypeId,
          attachmentOfId: inData.attachmentOfId,
          entityId: inData.entityId,
          ...(inData.attachmentIds?.length > 0 && {
            id: {
              [Op.notIn]: inData.attachmentIds,
            },
          }),
        },
        attributes: ["id"],
      });

      for (const attachment of existingAttachments) {
        const deleteAttachmentResponse = await axios.post(
          `${apiGatewayService}/${config.apiGatewayService.serviceAccess.case}/${endpointApiGateway.deleteAttachment}`,
          {
            attachmentId: attachment.dataValues.id,
          }
        );

        if (!deleteAttachmentResponse.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: deleteAttachmentResponse.data.error,
          });
        }

        await attachments.destroy({
          where: { id: attachment.dataValues.id },
          transaction: transaction,
        });
      }

      //SAVE ACCIDENTAL DOCUMENT
      if (inData.files.length > 0) {
        const batchInsertions = [];
        for (const file of inData.files) {
          batchInsertions.push({
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.entityId,
            fileName: file.filename,
            // originalName: file.originalname, //ENABLE AFTER CRM CODE MOVEMENT SINCE ORIGINAL NAME WORK WAS IMPLEMENTED ONLY IN CRM
          });
        }
        await Promise.all([
          attachments.bulkCreate(batchInsertions, { transaction }),
          ActivityLogs.create(
            {
              activityId: inData.entityId,
              typeId: 240, //Web
              title: `The ${authUserRole} "${authUserName}" has uploaded the documents.`,
            },
            {
              transaction: transaction,
            }
          ),
        ]);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The dealer documents have been uploaded successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function clearStaleCaseProcessingLocks(
    req: Request,
    res: Response
  ) {
    const maxAgeMinutes: any =
      process.env.ACTIVITY_PROCESSING_LOCK_CLEAR_CUT_OFF_MINS || 3;
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const [affectedRows]: any = await CaseDetails.update(
      { isActivityProcessing: 0, activityProcessingStartedAt: null },
      {
        where: {
          statusId: 2, //IN PROGRESS
          isActivityProcessing: 1,
          activityProcessingStartedAt: {
            [Op.lt]: moment
              .tz(cutoff, "Asia/Kolkata")
              .format("YYYY-MM-DD HH:mm:ss"),
          },
        },
      }
    );

    if (affectedRows === 0) {
      return res.status(200).json({
        success: false,
        error: "No stale case processing locks found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stale case processing locks cleared successfully",
    });
  }
}

export const getCases = async (query: any) => {
  try {
    let result = await CaseDetails.findAll({
      where: query,
      attributes: ["id", "caseNumber", "subjectID", "statusId", "clientId"],
      include: [
        {
          model: CaseInformation,
          attributes: [
            "customerCurrentContactName",
            "customerCurrentMobileNumber",
            "breakdownLocation",
          ],
        },
      ],
    });
    return result;
  } catch (error: any) {
    throw error;
  }
};

//USED IN ADD REMINDER
export const checkCaseDetail = async (id: any) => {
  try {
    const caseDetail = await CaseDetails.findOne({
      where: {
        id: id,
        statusId: 2, //In Progress
      },
    });
    if (!caseDetail) {
      return {
        success: false,
        error: "Case not found",
      };
    }
    return {
      success: true,
      data: caseDetail,
      message: "Data Fetched Successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

// Helper function to get KM for comparison based on nonMembershipType
const getKmForComparison = (activity: any, activityAspDetail: any, usePaidKm: boolean = false): number => {
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
};

const getKmComparisonThreshold = (): number => {
  const threshold = Number(process.env.ADDITIONAL_KM_COMPARISON_THRESHOLD);
  if (Number.isFinite(threshold) && threshold >= 0) {
    return threshold;
  }
  return 5;
};

// Function to handle additional KM payment calculation when location is updated after payment is captured
const handleAdditionalKmPaymentOnLocationUpdate = async (
  activityId: number,
  previousActivityData: any,
  currentActivityData: any,
  masterService: string,
  endpointMaster: any,
  transaction: any
) => {
  try {
    // Calculate previous and new KM
    // For previous KM: Use paidTotalKm if available (what customer paid for), otherwise fall back to estimated values
    const previousKm = previousActivityData
      ? getKmForComparison(
        previousActivityData.dataValues,
        previousActivityData.activityAspDetail?.dataValues,
        true // usePaidKm = true to use paidTotalKm when available
      )
      : 0;

    // For new KM: Use current estimated values (estimatedTotalKm or additionalChargeableKm)
    const newKm = currentActivityData
      ? getKmForComparison(
        currentActivityData.dataValues,
        currentActivityData.activityAspDetail?.dataValues,
        false // usePaidKm = false to use current estimated values
      )
      : 0;

    const kmDifference = Math.abs(newKm - previousKm);

    // Check if payment has been captured for this activity and not refunded
    const hasPaymentCaptured: any = await ActivityTransactions.findOne({
      where: {
        activityId: activityId,
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
      transaction,
    });

    const activityForAdditionalKm: any = await Activities.findOne({
      where: { id: activityId },
      attributes: ["id", "nonMembershipType", "customerNeedToPay", "paymentForAdditionalKmCaptured"],
      include: [
        {
          model: ActivityAspDetails,
          attributes: ["id", "subServiceId"],
          required: true,
        },
        {
          model: CaseDetails,
          attributes: ["id", "clientId"],
          required: true,
        },
      ],
      transaction,
    });

    //IF PAYMENT FOR ADDITIONAL KM CAPTURED IS FALSE THEN ONLY PROCESS ADDITIONAL KM PAYMENT
    if (activityForAdditionalKm && (activityForAdditionalKm.paymentForAdditionalKmCaptured == false || activityForAdditionalKm.paymentForAdditionalKmCaptured == null)) {

      const kmComparisonThreshold = getKmComparisonThreshold();

      // If payment is captured and KM difference > threshold, calculate additional KM cost
      if (hasPaymentCaptured && kmDifference > kmComparisonThreshold) {

        // If customer needs to pay, calculate additional KM cost
        const clientId = activityForAdditionalKm.caseDetail.clientId;
        const subServiceId = activityForAdditionalKm.activityAspDetail.subServiceId;
        const nonMembershipType = activityForAdditionalKm.nonMembershipType;

        // Calculate cost for additional KM using new API
        const additionalKmCostDetails = await axios.post(
          `${masterService}/${endpointMaster.getAdditionalKmCost}`,
          {
            clientId: clientId,
            subServiceId: subServiceId,
            additionalKm: kmDifference,
            nonMembershipType: nonMembershipType,
          }
        );

        if (additionalKmCostDetails.data.success) {
          // Update activity with additional KM payment flags
          await Activities.update(
            {
              hasAdditionalKmForPayment: true,
              additionalKmForPayment: kmDifference.toString(),
            },
            {
              where: { id: activityId },
              transaction,
            }
          );

          // Update ActivityAspDetails with additional KM cost
          await ActivityAspDetails.update(
            {
              additionalKmEstimatedServiceCost:
                additionalKmCostDetails.data.data?.estimatedServiceCost || null,
              additionalKmEstimatedTotalTax:
                additionalKmCostDetails.data.data?.estimatedTotalTax || null,
              additionalKmEstimatedTotalAmount:
                additionalKmCostDetails.data.data?.estimatedTotalAmount || null,
            },
            {
              where: {
                activityId: activityId,
              },
              transaction,
            }
          );
        }
      } else if (hasPaymentCaptured && kmDifference <= kmComparisonThreshold) {
        // If payment is captured but KM difference <= threshold, clear additional KM flags
        await Activities.update(
          {
            hasAdditionalKmForPayment: false,
            additionalKmForPayment: null,
          },
          {
            where: { id: activityId },
            transaction,
          }
        );

        await ActivityAspDetails.update(
          {
            additionalKmEstimatedServiceCost: null,
            additionalKmEstimatedTotalTax: null,
            additionalKmEstimatedTotalAmount: null,
          },
          {
            where: {
              activityId: activityId,
            },
            transaction,
          }
        );
      }
    }
  } catch (error: any) {
    // Log error but don't throw - we don't want to break the main flow
    console.error("Error in handleAdditionalKmPaymentOnLocationUpdate:", error);
  }
};

const rsaActivitiesRateCardUpdate = async (
  payload: any,
  activity: any,
  towingSubServiceIds: any,
  transaction: any
) => {
  try {
    const activityAspDetailWhere: any = {};
    activityAspDetailWhere.aspId = { [Op.ne]: null };
    //THIS WILL BE INCLUDED ONLY FOR DROP LOCATION UPDATE
    if (towingSubServiceIds && towingSubServiceIds.length > 0) {
      activityAspDetailWhere.subServiceId = { [Op.in]: towingSubServiceIds };
    }

    // PREVIOUS CODE - Filter by activityStatusId
    // const aspMappedActivities: any = await Activities.findAll({
    //   attributes: [
    //     "id",
    //     "customerNeedToPay",
    //     "nonMembershipType",
    //     "additionalChargeableKm",
    //     "isAspAutoAllocated",
    //   ],
    //   where: {
    //     caseDetailId: payload.caseDetailId,
    //     activityStatusId: {
    //       [Op.in]: [1, 4, 8], //Open,Cancelled,Rejected
    //     },
    //   },
    //   include: {
    //     model: ActivityAspDetails,
    //     required: true,
    //     attributes: ["id", "aspId", "subServiceId"],
    //     where: activityAspDetailWhere,
    //   },
    // });

    // Filter activities based on:
    // 1. ASP not reached the breakdown location, OR
    // 2. If ASP reached breakdown location, then activity statusId should be either cancelled (4) or rejected (8)
    const aspMappedActivities: any = await Activities.findAll({
      attributes: [
        "id",
        "customerNeedToPay",
        "nonMembershipType",
        "additionalChargeableKm",
        "isAspAutoAllocated",
      ],
      where: {
        caseDetailId: payload.caseDetailId,
        [Op.or]: [
          {
            // ASP not reached breakdown location
            aspReachedToBreakdownAt: null,
          },
          {
            // ASP reached breakdown location AND activity is cancelled or rejected
            aspReachedToBreakdownAt: { [Op.ne]: null },
            activityStatusId: {
              [Op.in]: [4, 8], // Cancelled or Rejected
            },
          },
        ],
      },
      include: {
        model: ActivityAspDetails,
        required: true,
        attributes: ["id", "aspId", "subServiceId"],
        where: activityAspDetailWhere,
      },
    });

    const syncActivityIds: any = [];
    const aspAutoAllocatedActivityIds: any = [];
    if (aspMappedActivities && aspMappedActivities.length > 0) {
      const aspIds = new Set();
      const subServiceIds = new Set();
      aspMappedActivities.forEach((aspMappedActivity: any) => {
        aspIds.add(aspMappedActivity.activityAspDetail.aspId);
        subServiceIds.add(aspMappedActivity.activityAspDetail.subServiceId);
      });
      const uniqueAspIds = Array.from(aspIds);
      const uniqueSubServiceIds = Array.from(subServiceIds);

      // Store previous activity data before updates for KM comparison
      const previousActivityDataMap = new Map();
      for (const aspMappedActivity of aspMappedActivities) {
        const previousActivityData: any = await Activities.findOne({
          where: { id: aspMappedActivity.id },
          attributes: ["id", "nonMembershipType", "additionalChargeableKm", "paidTotalKm"],
          include: [
            {
              model: ActivityAspDetails,
              attributes: ["id", "estimatedTotalKm"],
              required: true,
            },
          ],
          transaction,
        });
        if (previousActivityData) {
          previousActivityDataMap.set(aspMappedActivity.id, previousActivityData);
        }
      }

      //GET ALL ASPS AND SUB SERVICES MASTER DETAILS
      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          aspIds: uniqueAspIds,
          subServiceIds: uniqueSubServiceIds,
        }
      );
      if (!getMasterDetail.data.success) {
        return getMasterDetail.data;
      }

      //REQUEST FORMATION FOR CUSTOMER AND ASP SERVICE RATE CARD
      const aspMasterDetails = getMasterDetail.data.data.aspsInformation;
      const subServiceMasterDetails =
        getMasterDetail.data.data.subServicesInformation;
      const activityDetails = [];
      for (const aspMappedActivity of aspMappedActivities) {
        const aspData = aspMasterDetails.find(
          (aspMasterDetail: any) =>
            aspMasterDetail.id == aspMappedActivity.activityAspDetail.aspId
        );
        const subServiceData = subServiceMasterDetails.find(
          (subServiceMasterDetail: any) =>
            subServiceMasterDetail.id ==
            aspMappedActivity.activityAspDetail.subServiceId
        );

        //MAP BREAKDOWN LOCATION DETAILS TO CASE INFORMATION
        if (payload.editType == 1) {
          activity.caseDetail.caseInformation.dataValues.breakdownLocation =
            payload.breakdownLocation;
          activity.caseDetail.caseInformation.dataValues.breakdownLat =
            payload.breakdownLat;
          activity.caseDetail.caseInformation.dataValues.breakdownLong =
            payload.breakdownLong;
        } else if (payload.editType == 2) {
          //MAP DROP LOCATION DETAILS TO CASE INFORMATION
          activity.caseDetail.caseInformation.dataValues.dropDealerId =
            payload.dropDealerId;
          activity.caseDetail.caseInformation.dataValues.dropLocationTypeId =
            payload.dropLocationTypeId;
          activity.caseDetail.caseInformation.dataValues.dropLocation =
            payload.dropLocation;
          activity.caseDetail.caseInformation.dataValues.dropLocationLat =
            payload.dropLocationLat;
          activity.caseDetail.caseInformation.dataValues.dropLocationLong =
            payload.dropLocationLong;
          activity.caseDetail.caseInformation.dataValues.breakdownToDropLocationDistance =
            payload.breakdownToDropDistance;
        }

        const notesResponse = await getNotes(
          activity.caseDetail,
          activity.caseDetail.caseInformation,
          subServiceData.serviceId,
          aspMappedActivity.activityAspDetail.subServiceId,
          payload.breakdownToDropDistance
        );

        if (notesResponse && notesResponse.success) {
          await Activities.update(
            {
              notes: JSON.stringify(notesResponse.notes),
              customerNeedToPay: notesResponse.notes.customerNeedToPay,
              nonMembershipType: notesResponse.notes.nonMembershipType,
              additionalChargeableKm:
                notesResponse.notes.additionalChargeableKm,
            },
            {
              where: { id: aspMappedActivity.id },
              transaction: transaction,
            }
          );

          activityDetails.push({
            caseDetailId: payload.caseDetailId,
            caseInformation: activity.caseDetail.caseInformation,
            aspId: aspMappedActivity.activityAspDetail.aspId,
            aspLocation: {
              latitude: aspData ? aspData.latitude : null,
              longitude: aspData ? aspData.longitude : null,
            },
            clientId: activity.caseDetail.clientId,
            activityId: aspMappedActivity.id,
            breakdownLocation: {
              latitude: activity.caseDetail.caseInformation.breakdownLat,
              longitude: activity.caseDetail.caseInformation.breakdownLong,
            },
            ...(subServiceData &&
              subServiceData.serviceId == 1 && {
              //IF TOWING
              dropLocation: {
                latitude: activity.caseDetail.caseInformation.dropLocationLat,
                longitude:
                  activity.caseDetail.caseInformation.dropLocationLong,
              },
            }),
            activityDetail: {
              id: aspMappedActivity.id,
              aspId: aspMappedActivity.activityAspDetail.aspId,
              customerNeedToPay: notesResponse.notes.customerNeedToPay,
              subServiceId: aspMappedActivity.activityAspDetail.subServiceId,
              nonMembershipType: notesResponse.notes.nonMembershipType,
              additionalChargeableKm:
                notesResponse.notes.additionalChargeableKm,
              isAspAutoAllocated: aspMappedActivity.isAspAutoAllocated,
            },
            aspServiceCostApiPayload: {
              caseDetailId: payload.caseDetailId,
              activityId: aspMappedActivity.id,
              aspId: aspMappedActivity.activityAspDetail.aspId,
              subServiceId: aspMappedActivity.activityAspDetail.subServiceId,
              totalKm: null,
              caseDate: moment
                .tz(activity.caseDetail.createdAt, "Asia/Kolkata")
                .format("YYYY-MM-DD"),
              typeId: 1,
              authUserRoleId: payload.authUserData.roleId,
            },
          });
        }
      }

      //CUSTOMER RATE CARD AND ASP RATE CARD CALCULATION
      const activityCostDetails = await axios.post(
        `${masterService}/${endpointMaster.rsaGetActivityCustomerAndAspRateCard}`,
        activityDetails
      );
      if (!activityCostDetails.data.success) {
        return activityCostDetails.data;
      }

      for (const activityCostDetail of activityCostDetails.data.data) {
        const customerServiceCost = activityCostDetail.customerRateCard;
        const aspServiceCost = activityCostDetail.aspRateCard;
        const activityId = customerServiceCost.activityDetail.id;
        // Get previous activity data from map (stored before updates)
        const previousActivityData = previousActivityDataMap.get(activityId);

        await ActivityAspDetails.update(
          {
            estimatedTotalKm: customerServiceCost.data.estimatedTotalKm,
            estimatedTotalDuration:
              customerServiceCost.data.estimatedTotalDuration,
            estimatedAspToBreakdownKm:
              customerServiceCost.data?.estimatedTotalKmBetweenLocations
                ?.estimatedAspToBreakdownKm ?? null,
            estimatedAspToBreakdownKmDuration:
              customerServiceCost.data?.estimatedTotalKmDurationBetweenLocations
                ?.estimatedAspToBreakdownKmDuration ?? null,
            estimatedBreakdownToAspKm:
              customerServiceCost.data?.estimatedTotalKmBetweenLocations
                ?.estimatedBreakdownToAspKm ?? null,
            estimatedBreakdownToAspKmDuration:
              customerServiceCost.data?.estimatedTotalKmDurationBetweenLocations
                ?.estimatedBreakdownToAspKmDuration ?? null,
            estimatedBreakdownToDropKm:
              customerServiceCost.data?.estimatedTotalKmBetweenLocations
                ?.estimatedBreakdownToDropKm ?? null,
            estimatedBreakdownToDropKmDuration:
              customerServiceCost.data?.estimatedTotalKmDurationBetweenLocations
                ?.estimatedBreakdownToDropKmDuration ?? null,
            estimatedDropToAspKm:
              customerServiceCost.data?.estimatedTotalKmBetweenLocations
                ?.estimatedDropToAspKm ?? null,
            estimatedDropToAspKmDuration:
              customerServiceCost.data?.estimatedTotalKmDurationBetweenLocations
                ?.estimatedDropToAspKmDuration ?? null,
            estimatedServiceCost:
              customerServiceCost.data?.estimatedServiceCost || null,
            estimatedTotalTax:
              customerServiceCost.data?.estimatedTotalTax || null,
            estimatedTotalAmount:
              customerServiceCost.data?.estimatedTotalAmount || null,
            estimatedAspServiceCost:
              aspServiceCost.data?.aspServiceCost || null,
            estimatedAspTotalTax: aspServiceCost.data?.aspTotalTax || null,
            estimatedAspTotalAmount:
              aspServiceCost.data?.aspTotalAmount || null,
          },
          {
            where: {
              activityId: customerServiceCost.activityDetail.id,
            },
            transaction,
          }
        );

        // Get current activity data (after updates) to calculate new KM
        const currentActivityData: any = await Activities.findOne({
          where: { id: activityId },
          attributes: ["id", "nonMembershipType", "additionalChargeableKm", "paidTotalKm"],
          include: [
            {
              model: ActivityAspDetails,
              attributes: ["id", "estimatedTotalKm"],
              required: true,
            },
          ],
          transaction,
        });

        // Handle additional KM payment calculation if location changed after payment was captured
        await handleAdditionalKmPaymentOnLocationUpdate(
          activityId,
          previousActivityData,
          currentActivityData,
          masterService,
          endpointMaster,
          transaction
        );

        //ACTIVITY ASP RATE CARD
        const aspRateCardData = aspServiceCost.data.aspRateCard;
        const activityAspRateCardData = {
          activityId: customerServiceCost.activityDetail.id,
          aspId: customerServiceCost.activityDetail.aspId,
          rangeLimit: aspRateCardData.range_limit,
          belowRangePrice: aspRateCardData.below_range_price,
          aboveRangePrice: aspRateCardData.above_range_price,
          waitingChargePerHour: aspRateCardData.waiting_charge_per_hour,
          emptyReturnRangePrice: aspRateCardData.empty_return_range_price,
        };

        const activityAspRateCard: any = await ActivityAspRateCards.findOne({
          attributes: ["id"],
          where: {
            activityId: customerServiceCost.activityDetail.id,
            aspId: customerServiceCost.activityDetail.aspId,
          },
        });
        if (!activityAspRateCard) {
          await ActivityAspRateCards.create(activityAspRateCardData, {
            transaction: transaction,
          });
        } else {
          await ActivityAspRateCards.update(activityAspRateCardData, {
            where: { id: activityAspRateCard.dataValues.id },
            transaction: transaction,
          });
        }

        //CREATE ACTIVITY CLIENT RATE CARD(IF CUSTOMER NEED TO PAY)
        await ActivityClientRateCards.destroy({
          where: {
            activityId: customerServiceCost.activityDetail.id,
            clientId: activity.caseDetail.clientId,
          },
          transaction: transaction,
          force: true,
        });
        if (customerServiceCost.data.customerNeedToPay) {
          const customerNonMembershipRateCardData =
            customerServiceCost.data.customerNonMembershipRateCard;
          const activityClientRateCardData = {
            activityId: customerServiceCost.activityDetail.id,
            clientId: activity.caseDetail.clientId,
            rangeLimit: customerNonMembershipRateCardData.range_limit,
            belowRangePrice:
              customerNonMembershipRateCardData.below_range_price,
            aboveRangePrice:
              customerNonMembershipRateCardData.above_range_price,
            waitingChargePerHour: null,
          };
          await ActivityClientRateCards.create(activityClientRateCardData, {
            transaction: transaction,
          });
        }

        syncActivityIds.push(customerServiceCost.activityDetail.id);

        if (customerServiceCost.activityDetail.isAspAutoAllocated) {
          aspAutoAllocatedActivityIds.push(
            customerServiceCost.activityDetail.id
          );
        }
      }
    }

    // if (payload.editType == 1) {
    //SYNC ASP REJECTION DETAILS FOR CRM REPORT.
    Utils.createReportSyncTableRecord(
      "aspRejectionReportDetails",
      syncActivityIds
    );

    //SYNC ASP AUTO ALLOCATED DETAILS FOR CRM REPORT.
    Utils.createReportSyncTableRecord(
      "autoAllocatedAspReportDetails",
      aspAutoAllocatedActivityIds
    );
    // }

    // Sync client report details, client report with mobile number details
    Utils.createReportSyncTableRecord(
      ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
      [activity.caseDetail.id]
    );


    // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
    Utils.createReportSyncTableRecord(
      ["financialReportDetails", "activityReportDetails"],
      syncActivityIds
    );


    return {
      success: true,
      message: "Processed successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

const vdmActivitiesRateCardUpdate = async (
  payload: any,
  caseDetail: any,
  transaction: any
) => {
  try {
    const aspMappedActivities: any = await Activities.findAll({
      attributes: ["id"],
      where: {
        caseDetailId: payload.caseDetailId,
        activityStatusId: {
          [Op.in]: [1, 4, 8], //Open, cancelled, rejected
        },
      },
      include: {
        model: ActivityAspDetails,
        required: true,
        attributes: ["id", "aspId", "subServiceId"],
        where: {
          aspId: {
            [Op.ne]: null,
          },
        },
      },
    });

    if (aspMappedActivities.length > 0) {
      const aspIds = new Set();
      aspMappedActivities.forEach((aspMappedActivity: any) => {
        aspIds.add(aspMappedActivity.activityAspDetail.aspId);
      });
      const uniqueAspIds = Array.from(aspIds);

      //GET ALL ASPS AND SUB SERVICES MASTER DETAILS
      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          aspIds: uniqueAspIds,
        }
      );
      if (!getMasterDetail.data.success) {
        return getMasterDetail.data;
      }

      //REQUEST FORMATION FOR CLIENT AND ASP SERVICE RATE CARD
      const aspMasterDetails = getMasterDetail.data.data.aspsInformation;
      const activityDetails = [];
      for (const aspMappedActivity of aspMappedActivities) {
        const aspData = aspMasterDetails.find(
          (aspMasterDetail: any) =>
            aspMasterDetail.id == aspMappedActivity.activityAspDetail.aspId
        );

        //LOCATION TYPE IS CUSTOMER PREFERRED LOCATION
        if (caseDetail.locationTypeId && caseDetail.locationTypeId == 451) {
          //PICKUP
          if (payload.editType == 1) {
            caseDetail.dataValues.pickupLatitude = payload.pickupLatitude;
            caseDetail.dataValues.pickupLongitude = payload.pickupLongitude;
          } else {
            //DROP
            caseDetail.dataValues.dropLatitude = payload.dropLatitude;
            caseDetail.dataValues.dropLongitude = payload.dropLongitude;
          }
        } else {
          //LOCATION TYPE IS DEALER
          //PICKUP
          if (payload.editType == 1) {
            caseDetail.dataValues.pickupLatitude = payload.pickupDealerData.lat;
            caseDetail.dataValues.pickupLongitude =
              payload.pickupDealerData.long;
          } else {
            //DROP
            caseDetail.dataValues.dropLatitude = payload.dropDealerData.lat;
            caseDetail.dataValues.dropLongitude = payload.dropDealerData.long;
          }
        }

        activityDetails.push({
          //CLIENT RATE CARD REQUEST PARAMS
          caseDetailId: payload.caseDetailId,
          clientId: caseDetail.clientId,
          aspId: aspMappedActivity.activityAspDetail.aspId,
          aspLocation: {
            latitude: aspData?.latitude || null,
            longitude: aspData?.longitude || null,
          },
          pickupLocation: {
            latitude: caseDetail.dataValues.pickupLatitude,
            longitude: caseDetail.dataValues.pickupLongitude,
          },
          dropLocation: {
            latitude: caseDetail.dataValues.dropLatitude,
            longitude: caseDetail.dataValues.dropLongitude,
          },
          activityId: aspMappedActivity.id,
          //ASP RATE CARD REQUEST PARAMS
          aspServiceCostApiPayload: {
            caseDetailId: payload.caseDetailId,
            activityId: aspMappedActivity.id,
            aspId: aspMappedActivity.activityAspDetail.aspId,
            subServiceId: aspMappedActivity.activityAspDetail.subServiceId,
            totalKm: null,
            caseDate: moment
              .tz(caseDetail.createdAt, "Asia/Kolkata")
              .format("YYYY-MM-DD"),
            typeId: 1,
            authUserRoleId: payload.authUserData.roleId,
          },
        });
      }

      if (activityDetails.length > 0) {
        //CLIENT RATE CARD AND ASP RATE CARD CALCULATION
        const activityCostDetails = await axios.post(
          `${masterService}/${endpointMaster.vdmGetActivityClientAndAspRateCard}`,
          activityDetails
        );
        if (!activityCostDetails.data.success) {
          return activityCostDetails.data;
        }

        for (const activityCostDetail of activityCostDetails.data.data) {
          const clientServiceCost = activityCostDetail.clientRateCard;
          const aspServiceCost = activityCostDetail.aspRateCard;

          await ActivityAspDetails.update(
            {
              estimatedOnlineKm:
                clientServiceCost.data?.estimatedTotalKm || null,
              estimatedTotalKm:
                clientServiceCost.data?.estimatedTotalKm || null,
              estimatedTotalDuration:
                clientServiceCost.data?.estimatedTotalDuration || null,
              estimatedAspToPickupKm:
                clientServiceCost.data?.estimatedTotalKmBetweenLocations
                  ?.estimatedAspToPickupKm ?? null,
              estimatedAspToPickupKmDuration:
                clientServiceCost.data?.estimatedTotalKmDurationBetweenLocations
                  ?.estimatedAspToPickupKmDuration ?? null,
              estimatedPickupToDropKm:
                clientServiceCost.data?.estimatedTotalKmBetweenLocations
                  ?.estimatedPickupToDropKm ?? null,
              estimatedPickupToDropKmDuration:
                clientServiceCost.data?.estimatedTotalKmDurationBetweenLocations
                  .estimatedPickupToDropKmDuration ?? null,
              estimatedDropToAspKm:
                clientServiceCost.data?.estimatedTotalKmBetweenLocations
                  ?.estimatedDropToAspKm ?? null,
              estimatedDropToAspKmDuration:
                clientServiceCost.data?.estimatedTotalKmDurationBetweenLocations
                  ?.estimatedDropToAspKmDuration ?? null,
              estimatedServiceCost:
                clientServiceCost.data?.estimatedServiceCost || null,
              estimatedTotalTax:
                clientServiceCost.data?.estimatedTotalTax || null,
              estimatedTotalAmount:
                clientServiceCost.data?.estimatedTotalAmount || null,
              estimatedAspServiceCost:
                aspServiceCost.data?.aspServiceCost || null,
              estimatedAspTotalTax: aspServiceCost.data?.aspTotalTax || null,
              estimatedAspTotalAmount:
                aspServiceCost.data?.aspTotalAmount || null,
            },
            {
              where: {
                activityId: clientServiceCost.payloadData.activityId,
              },
              transaction,
            }
          );

          //ACTIVITY ASP RATE CARD
          const aspRateCardData = aspServiceCost.data.aspRateCard;
          const activityAspRateCardData = {
            activityId: clientServiceCost.payloadData.activityId,
            aspId: clientServiceCost.payloadData.aspId,
            rangeLimit: aspRateCardData.range_limit,
            belowRangePrice: aspRateCardData.below_range_price,
            aboveRangePrice: aspRateCardData.above_range_price,
            waitingChargePerHour: aspRateCardData.waiting_charge_per_hour,
            emptyReturnRangePrice: aspRateCardData.empty_return_range_price,
          };
          const activityAspRateCard: any = await ActivityAspRateCards.findOne({
            attributes: ["id"],
            where: {
              activityId: clientServiceCost.payloadData.activityId,
              aspId: clientServiceCost.payloadData.aspId,
            },
          });
          if (!activityAspRateCard) {
            await ActivityAspRateCards.create(activityAspRateCardData, {
              transaction: transaction,
            });
          } else {
            await ActivityAspRateCards.update(activityAspRateCardData, {
              where: { id: activityAspRateCard.id },
              transaction: transaction,
            });
          }

          //ACTIVITY CLIENT RATE CARD
          const clientDeliveryRequestPrice =
            clientServiceCost.data.deliveryRequestPrice;
          const activityClientRateCardData = {
            clientId: caseDetail.clientId,
            activityId: clientServiceCost.payloadData.activityId,
            rangeLimit: clientDeliveryRequestPrice.rangeLimit,
            belowRangePrice: clientDeliveryRequestPrice.belowRangePrice,
            aboveRangePrice: clientDeliveryRequestPrice.aboveRangePrice,
            waitingChargePerHour:
              clientDeliveryRequestPrice.waitingChargePerHour,
          };
          const activityClientRateCard: any =
            await ActivityClientRateCards.findOne({
              attributes: ["id"],
              where: {
                activityId: clientServiceCost.payloadData.activityId,
                clientId: caseDetail.clientId,
              },
            });
          if (!activityClientRateCard) {
            await ActivityClientRateCards.create(
              {
                ...activityClientRateCardData,
              },
              {
                transaction: transaction,
              }
            );
          } else {
            await ActivityClientRateCards.update(
              {
                ...activityClientRateCardData,
              },
              {
                where: { id: activityClientRateCard.id },
                transaction: transaction,
              }
            );
          }
        }
      }
    }
    return {
      success: true,
      message: "Processed successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

const formCaseDetailForMapView = async (caseDetail: any, color: string) => {
  try {
    //RSA
    if (caseDetail.typeId == 31 && caseDetail.caseInformation) {
      return {
        id: caseDetail.id,
        typeId: caseDetail.typeId,
        clientId: caseDetail.clientId,
        caseNumber: caseDetail.caseNumber,
        registrationNumber: caseDetail.registrationNumber,
        vin: caseDetail.vin,
        vehicleTypeId: caseDetail.vehicleTypeId,
        vehicleMakeId: caseDetail.vehicleMakeId,
        vehicleModelId: caseDetail.vehicleModelId,
        subjectId: caseDetail.subjectID,
        latitude: caseDetail.caseInformation.breakdownLat,
        longitude: caseDetail.caseInformation.breakdownLong,
        womenAssist: caseDetail.caseInformation.womenAssist,
        irateCustomer: caseDetail.caseInformation.irateCustomer,
        caseTypeId: caseDetail.caseInformation.caseTypeId,
        color: color,
      };
    } else if (caseDetail.typeId == 32) {
      //VDM
      return {
        id: caseDetail.id,
        typeId: caseDetail.typeId,
        clientId: caseDetail.clientId,
        caseNumber: caseDetail.caseNumber,
        registrationNumber: caseDetail.registrationNumber,
        vin: caseDetail.vin,
        vehicleTypeId: caseDetail.vehicleTypeId,
        vehicleMakeId: caseDetail.vehicleMakeId,
        vehicleModelId: caseDetail.vehicleModelId,
        subjectId: caseDetail.subjectID,
        latitude: caseDetail.dataValues.pickupLatitude,
        longitude: caseDetail.dataValues.pickupLongitude,
        deliveryRequestPickupDate:
          caseDetail.dataValues.deliveryRequestPickupDate,
        deliveryRequestPickupTime:
          caseDetail.dataValues.deliveryRequestPickupTime,
        deliveryRequestSubServiceId:
          caseDetail.dataValues.deliveryRequestSubServiceId,
        color: color,
      };
    } else {
      return {};
    }
  } catch (error: any) {
    throw error;
  }
};

const caseCancelAutoEscalation = async (
  caseDetail: any,
  authUserId: number
) => {
  try {
    //GET MASTER DETAILS
    const getMasterDetail: any = await axios.post(
      `${masterService}/${endpointMaster.getMasterDetails}`,
      {
        clientId: caseDetail.clientId,
      }
    );

    let clientDetail = null;
    if (getMasterDetail?.data?.success) {
      clientDetail = getMasterDetail.data.data.client;
    }

    if (caseDetail.caseInformation.customerMobileNumber) {
      const templateReplacements = {
        "{account_name}": clientDetail ? clientDetail.name : "",
        "{ticket_no}": caseDetail.caseNumber,
        "{cust_toll_free}": clientDetail
          ? clientDetail.customerTollFreeNumber
          : "",
      };

      sendEscalationSms(
        caseDetail.caseInformation.customerMobileNumber,
        templateReplacements,
        951, //Case Detail
        caseDetail.id,
        authUserId,
        132, //Ticket Cancelled By Customer
        caseDetail.clientId
      );
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

const expiryServiceProviderTrackLink = async (caseId: number) => {
  try {
    const activities: any = await Activities.findAll({
      attributes: ["id", "serviceProviderTrackLinkId"],
      where: {
        caseDetailId: caseId,
        serviceProviderTrackLinkId: {
          [Op.ne]: null,
        },
      },
    });

    if (activities.length > 0) {
      const serviceProviderTrackLinkIds = activities.map(
        (activity: any) => activity.serviceProviderTrackLinkId
      );
      await links.update(
        { expiryDateTime: new Date() },
        {
          where: {
            id: {
              [Op.in]: serviceProviderTrackLinkIds,
            },
          },
        }
      );
    }

    return {
      success: true,
      message: "Processed successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

const deliveryRequestAlreadyCreatedForVin = async (
  clientId: number,
  vin: string,
  caseDetailId = null
) => {
  try {
    const where: any = {
      clientId: clientId,
      vin: vin,
      statusId: {
        [Op.notIn]: [3], // NOT CANCELLED
      },
    };
    if (caseDetailId) {
      where.id = {
        [Op.ne]: caseDetailId,
      };
    }
    const deliveryRequests: any = await CaseDetails.findAll({
      attributes: ["id"],
      where: where,
      include: [
        {
          model: Activities,
          required: false,
        },
      ],
    });
    if (deliveryRequests.length > 0) {
      for (const deliveryRequest of deliveryRequests) {
        if (deliveryRequest.activities.length > 0) {
          const notMaturedActivityStatusIds = [4, 5, 8]; //4-CANCELLED, 5-FAILURE, 8-REJECTED
          //MATURED ACTIVITY EXISTS
          if (
            deliveryRequest.activities.find(
              (activity: any) => activity.financeStatusId == 1
            )
          ) {
            return true;
          } else if (
            deliveryRequest.activities.find(
              (activity: any) =>
                activity.financeStatusId == 3 &&
                !notMaturedActivityStatusIds.includes(activity.activityStatusId)
            )
          ) {
            //NOT MATURED ACTIVITY WITH POSITIVE FLOW EXISTS
            return true;
          }
        } else {
          //NO ACTIVITIES WHICH MEANS NO ASP ASSIGNED AND CASE IS IN PROGRESS
          return true;
        }
      }
    }
    return false;
  } catch (error: any) {
    throw error;
  }
};

const getActivitySlaDetails = async (
  activitySlaDetails: any,
  slaStatusIds: any
) => {
  try {
    const uniqueBreakdownAreaIds = [
      ...new Set(
        activitySlaDetails.map(
          (activitySlaDetail: any) =>
            activitySlaDetail.activity.caseDetail.caseInformation
              .breakdownAreaId
        )
      ),
    ];
    const breakdownCities = uniqueBreakdownAreaIds.map((breakdownAreaId) => ({
      id: breakdownAreaId,
      typeId: 870, //ASP Breakdown Reach Time SLA - L1
    }));

    const filterDataResponse = await axios.post(
      `${masterService}/${endpointMaster.getCrmListFilterData}`,
      {
        breakdownCities: breakdownCities,
      }
    );

    let rsaSlaDetails = [];
    let exceededExpectationSlaMins = null;
    if (filterDataResponse.data.success) {
      rsaSlaDetails = filterDataResponse.data.data.breakdownCitySlaSettings;
      exceededExpectationSlaMins =
        filterDataResponse.data.data.exceededExpectationSlaMins.name;
    }

    let slaAchievedActivityIds = [];
    let slaNotAchievedActivityIds = [];
    let slaExceedAtExpectationActivityIds = [];
    let slaPerformanceInprogressActivityIds = [];
    for (const activitySlaDetail of activitySlaDetails) {
      //RSA
      if (
        activitySlaDetail.activity.caseDetail.caseInformation.breakdownAreaId &&
        rsaSlaDetails.length > 0
      ) {
        let slaBaseDate = null;
        //OLD LOGIC
        // if (
        //   activitySlaDetail.activity.isInitiallyCreated &&
        //   !activitySlaDetail.activity.isImmediateService
        // ) {
        //   //For primary and additional not immediate service on case creation
        //   slaBaseDate = activitySlaDetail.activity.serviceInitiatingAt;
        // } else if (!activitySlaDetail.activity.isInitiallyCreated) {
        //   //For additional service requested from mobile app or web
        //   slaBaseDate = activitySlaDetail.activity.createdAt;
        // } else {
        //   //For primary and additional immediate service
        //   slaBaseDate = activitySlaDetail.activity.caseDetail.createdAt;
        // }
        //NEW LOGIC
        //WHEN SERVICE IS INITIALLY CREATED AND NOT IMMEDIATE SERVICE, THEN USE SERVICE INITIATING AT ELSE USE CASE CREATED AT FOR BASE DATE
        if (activitySlaDetail.activity.isInitiallyCreated && !activitySlaDetail.activity.isImmediateService) {
          slaBaseDate = activitySlaDetail.activity.serviceInitiatingAt;
        } else {
          slaBaseDate = activitySlaDetail.activity.caseDetail.createdAt;
        }

        //GET CITY LOCATION TYPE BASED BREAKDOWN REACH TIME SLA
        const citySlaDetail = rsaSlaDetails.find(
          (rsaSlaDetail: any) =>
            rsaSlaDetail.id ==
            activitySlaDetail.activity.caseDetail.caseInformation
              .breakdownAreaId
        );
        const slaTime = citySlaDetail ? citySlaDetail.slaTime : null;

        const slaDateTime = moment
          .tz(slaBaseDate, "Asia/Kolkata")
          .add(slaTime, "seconds")
          .format("YYYY-MM-DD HH:mm:ss");

        //If asp already reached to breakdown then check sla base date and breakdown reached date.
        if (activitySlaDetail.activity.aspReachedToBreakdownAt) {
          const formattedAspReachedToBreakdownAt = moment
            .tz(
              activitySlaDetail.activity.aspReachedToBreakdownAt,
              "Asia/Kolkata"
            )
            .format("YYYY-MM-DD HH:mm:ss");

          if (formattedAspReachedToBreakdownAt > slaDateTime) {
            slaNotAchievedActivityIds.push(activitySlaDetail.activity.id);
          } else {
            const momentSlaDateTime = moment.tz(slaDateTime, "Asia/Kolkata");
            const slaDateTimeMinusExpectedSlaMin = momentSlaDateTime.subtract(
              exceededExpectationSlaMins,
              "minutes"
            );
            const formattedSlaDateTimeMinusExpectedSlaMin =
              slaDateTimeMinusExpectedSlaMin.format("YYYY-MM-DD HH:mm:ss");

            //If asp reached breakdown before SLA exceeded time
            if (
              formattedAspReachedToBreakdownAt <=
              formattedSlaDateTimeMinusExpectedSlaMin
            ) {
              slaExceedAtExpectationActivityIds.push(
                activitySlaDetail.activity.id
              );
            } else {
              slaAchievedActivityIds.push(activitySlaDetail.activity.id);
            }
          }
        } else if (
          moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss") >
          slaDateTime
        ) {
          //CURRENT TIME EXCEEDS THE BREAKDOWN REACH TIME SLA
          slaNotAchievedActivityIds.push(activitySlaDetail.activity.id);
        } else {
          //CURRENT TIME DOES NOT EXCEEDS THE BREAKDOWN REACH TIME SLA
          slaPerformanceInprogressActivityIds.push(
            activitySlaDetail.activity.id
          );
        }
      }
    }

    const slaActivityIds = [];
    if (slaStatusIds.includes(1)) {
      slaActivityIds.push(...slaAchievedActivityIds);
    }
    if (slaStatusIds.includes(2)) {
      slaActivityIds.push(...slaNotAchievedActivityIds);
    }
    if (slaStatusIds.includes(3)) {
      slaActivityIds.push(...slaExceedAtExpectationActivityIds);
    }
    if (slaStatusIds.includes(4)) {
      slaActivityIds.push(...slaPerformanceInprogressActivityIds);
    }

    return {
      success: true,
      slaActivityIds,
    };
  } catch (error: any) {
    throw error;
  }
};

// Helper function to calculate breakdown reach time SLA (without saving to database)
const calculateBreakdownReachTimeSLA = async (
  caseDetail: any,
  activity: any
) => {
  try {
    if (
      !caseDetail?.caseInformation?.breakdownAreaId
    ) {
      return {
        success: false,
        error: "Breakdown area not found",
      }
    }

    // Get city data to find locationTypeId
    let cityData: any = await axios.post(
      `${masterService}/${endpointMaster.getCityData}`,
      { cityId: caseDetail.caseInformation.breakdownAreaId }
    );

    if (
      !cityData?.data?.data?.locationTypeId
    ) {
      return {
        success: false,
        error: "Location type not found",
      }
    }

    // Get SLA setting from master service
    const slaSettingResponse = await axios.post(
      `${masterService}/${endpointMaster.sla.getByCaseTypeAndTypeId}`,
      {
        caseTypeId: 31, // CRM case type
        typeId: 870, // ASP Breakdown Reach Time SLA - L1
        breakdownAreaId: caseDetail.caseInformation.breakdownAreaId,
      }
    );

    if (!slaSettingResponse?.data?.success || !slaSettingResponse?.data?.data) {
      return {
        success: false,
        error: "SLA setting not found",
      }
    }

    const masterSla = slaSettingResponse.data.data;

    // Get comparison date
    let compareDate: any = await getComparisionDate(activity, caseDetail);
    if (!compareDate) {
      return {
        success: false,
        error: "Comparison date not found",
      }
    }

    // Calculate SLA time
    let SLATime: any = await getSLATime(compareDate, masterSla.time);
    let slaStatus = null;
    let statusColor = null;

    if (activity.aspReachedToBreakdownAt) {
      let aspReachedToBreakdownAt: any = new Date(
        activity.aspReachedToBreakdownAt
      ).toISOString();
      // Violation Check
      if (aspReachedToBreakdownAt > SLATime) {
        slaStatus = "SLA Violated";
        statusColor = "red";
      }
      // Achieved Check
      if (aspReachedToBreakdownAt <= SLATime) {
        slaStatus = "SLA Achieved";
        statusColor = "green";
      }
    }

    // Inprogress check
    let currentTime: any = new Date().toISOString();
    if (!activity.aspReachedToBreakdownAt && currentTime < SLATime) {
      slaStatus = await getTimeDifference(SLATime);
      statusColor = "orange";
    }
    if (!activity.aspReachedToBreakdownAt && currentTime >= SLATime) {
      // Violation Check
      slaStatus = "SLA Violated";
      statusColor = "red";
    }

    return {
      slaStatus,
      statusColor,
      slaTime: SLATime,
      aspReachedToBreakdownAt: activity.aspReachedToBreakdownAt || null,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    }
  }
};

export default caseController;
