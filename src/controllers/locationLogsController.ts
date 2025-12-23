import Sequelize from "sequelize";
import { Attachments, LocationLogs } from "../database/models/index";
import { sendSms, smsInfo } from "../lib/sms";
import { sendWhatsapp } from "../lib/whatsapp";
import axios from "axios";
import crypto from "crypto";
import sequelize from "../database/connection";
import moment from "moment-timezone";
import Utils from "../lib/utils";
const config = require("../config/config.json");

const Op = Sequelize.Op;
const { Validator } = require("node-input-validator");

//API with endpoint (API Gateway);
const apiGatewayService = `${config.apiGatewayService.host}:${config.apiGatewayService.port}/${config.apiGatewayService.version}`;
const endpointApiGateway = config.apiGatewayService.endpoint;

class LocationLogsController {
  constructor() {}
  public async saveLocation(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validatorRules = {
        id: "required|numeric",
        token: "required|string|maxLength:250",
        latitude: "required|string|maxLength:70",
        longitude: "required|string|maxLength:70",
        files: "required|array",
        "files.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const tokenExists: any = await LocationLogs.findOne({
        where: {
          id: payload.id,
          token: payload.token,
          status: 0,
        },
        attributes: ["id", "token", "latitude", "longitude"],
      });
      if (!tokenExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Invalid location token",
        });
      }

      tokenExists.latitude = payload.latitude;
      tokenExists.longitude = payload.longitude;
      tokenExists.status = 1;
      tokenExists.expiryDateTime = new Date();
      await tokenExists.save({ transaction });

      let existingAttachments = await Attachments.findAll({
        where: {
          attachmentTypeId: 605, //Breakdown Vehicle Image
          attachmentOfId: 104, //Location Log
          entityId: payload.id,
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
          return res.status(200).json(deleteAttachmentResponse.data);
        }

        await Attachments.destroy({
          where: { id: attachment.dataValues.id },
          transaction: transaction,
        });
      }

      const batchInsertions = [];
      for (const file of payload.files) {
        batchInsertions.push({
          attachmentTypeId: 605, //Breakdown Vehicle Image
          attachmentOfId: 104, //Location Log
          entityId: payload.id,
          fileName: file.filename,
          originalName: file.originalname,
        });
      }
      await Attachments.bulkCreate(batchInsertions, { transaction });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: tokenExists,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async sendMessage(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validatorRules = {
        getLocationViaId: "required|numeric",
        customerName: "required|string|maxLength:191",
        target: "required|string|digits:10",
        existingLocationLogId: "numeric",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let output = Object();
      const currentDate = new Date().toISOString().slice(0, 10);
      const currentTimestamp = Date.now();
      let randomHexString = crypto.randomBytes(22).toString("hex");
      const token = `${currentDate}-${currentTimestamp}-${randomHexString}`;

      const tokenAlreadyExists = await LocationLogs.findOne({
        where: {
          token: token,
        },
        attributes: ["id"],
      });
      if (tokenAlreadyExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Location token is already exists",
        });
      }

      const minutesToAdd: any = process.env
        .LOCATION_TRACKER_URL_EXPIRY_MINS as any;
      const expiryDateTime = moment
        .tz("Asia/Kolkata")
        .add(minutesToAdd * 60, "seconds")
        .toDate();

      let locationDetails = {
        token: token,
        customerName: payload.customerName,
        customerMobileNumber: payload.target,
        expiryDateTime: expiryDateTime,
      };
      const locationLog = await LocationLogs.create(locationDetails, {
        transaction: transaction,
      });
      let url = `${process.env.LOCATION_TRACKER_URL}?token=${token}&id=${locationLog.dataValues.id}`;

      await LocationLogs.update(
        {
          url: url,
        },
        {
          where: { id: locationLog.dataValues.id },
          transaction: transaction,
        }
      );

      // ENABLE AFTER TEMPLATE INTEGRATION
      if (payload.getLocationViaId == 491) {
        //SMS
        let smsDetails = {
          phoneNumber: payload.target,
          message: `Dear Customer, Kindly help to track your location click on the below link to share your location: ${url} Team TVS Auto Assist`,
        };

        output = await sendSms(smsDetails, smsInfo, "location");
      } else if (payload.getLocationViaId == 492) {
        //WhatsApp
        let whatsappLoad = {
          mobile: payload.target,
          url: url,
        };

        output = await sendWhatsapp(whatsappLoad);
      }

      if (!output.success) {
        await transaction.rollback();
        return res.status(200).json({ ...output });
      }

      // EXPIRY THE OLD LINK
      if (payload.existingLocationLogId) {
        const existingLocationLogDetail = await LocationLogs.findOne({
          where: {
            id: payload.existingLocationLogId,
          },
          attributes: ["id"],
        });
        if (existingLocationLogDetail) {
          await LocationLogs.update(
            {
              expiryDateTime: new Date(),
            },
            {
              where: { id: payload.existingLocationLogId },
              transaction: transaction,
            }
          );
        }
      }

      await transaction.commit();
      // ENABLE AFTER TEMPLATE INTEGRATION
      return res
        .status(200)
        .json({ ...output, url, token, id: locationLog.dataValues.id });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async getLocationDetails(req: any, res: any) {
    try {
      const payload = req.body;
      const validatorRules = {
        id: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let locationLog = await LocationLogs.findOne({
        where: { id: payload.id },
        attributes: ["id", "token", "latitude", "longitude"],
      });
      if (!locationLog) {
        return res.status(200).json({
          success: false,
          error: "Location detail not found",
        });
      }

      if (
        !locationLog.dataValues.latitude &&
        !locationLog.dataValues.longitude
      ) {
        return res.status(200).json({
          success: false,
          error: "Location detail not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: locationLog,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async checkLocationExpiry(req: any, res: any) {
    try {
      const payload = req.body;
      const validatorRules = {
        id: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let locationLog = await LocationLogs.findOne({
        where: { id: payload.id },
        attributes: ["id", "expiryDateTime"],
      });
      if (!locationLog) {
        return res.status(200).json({
          success: false,
          error: "Location detail not found",
        });
      }

      const expiryDateTime = new Date(locationLog.dataValues.expiryDateTime);
      const currentDateTime = new Date();
      return res.status(200).json({
        success: true,
        linkExpired: currentDateTime > expiryDateTime,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}
const locationLogsController = new LocationLogsController();
export default locationLogsController;
