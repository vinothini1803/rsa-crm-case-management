import { Op } from "sequelize";
import axios from "axios";
import { RsaActivityInventory, Activities } from "../database/models/index";
import Attachment from "../database/models/attachments";
import { checkActivity } from "./activitiesContoller";
import sequelize from "../database/connection";
import { createActivityLog } from "./activityLog";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import notificationController from "./notificationController";

const config = require("../config/config.json");
//API with endpoint (API Gateway);
const apiGatewayService = `${config.apiGatewayService.host}:${config.apiGatewayService.port}/${config.apiGatewayService.version}`;
const endpointApiGateway = config.apiGatewayService.endpoint;

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

const checkRsaActivityInventoryExists = async (
  activityId: any,
  typeId: any
) => {
  try {
    return await RsaActivityInventory.findOne({
      where: { activityId: activityId, typeId: typeId },
      attributes: ["id"],
    });
  } catch (error: any) {
    throw error;
  }
};

const generateInventoryData = async (data: any) => {
  try {
    let inventory: any = {};
    if (data.typeId) inventory.typeId = data.typeId;
    if (data.failedPartName) inventory.failedPartName = data.failedPartName;
    if (data.repairWork) inventory.repairWork = data.repairWork;
    if (data.hubCaps) inventory.hubCaps = data.hubCaps;
    if (data.spareWheel != undefined) inventory.spareWheel = data.spareWheel;
    if (data.jackAndJackRoad != undefined)
      inventory.jackAndJackRoad = data.jackAndJackRoad;
    if (data.audioSystem != undefined) inventory.audioSystem = data.audioSystem;
    if (data.reverseParkingSystem != undefined)
      inventory.reverseParkingSystem = data.reverseParkingSystem;
    if (data.speakers) inventory.speakers = data.speakers;
    if (data.keyWithRemote != undefined)
      inventory.keyWithRemote = data.keyWithRemote;
    if (data.aerial != undefined) inventory.aerial = data.aerial;
    if (data.floorMat) inventory.floorMat = data.floorMat;
    if (data.fixedOrHangingIdol != undefined)
      inventory.fixedOrHangingIdol = data.fixedOrHangingIdol;
    if (data.reachedDealershipStatus != undefined)
      inventory.reachedDealershipStatus = data.reachedDealershipStatus;
    if (data.vehicleAcknowledgedBy)
      inventory.vehicleAcknowledgedBy = data.vehicleAcknowledgedBy;
    if (data.mobileNumberOfReceiver)
      inventory.mobileNumberOfReceiver = data.mobileNumberOfReceiver;
    if (data.requestDealershipSignature != undefined)
      inventory.requestDealershipSignature = data.requestDealershipSignature;
    if (data.termsAndConditions != undefined)
      inventory.termsAndConditions = data.termsAndConditions;

    return inventory;
  } catch (error: any) {
    throw error;
  }
};

const createRsaActivityInventory = async (data: any, transaction: any) => {
  try {
    return await RsaActivityInventory.create(
      {
        activityId: data.activityId,
        createdById: data.createOrUpdatebyId,
        ...(await generateInventoryData(data)),
      },
      { transaction: transaction }
    );
  } catch (error: any) {
    throw error;
  }
};

const updateRsaActivityInventory = async (data: any, transaction: any) => {
  try {
    return await RsaActivityInventory.update(
      {
        updatedById: data.createOrUpdatebyId,
        ...(await generateInventoryData(data)),
      },
      {
        where: { activityId: data.activityId, typeId: data.typeId },
        transaction: transaction,
      }
    );
  } catch (error: any) {
    throw error;
  }
};

const updateActivity = async (data: any, transaction: any) => {
  try {
    let updateData: any = {};
    if (data.typeId == "161") {
      // Drop
      updateData.activityAppStatusId = 29; // RSA Drop Inventory Added
    } else if (data.typeId == "162") {
      // Breakdown
      updateData.activityAppStatusId = 28; // RSA Breakdown Inventory Added
    }

    if (data.repairTime) {
      updateData.serviceDuration = data.repairTime;
    }
    if (data.aspReachedToBreakdownAt) {
      updateData.aspReachedToBreakdownAt = moment
        .tz(data.aspReachedToBreakdownAt, "Asia/Kolkata")
        .toDate();
    }
    if (data.repairStatus == 0 || data.repairStatus == 1) {
      updateData.serviceStatus = data.repairStatus;
    }
    if (data.aspReachedToDropAt) {
      updateData.aspReachedToDropAt = moment
        .tz(data.aspReachedToDropAt, "Asia/Kolkata")
        .toDate();
    }
    if (data.issueComments) {
      updateData.issueComments = data.issueComments;
    }

    if (data.isVehicleHandedOver == 0 || data.isVehicleHandedOver == 1) {
      updateData.isVehicleHandedOver = data.isVehicleHandedOver;
    }
    return await Activities.update(updateData, {
      where: { id: data.activityId },
      transaction: transaction,
    });
  } catch (error: any) {
    throw error;
  }
};

const handleAttachments = async (data: any) => {
  try {
    let attachmentTypeId: any;
    if (data.typeId == "161") {
      // Drop
      attachmentTypeId = ["93", "94", "95", "96", "97", "98", "99"];
    } else if (data.typeId == "162") {
      // Breakdown
      attachmentTypeId = [
        "85",
        "86",
        "87",
        "88",
        "89",
        "90",
        "91",
        "92",
        "600",
        "601",
        "606",
      ];
    }

    // DELETE THE ATTACHMENTS EXCEPT GIVEN ATTACHMENT IDS
    if (data.attachmentIds && data.attachmentIds.length > 0) {
      const existingAttachments = await Attachment.findAll({
        where: {
          entityId: data.activityId,
          id: {
            [Op.notIn]: data.attachmentIds,
          },
          attachmentTypeId: { [Op.in]: attachmentTypeId },
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
          return {
            success: false,
            error: deleteAttachmentResponse.data.error,
          };
        }
      }
    } else {
      // DELETE ALL THE ATTACHMENTS SINCE NO ATTACHMENT IDS FROM FRONT END(THAT MEANS ALL THE ATTACHMENTS ARE DELETED AT FRONTEND)
      const existingAttachments = await Attachment.findAll({
        where: {
          entityId: data.activityId,
          attachmentTypeId: { [Op.in]: attachmentTypeId },
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
          return {
            success: false,
            error: deleteAttachmentResponse.data.error,
          };
        }
      }
    }

    return {
      success: true,
      message: "Attachments processed successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

export namespace rsaActivityInventoryController {
  export async function addRsaActivityInventory(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      let body: any = req.validBody;
      const authUserPermissions = body.authUserData.permissions;
      // if (
      //   !Utils.hasPermission(authUserPermissions, "add-inventory-web") &&
      //   !Utils.hasPermission(authUserPermissions, "edit-inventory-web")
      // ) {
      //   await transaction.rollback();
      //   return res.status(200).json({
      //     success: false,
      //     error: "Permission not found",
      //   });
      // }

      //CHECK ACTIVITY EXISTS
      let activityExists = await checkActivity(req.validBody.activityId);
      if (!activityExists.success || !activityExists.data) {
        await transaction.rollback();
        return res.status(200).json(activityExists);
      }

      const activity: any = activityExists.data;

      // VALIDATE ACTIVITY STATUS AND CASE STATUS
      if (activity.dataValues.activityStatusId !== 3) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity is not in progress",
        });
      }

      if (!activity.activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP detail not found",
        });
      }

      if (!activity.caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      if (activity.caseDetail.dataValues.statusId !== 2) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case is not in progress",
        });
      }

      const [inventory, getASPDetail]: any = await Promise.all([
        checkRsaActivityInventoryExists(
          req.validBody.activityId,
          req.validBody.typeId
        ),
        // GET ASP DETAILS FOR NOTIFICATIONS
        axios.get(
          `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${activity.activityAspDetail.dataValues.aspId}`
        )
      ]);

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // INVENTORY ALREADY EXISTS THEN UPDATE
      if (inventory) {
        await updateRsaActivityInventory(req.validBody, transaction);

        const handleAttachmentResponse: any = await handleAttachments(
          req.validBody
        );
        if (!handleAttachmentResponse.success) {
          await transaction.rollback();
          return res.status(200).json(handleAttachmentResponse);
        }
      } else {
        // INVENTORY NOT EXISTS THEN CREATE
        await createRsaActivityInventory(req.validBody, transaction);
      }

      if (body.attachments && body.attachments.length > 0) {
        await Attachment.bulkCreate(body.attachments, { transaction });
      }

      //UPDATE ACTIVITY RELATED DATA
      await updateActivity(body, transaction);

      let activityLogTitle = "";
      //FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activity.dataValues.caseDetailId,
        notifyToAll: [""],
        workshopName: getASPDetail.data.data.workshopName,
      };

      //DROP INVENTORY TYPE
      if (body.typeId == 161) {
        activityLogTitle = "The drop inventory";
        details.templateId = 25;
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.mechanicDetail = activity.activityAspDetail.dataValues.aspMechanicId;
        details.notificationType = "CRM";
        details.sourceFrom = 2; //Mobile
      } else if (body.typeId == 162) {
        //BREAKDOWN INVENTORY TYPE
        activityLogTitle = "The breakdown inventory";
        details.templateId = 24;
        details.aspDetail = activity.activityAspDetail.dataValues.aspId;
        details.mechanicDetail = activity.activityAspDetail.dataValues.aspMechanicId;
        details.notificationType = "CRM";
        details.sourceFrom = 2; //Mobile
      }

      body.authUserName = body.authUserData.name;
      body.authUserRoleName = body.authUserData.role.name;

      const createActivityLogResponse = await createActivityLog(
        body,
        transaction,
        activityLogTitle
      );
      if (!createActivityLogResponse.success) {
        await transaction.rollback();
        return res.status(200).json(createActivityLogResponse);
      }

      // SEND NOTIFICATION
      notificationController.sendNotification(details);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Inventory has been updated successfully",
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

export default rsaActivityInventoryController;
