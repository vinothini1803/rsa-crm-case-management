import { Request, Response } from "express";
import {
  Activities,
  ActivityAspDetails,
  ActivityLogs,
  AutoAssignmentCase,
  CallInitiation,
  CaseDetails,
  CaseInformation,
  CaseQuestionnaireAnswer,
  CustomerServiceEntitlement,
  TempCaseFormDetail,
  TemplateSmsDetails,
  Templates,
  links,
  DialerLogs,
} from "../database/models/index";
import { Op, where } from "sequelize";
const config = require("../config/config.json");
import axios from "axios";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import caseDetails from "../database/models/caseDetails";
import { getCustomerServiceEntitlement } from "./customerServiceEntitlement";
import { CustomerService } from "../database/models/index";
import {
  createActivityAndActivityAspDetail,
  getNotes,
} from "../controllers/activitiesContoller";
import { sendEscalationSms } from "../controllers/template";

import moment from "moment-timezone";
import dotenv from "dotenv";
import { saveCaseInElk } from "../elasticsearch/sync/case";
import attachments from "../database/models/attachments";
import notificationController from "./notificationController";
import {
  calculateAvailableService,
  getCustomerService,
  storeClientServiceAgainstCustomerService,
} from "./customerService";
dotenv.config();

//API with endpoint (API Gateway);
const apiGatewayService = `${config.apiGatewayService.host}:${config.apiGatewayService.port}/${config.apiGatewayService.version}`;
const endpointApiGateway = config.apiGatewayService.endpoint;

export namespace caseInfoController {
  //API with endpoint (Master);
  const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
  const endpointMaster = config.MasterService.endpoint;

  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  // API endpoint for L2 agent
  const l2AgentService = `${config.L2AgentService.host}:${config.L2AgentService.port}/${config.L2AgentService.version}/${config.L2AgentService.serviceAccess.l2agent}`;
  const endpointL2Agent = config.L2AgentService.endpoint;

  async function sleep(ms: any) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  //Create New Case
  export async function addCaseInformation(req: Request, res: Response) {
    const transaction: any = await sequelize.transaction();
    try {
      const inData = req.validBody;
      //CUSTOM VALIDATION
      if (inData.isVinOrVehicleManuallyEntered) {
        const checkVinOrVehicleValidResponse = await axios.post(
          `${process.env.RSA_BASE_URL}/crm/checkVinOrVehicleValid`,
          {
            clientName: inData.clientName,
            vin: inData.vin,
            vehicleRegistrationNumber: inData.registrationNumber,
          }
        );

        if (!checkVinOrVehicleValidResponse.data.success) {
          await transaction.rollback();
          return res.status(200).json(checkVinOrVehicleValidResponse.data);
        }
      }

      //IF DROP LOCATION IS DEALER OR CUSTOMER PREFERRED LOCATION IS DEALER MEANS VALIDATE DROP DETAILS
      if (
        inData.dropLocationTypeId == 452 ||
        inData.customerPreferredLocationId == 461
      ) {
        if (!inData.dropDealerId) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Drop dealer is required",
          });
        }
      }

      //IF CUSTOMER PREFERRED IS HOME OR GARAGE OR CHARGING STATION THEN DROP AREA IS REQUIRED
      if (
        [462, 463, 464].includes(inData.customerPreferredLocationId) &&
        !inData.dropAreaId
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Drop area is required",
        });
      }

      // CHECK POLCIY VALIDATION ONLY IF THE POLICY TYPE IS WARRANTY OR EXTENDED WARRANTY OR RSA RETAIL
      if (
        [431, 432, 433].includes(inData.policyTypeId) &&
        inData.policyStartDate &&
        inData.policyEndDate
      ) {
        const policyValidationResponse = await policyCheck(inData, res);
        if (policyValidationResponse !== "success") {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: policyValidationResponse,
          });
        }
      }

      // GENERATE SERIAL NUMBER
      const financialYear = Utils.getCurrentFinancialYear();
      const [
        generateSerialNumber,
        l1AgentDetail,
        getAgentDetail,
        tempCaseFormDetail,
      ]: any = await Promise.all([
        axios.get(
          `${masterService}/${endpointMaster.generateCaseSerialNumber}?clientId=${inData.clientId}&financialYear=${financialYear}`
        ),
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: inData.createdById,
        }),
        Utils.getUserDetail(inData.createdById),
        TempCaseFormDetail.findOne({
          where: {
            id: inData.tempCaseFormDetailId,
          },
          attributes: ["id", "payload", "createdAt"],
        }),
      ]);

      if (!generateSerialNumber.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: generateSerialNumber.data.error,
        });
      }
      // Level 1 agent details
      if (!l1AgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "L1 agent not found",
        });
      }

      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      if (!tempCaseFormDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `The temporary case form detail not found`,
        });
      }

      //CHECK GENERATED SERIAL NUMBER ALREADY TAKEN OR NOT
      const serialNumberExist = await caseDetails.findOne({
        where: { caseNumber: generateSerialNumber.data.data },
        attributes: ["id"],
      });

      if (serialNumberExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `The case number ${generateSerialNumber.data.data} is already taken`,
        });
      }

      // Create Case Information
      let caseDetailData: any = {
        date: new Date(),
        typeId: inData.typeId,
        l1AgentId: inData.createdById,
        agentAutoAllocation: inData.agentAutoAllocation,
        clientId: inData.clientId,
        callCenterId: getAgentDetail?.data?.user?.callCenterId || null,
        registrationNumber: inData.registrationNumber,
        caseNumber: generateSerialNumber.data.data,
        subjectID: inData.subjectId,
        vin: inData.vin,
        vehicleTypeId: inData.vehicleTypeId,
        vehicleMakeId: inData.vehicleMakeId,
        vehicleModelId: inData.vehicleModelId,
        statusId: 1, //OPEN
        createdById: inData.createdById,
        rmId: inData.breakdownAreaRmId ? inData.breakdownAreaRmId : null,
        inboundCallMonitorUCID: inData.monitorUcid,
      };

      // Set caseCreateClickedAt from tempCaseFormDetail createdAt (L1 "Case Create" click time)
      if (tempCaseFormDetail && tempCaseFormDetail.createdAt) {
        caseDetailData.caseCreateClickedAt = tempCaseFormDetail.createdAt;
      }

      //SELF ASSIGN L1 AGENT AS L2 AGENT
      if (inData.agentAutoAllocation == 0) {
        caseDetailData.agentId = inData.createdById;
        caseDetailData.statusId = 2; //INPROGRESS
        caseDetailData.agentAssignedAt = new Date();
      }

      const createdCaseDetail = await CaseDetails.create(caseDetailData, {
        transaction: transaction,
      });
      inData.caseDetailId = createdCaseDetail.dataValues.id;
      inData.notes = JSON.stringify(inData.notes);
      inData.additionalServiceRequested =
        inData?.additionalServiceDetails?.length > 0 ? 1 : 0;
      inData.breakdownLocationUpdatedAt = new Date();

      // Get nearest dealer for towing service
      inData.nearestDealerId = null;
      if (inData.serviceId == 1 && inData.breakdownLat && inData.breakdownLong) {
        const nearestDealerResponse = await Utils.getNearestDealerByBreakdownLocation({
          clientId: inData.clientId,
          caseTypeId: inData.caseTypeId,
          breakdownLat: inData.breakdownLat,
          breakdownLong: inData.breakdownLong,
        });
        if (nearestDealerResponse && nearestDealerResponse.success) {
          inData.nearestDealerId = nearestDealerResponse.nearestDealerId;
        }
      }

      // Create Case Information
      const createdCaseInformation = await CaseInformation.create(inData, {
        transaction: transaction,
      });

      saveCaseInElk(
        {
          caseId: createdCaseDetail.dataValues.id,
          caseNumber: createdCaseDetail.dataValues.caseNumber,
          subject: inData.subjectId,
          // status: "Open",
          // statusId: 1,
          status: "",
          statusId: caseDetailData.statusId,
          customerContactName: inData.customerContactName,
          customerMobileNumber: inData.customerMobileNumber,
          breakdownLocation: inData.breakdownLocation,
          clientId: inData.clientId,
          vehicleNumber: inData.registrationNumber,
          vin: inData.vin,
          irateCustomer: inData.irateCustomer ? 'Yes' : 'No',
          dropLocation: inData.dropLocation,
          callCenter: caseDetailData.callCenterId,
          agent: caseDetailData.agentId,
          rmName: caseDetailData.rmId,
          womenAssist: inData.womenAssist ? 'Yes' : 'No',
          policyType: inData.policyTypeId,
          policyNumber: inData.policyNumber,
          policyStartDate: inData.policyStartDate,
          policyEndDate: inData.policyEndDate,
        },
        inData.vin,
        {
          mobileNumber: inData.customerMobileNumber,
          language: inData.contactLanguageId,
        }
      );

      const tempCaseFormDetailPayload = JSON.parse(tempCaseFormDetail.payload);
      if (tempCaseFormDetailPayload.callInitiationId) {
        const callInitiation = {
          contactName: inData.customerContactName
            ? inData.customerContactName
            : null,
          mobileNumber: inData.customerMobileNumber
            ? inData.customerMobileNumber
            : null,
          caseId: createdCaseDetail.dataValues.id,
          updatedById: inData.createdById,
        };
        await CallInitiation.update(callInitiation, {
          where: {
            id: tempCaseFormDetailPayload.callInitiationId,
          },
          transaction,
        });
      }

      if (inData.monitorUcid) {
        await DialerLogs.update(
          { caseDetailId: createdCaseDetail.dataValues.id },
          { where: { callMonitorUCID: inData.monitorUcid }, transaction }
        );
        let dialerLog: any = await DialerLogs.findOne({
          where: { callMonitorUCID: inData.monitorUcid },
          transaction,
        });
        console.log("dialer log", dialerLog);
        if (dialerLog) {
          await ActivityLogs.update(
            { caseDetailId: inData.caseDetailId },
            { where: { id: dialerLog.activityLogId }, transaction }
          );
        }
      }

      await Promise.all([
        TempCaseFormDetail.destroy({
          where: {
            id: inData.tempCaseFormDetailId,
          },
          force: true,
          transaction: transaction,
        }),
        ActivityLogs.create(
          {
            caseDetailId: inData.caseDetailId,
            typeId: 240, //WEB
            title: `The L1 agent "${l1AgentDetail.data.user.name}" has created a RSA request.`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      //SELF ASSIGN L1 AGENT AS L2 AGENT
      let agentName = null;
      if (inData.agentAutoAllocation == 0) {
        // FCM PUSH NOTIFICATIONS
        const getAgentDetail = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUser}`,
          {
            id: inData.createdById,
          }
        );
        if (getAgentDetail.data.success) {
          //AGENT UPDATE
          await ActivityLogs.create(
            {
              caseDetailId: inData.caseDetailId,
              typeId: 240, //WEB
              title: `The agent "${getAgentDetail.data.user.name}" has been assigned to this request.`,
              createdAt: new Date(),
            },
            { transaction: transaction }
          );

          //PUSH NOTIFICATION NEED TO BE ENABLED
          agentName = getAgentDetail.data.user.name;

          //Send escalation sms only for ICICIL client
          const templateReplacements = {
            "{agent_name}": getAgentDetail.data.user.name,
          };
          sendEscalationSms(
            inData.customerMobileNumber,
            templateReplacements,
            951, //Case Detail
            inData.caseDetailId,
            inData.createdById,
            126, //Only Once When Ticket ID Assigned To Agent
            inData.clientId
          );
        }
        // update agent in user login
        axios.put(`${userServiceUrl}/${userServiceEndpoint.updateUserLogin}`, {
          userId: inData.createdById,
          pendingCaseCount: 1,
          assignedCasesCount: 1,
          lastAllocatedCaseTime: new Date(),
        });
      }

      //CREATE ACTIVITY AND ACTIVITY ASP DETAIL FOR SELECTED SERVICE (PRIMARY SERVICE)
      const selectedServiceCreateActivityResponse =
        await createActivityAndActivityAspDetail(
          createdCaseDetail,
          createdCaseInformation,
          inData.createdById,
          inData.serviceId,
          inData.subServiceId,
          inData.breakdownToDropLocationDistance,
          1, //INITIALLY CREATED
          inData.serviceIsImmediate,
          inData.serviceInitiatingAt,
          inData.serviceExpectedAt,
          inData.aspAutoAllocation,
          transaction
        );
      if (!selectedServiceCreateActivityResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: selectedServiceCreateActivityResponse.error,
        });
      }

      //LATER AUTO ASSIGN AGENT EXISTS (WHICH MEANS ALL SERVICE REQUESTED LATER) OR
      //LATER AGENT AUTO ASSIGN AGENT NOT EXISTS (WHICH MEANS ANY ONE SERVICE IS REQUESTED IMMEDIATELY) & SERVICE IS LATER & ASP AUTO ALOCATION IS TRUE
      if (
        inData.laterAutoAssignAgentExists ||
        (!inData.laterAutoAssignAgentExists &&
          !inData.serviceIsImmediate &&
          inData.aspAutoAllocation)
      ) {
        const autoAssignmentCase: any = await createAutoAssignmentCases(
          createdCaseDetail.dataValues.id,
          selectedServiceCreateActivityResponse.activityId,
          transaction
        );
        if (!autoAssignmentCase.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: autoAssignmentCase.error,
          });
        }
      }

      //CREATE ACTIVITY AND ACTIVITY ASP DETAIL FOR ADDITIONAL SERVICE (ONLY FOR TOWING)
      if (
        inData.additionalServiceDetails &&
        inData.additionalServiceDetails.length > 0
      ) {
        for (const additionalServiceDetail of inData.additionalServiceDetails) {
          const additionalServiceCreateActivityResponse =
            await createActivityAndActivityAspDetail(
              createdCaseDetail,
              createdCaseInformation,
              inData.createdById,
              additionalServiceDetail.additionalServiceId,
              additionalServiceDetail.additionalSubServiceId,
              null, //need to pass value if towing related service means
              1, //INITIALLY CREATED
              additionalServiceDetail.additionalServiceIsImmediate,
              additionalServiceDetail.additionalServiceInitiatingAt,
              additionalServiceDetail.additionalServiceExpectedAt,
              additionalServiceDetail.additionalServiceAspAutoAllocation
                ? 1
                : 0,
              transaction
            );
          if (!additionalServiceCreateActivityResponse.success) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: additionalServiceCreateActivityResponse.error,
            });
          }

          additionalServiceDetail.activityId =
            additionalServiceCreateActivityResponse.activityId;

          //SERVICE IS LATER & ASP AUTO ALOCATION IS TRUE
          if (
            !additionalServiceDetail.additionalServiceIsImmediate &&
            additionalServiceDetail.additionalServiceAspAutoAllocation
          ) {
            const additionalServiceAutoAssignmentCase: any =
              await createAutoAssignmentCases(
                createdCaseDetail.dataValues.id,
                additionalServiceCreateActivityResponse.activityId,
                transaction
              );
            if (!additionalServiceAutoAssignmentCase.success) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: additionalServiceAutoAssignmentCase.error,
              });
            }
          }
        }
      }

      //Send this sms only for isuzu client
      const templateReplacements = {
        "{account_name}": inData.clientName,
        "{ticket_no}": createdCaseDetail.dataValues.caseNumber,
        "{cust_toll_free}": inData.customerTollFreeNumber,
      };

      sendEscalationSms(
        inData.customerMobileNumber,
        templateReplacements,
        951, //Case Detail
        inData.caseDetailId,
        inData.createdById,
        133, //Ticket Creation (Case Created)
        inData.clientId
      );

      //VALIDATE AND SAVE QUESTIONNAIRE ANSWERS
      if (inData.subjectId) {
        // Fetch questionnaires for the case subject to validate
        let questionnairesResponse: any = null;
        try {
          questionnairesResponse = await axios.get(
            `${masterService}/${endpointMaster.caseSubjects.caseSubjects}/getQuestionnairesByCaseSubjectId?caseSubjectId=${inData.subjectId}`
          );
        } catch (error: any) {
          // If API call fails, continue without validation (optional validation)
          console.error("Error fetching questionnaires:", error);
        }

        // COMMENTED OUT: Questionnaire validation - making questionnaires optional
        // if (questionnairesResponse?.data?.success && questionnairesResponse.data.data?.length > 0) {
        //   const expectedQuestionnaires = questionnairesResponse.data.data;
        //   const questionnaireAnswers = inData.questionnaireAnswers || [];
        //   
        //   // Check if all questionnaires have answers
        //   const answeredQuestionnaireIds = questionnaireAnswers.map((q: any) => q.questionnaireId).filter((id: any) => id !== undefined && id !== null);
        //   const missingAnswers = expectedQuestionnaires.filter(
        //     (q: any) => {
        //       const questionnaireId = q.id || q.dataValues?.id;
        //       return questionnaireId !== undefined && questionnaireId !== null && !answeredQuestionnaireIds.includes(questionnaireId);
        //     }
        //   );
        //   
        //   if (missingAnswers.length > 0) {
        //     await transaction.rollback();
        //     return res.status(200).json({
        //       success: false,
        //       error: "Please answer all probing questions before submitting the case",
        //     });
        //   }
        //   
        //   // Validate answer content for each questionnaire
        //   for (const questionnaire of expectedQuestionnaires) {
        //     const questionnaireId = questionnaire.id || questionnaire.dataValues?.id;
        //     if (!questionnaireId) {
        //       console.error("Questionnaire missing id:", questionnaire);
        //       continue; // Skip questionnaires without valid id
        //     }
        //     const answer = questionnaireAnswers.find((q: any) => q.questionnaireId === questionnaireId);
        //     if (!answer || answer.answer === undefined || answer.answer === null) {
        //       await transaction.rollback();
        //       return res.status(200).json({
        //         success: false,
        //         error: "Please answer all probing questions before submitting the case",
        //       });
        //     }
        //     
        //     const answerType = questionnaire.answerType;
        //     const fieldType = answerType?.fieldType;
        //     
        //     // Validate option_text - both option and text required
        //     if (fieldType === "option_text") {
        //       if (typeof answer.answer !== 'object' || 
        //           !answer.answer.option || 
        //           answer.answer.option === '' ||
        //           !answer.answer.text || 
        //           answer.answer.text.trim() === '') {
        //         await transaction.rollback();
        //         return res.status(200).json({
        //           success: false,
        //           error: `Please provide both option and text for question: ${questionnaire.question}`,
        //         });
        //       }
        //     } else if (fieldType === "option_conditional") {
        //       // For option_conditional, check if selected option requires text
        //       const conditionalOptions = answerType?.conditionalOptions 
        //         ? (typeof answerType.conditionalOptions === 'string' 
        //             ? JSON.parse(answerType.conditionalOptions) 
        //             : answerType.conditionalOptions)
        //         : [];
        //       
        //       if (typeof answer.answer !== 'object' || !answer.answer.option || answer.answer.option === '') {
        //         await transaction.rollback();
        //         return res.status(200).json({
        //           success: false,
        //           error: `Please select an option for question: ${questionnaire.question}`,
        //         });
        //       }
        //       
        //       // If selected option is in conditionalOptions, text is required
        //       if (conditionalOptions.includes(answer.answer.option)) {
        //         if (!answer.answer.text || answer.answer.text.trim() === '') {
        //           await transaction.rollback();
        //           return res.status(200).json({
        //             success: false,
        //             error: `Please provide text details for question: ${questionnaire.question}`,
        //           });
        //         }
        //       }
        //     } else if (fieldType === "option") {
        //       // For option type, answer should be a non-empty string
        //       if (typeof answer.answer !== 'string' || answer.answer.trim() === '') {
        //         await transaction.rollback();
        //         return res.status(200).json({
        //           success: false,
        //           error: `Please select an option for question: ${questionnaire.question}`,
        //         });
        //       }
        //     } else if (fieldType === "text") {
        //       // For text type, answer should be a non-empty string
        //       if (typeof answer.answer !== 'string' || answer.answer.trim() === '') {
        //         await transaction.rollback();
        //         return res.status(200).json({
        //           success: false,
        //           error: `Please provide an answer for question: ${questionnaire.question}`,
        //         });
        //       }
        //     }
        //   }
        // }
        // Questionnaire answers are optional - if questionnaires exist and answers are provided, they will be saved
      }

      //SAVE QUESTIONNAIRE ANSWERS
      if (inData.questionnaireAnswers && Array.isArray(inData.questionnaireAnswers)) {
        for (const answer of inData.questionnaireAnswers) {
          // Validate questionnaireId is a valid number
          const questionnaireId = answer.questionnaireId;
          if (questionnaireId !== undefined &&
            questionnaireId !== null &&
            !isNaN(Number(questionnaireId)) &&
            Number(questionnaireId) > 0 &&
            answer.answer !== undefined &&
            answer.answer !== null) {
            await CaseQuestionnaireAnswer.create(
              {
                caseId: createdCaseDetail.dataValues.id,
                questionnaireId: Number(questionnaireId),
                answer: typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer),
                createdById: inData.createdById,
                updatedById: inData.createdById,
              },
              {
                transaction: transaction,
              }
            );
          } else {
            console.error("Invalid questionnaire answer data:", answer);
          }
        }
      }

      await transaction.commit();

      // L2 Agent and ASP Auto Allocation Process
      autoAllocationProcess(
        createdCaseDetail,
        inData,
        inData.additionalServiceDetails,
        selectedServiceCreateActivityResponse
      );

      //Update customer service details and sales portal policy vehicle details.
      updateCustomerServiceAndSalesPortalPolicyDetail(inData);

      //SELF AGENT ASSIGNMENT
      if (inData.agentAutoAllocation == 0) {
        let details: any = {
          caseDetailId: inData.caseDetailId,
          notifyToAll: [""],
        };
        details.templateId = 1;
        details.agentName = agentName;
        details.notificationType = "CRM";
        notificationController.sendNotification(details);
      }

      // Sync client report details, client report with mobile number details
      Utils.createReportSyncTableRecord(
        ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
        [createdCaseDetail.dataValues.id]
      );

      return res.status(200).json({
        success: true,
        message: "New Case Information Created Successfully",
        caseDetailId: createdCaseDetail.dataValues.id,
        caseInformationId: createdCaseInformation.dataValues.id,
      });
    } catch (error: any) {
      // console.log("Error in caseInfoController", error);
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function autoAllocationProcess(
    createdCaseDetail: any,
    inData: any,
    additionalServiceDetails: any,
    selectedServiceCreateActivityResponse: any
  ) {
    try {
      //IF AGENT AUTO ALLOCATION IS TRUE AND LATER AGENT AUTO ASSIGN AGENT DOES NOT EXISTS (WHICH MEANS ANY ONE SERVICE IS REQUESTED IMMEDIATELY)
      let l2AgentAllocationResponse: any = null;
      if (
        createdCaseDetail &&
        !inData.laterAutoAssignAgentExists &&
        inData.agentAutoAllocation == 1
      ) {
        // console.log(
        //   "calling agent allocation from auto allocation ***",
        //   createdCaseDetail.dataValues.id,
        //   inData.contactLanguageId,
        //   inData.clientId,
        //   inData.breakdownAreaId
        // );
        l2AgentAllocationResponse = await agentAutoAllocation({
          caseDetailId: createdCaseDetail.dataValues.id,
          languageId: inData.contactLanguageId,
          clientId: inData.clientId,
          breakDownId: inData.breakdownAreaId,
        });
        await agentActivityUpdate(
          l2AgentAllocationResponse,
          inData.caseDetailId
        );
      }

      //IF AGENT AUTO ALLOCATION IS FALSE OR
      //LATER AGENT AUTO ASSIGN AGENT DOES NOT EXISTS (WHICH MEANS ANY ONE SERVICE IS REQUESTED IMMEDIATELY) AND AGENT AUTO ALLOCATION IS TRUE WITH L2 AGENT AUTO ASSIGNED
      if (
        inData.agentAutoAllocation == 0 ||
        !inData.agentAutoAllocation ||
        (!inData.laterAutoAssignAgentExists &&
          inData.agentAutoAllocation == 1 &&
          l2AgentAllocationResponse?.success &&
          l2AgentAllocationResponse?.message &&
          l2AgentAllocationResponse?.message?.agentId)
      ) {
        let agentId: any = null;
        if (inData.agentAutoAllocation == 0) {
          agentId = inData.createdById;
        } else {
          agentId = l2AgentAllocationResponse?.message?.agentId;
        }
        // ASP Auto Allocation process
        if (
          inData.serviceIsImmediate &&
          inData.aspAutoAllocation &&
          selectedServiceCreateActivityResponse.activityId &&
          agentId != null
        ) {
          await aspAutoAllocation({
            caseDetailId: createdCaseDetail.dataValues.id,
            breakdownAreaId: inData.breakdownAreaId,
            latitude: inData.breakdownLat,
            longitude: inData.breakdownLong,
            activityStatusId: 1,
            serviceId: inData.serviceId,
            subServiceId: inData.subServiceId,
            activityId: selectedServiceCreateActivityResponse.activityId,
            agentId: agentId,
          });
        }

        if (additionalServiceDetails && additionalServiceDetails.length > 0) {
          for (const additionalServiceDetail of additionalServiceDetails) {
            if (
              additionalServiceDetail.additionalServiceIsImmediate &&
              additionalServiceDetail.additionalServiceAspAutoAllocation &&
              additionalServiceDetail.activityId &&
              agentId != null
            ) {
              await aspAutoAllocation({
                caseDetailId: createdCaseDetail.dataValues.id,
                breakdownAreaId: inData.breakdownAreaId,
                latitude: inData.breakdownLat,
                longitude: inData.breakdownLong,
                activityStatusId: 1,
                serviceId: additionalServiceDetail.additionalServiceId,
                subServiceId: additionalServiceDetail.additionalSubServiceId,
                activityId: additionalServiceDetail.activityId,
                agentId: agentId,
              });
            }
          }
        }
      }
    } catch (error) {
      console.log("Error in auto allocation process", error);
    }
  }

  export async function agentAutoAllocation(caseDetail: any) {
    try {
      const l2AgentAllocationResponse = await axios.post(
        `${l2AgentService}/${endpointL2Agent.agentAssignment}`,
        caseDetail
      );
      return l2AgentAllocationResponse?.data;
    } catch (error: any) {
      throw error;
    }
  }

  export async function aspAutoAllocation(caseDetail: any) {
    try {
      const aspAutoAllocationResponse = await axios.post(
        `${l2AgentService}/${endpointL2Agent.aspAutoAssignment}`,
        caseDetail
      );
      return aspAutoAllocationResponse.data;
    } catch (error: any) {
      throw error;
    }
  }

  export async function agentActivityUpdate(
    l2AgentAllocationResponse: any,
    caseDetailId: any
  ) {
    try {
      if (
        l2AgentAllocationResponse?.success &&
        l2AgentAllocationResponse?.message &&
        l2AgentAllocationResponse?.message?.agentId
      ) {
        //AGENT UPDATE
        const getAgentDetail = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUser}`,
          {
            id: l2AgentAllocationResponse.message.agentId,
          }
        );
        await ActivityLogs.create({
          caseDetailId: caseDetailId,
          typeId: 240, //WEB
          title: `The agent "${getAgentDetail.data.user.name}" has been assigned to this request.`,
          createdAt: new Date(),
        });
      }
    } catch (error: any) {
      console.log("error while creating agent activity", error);
    }
  }

  export async function policyCheck(policyCheckdata: any, res: any) {
    try {
      const currentDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
      const policyStartDate = moment
        .tz(policyCheckdata.policyStartDate, "Asia/Kolkata")
        .format("YYYY-MM-DD");
      const policyEndDate = moment
        .tz(policyCheckdata.policyEndDate, "Asia/Kolkata")
        .format("YYYY-MM-DD");

      // CHECK POLICY IS ACTIVE
      if (currentDate >= policyStartDate && currentDate <= policyEndDate) {
        // CHECK CUSTOMER SERVICE IS EXISTS
        const customerServiceExist = await getCustomerService({
          clientId: policyCheckdata.clientId,
          vin: policyCheckdata.vin ? policyCheckdata.vin.trim() : null,
          vehicleRegistrationNumber: policyCheckdata.registrationNumber
            ? policyCheckdata.registrationNumber.trim()
            : null,
          serviceId: policyCheckdata.serviceId,
          policyTypeId: policyCheckdata.policyTypeId,
          policyNumber: policyCheckdata.policyNumber
            ? String(policyCheckdata.policyNumber).trim()
            : null,
          membershipTypeId: policyCheckdata.serviceEligibilityId
            ? policyCheckdata.serviceEligibilityId
            : null,
        });
        if (!customerServiceExist) {
          return "Customer service not found";
        } else {
          return "success";

          //DISABLED SINCE WE ARE ALLOWING THE ACTIVE POLICY WITH PAID SERVICE
          // // CHECK CUSTOMER SERVICE HAS AVAILABLE SERVICE
          // if (customerServiceExist.dataValues.availableService > 0) {
          //   const customerServiceEntitlementDetails =
          //     await getCustomerServiceEntitlement({
          //       subServiceId: policyCheckdata.subServiceId,
          //       customerServiceId: customerServiceExist.dataValues.id,
          //     });
          //   // if (
          //   //   !customerServiceEntitlementDetails ||
          //   //   (customerServiceEntitlementDetails &&
          //   //     customerServiceEntitlementDetails.dataValues.availableService ==
          //   //       0)
          //   // ) {
          //   // CHECK CUSTOMER SERVICE ENTITLEMENT HAS AVAILABLE SERVICE
          //   if (
          //     customerServiceEntitlementDetails?.dataValues?.availableService ==
          //     0
          //   ) {
          //     return "Available free services have already been utilized for the selected sub service";
          //   } else {
          //     return "success";
          //   }
          // } else {
          //   return "All available free services have already been utilized.";
          // }
        }
      } else {
        return "The policy has expired. Kindly create the case with the policy type as Non Member.";
      }
    } catch (error: any) {
      throw error;
    }
  }

  export async function uploadAccidentalDocument(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;

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

        authUserRole = getAuthUserResponse.data.user.role
          ? getAuthUserResponse.data.user.role.name
          : "";
        authUserName = getAuthUserResponse.data.user.name;
      }

      const caseInformation: any = await CaseInformation.findOne({
        where: { caseDetailId: inData.entityId },
        attributes: [
          "id",
          "customerContactName",
          "caseTypeId",
          "hasAccidentalDocument",
          "withoutAccidentalDocument",
          "withoutAccidentalDocumentRemarks",
        ],
        include: {
          model: CaseDetails,
          attributes: ["id", "agentId"],
          required: true,
          where: {
            statusId: 2, //In Progress
          },
        },
      });
      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      const getAgentDetail: any = await Utils.getUserDetail(
        caseInformation.caseDetail.agentId
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      //CHECK IF NON ACCIDENTAL
      if (caseInformation.dataValues.caseTypeId != 413) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Document is not required for non accidental case",
        });
      }

      //TRACKER LINK DETAIL UPDATE
      if (inData.linkId) {
        const tokenExists: any = await links.findOne({
          where: {
            id: inData.linkId,
            token: inData.linkToken,
            status: 0,
          },
          attributes: ["id", "token"],
        });
        if (!tokenExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Invalid link token",
          });
        }

        tokenExists.status = 1;
        tokenExists.expiryDateTime = new Date();
        await tokenExists.save({ transaction });

        //UPDATE CASE INFORMATION
        caseInformation.accidentalDocLinkId = inData.linkId;
        await caseInformation.save({ transaction });
      }

      //REMOVE EXISTING ACCIDENTAL DOCUMENTS
      let existingAttachments = [];
      if (inData.attachmentIds && inData.attachmentIds.length > 0) {
        existingAttachments = await attachments.findAll({
          where: {
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.entityId,
            id: {
              [Op.notIn]: inData.attachmentIds,
            },
          },
          attributes: ["id"],
        });
      } else {
        existingAttachments = await attachments.findAll({
          where: {
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.entityId,
          },
          attributes: ["id"],
        });
      }

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
            originalName: file.originalname,
          });
        }
        await attachments.bulkCreate(batchInsertions, { transaction });

        //UPDATE CASE INFORMATION
        caseInformation.hasAccidentalDocument = 1;
        await caseInformation.save({ transaction });

        if (inData.linkId) {
          //DOCUMENT UPLOADING FROM URL
          await ActivityLogs.create(
            {
              caseDetailId: inData.entityId,
              typeId: 240, //Web
              title: `The customer "${caseInformation.customerContactName}" has uploaded the accidental documents.`,
            },
            {
              transaction: transaction,
            }
          );
        } else {
          await ActivityLogs.create(
            {
              caseDetailId: inData.entityId,
              typeId: 240, //Web
              // title: `The agent "${getAgentDetail.data.user.name}" has uploaded the accidental documents.`,
              title: `The ${authUserRole} "${authUserName}" has uploaded the accidental documents.`,
            },
            {
              transaction: transaction,
            }
          );
        }
      }

      // FCM PUSH NOTIFICATIONS
      const details = {
        caseDetailId: inData.entityId,
        templateId: 3,
        notificationType: "CRM",
        notifyToAll: [""],
      };
      notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc

      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: caseInformation,
        message: "Accidental documents uploaded successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateAccidentalDocumentRemarks(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      const caseInformation: any = await CaseInformation.findOne({
        where: { caseDetailId: inData.caseDetailId },
        attributes: [
          "id",
          "caseTypeId",
          "hasAccidentalDocument",
          "withoutAccidentalDocument",
          "withoutAccidentalDocumentRemarks",
        ],
        include: {
          model: CaseDetails,
          attributes: ["id"],
          required: true,
          where: {
            statusId: 2, //In Progress
          },
        },
      });
      if (!caseInformation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      //CHECK IF NON ACCIDENTAL
      if (caseInformation.dataValues.caseTypeId != 413) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Remarks not required for non accidental case",
        });
      }

      //UPDATE CASE INFORMATION
      caseInformation.withoutAccidentalDocument =
        inData.withoutAccidentalDocument;
      caseInformation.withoutAccidentalDocumentRemarks =
        inData.withoutAccidentalDocumentRemarks;
      await caseInformation.save({ transaction });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: caseInformation,
        message: "Accidental remarks updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function updateIssueIdentification(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      if (!inData.issueComments && inData.attachments.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Issue comments or attachments are required",
        });
      }

      const [activity, existingAttachments, activityAspDetail]: any =
        await Promise.all([
          Activities.findOne({
            where: {
              id: inData.entityId,
              activityStatusId: 3, //INPROGRESS
            },
            attributes: ["id", "issueComments"],
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
          //REMOVE EXISTING DOCUMENTS
          attachments.findAll({
            where: {
              attachmentTypeId: {
                [Op.in]: [83, 603],
              },
              attachmentOfId: 102,
              entityId: inData.entityId,
            },
            attributes: ["id"],
          }),
          ActivityAspDetails.findOne({
            where: { activityId: inData.entityId },
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
      }

      if (inData.attachments && inData.attachments.length > 0) {
        const batchInsertions = [];
        for (const file of inData.attachments) {
          batchInsertions.push({
            attachmentTypeId: file.attachmentTypeId,
            attachmentOfId: file.attachmentOfId,
            entityId: inData.entityId,
            fileName: file.fileName,
            originalName: file.originalName,
          });
        }
        await attachments.bulkCreate(batchInsertions, { transaction });
      }

      //UPDATE ACTIVITY
      activity.issueComments = inData.issueComments
        ? inData.issueComments
        : null;
      activity.activityAppStatusId = 24; //Issue Identification Completed
      activity.updatedById = inData.authUserId;
      await activity.save({ transaction });

      await ActivityLogs.create(
        {
          activityId: inData.entityId,
          typeId: 241, //Mobile
          title: `The service provider "${getAspDetail.data.data.workshopName}" has completed the issue identification process.`,
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Issue identification updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updatePolicyDetail(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      // const authUserPermissions = payload.authUserData.permissions;
      // if (
      //   !Utils.hasPermission(authUserPermissions, "add-policy-web") &&
      //   !Utils.hasPermission(authUserPermissions, "edit-policy-web")
      // ) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Permission not found",
      //   });
      // }

      let existAttachmentWhere: any = {
        attachmentTypeId: 81, //CASE POLICY DOCUMENTS
        attachmentOfId: 101, //CASE
        entityId: payload.caseDetailId,
      };
      if (payload.attachmentIds && payload.attachmentIds.length > 0) {
        existAttachmentWhere.id = {
          [Op.notIn]: payload.attachmentIds,
        };
      }

      const [caseDetail, existingAttachments]: any = await Promise.all([
        CaseDetails.findOne({
          attributes: [
            "id",
            "clientId",
            "caseNumber",
            "registrationNumber",
            "vin",
            "vehicleMakeId",
            "vehicleModelId",
            "typeId",
          ],
          where: {
            id: payload.caseDetailId,
            statusId: 2, //In Progress
          },
          include: [
            {
              model: CaseInformation,
              attributes: [
                "id",
                "customerContactName",
                "customerMobileNumber",
                "caseTypeId",
                "breakdownLat",
                "breakdownLong",
                "breakdownToDropLocationDistance",
                "salesPolicyId",
              ],
              required: true,
            },
            {
              model: Activities,
              attributes: ["id", "caseDetailId"],
              required: false,
              include: [
                {
                  model: ActivityAspDetails,
                  attributes: ["id", "subServiceId"],
                  required: false,
                },
              ],
            },
          ],
        }),
        //GET EXISTING ATTACHMENTS
        attachments.findAll({
          where: existAttachmentWhere,
          attributes: ["id"],
        }),
      ]);

      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      if (await Utils.positiveActivityExists(payload.caseDetailId)) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error:
            "Case activity is currently in progress, so it is not possible to update the policy.",
        });
      }

      // STORE POLICY INFORMATIONS IN CASE INFORMATIONS TABLE
      let policyNumber = payload.policyNumber
        ? String(payload.policyNumber).trim()
        : null;
      let policyStartDate = moment
        .tz(payload.policyStartDate, "YYYY-MM-DD", "Asia/Kolkata")
        .format("YYYY-MM-DD");
      let policyEndDate = moment
        .tz(payload.policyEndDate, "YYYY-MM-DD", "Asia/Kolkata")
        .format("YYYY-MM-DD");
      let serviceEligibilityId = payload.serviceEligibilityId || null;
      let serviceEligibility = payload.serviceEligibilityName || null;

      await CaseInformation.update(
        {
          policyNumber: policyNumber,
          policyTypeId: payload.policyTypeId,
          policyStartDate: policyStartDate,
          policyEndDate: policyEndDate,
          serviceEligibilityId: serviceEligibilityId,
          serviceEligibility: serviceEligibility,
          customerPolicyStateId: payload.customerStateId,
          updatedById: payload.authUserData.id,
        },
        {
          where: {
            id: caseDetail.caseInformation.id,
          },
          transaction,
        }
      );

      //DELETE EXISTING ATTACHMENTS
      if (existingAttachments.length > 0) {
        for (const attachment of existingAttachments) {
          const deleteAttachmentResponse = await axios.post(
            `${apiGatewayService}/${config.apiGatewayService.serviceAccess.case}/${endpointApiGateway.deleteAttachment}`,
            {
              attachmentId: attachment.dataValues.id,
            }
          );
          if (!deleteAttachmentResponse.data.success) {
            await transaction.rollback();
            return res.status(200).json(deleteAttachmentResponse.data);
          }

          await attachments.destroy({
            where: { id: attachment.dataValues.id },
            transaction: transaction,
          });
        }
      }

      //STORE NEW ATTACHMENTS
      if (payload.files && payload.files.length > 0) {
        const batchInsertions = [];
        for (const file of payload.files) {
          batchInsertions.push({
            attachmentTypeId: 81, //CASE POLICY DOCUMENTS
            attachmentOfId: 101, //CASE
            entityId: payload.caseDetailId,
            fileName: file.filename,
            originalName: file.originalname,
          });
        }
        await attachments.bulkCreate(batchInsertions, { transaction });
      }

      const [
        clientServiceEntitlementResponse,
        removeExistingCustomerService,
        getMasterDetail,
        policyFileNames,
      ] = await Promise.all([
        //GET CLIENT SERVICE ENTITLEMENTS
        axios.post(
          `${masterService}/${endpointMaster.clients.getClientServiceEntitlements}`,
          {
            clientId: caseDetail.clientId,
            policyTypeId: payload.policyTypeId,
            membershipTypeId: serviceEligibilityId,
          }
        ),
        //REMOVE EXISTING POLICY TYPE CUSTOMER SERVICES
        payload.existingPolicyTypeId &&
        CustomerService.destroy({
          where: {
            clientId: caseDetail.clientId,
            policyTypeId: payload.existingPolicyTypeId,
            vin: caseDetail.vin,
            vehicleRegistrationNumber: caseDetail.registrationNumber,
          },
          force: true,
          transaction,
        }),
        //GET MASTER DETAILS
        axios.post(`${masterService}/${endpointMaster.getMasterDetails}`, {
          clientId: caseDetail.clientId,
          vehicleMakeId: caseDetail.vehicleMakeId,
          vehicleModelId: caseDetail.vehicleModelId,
        }),
        //GET EXISTING POLICY FILE NAMES
        attachments
          .findAll({
            attributes: ["fileName"],
            where: {
              attachmentTypeId: 81, //CASE POLICY DOCUMENTS
              attachmentOfId: 101, //CASE
              entityId: payload.caseDetailId,
            },
            transaction,
          })
          .then((attachments) =>
            attachments.map((attachment: any) => attachment.fileName)
          ),
      ]);

      if (!clientServiceEntitlementResponse.data.success) {
        await transaction.rollback();
        return res.status(200).json(clientServiceEntitlementResponse.data);
      }

      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json(getMasterDetail.data);
      }

      //STORE CUSTOMER SERVICES
      const serviceEntitlementData = {
        clientId: caseDetail.clientId,
        vin: caseDetail.vin,
        vehicleRegistrationNumber: caseDetail.registrationNumber,
        policyTypeId: payload.policyTypeId,
        policyNumber: policyNumber,
        policyStartDate: policyStartDate,
        policyEndDate: policyEndDate,
        membershipTypeId: serviceEligibilityId,
        authUserId: payload.authUserData.id,
        customerName: caseDetail.caseInformation.customerContactName,
        customerContactNumber: caseDetail.caseInformation.customerMobileNumber,
      };
      await storeClientServiceAgainstCustomerService(
        clientServiceEntitlementResponse,
        serviceEntitlementData,
        transaction
      );

      //SEND POLICY DETAILS TO SALES PORTAL FOR POLICY CREATION
      let rsaStatusName = null;
      if (policyStartDate && policyEndDate) {
        const currentDate = new Date();
        const startDate = new Date(policyStartDate);
        const endDate = new Date(policyEndDate);
        if (currentDate >= startDate && currentDate <= endDate) {
          //Active policy
          rsaStatusName = "Active";
        } else if (currentDate > endDate) {
          //Expired policy
          rsaStatusName = "Expired";
        } else if (currentDate < startDate) {
          //Inactive policy
          rsaStatusName = "Inactive";
        }
      }

      let warrantyStartDate = null;
      let warrantyEndDate = null;
      let extendedWarrantyStartDate = null;
      let extendedWarrantyEndDate = null;
      let rsaStartDate = null;
      let rsaEndDate = null;
      //WARRANTY
      if (payload.policyTypeId == 431) {
        warrantyStartDate = policyStartDate;
        warrantyEndDate = policyEndDate;
      } else if (payload.policyTypeId == 432) {
        //EXTENDED WARRANTY
        extendedWarrantyStartDate = policyStartDate;
        extendedWarrantyEndDate = policyEndDate;
      } else if (payload.policyTypeId == 433) {
        //RSA RETAIL
        rsaStartDate = policyStartDate;
        rsaEndDate = policyEndDate;
      }

      const membershipRequest = {
        clientName: getMasterDetail.data.data.client.name,
        caseNumber: caseDetail.caseNumber,
        customerContactName: caseDetail.caseInformation.customerContactName,
        customerMobileNumber: caseDetail.caseInformation.customerMobileNumber,
        vehicleMakeName: getMasterDetail.data.data.vehicleMake?.name || null,
        vehicleModelName: getMasterDetail.data.data.vehicleModel?.name || null,
        registrationNumber: caseDetail.registrationNumber || null,
        vin: caseDetail.vin || null,
        policyFileNames: policyFileNames.join(", "),
        policyId: caseDetail.caseInformation.salesPolicyId,
        policyNumber: policyNumber,
        warrantyStartDate: warrantyStartDate,
        warrantyEndDate: warrantyEndDate,
        extendedWarrantyStartDate: extendedWarrantyStartDate,
        extendedWarrantyEndDate: extendedWarrantyEndDate,
        rsaStartDate: rsaStartDate,
        rsaEndDate: rsaEndDate,
        policyTypeName: payload.policyTypeName,
        serviceEligibilityId: serviceEligibilityId,
        customerStateName: payload.customerStateName,
        rsaStatusName: rsaStatusName,
      };

      const membershipResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/process/membership/detail`,
        membershipRequest
      );
      if (!membershipResponse.data.success) {
        await transaction.rollback();
        return res.status(200).json(membershipResponse.data);
      }
      const membershipId = membershipResponse.data.membershipId;

      await Promise.all([
        CaseInformation.update(
          {
            salesPolicyId: membershipId,
          },
          {
            where: {
              id: caseDetail.caseInformation.id,
            },
            transaction,
          }
        ),
        ActivityLogs.create(
          {
            caseDetailId: payload.caseDetailId,
            typeId: 240, //Web
            // title: `The agent "${payload.authUserData.name}" has updated policy details for the case "${caseDetail.caseNumber}".`,
            title: `The ${payload.authUserData.role.name} "${payload.authUserData.name}" has updated policy details for the case "${caseDetail.caseNumber}".`,
          },
          {
            transaction,
          }
        ),
      ]);

      await transaction.commit();

      //UPDATE ACTIVITY NOTES SINCE POLICY DETAILS ARE UPDATED
      if (caseDetail.activities.length > 0) {
        const subServices = getMasterDetail.data.data.allSubServices;
        caseDetail.caseInformation.dataValues.policyTypeId =
          payload.policyTypeId;
        caseDetail.caseInformation.dataValues.policyNumber = policyNumber;
        caseDetail.caseInformation.dataValues.policyStartDate = policyStartDate;
        caseDetail.caseInformation.dataValues.policyEndDate = policyEndDate;
        caseDetail.caseInformation.dataValues.serviceEligibilityId =
          serviceEligibilityId;

        await Promise.all(
          caseDetail.activities.map(async (activity: any) => {
            if (activity.activityAspDetail) {
              const subServiceId =
                activity.activityAspDetail.dataValues.subServiceId;
              const serviceId = subServices.find(
                (subService: any) => subService.id === subServiceId
              ).serviceId;

              // Additional service activity notes
              const notesResponse = await getNotes(
                caseDetail,
                caseDetail.caseInformation,
                serviceId,
                subServiceId,
                caseDetail.caseInformation.breakdownToDropLocationDistance
              );
              if (notesResponse && notesResponse.success) {
                activity.notes = JSON.stringify(notesResponse.notes);
                activity.customerNeedToPay =
                  notesResponse.notes.customerNeedToPay;
                activity.nonMembershipType =
                  notesResponse.notes.nonMembershipType;
                activity.additionalChargeableKm =
                  notesResponse.notes.additionalChargeableKm;
                await activity.save();
              }
            }
          })
        );
      }

      // Sync client report details, client report with mobile number details
      if (caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          ["clientReportDetails", "clientReportWithMobileNumberDetails", "caseReportDetails", "exceptionReportDetails"],
          [payload.caseDetailId]
        );
      }

      // CREATE REPORT SYNC TABLE RECORD FOR FINANCIAL REPORT AND ACTIVITY REPORT
      if (caseDetail.typeId == 31 && caseDetail.activities && caseDetail.activities.length > 0) {
        const activityIds = caseDetail.activities.map((activity: any) => activity.id);

        Utils.createReportSyncTableRecord(
          ["financialReportDetails", "activityReportDetails"],
          activityIds
        );
      }

      return res.status(200).json({
        success: true,
        message: "Policy details updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // Get Questionnaire Answers by Case ID
  export async function getQuestionnaireAnswersByCaseId(req: Request, res: Response) {
    try {
      const { caseId } = req.query;

      if (!caseId) {
        return res.status(200).json({
          success: false,
          error: "caseId is required",
        });
      }

      // Get case detail to get case subject ID
      const caseDetail: any = await CaseDetails.findOne({
        where: { id: caseId },
        attributes: ["id", "subjectID"],
      });

      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      // Get questionnaire answers for this case
      const questionnaireAnswersModels = await CaseQuestionnaireAnswer.findAll({
        where: {
          caseId: caseId,
          deletedAt: null,
        },
        attributes: ["id", "questionnaireId", "answer"],
        order: [["createdAt", "ASC"]],
      });

      // Convert Sequelize models to plain objects
      const questionnaireAnswersData = questionnaireAnswersModels.map((model: any) => ({
        id: model.get ? model.get('id') : model.id,
        questionnaireId: model.get ? model.get('questionnaireId') : model.questionnaireId,
        answer: model.get ? model.get('answer') : model.answer,
      }));

      // Get questionnaires from master service
      let questionnaires: any = [];
      if (caseDetail.subjectID) {
        try {
          const questionnairesResponse = await axios.get(
            `${masterService}/${endpointMaster.caseSubjects.caseSubjects}/getQuestionnairesByCaseSubjectId?caseSubjectId=${caseDetail.subjectID}`
          );
          if (questionnairesResponse.data.success) {
            questionnaires = questionnairesResponse.data.data || [];
            // Convert Sequelize models to plain objects if needed
            questionnaires = questionnaires.map((q: any) => {
              if (q.toJSON) {
                return q.toJSON();
              }
              return q;
            });
          }
        } catch (error: any) {
          console.error("Error fetching questionnaires from master service:", error);
        }
      }

      // Match answers with questionnaires
      const questionnairesWithAnswers = questionnaires.map((questionnaire: any) => {
        // Ensure questionnaire is a plain object
        const plainQuestionnaire = questionnaire.toJSON ? questionnaire.toJSON() : questionnaire;

        // Handle answerType - it might be a Sequelize model or plain object
        let answerType = null;
        if (plainQuestionnaire.answerType) {
          answerType = plainQuestionnaire.answerType.toJSON
            ? plainQuestionnaire.answerType.toJSON()
            : plainQuestionnaire.answerType;
        }

        // Find matching answer - convert IDs to numbers for comparison
        const questionnaireId = Number(plainQuestionnaire.id);
        const answer = questionnaireAnswersData.find(
          (qa: any) => Number(qa.questionnaireId) === questionnaireId
        );

        let parsedAnswer = null;
        if (answer && answer.answer) {
          try {
            // Try to parse JSON answer
            parsedAnswer = JSON.parse(answer.answer);
          } catch {
            // If not JSON, use as string
            parsedAnswer = answer.answer;
          }
        }

        return {
          id: plainQuestionnaire.id,
          question: plainQuestionnaire.question,
          answerTypeId: plainQuestionnaire.answerTypeId,
          sequence: plainQuestionnaire.sequence,
          answerType: answerType,
          answer: parsedAnswer,
          answerId: answer?.id || null,
        };
      });

      return res.status(200).json({
        success: true,
        message: "Questionnaire answers fetched successfully",
        data: questionnairesWithAnswers,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function policyDetailUpdateFormData(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const [caseDetail, policyAttachments]: any = await Promise.all([
        CaseDetails.findOne({
          attributes: ["id", "clientId"],
          where: {
            id: payload.caseDetailId,
          },
          include: {
            model: CaseInformation,
            required: true,
            attributes: [
              "id",
              "policyNumber",
              "policyStartDate",
              "policyEndDate",
              "policyTypeId",
              "serviceEligibilityId",
              "serviceEligibility",
              "customerPolicyStateId",
              "salesPolicyId",
            ],
          },
        }),
        attachments.findAll({
          where: {
            attachmentTypeId: 81, //CASE POLICY DOCUMENTS
            attachmentOfId: 101, //CASE
            entityId: payload.caseDetailId,
          },
          attributes: ["id", "fileName", "originalName"],
        }),
      ]);

      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      for (const policyAttachment of policyAttachments) {
        policyAttachment.dataValues.filePath = `${process.env.API_GATEWAY_URL}uploads/${policyAttachment.fileName}`;
      }

      const policyDetailMasterResponse = await axios.post(
        `${masterService}/${endpointMaster.policyDetailUpdateFormData}`,
        {
          clientId: caseDetail.clientId,
        }
      );
      if (!policyDetailMasterResponse.data.success) {
        return res.status(200).json(policyDetailMasterResponse.data);
      }

      const data = {
        ...caseDetail.caseInformation.dataValues,
        policyAttachments,
        extras: {
          ...policyDetailMasterResponse.data.data,
        },
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

//UPDATE CUSTOMER SERVICE AND SALES PORTAL POLICY DETAILS AFTER CASE CREATION
const updateCustomerServiceAndSalesPortalPolicyDetail = async (data: any) => {
  try {
    const salesPortalParams = {
      clientName: data.clientName,
      vin: data.vin,
      vehicleRegistrationNumber: data.registrationNumber,
    };
    axios.post(
      `${process.env.RSA_BASE_URL}/crm/processUpdatePolicyVehicle`,
      salesPortalParams
    );

    let baseQuery: any = {
      attributes: [
        "id",
        "customerName",
        "customerContactNumber",
        "vin",
        "vehicleRegistrationNumber",
        "policyStartDate",
        "policyEndDate",
      ],
    };

    //GET CUSTOMER SERVICE BY VIN, IF DATA FOUND UPDATE DETAILS
    if (data.vin) {
      baseQuery.where = {
        clientId: data.clientId,
        vin: data.vin,
        policyTypeId: data.policyTypeId,
        policyNumber: data.policyNumber ? data.policyNumber : null,
        membershipTypeId: data.serviceEligibilityId
          ? data.serviceEligibilityId
          : null,
      };
      fetchAndUpdateCustomerServices(baseQuery, data);
    }

    //GET CUSTOMER SERVICE BY REGISTRATION NUMBER, IF DATA FOUND UPDATE DETAILS
    if (data.registrationNumber) {
      baseQuery.where = {
        clientId: data.clientId,
        vehicleRegistrationNumber: data.registrationNumber,
        policyTypeId: data.policyTypeId,
        policyNumber: data.policyNumber ? data.policyNumber : null,
        membershipTypeId: data.serviceEligibilityId
          ? data.serviceEligibilityId
          : null,
      };
      fetchAndUpdateCustomerServices(baseQuery, data);
    }

    return {
      success: true,
      message: "Details saved successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

//UPDATE CUSTOMER SERVICES (USED IN CASE CREATEION FLOW)
const fetchAndUpdateCustomerServices = async (baseQuery: any, data: any) => {
  try {
    const customerServices: any = await CustomerService.findAll(baseQuery);
    if (customerServices.length > 0) {
      for (const customerService of customerServices) {
        const updates: any = {};
        if (!customerService.customerName) {
          updates.customerName = data.customerContactName;
        }
        if (!customerService.customerContactNumber) {
          updates.customerContactNumber = data.customerMobileNumber;
        }
        if (!customerService.vin && data.vin) {
          updates.vin = data.vin;
        }
        if (
          !customerService.vehicleRegistrationNumber &&
          data.registrationNumber
        ) {
          updates.vehicleRegistrationNumber = data.registrationNumber;
        }
        if (!customerService.policyStartDate && data.policyStartDate) {
          updates.policyStartDate = data.policyStartDate;
        }
        if (!customerService.policyEndDate && data.policyEndDate) {
          updates.policyEndDate = data.policyEndDate;
        }

        if (Object.keys(updates).length > 0) {
          await CustomerService.update(updates, {
            where: {
              id: customerService.id,
            },
          });
        }
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const createAutoAssignmentCases = async (
  caseDetailId: number,
  activityId: number,
  transaction: any
) => {
  try {
    await AutoAssignmentCase.create(
      {
        caseDetailId: caseDetailId,
        activityId: activityId,
      },
      {
        transaction: transaction,
      }
    );
    return {
      success: true,
    };
  } catch (error: any) {
    throw error;
  }
};

export default caseInfoController;
