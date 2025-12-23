import { Request, Response } from "express";
import { CaseDetails, CaseFeedback, CaseFeedbackAnswer, ActivityLogs, CaseInformation, Activities, ActivityAspDetails } from "../database/models/index";
import sequelize from "../database/connection";
import { Op } from "sequelize";
import axios from "axios";
import config from "../config/config.json";
import sendMailNotification from "../lib/emailNotification";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import { getDocument, updateDocument, documentExists } from "../elasticsearch/sync/common";

const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;
const endpointMaster = config.MasterService.endpoint;

export namespace customerFeedbackController {
  export async function saveFeedback(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;

      // Validate caseDetailId and get clientId
      const caseDetailExists: any = await CaseDetails.findOne({
        attributes: ["id", "clientId"],
        where: { id: inData.caseDetailId },
        transaction,
      });

      if (!caseDetailExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      const clientId = caseDetailExists.clientId;

      // Use clientName from request
      const isTataClient = clientId === parseInt(process.env.TATA_CLIENT_ID || "0");

      // Prevent duplicate feedback for "Answered" status (callStatusId = 1180)
      const existingFeedback = await CaseFeedback.findOne({
        where: {
          caseDetailId: inData.caseDetailId,
          callStatusId: 1180, // Answered
          deletedAt: null,
        },
        transaction,
      });

      if (existingFeedback) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Feedback has already been submitted for this case with Answered",
        });
      }

      // Create feedback record
      const feedbackData: any = {
        caseDetailId: inData.caseDetailId,
        languageId: inData.languageId,
        callStatusId: inData.callStatusId,
        customerFeedback: inData.customerFeedbackId || null,
        notConnectedReason: inData.notConnectedReasonId || null,
        comments: inData.comments || null,
        createdById: inData.createdById || null,
      };

      const createdFeedback = await CaseFeedback.create(feedbackData, {
        transaction,
      });

      // Fetch questions for rating calculation
      let allQuestions: any[] = [];
      if (inData.answers && inData.answers.length > 0) {
        const queryParams = new URLSearchParams({
          callStatusId: String(inData.callStatusId),
          clientId: String(clientId),
        });

        const questionsResponse = await axios.get(
          `${masterService}/customerFeedback/getQuestionsByCallStatus?${queryParams.toString()}`
        );

        if (questionsResponse?.data?.success && questionsResponse.data.data?.length > 0) {
          allQuestions = questionsResponse.data.data;
        }

        // Save answers using bulkCreate for better performance
        const answersToSave = inData.answers
          .filter((answer: any) =>
            answer.feedbackQuestionId &&
            answer.answerText
          )
          .map((answer: any) => ({
            caseFeedbackId: createdFeedback.dataValues.id,
            feedbackQuestionId: answer.feedbackQuestionId,
            answerText: String(answer.answerText),
            createdById: inData.createdById || null,
          }));

        if (answersToSave.length > 0) {
          await CaseFeedbackAnswer.bulkCreate(answersToSave, { transaction });
        }
      }

      // Calculate and store feedback rating
      let feedbackRating: number | null = null;
      const customerFeedbackValue = String(inData.customerFeedbackId || "").toLowerCase().trim();

      // If "Not Satisfied" -> set rating to 3 for all clients
      if (customerFeedbackValue === "not satisfied") {
        feedbackRating = 3;
      }
      // If "Satisfied" -> calculate based on client
      else if (customerFeedbackValue === "satisfied") {
        // If TATA client and Satisfied -> set rating to 5
        if (isTataClient) {
          feedbackRating = 5;
        }
        // For other clients, calculate average from rating questions
        else if (allQuestions.length > 0 && inData.answers && Array.isArray(inData.answers)) {
          // Filter only rating-type questions
          const ratingQuestions = allQuestions.filter((q: any) => q.answerType?.fieldType === "rating");

          if (ratingQuestions.length > 0) {
            const ratingValues: number[] = [];

            // Extract rating values from answers
            for (const ratingQuestion of ratingQuestions) {
              const answer = inData.answers.find((a: any) => a.feedbackQuestionId === ratingQuestion.id);
              if (answer?.answerText) {
                const ratingValue = parseInt(String(answer.answerText));
                if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
                  ratingValues.push(ratingValue);
                }
              }
            }

            // Calculate average if we have rating values
            if (ratingValues.length > 0) {
              const sum = ratingValues.reduce((acc, val) => acc + val, 0);
              const average = sum / ratingValues.length;
              // Round to nearest integer and clamp between 1 and 5
              feedbackRating = Math.max(1, Math.min(5, Math.round(average)));
            }
          }
        }
      }
      // For other feedback values (DNC, Call on alternative number, etc.) -> rating remains null

      // Update caseDetail with feedbackRating and psfStatus
      const updateData: any = { feedbackRating: feedbackRating };

      // Set psfStatus to 2 (Completed) if call status is "Answered" (1180)
      if (inData.callStatusId === 1180) {
        updateData.psfStatus = 2;
      }

      await CaseDetails.update(
        updateData,
        {
          where: { id: inData.caseDetailId },
          transaction,
        }
      );

      await transaction.commit();

      // Create activity log with PSF feedback details
      const descriptionParts: string[] = [];

      // 1. Language
      if (inData.languageId) {
        try {
          const languageResponse = await axios.get(
            `${masterService}/${endpointMaster.getLanguage}?languageId=${inData.languageId}`
          );
          if (languageResponse?.data?.success && languageResponse.data.data?.name) {
            descriptionParts.push(
              `Language: <span style="color:#999">${languageResponse.data.data.name}</span>`
            );
          }
        } catch (error: any) {
          // If language fetch fails, skip it
        }
      }

      // 2. Call Status
      if (inData.callStatusName) {
        descriptionParts.push(
          `Call Status: <span style="color:#999">${inData.callStatusName}</span>`
        );
      }

      // 3. Customer Feedback (only if Call status is Answered - 1180)
      if (inData.callStatusId === 1180 && inData.customerFeedbackId) {
        descriptionParts.push(
          `Customer Feedback: <span style="color:#999">${inData.customerFeedbackId}</span>`
        );
      }

      // 4. Reasons for not connecting (only if call status is Not Answered)
      if (inData.callStatusId !== 1180 && inData.notConnectedReasonId) {
        descriptionParts.push(
          `Reasons for not connecting: <span style="color:#999">${inData.notConnectedReasonId}</span>`
        );
      }

      // 5. Comments
      if (inData.comments) {
        descriptionParts.push(
          `Comments: <span style="color:#999">${inData.comments}</span>`
        );
      }

      // 6. Collected By (User who submitted the feedback)
      // Use authUserData from API gateway instead of making another API call
      const authUserData = inData.authUserData;
      if (authUserData?.name) {
        descriptionParts.push(
          `Collected By: <span style="color:#999">${authUserData.name}</span>`
        );
      }

      await ActivityLogs.create({
        caseDetailId: inData.caseDetailId,
        typeId: 240, // WEB
        title: "PSF Collected",
        description: descriptionParts.join('<br />'),
        createdById: inData.createdById,
      });

      // Trigger email notification asynchronously (only for Answered + Not Satisfied)
      if (inData.callStatusId === 1180 && inData.customerFeedbackId &&
        String(inData.customerFeedbackId).toLowerCase().trim() === "not satisfied") {
        sendFeedbackEmailNotification(inData, createdFeedback.dataValues.id);
      }

      // Update customer index in Elasticsearch (asynchronously, after transaction commit)
      if (inData.callStatusId === 1180 &&
        (customerFeedbackValue === "satisfied" || customerFeedbackValue === "not satisfied") &&
        feedbackRating) {
        updateCustomerIndexInElasticsearch(inData.caseDetailId, feedbackRating, customerFeedbackValue);
      }

      // Trigger sync for customer feedback report
      Utils.createReportSyncTableRecord("customerFeedbackReportDetails", [
        createdFeedback.dataValues.id,
      ]);

      return res.status(200).json({
        success: true,
        message: "Feedback saved successfully",
        data: {
          id: createdFeedback.dataValues.id,
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

  export async function getFeedbackByCaseId(req: Request, res: Response) {
    try {
      const { caseDetailId } = req.query;

      if (!caseDetailId) {
        return res.status(200).json({
          success: false,
          error: "caseDetailId is required",
        });
      }

      const feedbackDetail = await CaseFeedback.findOne({
        where: {
          caseDetailId: caseDetailId,
          callStatusId: 1180, // Answered
          deletedAt: null,
        },
        include: [
          {
            model: CaseFeedbackAnswer,
            as: "answers",
            where: {
              deletedAt: null,
            },
            required: false,
            attributes: [
              "id",
              "feedbackQuestionId",
              "answerText",
            ],
          },
        ],
        attributes: [
          "id",
          "caseDetailId",
          "languageId",
          "callStatusId",
          "customerFeedback",
          "notConnectedReason",
          "comments",
          "createdAt",
        ],
      });

      return res.status(200).json({
        success: true,
        message: "Feedback fetched successfully",
        data: feedbackDetail,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

// Helper function to format feedback answer for email display
// Only supports: rating, option, option_conditional
function formatAnswerForEmail(answerText: string, fieldType: string, answerType: any): string {
  try {
    if (fieldType === "rating") {
      const ratingOptions = answerType?.options;
      const maxRating = ratingOptions?.length > 0 ? parseInt(ratingOptions[ratingOptions.length - 1]) : 5;
      return `${answerText}/${maxRating}`;
    } else if (fieldType === "option_conditional") {
      const answerObj = typeof answerText === 'string' ? JSON.parse(answerText) : answerText;
      return `${answerObj.option || ""}${answerObj.text ? ` - ${answerObj.text}` : ""}`;
    } else if (fieldType === "option") {
      return String(answerText);
    } else {
      return String(answerText);
    }
  } catch (e) {
    return String(answerText);
  }
}

// Async function to send feedback email notification
async function sendFeedbackEmailNotification(inData: any, feedbackId: number) {
  try {
    // Fetch case details with case information
    const caseDetail: any = await CaseDetails.findOne({
      where: { id: inData.caseDetailId },
      attributes: ["id", "caseNumber", "registrationNumber", "callCenterId", "rmId", "clientId", "createdAt"],
      include: [
        {
          model: CaseInformation,
          as: "caseInformation",
          attributes: [
            "customerContactName",
            "customerMobileNumber",
            "voiceOfCustomer",
            "breakdownAreaId",
          ],
        },
      ],
    });

    if (!caseDetail) {
      return {
        success: false,
        error: "Case detail not found",
      }
    }

    // Fetch call center details from master service and use callStatusName from request
    let spocEmails: string[] = [];
    let stateName: string = "";
    let cityName: string = "";
    const masterDetailsResponse = await axios.post(
      `${masterService}/${endpointMaster.getMasterDetails}`,
      {
        getCallCenterWithoutValidation: caseDetail.callCenterId,
        getCityWithoutValidation: caseDetail.caseInformation.breakdownAreaId,
      }
    );
    if (masterDetailsResponse?.data?.success) {
      if (masterDetailsResponse?.data?.data?.callCenterWithoutValidation?.spocEmailIds) {
        let spocEmailIds = masterDetailsResponse.data.data.callCenterWithoutValidation.spocEmailIds;
        if (spocEmailIds && spocEmailIds.trim() !== "") {
          spocEmails = spocEmailIds
            .split(",")
            .map((email: string) => email.trim())
            .filter((email: string) => email.length > 0);
        }
      }

      if (masterDetailsResponse?.data?.data?.cityWithoutValidation) {
        cityName = masterDetailsResponse.data.data.cityWithoutValidation.name;
        stateName = masterDetailsResponse.data.data.cityWithoutValidation.state ? masterDetailsResponse.data.data.cityWithoutValidation.state.name : "";
      }
    }

    // Fetch RM email and name using user service common controller
    let rmEmail: any = null;
    let rmName: string = "";
    let zmEmail: any = "";
    if (caseDetail.rmId) {
      const rmResponse = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.commonGetMasterDetails}`,
        {
          rmId: caseDetail.rmId,
        }
      );

      if (rmResponse?.data?.success) {
        if (rmResponse?.data?.data?.rm) {
          rmEmail = rmResponse.data.data.rm.email ? rmResponse.data.data.rm.email : "";
          rmName = rmResponse.data.data.rm.name ? rmResponse.data.data.rm.name : "";
        }
        if (rmResponse?.data?.data?.rm?.serviceZm) {
          zmEmail = rmResponse.data.data.rm.serviceZm.email ? rmResponse.data.data.rm.serviceZm.email : "";
        }
      }
    }

    const caseInfo = caseDetail.caseInformation || caseDetail.dataValues?.caseInformation;

    // Query last positive mechanic service activity (serviceId = 2)
    const lastMechanicActivity: any = await Activities.findOne({
      where: {
        caseDetailId: inData.caseDetailId,
        activityStatusId: {
          [Op.notIn]: [1, 4, 8], // Exclude Open, Cancelled, Rejected
        },
        deletedAt: null,
      },
      include: [
        {
          model: ActivityAspDetails,
          as: "activityAspDetail",
          where: {
            serviceId: 2, // Mechanic service
            deletedAt: null,
          },
          required: true,
          attributes: ["aspId"],
        },
      ],
      attributes: ["id"],
      order: [["createdAt", "DESC"]],
    });

    // Query last positive towing service activity (serviceId = 1)
    const lastTowingActivity: any = await Activities.findOne({
      where: {
        caseDetailId: inData.caseDetailId,
        activityStatusId: {
          [Op.notIn]: [1, 4, 8], // Exclude Open, Cancelled, Rejected
        },
        deletedAt: null,
      },
      include: [
        {
          model: ActivityAspDetails,
          as: "activityAspDetail",
          where: {
            serviceId: 1, // Towing service
            deletedAt: null,
          },
          required: true,
          attributes: ["aspId"],
        },
      ],
      attributes: ["id"],
      order: [["createdAt", "DESC"]],
    });

    // Fetch ASP names for mechanic and towing
    const aspIds: number[] = [];
    if (lastMechanicActivity?.activityAspDetail?.aspId) {
      aspIds.push(lastMechanicActivity.activityAspDetail.aspId);
    }
    if (lastTowingActivity?.activityAspDetail?.aspId) {
      aspIds.push(lastTowingActivity.activityAspDetail.aspId);
    }

    // Fetch last positive mechanic and towing service activities
    let mechAspName: string = "";
    let towAspName: string = "";
    if (aspIds.length > 0) {
      const aspResponse = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          getAspsWithoutValidation: aspIds,
        }
      );

      if (aspResponse?.data?.success && aspResponse?.data?.data?.aspsWithoutValidation) {
        const asps = aspResponse.data.data.aspsWithoutValidation;

        // Get mechanic ASP name
        if (lastMechanicActivity?.activityAspDetail?.aspId) {
          const mechAsp = asps.find(
            (a: any) => a.id === lastMechanicActivity.activityAspDetail.aspId
          );
          if (mechAsp?.name) {
            mechAspName = mechAsp.name;
          }
        }

        // Get towing ASP name
        if (lastTowingActivity?.activityAspDetail?.aspId) {
          const towAsp = asps.find(
            (a: any) => a.id === lastTowingActivity.activityAspDetail.aspId
          );
          if (towAsp?.name) {
            towAspName = towAsp.name;
          }
        }
      }
    }

    // Fetch all questions and answers for email
    let questions: any[] = [];
    let issuesWith: string = "";
    let reasonForNotSatisfied: string = "";
    const queryParams = new URLSearchParams({
      callStatusId: String(inData.callStatusId),
      clientId: String(caseDetail.clientId),
    });

    const questionsResponse = await axios.get(
      `${masterService}/customerFeedback/getQuestionsByCallStatus?${queryParams.toString()}`
    );
    if (questionsResponse.data?.success && questionsResponse.data.data?.length > 0) {
      const allQuestions = questionsResponse.data.data;

      // Fetch saved answers
      const savedAnswers = await CaseFeedbackAnswer.findAll({
        where: { caseFeedbackId: feedbackId, deletedAt: null },
        attributes: ["feedbackQuestionId", "answerText"],
      });

      // Create a map of answers by question ID
      const answersMap = new Map();
      savedAnswers.forEach((answer: any) => {
        answersMap.set(answer.feedbackQuestionId, answer.answerText);
      });

      // Fetch "Issues With" answer to determine email recipients
      // Find the "Issues With" question (reportColumn: "issuesWith")
      const issuesWithQuestion = allQuestions.find((q: any) => q.reportColumn === "issuesWith");
      if (issuesWithQuestion) {
        const issuesWithAnswer = answersMap.get(issuesWithQuestion.id);
        if (issuesWithAnswer) {
          issuesWith = String(issuesWithAnswer).trim();
        }
      }

      // Find the "Reason for Not Satisfied" question (reportColumn: "reasonForNotSatisfied")
      const reasonForNotSatisfiedQuestion = allQuestions.find((q: any) => q.reportColumn === "reasonForNotSatisfied");
      if (reasonForNotSatisfiedQuestion) {
        const reasonAnswer = answersMap.get(reasonForNotSatisfiedQuestion.id);
        if (reasonAnswer) {
          reasonForNotSatisfied = String(reasonAnswer).trim();
        }
      }

      // Format questions and answers
      questions = allQuestions
        .filter((q: any) => {
          // Include parent questions if they have values
          if (q.questionType === "customer_feedback" && inData.customerFeedbackId) {
            return true;
          }
          if (q.questionType === "not_connected_reason" && inData.notConnectedReasonId) {
            return true;
          }
          // Include child questions that have answers
          return answersMap.has(q.id);
        })
        .map((q: any) => {
          let answerText = "";

          if (q.questionType === "customer_feedback" && inData.customerFeedbackId) {
            answerText = String(inData.customerFeedbackId || "");
          } else if (q.questionType === "not_connected_reason" && inData.notConnectedReasonId) {
            answerText = String(inData.notConnectedReasonId || "");
          } else {
            const answer = answersMap.get(q.id);
            if (answer) {
              answerText = formatAnswerForEmail(answer, q.answerType?.fieldType || "", q.answerType);
            }
          }

          return {
            question: String(q.question || ""),
            answer: String(answerText || ""),
          };
        })
        .filter((q: any) => q.answer !== "" && q.question !== ""); // Only include questions with answers
    }

    // Ensure questions is always an array
    if (!Array.isArray(questions)) {
      questions = [];
    }

    const toEmails: string[] = [];
    if (issuesWith) {
      const issuesWithLower = issuesWith.toLowerCase();

      if (issuesWithLower == "call centre") {
        // Send to call center spoc only
        toEmails.push(...spocEmails);

      } else if (issuesWithLower == "field team") {
        // Send to RM email and ZM email
        if (rmEmail) {
          toEmails.push(rmEmail);
        }
        if (zmEmail) {
          toEmails.push(zmEmail);
        }
      } else if (issuesWithLower == "call centre & field work team") {
        // Send to call center spoc, RM email, and ZM email
        toEmails.push(...spocEmails);
        if (rmEmail) {
          toEmails.push(rmEmail);
        }
        if (zmEmail) {
          toEmails.push(zmEmail);
        }
      } else {
        // Default: send to both RM, ZM, and call center spoc (original behavior)
        toEmails.push(...spocEmails);
        if (rmEmail) {
          toEmails.push(rmEmail);
        }
        if (zmEmail) {
          toEmails.push(zmEmail);
        }
      }
    } else {
      // If no "Issues With" value, use original behavior
      // toEmails.push(...spocEmails);
      // if (rmEmail) {
      //   toEmails.push(rmEmail);
      // }
    }

    const uniqueEmails = [...new Set(toEmails)];
    if (uniqueEmails.length === 0) {
      return {
        success: false,
        error: "No email recipients found for feedback notification",
      }
    }

    // Prepare email data - ensure all values are properly formatted for Handlebars
    const emailData = {
      smtpEndPoint: process.env.SMTP_END_POINT,
      smtpPort: process.env.SMTP_PORT,
      smtpSenderAddress: process.env.SENDER_ADDRESS,
      smtpUsername: process.env.SMTP_USERNAME,
      smtpPassword: process.env.SMTP_PASSWORD,
      templateFileName: "customer-feedback-notification-template.html",
      toEmail: uniqueEmails,
      subject: `PSF Collected - Case #${caseDetail.caseNumber}`,
      portalLogoUrl: `${process.env.API_GATEWAY_URL}images/portalLogo.png`,
      caseNumber: caseDetail.caseNumber || "--",
      registrationNumber: caseDetail.registrationNumber || "--",
      callStatus: inData.callStatusName || "--",
      customerFeedback: inData.customerFeedbackId || "--",
      notConnectedReason: inData.notConnectedReasonId || "--",
      comments: inData.comments || "--",
      questions: Array.isArray(questions) ? questions : [],
      clientName: inData.clientName || "--",
      caseCreatedDate: caseDetail.createdAt
        ? moment.tz(caseDetail.createdAt, "Asia/Kolkata").format("DD/MM/YYYY")
        : "",
      rmName: rmName || "--",
      customerName: caseInfo?.customerContactName || "--",
      mobile: caseInfo?.customerMobileNumber || "--",
      vehicleNumber: caseDetail.registrationNumber || "--",
      state: stateName || "--",
      city: cityName || "--",
      mechAspName: mechAspName || "--",
      towAspName: towAspName || "--",
      customerVoice: caseInfo?.voiceOfCustomer || "--",
      subDisposition: reasonForNotSatisfied || "--",
      date: moment.tz(new Date(), "Asia/Kolkata").format("DD/MM/YYYY"),
    };

    //Send email
    const emailResult = await sendMailNotification(emailData);
    if (!emailResult.success) {
      return {
        success: true,
        error: emailResult.error,
      }
    }

    return {
      success: true,
      message: "Feedback email notification sent successfully",
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    }
  }
}


// Helper function to get previous cases by mobile number
async function getPreviousCasesByMobile(mobileNumber: string, excludeCaseId: number) {
  try {
    // Get all case details that match the mobile number, excluding cancelled cases
    const previousCases = await CaseDetails.findAll({
      attributes: ["id", "feedbackRating"],
      where: {
        id: { [Op.ne]: excludeCaseId },
        statusId: { [Op.notIn]: [3] }, // Exclude Cancelled
      },
      include: [
        {
          model: CaseInformation,
          as: "caseInformation",
          where: {
            customerMobileNumber: mobileNumber,
          },
          attributes: ["customerMobileNumber"],
          required: true,
        },
        {
          model: CaseFeedback,
          as: "feedbacks",
          where: {
            callStatusId: 1180, // Only Answered feedbacks
          },
          attributes: ["customerFeedback"],
          required: false,
          order: [["createdAt", "DESC"]],
          limit: 1,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return previousCases.map((caseDetail: any) => ({
      id: caseDetail.id,
      feedbackRating: caseDetail.feedbackRating,
      customerFeedback: caseDetail.feedbacks && caseDetail.feedbacks.length > 0
        ? caseDetail.feedbacks[0].customerFeedback
        : null,
    }));
  } catch (error: any) {
    return [];
  }
}

// Helper function to calculate customer experience status
function calculateExperienceStatus(previousCases: any[], currentStatus: string): string {
  // Check if any previous case has "Not Satisfied"
  const hasNotSatisfied = previousCases.some((caseItem: any) => {
    const feedback = String(caseItem.customerFeedback || "").toLowerCase().trim();
    return feedback === "not satisfied";
  });

  if (hasNotSatisfied) {
    return "Not Satisfied";
  }

  // Return current status
  return currentStatus === "not satisfied" ? "Not Satisfied" : "Satisfied";
}

// Helper function to get and increment case count
async function getAndIncrementCaseCount(mobileNumber: string): Promise<number> {
  try {
    const customerDoc: any = await getDocument("customer", {
      match: { mobileNumber: mobileNumber },
    });

    if (customerDoc && customerDoc._source) {
      const currentCount = customerDoc._source.totalCaseCount || 0;
      return currentCount + 1;
    }

    return 1; // First case
  } catch (error: any) {
    return 1; // Default to 1 if error
  }
}

// Helper function to calculate overall rating
function calculateOverallRating(
  previousCases: any[],
  currentRating: number,
  currentCustomerFeedback: string
): number | null {
  // Combine all cases (previous + current)
  const allCases: any[] = [...previousCases];

  // Add current case if it has feedback
  if (currentRating || currentCustomerFeedback) {
    allCases.push({
      feedbackRating: currentRating,
      customerFeedback: currentCustomerFeedback,
    });
  }

  // Check if any case has "Not Satisfied" feedback
  const hasNotSatisfied = allCases.some((caseItem: any) => {
    const feedback = String(caseItem.customerFeedback || "").toLowerCase().trim();
    return feedback === "not satisfied";
  });

  if (hasNotSatisfied) {
    return 3;
  }

  // Filter only "Satisfied" cases
  const satisfiedCases = allCases.filter((caseItem: any) => {
    const feedback = String(caseItem.customerFeedback || "").toLowerCase().trim();
    return feedback === "satisfied" && caseItem.feedbackRating;
  });

  if (satisfiedCases.length > 0) {
    // Get the lowest rating from satisfied cases
    const ratings = satisfiedCases.map((caseItem: any) => caseItem.feedbackRating);
    return Math.min(...ratings);
  }

  // No satisfied cases with ratings
  return null;
}

// Helper function to update customer index in Elasticsearch
async function updateCustomerIndexInElasticsearch(
  caseDetailId: number,
  feedbackRating: number,
  customerFeedbackValue: string
) {
  try {
    // Get customer mobile number from case information
    const caseInfo: any = await CaseInformation.findOne({
      attributes: ["customerMobileNumber"],
      where: { caseDetailId: caseDetailId },
      include: [
        {
          model: CaseDetails,
          attributes: ["id"],
          where: {
            statusId: { [Op.notIn]: [3] }, // Exclude Cancelled
          },
          required: true,
        },
      ],
    });

    if (!caseInfo?.customerMobileNumber) {
      return {
        success: false,
        error: "Customer mobile number not found for case",
      }
    }

    const mobileNumber = caseInfo.customerMobileNumber;

    // Query all previous cases by mobile number
    const previousCases = await getPreviousCasesByMobile(mobileNumber, caseDetailId);

    // Calculate values
    const previousCaseRating = feedbackRating;
    const customerExperienceForPreviousCases = calculateExperienceStatus(
      previousCases,
      customerFeedbackValue
    );
    const overAllRating = calculateOverallRating(
      previousCases,
      feedbackRating,
      customerFeedbackValue
    );

    const totalCaseCount = await getAndIncrementCaseCount(mobileNumber);

    // Get or check if customer document exists in Elasticsearch
    const customerDoc: any = await getDocument("customer", {
      match: { mobileNumber: mobileNumber },
    });

    if (customerDoc && customerDoc._id) {
      // Update existing customer document
      await updateDocument("customer", customerDoc._id, {
        previousCaseRating,
        customerExperienceForPreviousCases,
        totalCaseCount,
        overAllRating,
      });
    }

    return {
      success: true,
      message: "Customer index updated successfully",
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    }
  }
}

export default customerFeedbackController;

