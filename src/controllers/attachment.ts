import { Request, Response } from "express";
import Attachment from "../database/models/attachments";
import ActivityChargeAttachments from "../database/models/activityChargeAttachments";
import { Activities, ActivityAspRateCards } from "../database/models/index";
import fs from "fs";
import path from "path";

export namespace attachmentController {
  export async function getAttachments(req: Request, res: Response) {
    try {
      const { entityId, attachmentOfId } = req.body;

      // Fetch file data from the database (assuming you have an Attachment model)
      const attachments = await Attachment.findAll({
        where: { entityId: entityId, attachmentOfId: attachmentOfId },
      });

      if (!attachments || attachments.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Attachments not found",
        });
      }
      // Send the array of attachments as the response
      return res.status(200).json({
        success: true,
        data: attachments,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getAdditionalChargeAttachments(
    req: Request,
    res: Response
  ) {
    try {
      const { activityId, chargeId } = req.body;

      const where: any = {};

      const activity = await Activities.findOne({
        where: { id: activityId },
      });
      if (!activity) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      } else {
        where.activityId = activityId;
      }

      //Get all attachment based on chargeId;
      if (chargeId) {
        where.chargeId = chargeId;
      }

      const attachments = await ActivityChargeAttachments.findAll({
        where,
      });

      if (!attachments || attachments.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Attachments not found",
        });
      }
      // Send the array of attachments as the response
      return res.status(200).json({
        success: true,
        data: attachments,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function deleteAttachment(req: Request, res: Response) {
    try {
      const data: any = req.validBody;
      const attachments: any = await Attachment.findAll({
        where: {
          id: data.attachmentId,
        },
        attributes: {
          exclude: ["createdAt", "updatedAt", "deletedAt"],
        },
      });

      if (attachments.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Attachment not found",
        });
      }

      // Delete attachments from the database
      await Promise.all(
        attachments.map(async (attachment: any) => {
          await attachment.destroy();
        })
      );

      return res.status(200).json({
        success: true,
        data: attachments,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function deleteAdditionalChargeAttachment(
    req: Request,
    res: Response
  ) {
    try {
      const data = req.validBody;
      const activityChargeAttachments = await ActivityChargeAttachments.findAll(
        {
          where: {
            id: data.attachmentId,
          },
          attributes: {
            exclude: ["createdAt", "updatedAt", "deletedAt"],
          },
        }
      );

      if (activityChargeAttachments.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Attachments not found",
        });
      }

      // Delete attachments from the database
      await Promise.all(
        activityChargeAttachments.map(async (attachment: any) => {
          await attachment.destroy();
        })
      );

      return res.status(200).json({
        success: true,
        data: activityChargeAttachments,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function deleteAdditionalAttachmentByCharge(
    req: Request,
    res: Response
  ) {
    try {
      const data = req.validBody;

      const activity = await Activities.findByPk(data.activityId);
      if (!activity) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const activityChargeAttachments = await ActivityChargeAttachments.findAll(
        {
          where: {
            activityId: data.activityId,
            chargeId: data.chargeId,
          },
          attributes: {
            exclude: ["createdAt", "updatedAt", "deletedAt"],
          },
        }
      );

      if (activityChargeAttachments.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Attachments not found",
        });
      }

      // Delete attachments from the database
      await Promise.all(
        activityChargeAttachments.map(async (attachment: any) => {
          await attachment.destroy();
        })
      );

      return res.status(200).json({
        success: true,
        data: activityChargeAttachments,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default attachmentController;
