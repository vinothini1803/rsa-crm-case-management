import { Request, Response } from "express";
import {
  CallInitiation,
  CaseDetails,
  CaseInformation,
  TemplateLogs,
  Templates,
  TemplateSmsDetails,
} from "../database/models/index";
import { Op, Sequelize } from "sequelize";
import sequelize from "../database/connection";
import { sendEscalationSms } from "../controllers/template";
import Utils from "../lib/utils";
import axios from "axios";
const config = require("../config/config.json");
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middlewares/excel.middleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

export namespace callInitiationController {
  const defaultLimit = 10;
  const defaultOffset = 0;

  //API with endpoint (Master);
  const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
  const endpointMaster = config.MasterService.endpoint;

  export async function getFormData(req: any, res: any) {
    try {
      const { id } = req.query;

      let callInitiation: any = {};
      if (id) {
        const callInitiationExists: any = await CallInitiation.findOne({
          where: { id: id },
        });
        if (!callInitiationExists) {
          return res.status(200).json({
            success: false,
            error: "Call Initiation not found",
          });
        }
        const { deletedAt, ...data } = callInitiationExists.dataValues;
        callInitiation = {
          ...data,
          status: deletedAt ? 0 : 1,
        };
      }

      return res.status(200).json({
        success: true,
        data: { callInitiation: callInitiation },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function createCallInitiation(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      let message = null;
      let callInitiationId = null;
      if (inData.id) {
        const callInitiationExists = await CallInitiation.findByPk(inData.id);
        if (!callInitiationExists) {
          return res.status(200).json({
            success: false,
            error: "Call Initiation not found",
          });
        }

        const { createdById, ...updateData } = inData;
        updateData.updatedById = createdById;
        await CallInitiation.update(updateData, {
          where: {
            id: inData.id,
          },
          transaction: transaction,
        });
        message = "Call Initiation updated successfully";
        callInitiationId = inData.id;
      } else {
        const newCallInitiation = await CallInitiation.create(inData, {
          transaction,
        });
        message = "Call Initiation created successfully";
        callInitiationId = newCallInitiation.dataValues.id;
      }

      //If subject is non rsa then send interaction sms to customer
      if (inData.subjectId == 391) {
        sendEscalationSms(
          inData.mobileNumber,
          null,
          953, //CALL INITIATION
          callInitiationId,
          inData.createdById,
          114, //Add Interaction Non RSA
          null
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: message,
        callInitiationId: callInitiationId,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getCallInitiationList(req: any, res: any) {
    try {
      const {
        limit,
        offset,
        searchKey,
        clientId,
        subjectId,
        dispositionId,
        callFromId,
        startDate,
        endDate,
        authUserId,
      } = req.query;

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

      const userPermissions = getAuthUserDetail.data.user.permissions;
      if (
        !Utils.hasPermission(userPermissions, "call-initiation-view-all") &&
        !Utils.hasPermission(userPermissions, "call-initiation-view-own")
      ) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      // Limitation value setup
      let limitValue: number = defaultLimit;
      if (limit) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = defaultOffset;
      if (offset) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const where: any = {};
      let searchWhereClause: any = [];
      if (searchKey) {
        const searchDataResponse = await axios.post(
          `${masterService}/${endpointMaster.getCrmListSearchData}`,
          {
            search: searchKey,
          }
        );
        let masterSearchDetails = [];
        if (searchDataResponse?.data?.success) {
          for (const searchDetail of searchDataResponse.data.searchDetails) {
            if (searchDetail.type == "subject") {
              masterSearchDetails.push({
                subjectId: {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "client") {
              masterSearchDetails.push({
                clientId: {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "callFrom") {
              masterSearchDetails.push({
                callFromId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "disposition") {
              masterSearchDetails.push({
                dispositionId: { [Op.in]: searchDetail.ids },
              });
            } else if (searchDetail.type == "channel") {
              masterSearchDetails.push({
                "$caseDetail.caseInformation.channelId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            } else if (searchDetail.type == "language") {
              masterSearchDetails.push({
                "$caseDetail.caseInformation.contactLanguageId$": {
                  [Op.in]: searchDetail.ids,
                },
              });
            }
          }
        }

        searchWhereClause = [
          { contactName: { [Op.like]: `%${searchKey}%` } },
          { mobileNumber: { [Op.like]: `%${searchKey}%` } },
          { remarks: { [Op.like]: `%${searchKey}%` } },
          Sequelize.literal(`caseDetail.caseNumber LIKE "%${searchKey}%"`),
        ];

        if (masterSearchDetails.length > 0) {
          searchWhereClause.push(...masterSearchDetails);
        }
      }

      if (clientId) {
        where.clientId = clientId;
      }
      if (subjectId) {
        where.subjectId = subjectId;
      }
      if (dispositionId) {
        where.dispositionId = dispositionId;
      }
      if (callFromId) {
        where.callFromId = callFromId;
      }

      let dateFilterWhereClause: any = [];
      // Check if a date query is provided
      if (startDate && endDate) {
        dateFilterWhereClause = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("callInitiation.createdAt")),
            ">=",
            startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("callInitiation.createdAt")),
            "<=",
            endDate
          ),
        ];
      }

      if (Utils.hasPermission(userPermissions, "call-initiation-view-own")) {
        where[Op.or] = [
          { createdById: authUserId },
          { updatedById: authUserId },
        ];
      }

      where[Op.and] = {
        [Op.and]: [
          ...(dateFilterWhereClause.length > 0
            ? [{ [Op.and]: dateFilterWhereClause }]
            : []),
          ...(searchWhereClause.length > 0
            ? [{ [Op.or]: searchWhereClause }]
            : []),
        ],
      };

      const callInitiationList = await CallInitiation.findAndCountAll({
        where,
        attributes: [
          "id",
          "subjectId",
          "clientId",
          "contactName",
          "mobileNumber",
          "callFromId",
          "dispositionId",
          "remarks",
          [Sequelize.col("caseDetail.caseNumber"), "caseNumber"],
          [
            Sequelize.col("caseDetail.caseInformation.contactLanguageId"),
            "contactLanguageId",
          ],
          [Sequelize.col("caseDetail.caseInformation.channelId"), "channelId"],
          [
            Sequelize.literal(
              "( SELECT DATE_FORMAT(callInitiation.createdAt,'%d/%m/%Y %h:%i %p') )"
            ),
            "createdAt",
          ],
        ],
        order: [["id", "desc"]],
        limit: limitValue,
        offset: offsetValue,
        include: {
          model: CaseDetails,
          as: "caseDetail",
          attributes: [],
          required: false,
          include: [
            {
              model: CaseInformation,
              as: "caseInformation",
              attributes: [],
              required: false,
            },
          ],
        },
      });

      if (callInitiationList.count === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: callInitiationList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function exportData(req: any, res: any) {
    try {
      const { format, startDate, endDate } = req.body;
      if (!Utils.isValidExportFormat(format)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or missing export format",
        });
      }

      const where: any = {};
      if (startDate && endDate) {
        const dateFilter = Utils.getDateFilter(startDate, endDate);
        where.createdAt = dateFilter;
      }

      const callInitiationDetails: any = await CallInitiation.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
      });
      if (!callInitiationDetails || callInitiationDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No record found for the selected date range",
        });
      }

      let subjectIds: any = [];
      let clientIds: any = [];
      let callFromIds: any = [];
      let dispositionIds: any = [];
      let caseIds: any = [];
      for (const callInitiationDetail of callInitiationDetails) {
        if (
          callInitiationDetail.subjectId &&
          !subjectIds.includes(callInitiationDetail.subjectId)
        ) {
          subjectIds.push(callInitiationDetail.subjectId);
        }

        if (
          callInitiationDetail.clientId &&
          !clientIds.includes(callInitiationDetail.clientId)
        ) {
          clientIds.push(callInitiationDetail.clientId);
        }

        if (
          callInitiationDetail.callFromId &&
          !callFromIds.includes(callInitiationDetail.callFromId)
        ) {
          callFromIds.push(callInitiationDetail.callFromId);
        }

        if (
          callInitiationDetail.dispositionId &&
          !dispositionIds.includes(callInitiationDetail.dispositionId)
        ) {
          dispositionIds.push(callInitiationDetail.dispositionId);
        }

        if (
          callInitiationDetail.caseId &&
          !caseIds.includes(callInitiationDetail.caseId)
        ) {
          caseIds.push(callInitiationDetail.caseId);
        }
      }

      const getMasterDetails: any = await axios.post(
        `${masterService}/${endpointMaster.callInitiation.getExportData}`,
        {
          subjectIds: subjectIds,
          clientIds: clientIds,
          callFromIds: callFromIds,
          dispositionIds: dispositionIds,
        }
      );

      let subjectDetails = [];
      let clientDetails = [];
      let callFromDetails = [];
      let dispositionDetails = [];
      if (getMasterDetails && getMasterDetails.data.success) {
        subjectDetails = getMasterDetails.data.data.subjectDetails;
        clientDetails = getMasterDetails.data.data.clientDetails;
        callFromDetails = getMasterDetails.data.data.callFromDetails;
        dispositionDetails = getMasterDetails.data.data.dispositionDetails;
      }

      let caseDetails: any = [];
      if (caseIds.length > 0) {
        caseDetails = await CaseDetails.findAll({
          attributes: ["id", "caseNumber"],
          where: {
            id: { [Op.in]: caseIds },
          },
        });
      }

      let callInitiationArray = [];
      for (const callInitiationDetail of callInitiationDetails) {
        const subjectData = subjectDetails.find(
          (subjectDetail: any) =>
            subjectDetail.id == callInitiationDetail.subjectId
        );

        const clientData = clientDetails.find(
          (clientDetail: any) =>
            clientDetail.id == callInitiationDetail.clientId
        );

        const callFromData = callFromDetails.find(
          (callFromDetail: any) =>
            callFromDetail.id == callInitiationDetail.callFromId
        );

        const dispositionData = dispositionDetails.find(
          (dispositionDetail: any) =>
            dispositionDetail.id == callInitiationDetail.dispositionId
        );

        const caseData = caseDetails.find(
          (caseDetail: any) => caseDetail.id == callInitiationDetail.caseId
        );

        callInitiationArray.push({
          Subject: subjectData ? subjectData.name : "",
          Client: clientData ? clientData.name : "",
          "Contact Name": callInitiationDetail.contactName,
          "Mobile Number": callInitiationDetail.mobileNumber,
          "Call From": callFromData ? callFromData.name : "",
          Disposition: dispositionData ? dispositionData.name : "",
          Remarks: callInitiationDetail.remarks,
          "Case Number": caseData ? caseData.caseNumber : "",
          "Created At": moment
            .tz(callInitiationDetail.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
        });
      }

      const callInitiationColumnNames = callInitiationArray
        ? Object.keys(callInitiationArray[0])
        : [];

      let buffer;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          callInitiationArray,
          callInitiationColumnNames,
          format,
          "Call Initiation Details"
        );
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          callInitiationArray,
          callInitiationColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Call initiation data export successfully",
        data: buffer,
        format: format,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default callInitiationController;
