import { Request, Response } from "express";
const config = require("../config/config.json");
import axios from "axios";
import { Op, Sequelize } from "sequelize";
import {
  Activities,
  ActivityAspDetails,
  ActivityLogs,
  ActivityTransactions,
  CaseDetails,
  CaseInformation,
} from "../database/models";
import sequelize from "../database/connection";
import attachments from "../database/models/attachments";
import Utils from "../lib/utils";
import dotenv from "dotenv";
import FormData from "form-data";

dotenv.config();
const defaultLimit = 10;
const defaultOffset = 0;

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

const apiGatewayService = `${config.apiGatewayService.host}:${config.apiGatewayService.port}/${config.apiGatewayService.version}`;
const endpointApiGateway = config.apiGatewayService.endpoint;

export namespace reimbursementController {
  export async function mapping(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;
      // const authUserPermissions = inData.authUserData.permissions;

      // if (
      //   !Utils.hasPermission(
      //     authUserPermissions,
      //     "activity-map-reimbursement-web"
      //   )
      // ) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Permission not found",
      //   });
      // }

      const [activity, reimbursementActivityTransaction]: any =
        await Promise.all([
          Activities.findOne({
            attributes: ["id"],
            where: {
              id: inData.activityId,
              activityStatusId: 1, //OPEN
            },
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
                  statusId: 2, //INPROGRESS
                },
              },
            ],
          }),
          ActivityTransactions.findOne({
            attributes: ["id", "amount"],
            where: {
              activityId: inData.activityId,
              paymentTypeId: 175, // Reimbursement
            },
          }),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
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

      const activityUpdate: any = {};
      activityUpdate.isReimbursement = inData.isReimbursement;
      activityUpdate.updatedById = inData.authUserData.id;
      const promiseArray = [];
      //YES
      if (inData.isReimbursement == 1) {
        activityUpdate.reimbursementComments = inData.comments;
        if (!reimbursementActivityTransaction) {
          promiseArray.push(
            ActivityTransactions.create(
              {
                activityId: inData.activityId,
                date: new Date(),
                paymentTypeId: 175, //REIMBURSEMENT
                transactionTypeId: 180, //CREDIT
                paymentStatusId: 190, //PENDING,
                createdById: inData.authUserData.id,
              },
              {
                transaction: transaction,
              }
            )
          );
        }
      } else {
        activityUpdate.reimbursementComments = null;
        promiseArray.push(
          ActivityTransactions.destroy({
            where: {
              activityId: inData.activityId,
              paymentTypeId: 175, //REIMBURSEMENT
            },
            force: true,
            transaction: transaction,
          })
        );
      }

      promiseArray.push(
        Activities.update(activityUpdate, {
          where: { id: inData.activityId },
          transaction: transaction,
        })
      );

      promiseArray.push(
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 240, //WEB
            // title: `The agent "${
            //   inData.authUserData.name
            // }" has mapped the sub service "${
            //   getMasterDetail.data.data.subService.name
            // }" as reimbursement "${
            //   inData.isReimbursement == 1 ? "Yes" : "No"
            // }".`,

            title: `The ${inData.authUserData.role.name} "${inData.authUserData.name
              }" has mapped the sub service "${getMasterDetail.data.data.subService.name
              }" as reimbursement "${inData.isReimbursement == 1 ? "Yes" : "No"
              }".`,
            createdById: inData.authUserData.id,
          },
          {
            transaction: transaction,
          }
        )
      );

      await Promise.all(promiseArray);
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Reimbursement mapped successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function activityStatusUpdate(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;
      const activity: any = await Activities.findOne({
        attributes: ["id", "isServiceEntitlementUpdated"],
        where: {
          id: inData.activityId,
          activityStatusId: 1, //OPEN
          isReimbursement: 1, //YES
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: ["id", "clientId", "vin", "registrationNumber"],
            where: {
              statusId: 2, //INPROGRESS
            },
            include: [
              {
                model: CaseInformation,
                required: true,
                attributes: [
                  "id",
                  "policyTypeId",
                  "policyNumber",
                  "serviceEligibilityId",
                ],
              },
            ],
          },
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

      await Promise.all([
        Activities.update(
          {
            activityStatusId: inData.activityStatusId,
            updatedById: inData.authUserData.id,
          },
          {
            where: { id: inData.activityId },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 240, //WEB
            title: `The agent "${inData.authUserData.name}" has updated the activity status as "${inData.activityStatusName}" for the sub service "${getMasterDetail.data.data.subService.name}".`,
            createdById: inData.authUserData.id,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      //IF ACTIVITY STATUS SUCCESS THEN REDUCE CUSTOMER SERVICE ENTITLEMENT
      if (
        inData.activityStatusId == 7 &&
        !activity.isServiceEntitlementUpdated
      ) {
        const reduceCustomerServiceEntitlementRequest = {
          activityId: activity.id,
          clientId: activity.caseDetail.clientId,
          vin: activity.caseDetail.vin,
          registrationNumber: activity.caseDetail.registrationNumber,
          serviceId: getMasterDetail.data.data.subService.service.id,
          subServiceId: activity.activityAspDetail
            ? activity.activityAspDetail.subServiceId
            : null,
          policyTypeId: activity.caseDetail.caseInformation.policyTypeId,
          policyNumber: activity.caseDetail.caseInformation.policyNumber,
          serviceEligibilityId:
            activity.caseDetail.caseInformation.serviceEligibilityId,
        };

        const reduceCustomerServiceEntitlementResponse: any =
          await Utils.reduceCustomerServiceEntitlement(
            reduceCustomerServiceEntitlementRequest,
            transaction
          );
        if (!reduceCustomerServiceEntitlementResponse.success) {
          await transaction.rollback();
          return res.status(200).json(reduceCustomerServiceEntitlementResponse);
        }
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Reimbursement activity status successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //NOT IN USE
  // export async function change(req: Request, res: Response) {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     const inData = req.body;
  //     const activity: any = await Activities.findOne({
  //       attributes: ["id"],
  //       where: {
  //         id: inData.activityId,
  //       },
  //       include: {
  //         model: ActivityAspDetails,
  //         required: true,
  //         attributes: ["id", "subServiceId"],
  //       },
  //     });
  //     if (!activity) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "Activity not found",
  //       });
  //     }

  //     //GET MASTER DETAILS
  //     const getMasterDetail = await axios.post(
  //       `${masterService}/${endpointMaster.getMasterDetails}`,
  //       {
  //         subServiceId: activity.activityAspDetail.subServiceId,
  //       }
  //     );
  //     if (!getMasterDetail.data.success) {
  //       await transaction.rollback();
  //       return res.status(200).json(getMasterDetail.data);
  //     }

  //     const activityUpdate: any = {};
  //     const promiseArray = [];
  //     activityUpdate.isReimbursement = inData.isReimbursement;
  //     activityUpdate.updatedById = inData.authUserData.id;
  //     if (inData.isReimbursement == 0) {
  //       //NO
  //       activityUpdate.reimbursementComments = null;
  //       promiseArray.push(
  //         ActivityTransactions.destroy({
  //           where: {
  //             activityId: inData.activityId,
  //             paymentTypeId: 175,
  //           },
  //           force: true,
  //           transaction: transaction,
  //         })
  //       );
  //     }

  //     promiseArray.push(
  //       Activities.update(activityUpdate, {
  //         where: { id: inData.activityId },
  //         transaction: transaction,
  //       })
  //     );

  //     promiseArray.push(
  //       ActivityLogs.create(
  //         {
  //           activityId: inData.activityId,
  //           typeId: 240, //WEB
  //           title: `The agent "${
  //             inData.authUserData.name
  //           }" has updated the reimbursement as "${
  //             inData.isReimbursement == 1 ? "Yes" : "No"
  //           }" for sub service "${getMasterDetail.data.data.subService.name}".`,
  //           createdById: inData.authUserData.id,
  //         },
  //         {
  //           transaction: transaction,
  //         }
  //       )
  //     );

  //     await Promise.all(promiseArray);
  //     await transaction.commit();
  //     return res.status(200).json({
  //       success: true,
  //       message: "Reimbursement updated successfully",
  //     });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({
  //       success: false,
  //       error: error?.message,
  //     });
  //   }
  // }

  export async function updateDetails(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;
      // const authUserPermissions = inData.authUserData.permissions;
      // if (
      //   !Utils.hasPermission(
      //     authUserPermissions,
      //     "activity-reimbursement-update-detail-web"
      //   )
      // ) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Permission not found",
      //   });
      // }

      const [activity, reimbursementActivityTransaction]: any =
        await Promise.all([
          Activities.findOne({
            attributes: ["id"],
            where: {
              id: inData.activityId,
              activityStatusId: 7, //SUCCESSFUL
              isReimbursement: 1, //YES
            },
            include: [
              {
                model: ActivityAspDetails,
                required: true,
                attributes: ["id", "subServiceId"],
              },
              {
                model: CaseDetails,
                required: true,
                attributes: ["id", "caseNumber"],
                where: {
                  statusId: 2, //IN PROGRESS
                },
                include: [
                  {
                    model: CaseInformation,
                    required: false,
                    attributes: ["id", "customerMobileNumber", "customerCurrentMobileNumber"],
                  },
                ],
              },
            ],
          }),
          ActivityTransactions.findOne({
            attributes: ["id", "amount"],
            where: {
              activityId: inData.activityId,
              paymentTypeId: 175, // Reimbursement
            },
          }),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
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

      let accountHolderName = inData.accountHolderName
        ? inData.accountHolderName
        : null;
      let accountNumber = inData.accountNumber ? inData.accountNumber : null;
      let ifscCode = inData.ifscCode ? inData.ifscCode : null;
      let upiLinkedMobileNumber = inData.upiLinkedMobileNumber ? inData.upiLinkedMobileNumber : null;
      let existingAttachments: any = [];

      //BANK
      if (inData.paymentMethodId == 3) {
        upiLinkedMobileNumber = null;

        //GET EXISTING BANK DETAIL ATTACHMENTS
        const whereClause: any = {
          attachmentTypeId: 613, //Bank Detail Attachments
          attachmentOfId: 102, //Activity
          entityId: inData.activityId,
        };

        if (inData.attachmentIds && inData.attachmentIds.length > 0) {
          whereClause.id = { [Op.notIn]: inData.attachmentIds };
        }

        existingAttachments = await attachments.findAll({
          where: whereClause,
          attributes: ["id"],
        })
      }
      else if (inData.paymentMethodId == 4) {
        // UPI
        accountHolderName = null;
        accountNumber = null;
        ifscCode = null;

        //GET ALL BANK DETAIL ATTACHMENTS
        const whereClause: any = {
          attachmentTypeId: 613, //Bank Detail Attachments
          attachmentOfId: 102, //Activity
          entityId: inData.activityId,
        };

        existingAttachments = await attachments.findAll({
          where: whereClause,
          attributes: ["id"],
        })
      }

      const activityTransactionData: any = {
        activityId: inData.activityId,
        paymentMethodId: inData.paymentMethodId,
        paymentTypeId: 175, //Reimbursement
        transactionTypeId: 180, // CREDIT
        accountHolderName: accountHolderName,
        accountNumber: accountNumber,
        ifscCode: ifscCode,
        upiLinkedMobileNumber: upiLinkedMobileNumber,
        amount: inData.amount,
        remarks: inData.remarks,
      };

      const promiseArray = [];
      if (!reimbursementActivityTransaction) {
        activityTransactionData.createdById = inData.authUserData.id;
        activityTransactionData.date = new Date();
        promiseArray.push(
          ActivityTransactions.create(activityTransactionData, {
            transaction: transaction,
          })
        );
      } else {
        activityTransactionData.updatedById = inData.authUserData.id;
        promiseArray.push(
          ActivityTransactions.update(activityTransactionData, {
            where: {
              id: reimbursementActivityTransaction.dataValues.id,
            },
            transaction,
          })
        );
      }

      promiseArray.push(
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 240, //WEB
            // title: `The agent "${inData.authUserData.name}" has updated the reimbursement details for the sub service "${getMasterDetail.data.data.subService.name}".`,
            title: `The ${inData.authUserData.role.name} "${inData.authUserData.name}" has updated the reimbursement details for the sub service "${getMasterDetail.data.data.subService.name}".`,
            createdById: inData.authUserData.id,
          },
          {
            transaction: transaction,
          }
        )
      );
      await Promise.all(promiseArray);

      //REMOVE EXISTING BANK DETAIL ATTACHMENTS
      if (existingAttachments && existingAttachments.length > 0) {
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
      }

      //CREATE NEW BANK DETAIL ATTACHMENTS (only if payment method is Bank)
      if (inData.paymentMethodId == 3 && inData.bankDetailAttachments && inData.bankDetailAttachments.length > 0) {
        const batchInsertions = [];
        for (const file of inData.bankDetailAttachments) {
          batchInsertions.push({
            attachmentTypeId: 613, //Bank Detail Attachments
            attachmentOfId: 102, //Activity
            entityId: inData.activityId,
            fileName: file.filename,
            originalName: file.originalname,
          });
        }
        await attachments.bulkCreate(batchInsertions, { transaction });
      }

      //SEND REIMBURSEMENT DETAILS TO VENDOR
      const vendorResponse = await sendReimbursementDetailsToVendor(activity, inData);
      if (!vendorResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: vendorResponse.error,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Reimbursement details updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function verifyVPA(req: Request, res: Response) {
    try {
      const { mobileNumber } = req.body;
      if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
        return res.status(200).json({
          success: false,
          error: "Invalid mobile number. Please provide a valid 10-digit mobile number.",
        });
      }

      // Generate request UUID
      const requestUUID = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Prepare request payload for VPA verification API
      const vpaRequestPayload = {
        VerifyVPARequest: {
          SubHeader: {
            requestUUID: requestUUID,
            serviceRequestId: process.env.UPI_VERIFY_SERVICE_REQUEST_ID,
            serviceRequestVersion: process.env.UPI_VERIFY_SERVICE_REQUEST_VERSION,
            channelId: process.env.UPI_VERIFY_CHANNEL_ID,
          },
          VerifyVPARequestBody: {
            merchId: process.env.UPI_VERIFY_MERCHANT_ID,
            merchChanId: process.env.UPI_VERIFY_MERCHANT_CHAN_ID,
            customerVpa: mobileNumber,
            corpCode: process.env.UPI_VERIFY_CORP_CODE,
            channelId: process.env.UPI_VERIFY_REQUEST_BODY_CHANNEL_ID,
            checksum: process.env.UPI_VERIFY_CHECK_SUM,
          },
        },
      };

      const url = process.env.UPI_VERIFY_URL as string;

      // Call external VPA verification API
      const vpaResponse = await axios.post(
        url,
        vpaRequestPayload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const responseData = vpaResponse.data;
      let customerName = "";
      if (responseData?.VerifyVPAResponse?.VerifyVPAResponseBody) {
        try {
          const parsedBody = typeof responseData.VerifyVPAResponse.VerifyVPAResponseBody === 'string'
            ? JSON.parse(responseData.VerifyVPAResponse.VerifyVPAResponseBody)
            : responseData.VerifyVPAResponse.VerifyVPAResponseBody;
          customerName = parsedBody?.customerName || "";
        } catch (parseError) {
          // If JSON parsing fails, try to extract customerName directly
          console.error("Error parsing VerifyVPAResponseBody:", parseError);
          customerName = "";
        }
      }

      return res.status(200).json({
        success: true,
        customerName: customerName,
        mobileNumber: mobileNumber,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function statusChange(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;
      // const authUserPermissions = inData.authUserData.permissions;
      // if (
      //   !Utils.hasPermission(
      //     authUserPermissions,
      //     "activity-reimbursement-status-change-web"
      //   )
      // ) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Permission not found",
      //   });
      // }

      const [activity, reimbursementActivityTransaction]: any =
        await Promise.all([
          Activities.findOne({
            attributes: ["id"],
            where: {
              id: inData.activityId,
              activityStatusId: 7, //SUCCESSFULL
              isReimbursement: 1, //YES
            },
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
                  statusId: 2, //INPROGRESS
                },
              },
            ],
          }),
          ActivityTransactions.findOne({
            attributes: ["id", "amount"],
            where: {
              activityId: inData.activityId,
              paymentTypeId: 175, // REIMBURSEMENT
              paymentStatusId: 190, //PENDING
            },
          }),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!reimbursementActivityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity transaction not found",
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

      await Promise.all([
        ActivityTransactions.update(
          {
            paymentStatusId: inData.statusId,
            updatedById: inData.authUserData.id,
          },
          {
            where: { id: reimbursementActivityTransaction.id },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 240, //WEB
            // title: `The agent "${inData.authUserData.name}" has updated the reimbursement status as "${inData.statusName}" for the sub service "${getMasterDetail.data.data.subService.name}".`,
            title: `The ${inData.authUserData.role.name} "${inData.authUserData.name}" has updated the reimbursement status as "${inData.statusName}" for the sub service "${getMasterDetail.data.data.subService.name}".`,
            createdById: inData.authUserData.id,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Reimbursement status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getList(req: Request, res: Response) {
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
      activityAspDetailWhere = {
        "$activity.activityStatusId$": {
          [Op.notIn]: [4, 8], //CANCELLED, REJECTED
        },
      };
      activityWhere.isReimbursement = 1;
      caseDetailWhere.typeId = 31; //RSA

      if (inputData.caseStatusIds?.length > 0) {
        caseDetailWhere.statusId = {
          [Op.in]: inputData.caseStatusIds,
        };
      }

      if (inputData.clientIds?.length > 0) {
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

      // AGENT PERMISSION
      if (
        Utils.hasPermission(
          userPermissions,
          "reimbursement-list-agent-view-own-web"
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
          activityAspDetailWhere = {
            ...activityAspDetailWhere,
            "$activity.caseDetail.l1AgentId$": userId,
          };
        } else if (inputData.levelId == 1046) {
          //L2 AGENT
          activityAspDetailWhere = {
            ...activityAspDetailWhere,
            "$activity.caseDetail.agentId$": userId,
          };
        } else if (inputData.levelId == 1047) {
          //L1 & L2 AGENT
          activityAspDetailWhere[Op.or] = [
            { "$activity.caseDetail.l1AgentId$": userId },
            { "$activity.caseDetail.agentId$": userId },
          ];
        }
      } else if (
        userId &&
        (Utils.hasPermission(
          userPermissions,
          "reimbursement-list-bo-head-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-service-head-own-web"
          ))
      ) {
        //If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
        const apiParams: any = {};
        if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-bo-head-own-web"
          )
        ) {
          //BO head
          apiParams.where = {
            boHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-network-head-own-web"
          )
        ) {
          //Network head
          apiParams.where = {
            networkHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-customer-experience-head-own-web"
          )
        ) {
          //Customer Experience Head
          apiParams.where = {
            customerExperienceHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-command-centre-head-own-web"
          )
        ) {
          //Command Centre Head
          apiParams.where = {
            commandCentreHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-service-head-own-web"
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
          ...activityAspDetailWhere,
          "$activity.caseDetail.caseInformation.breakdownAreaId$": {
            [Op.in]: roleCityIds,
          },
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "reimbursement-list-call-centre-manager-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-call-centre-head-own-web"
          )) &&
        userId
      ) {
        //If call centre manager (or ) call centre head role then. Get cases by its call centres
        const apiParams: any = {};
        apiParams.userId = userId;
        if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-call-centre-head-own-web"
          )
        ) {
          //Call centre head
          apiParams.type = 1;
        }

        if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-call-centre-manager-own-web"
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
          ...activityAspDetailWhere,
          "$activity.caseDetail.callCenterId$": {
            [Op.in]: callCenterIds,
          },
        };
      } else if (
        Utils.hasPermission(
          userPermissions,
          "reimbursement-list-tvs-spoc-own-web"
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
          ...activityAspDetailWhere,
          "$activity.caseDetail.clientId$": {
            [Op.in]: clientIds,
          },
        };
      } else if (
        (Utils.hasPermission(
          userPermissions,
          "reimbursement-list-team-leader-agents-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-sme-own-web"
          )) &&
        userId
      ) {
        //If team leader (or) sme role then. Get cases by its agents
        const apiParams: any = {};
        apiParams.roleId = 3; //Agent
        if (
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-team-leader-agents-own-web"
          )
        ) {
          //Team leader
          apiParams.where = {
            tlId: userId,
          };
        } else if (
          Utils.hasPermission(userPermissions, "reimbursement-list-sme-own-web")
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
          ...activityAspDetailWhere,
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

      let searchWhereQuery: any = [];
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
            } else if (searchDetail.type == "caseStatus") {
              masterSearchDetails.push({
                "$activity.caseDetail.statusId$": { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "activityPaymentStatus") {
              masterSearchDetails.push({
                "$activity.reimbursementActivityTransaction.paymentStatusId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            }
          }
        }

        searchWhereQuery = [
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

        if (masterSearchDetails && masterSearchDetails.length > 0) {
          searchWhereQuery.push(...masterSearchDetails);
        }
      }

      let dateFilterQuery: any = [];
      if (startDate && endDate) {
        dateFilterQuery = [
          sequelize.where(
            sequelize.fn(
              "DATE",
              sequelize.col("activity.caseDetail.createdAt")
            ),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn(
              "DATE",
              sequelize.col("activity.caseDetail.createdAt")
            ),
            "<=",
            endDate
          ),
        ];
      }

      activityAspDetailWhere[Op.and] = [
        searchWhereQuery.length > 0 ? { [Op.or]: searchWhereQuery } : {},
        dateFilterQuery.length > 0 ? { [Op.and]: dateFilterQuery } : {},
      ];

      const activityAspDetailsList = await ActivityAspDetails.findAndCountAll({
        where: activityAspDetailWhere,
        attributes: [
          "id",
          "subServiceId",
          [Sequelize.col("activity.caseDetail.id"), "caseDetailId"],
          [Sequelize.col("activity.caseDetail.statusId"), "caseStatusId"],
          [Sequelize.col("activity.caseDetail.createdAt"), "caseCreatedAt"],
          [Sequelize.col("activity.caseDetail.caseNumber"), "caseNumber"],
          [Sequelize.col("activity.caseDetail.subjectID"), "caseSubjectId"],
          [Sequelize.col("activity.caseDetail.vin"), "caseVin"],
          [
            Sequelize.col("activity.caseDetail.registrationNumber"),
            "caseRegistrationNumber",
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
                model: ActivityTransactions,
                as: "reimbursementActivityTransaction",
                required: true,
                attributes: ["id", "amount", "paymentStatusId"],
              },
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

  export async function updatePaymentStatus(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;

      const [activity, reimbursementActivityTransaction]: any =
        await Promise.all([
          Activities.findOne({
            attributes: ["id"],
            where: {
              id: inData.activityId,
              activityStatusId: 7, //SUCCESSFULL
              isReimbursement: 1, //YES
            },
            include: [
              {
                model: CaseDetails,
                required: true,
                attributes: ["id"],
                where: {
                  statusId: {
                    [Op.in]: [2, 4], //INPROGRESS, CLOSED
                  },
                },
              },
            ],
          }),
          ActivityTransactions.findOne({
            attributes: ["id", "paymentStatusId"],
            where: {
              activityId: inData.activityId,
              paymentTypeId: 175, // REIMBURSEMENT
              paymentStatusId: 190, //PENDING
            },
          }),
        ]);

      if (!activity) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!reimbursementActivityTransaction) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity transaction not found",
        });
      }

      if (reimbursementActivityTransaction.paymentStatusId == 191) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Reimbursement payment status is already Success.",
        });
      }

      // Map paymentStatus to paymentStatusId
      let paymentStatusId = null;
      const descriptionParts: string[] = [];
      if (inData.paymentStatus === "Success") {
        paymentStatusId = 191;
        descriptionParts.push(
          `Payment Status: <span style="color:#999">Success</span>`
        );
      } else if (inData.paymentStatus === "Failed") {
        paymentStatusId = 192;
        descriptionParts.push(
          `Payment Status: <span style="color:#999">Failed</span>`,
        );
        descriptionParts.push(
          `Failed Reason: <span style="color:#999">${inData.failureReason}</span>`,
        );
      }

      const updateData: any = {
        paymentStatusId: paymentStatusId,
        failureReason: paymentStatusId == 192 ? inData.failureReason : null,
      };

      await Promise.all([
        ActivityTransactions.update(
          updateData,
          {
            where: { id: reimbursementActivityTransaction.id },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 240, //WEB
            title: `Reimbursement Payment Status`,
            description: descriptionParts.join('<br />'),
            createdById: 484, //Admin
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Reimbursement payment status updated successfully",
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

const sendReimbursementDetailsToVendor = async (activity: any, payload: any) => {
  try {
    const vendorApiUrl: any = process.env.REIMBURSEMENT_VENDOR_API_URL;

    const formData = new FormData();
    formData.append("mActivityId", activity.id);
    formData.append("mCaseId", activity.caseDetail.id);
    formData.append("mPaymentMethod", payload.paymentMethodName);
    formData.append("mAccountHolderName", payload.paymentMethodId == 3 ? payload.accountHolderName : "");
    formData.append("mAccountNumber", payload.paymentMethodId == 3 ? payload.accountNumber : "");
    formData.append("mPhoneNumber", activity.caseDetail.caseInformation?.customerMobileNumber ? activity.caseDetail.caseInformation?.customerMobileNumber : "");
    formData.append("mReimbursementAmount", payload.amount);
    formData.append("mUPIId", payload.paymentMethodId == 4 ? payload.upiLinkedMobileNumber : "");

    // Get bank detail attachments and add to FormData
    if (payload.paymentMethodId == 3) {
      // 1. Add newly uploaded files from payload (they have base64 buffers)
      if (payload.bankDetailAttachments && Array.isArray(payload.bankDetailAttachments)) {
        for (const file of payload.bankDetailAttachments) {
          if (file.buffer && file.filename) {
            // Convert base64 string back to Buffer
            const fileBuffer = Buffer.from(file.buffer, "base64");
            // Append file buffer to FormData with field name "attachments"
            formData.append("attachments", fileBuffer, {
              filename: file.filename,
              contentType: file.mimetype || "application/octet-stream",
            });
          }
        }
      }

      // 2. Get all existing attachments from database (excluding newly created one)
      const allBankAttachments = await attachments.findAll({
        where: {
          attachmentTypeId: 613, // Bank Detail Attachments
          attachmentOfId: 102, // Activity
          entityId: activity.id,
        },
        attributes: ["id", "fileName", "originalName"],
      });

      for (const attachment of allBankAttachments) {
        const fileName = attachment.dataValues.fileName;
        const fileUrl = `${process.env.API_GATEWAY_URL}uploads/${fileName}`;

        // Fetch file from API Gateway
        const fileResponse = await axios.get(fileUrl, {
          responseType: "arraybuffer",
        });

        // Convert arraybuffer to Buffer
        const fileBuffer = Buffer.from(fileResponse.data);
        // Append file buffer to FormData with field name "attachments"
        formData.append("attachments", fileBuffer, {
          filename: fileName,
          contentType: fileResponse.headers["content-type"] || "application/octet-stream",
        });
      }
    }

    if (vendorApiUrl) {
      await axios.post(vendorApiUrl, formData, {
        headers: {
          ...formData.getHeaders(), // This sets Content-Type: multipart/form-data with boundary
        },
      });
    }

    return {
      success: true,
      message: "Reimbursement details sent to vendor successfully",
    };
  }
  catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
}

export default reimbursementController;
