import { Request, Response } from "express";
const config = require("../config/config.json");
import axios from "axios";
import { Op } from "sequelize";
import {
  Activities,
  ActivityAspDetails,
  ActivityLogs,
  CaseDetails,
  CaseInformation,
  RsaActivityInventory,
} from "../database/models";
import sequelize from "../database/connection";
import attachments from "../database/models/attachments";
import Utils from "../lib/utils";
import { sendSms, smsInfo } from "../lib/sms";

//API with endpoint (API Gateway);
const apiGatewayService = `${config.apiGatewayService.host}:${config.apiGatewayService.port}/${config.apiGatewayService.version}`;
const endpointApiGateway = config.apiGatewayService.endpoint;

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

export namespace otherServiceController {
  export async function updateStatus(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;
      //GET EXISTING ATTACHMENTS
      const whereClause: any = {
        attachmentTypeId: inData.attachmentTypeId,
        attachmentOfId: inData.attachmentOfId,
        entityId: inData.activityId,
      };

      if (inData.attachmentIds && inData.attachmentIds.length > 0) {
        whereClause.id = { [Op.notIn]: inData.attachmentIds };
      }

      const [activity, existingAttachments]: any = await Promise.all([
        Activities.findOne({
          attributes: ["id", "isServiceEntitlementUpdated", "isReimbursement"],
          where: {
            id: inData.activityId,
            activityStatusId: {
              [Op.in]: [1, 4, 7, 8], //1-OPEN, 4-CANCELED, 7-SUCCESSFUL, 8-REJECTED
            },
          },
          include: [
            {
              model: ActivityAspDetails,
              attributes: ["id", "subServiceId"],
            },
            {
              model: CaseDetails,
              required: true,
              attributes: [
                "id",
                "clientId",
                "agentId",
                "vin",
                "registrationNumber",
              ],
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
          ],
        }),
        attachments.findAll({
          where: whereClause,
          attributes: ["id"],
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

      //REMOVE EXISTING DOCUMENTS
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

      if (inData.files.length > 0) {
        const batchInsertions = [];
        for (const file of inData.files) {
          batchInsertions.push({
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.activityId,
            fileName: file.filename,
            originalName: file.originalname,
          });
        }
        await attachments.bulkCreate(batchInsertions, { transaction });
      }

      await Promise.all([
        Activities.update(
          {
            activityStatusId: inData.activityStatusId,
            remarks: inData.remarks,
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
            // title: `The agent "${inData.authUserData.name}" has updated the activity status as "${inData.activityStatusName}" for the sub service "${getMasterDetail.data.data.subService.name}".`,
            title: `The ${inData.authUserData.role.name} "${inData.authUserData.name}" has updated the activity status as "${inData.activityStatusName}" for the sub service "${getMasterDetail.data.data.subService.name}".`,
            createdById: inData.authUserData.id,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      //IF ACTIVITY STATUS SUCCESS AND REIMBURSEMENT IS DONE THEN REDUCE CUSTOMER SERVICE ENTITLEMENT
      if (
        inData.activityStatusId == 7 &&
        !activity.dataValues.isServiceEntitlementUpdated &&
        activity.dataValues.isReimbursement == 1
      ) {
        const reduceCustomerServiceEntitlementRequest = {
          activityId: activity.id,
          clientId: activity.caseDetail.clientId,
          vin: activity.caseDetail.vin,
          registrationNumber: activity.caseDetail.registrationNumber,
          serviceId: inData.serviceId,
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
        message: "The activity status has been updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateVehicleHandoverStatus(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;
      const activity: any = await Activities.findOne({
        attributes: ["id", "caseDetailId"],
        where: {
          id: inData.activityId,
        },
        include: [
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "aspId"],
          },
          {
            model: CaseDetails,
            required: true,
            attributes: ["id"],
            include: [
              {
                model: CaseInformation,
                required: true,
                attributes: ["id", "customerCurrentMobileNumber"],
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

      //GET ASP AND TOWING SUB SERVICE DETAILS
      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.otherService.getMasterDetails}`,
        {
          aspId: activity.activityAspDetail.aspId,
          serviceId: 1, //TOWING
        }
      );
      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json(getMasterDetail.data);
      }

      const serviceSubServiceIds =
        getMasterDetail.data.data.serviceSubServices.map(
          (serviceSubService: any) => serviceSubService.id
        );
      const otp = Math.floor(1000 + Math.random() * 9000).toString(); //4 DIGIT

      await Promise.all([
        Activities.update(
          {
            isVehicleHandedOver: inData.isVehicleHandedOver,
            vehicleHandOverOtp: otp,
            updatedById: inData.authUserId,
          },
          {
            where: { id: inData.activityId },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 241, //Mobile
            title: `The service provider "${
              getMasterDetail.data.data.asp.workshopName
            }" successfully updated vehicle handed over status as ${
              inData.isVehicleHandedOver == 1 ? "Yes" : "No"
            }.`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      const towingActivities: any = await Activities.findAll({
        attributes: ["id", "activityStatusId", "activityAppStatusId"],
        where: {
          caseDetailId: activity.caseDetailId,
          activityStatusId: { [Op.in]: [2, 3] }, //2-Assigned,3-Inprogress
        },
        include: {
          model: ActivityAspDetails,
          required: true,
          attributes: ["id"],
          where: {
            subServiceId: { [Op.in]: serviceSubServiceIds },
          },
        },
      });

      let sendSmsToAsp = false;
      for (const towingActivity of towingActivities) {
        if (towingActivity.activityStatusId == 2) {
          //If activity status is assigned
          sendSmsToAsp = true;
        } else if (
          towingActivity.activityStatusId == 3 &&
          (towingActivity.activityAppStatusId == 21 ||
            towingActivity.activityAppStatusId == 22)
        ) {
          //If activity status is in progress and activity app status started To BD Location or reached BD Location
          sendSmsToAsp = true;
        }
      }

      const smsSubject = `test`; //provided by client
      const smsDetails = {
        phoneNumber: sendSmsToAsp
          ? getMasterDetail.data.data.asp.contactNumber
          : activity.caseDetail.caseInformation.customerCurrentMobileNumber,
        message: smsSubject,
      };
      sendSms(smsDetails, smsInfo, "otherService");

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle handed over status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function updateVehicleHandoverDetail(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.body;
      const activity: any = await Activities.findOne({
        attributes: ["id", "vehicleHandOverOtp"],
        where: {
          id: inData.activityId,
          isVehicleHandedOver: 1, //1-Yes
        },
        include: [
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "aspId"],
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

      if (inData.otp != activity.vehicleHandOverOtp) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Invalid OTP",
        });
      }

      const [getMasterDetail, rsaActivityInventory]: any = await Promise.all([
        axios.post(
          `${masterService}/${endpointMaster.otherService.getMasterDetails}`,
          {
            aspId: activity.activityAspDetail.aspId,
          }
        ),
        RsaActivityInventory.findOne({
          attributes: ["id"],
          where: {
            activityId: inData.activityId,
            typeId: 162, //BREAKDOWN
          },
        }),
      ]);
      if (!getMasterDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json(getMasterDetail.data);
      }

      if (!rsaActivityInventory) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Rsa activity inventory not found",
        });
      }

      //REMOVE EXISTING DOCUMENTS
      let existingAttachments = [];
      if (inData.attachmentIds && inData.attachmentIds.length > 0) {
        existingAttachments = await attachments.findAll({
          where: {
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.activityId,
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
            entityId: inData.activityId,
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

      if (inData.files.length > 0) {
        const batchInsertions = [];
        for (const file of inData.files) {
          batchInsertions.push({
            attachmentTypeId: inData.attachmentTypeId,
            attachmentOfId: inData.attachmentOfId,
            entityId: inData.activityId,
            fileName: file.filename,
            originalName: file.originalname,
          });
        }
        await attachments.bulkCreate(batchInsertions, { transaction });
      }

      await Promise.all([
        RsaActivityInventory.update(
          {
            vehicleAcknowledgedBy: inData.name,
            updatedById: inData.authUserId,
          },
          {
            where: { id: rsaActivityInventory.dataValues.id },
            transaction: transaction,
          }
        ),
        ActivityLogs.create(
          {
            activityId: inData.activityId,
            typeId: 241, //Mobile
            title: `The service provider "${getMasterDetail.data.data.asp.workshopName}" successfully updated vehicle handed over detail.`,
          },
          {
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle handed over detail updated successfully",
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

export default otherServiceController;
