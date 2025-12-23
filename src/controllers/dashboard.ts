import { Request, Response } from "express";
const config = require("../config/config.json");
import axios from "axios";
import { Op } from "sequelize";
import {
  Activities,
  ActivityAspDetails,
  CaseDetails,
  CaseInformation,
} from "../database/models";
import sequelize from "../database/connection";

const defaultLimit = 10;
const defaultOffset = 0;

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

export namespace dashboardController {
  export async function agentOnGoingCases(req: Request, res: Response) {
    try {
      const payload = req.body;
      const userId = payload.authUserData.id;
      const agentLevelId = payload.authUserData.levelId;

      const caseDetailWhere: any = {};
      caseDetailWhere.statusId = {
        [Op.in]: [1, 2], //1-Open, 2- In Progress
      };

      if (agentLevelId == 1045) {
        //L1 AGENT
        caseDetailWhere.l1AgentId = userId;
      } else if (agentLevelId == 1046) {
        //L2 AGENT
        caseDetailWhere.agentId = userId;
      } else if (agentLevelId == 1047) {
        //L1 & L2 AGENT
        caseDetailWhere[Op.or] = [{ l1AgentId: userId }, { agentId: userId }];
      }

      if (payload.startDate && payload.endDate) {
        caseDetailWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            ">=",
            payload.startDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            "<=",
            payload.endDate
          ),
        ];
      }

      // Limitation value setup
      let limitValue: number = defaultLimit;

      if (payload.limit) {
        const parsedLimit = parseInt(payload.limit as string);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = defaultOffset;

      if (payload.offset) {
        const parsedOffset = parseInt(payload.offset as string);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const caseDetails = await CaseDetails.findAll({
        attributes: [
          "id",
          "caseNumber",
          "registrationNumber",
          "subjectID",
          "statusId",
          "createdAt",
        ],
        where: caseDetailWhere,
        include: {
          model: CaseInformation,
          attributes: [
            "id",
            "customerContactName",
            "caseTypeId",
            "serviceId",
            "policyTypeId",
            "channelId",
            "voiceOfCustomer",
          ],
          required: true,
        },
        limit: limitValue,
        offset: offsetValue,
        order: [["id", "asc"]],
      });

      if (caseDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      //GET MASTER DETAILS
      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.dashboard.getAgentOnGoingCaseMasterDetails}`,
        {
          caseDetails: caseDetails,
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

  export async function agentServiceCount(req: Request, res: Response) {
    try {
      const payload = req.body;
      const userId = payload.authUserData.id;
      const agentLevelId = payload.authUserData.levelId;

      const caseDetailWhere: any = {};
      if (agentLevelId == 1045) {
        //L1 AGENT
        caseDetailWhere.l1AgentId = userId;
      } else if (agentLevelId == 1046) {
        //L2 AGENT
        caseDetailWhere.agentId = userId;
      } else if (agentLevelId == 1047) {
        //L1 & L2 AGENT
        caseDetailWhere[Op.or] = [{ l1AgentId: userId }, { agentId: userId }];
      }

      if (payload.startDate && payload.endDate) {
        caseDetailWhere[Op.and] = [
          sequelize.where(
            sequelize.fn(
              "DATE",
              sequelize.col("activity.caseDetail.createdAt")
            ),
            ">=",
            payload.startDate
          ),
          sequelize.where(
            sequelize.fn(
              "DATE",
              sequelize.col("activity.caseDetail.createdAt")
            ),
            "<=",
            payload.endDate
          ),
        ];
      }

      const activityAspDetails: any = await ActivityAspDetails.findAll({
        attributes: ["id", "subServiceId"],
        include: [
          {
            model: Activities,
            attributes: ["id"],
            required: true,
            include: [
              {
                model: CaseDetails,
                attributes: ["id"],
                where: caseDetailWhere,
                required: true,
              },
            ],
          },
        ],
      });

      let services = [];
      if (activityAspDetails.length > 0) {
        const uniqueSubServiceIds = [
          ...new Set(
            activityAspDetails.map(
              (activityAspDetail: any) => activityAspDetail.subServiceId
            )
          ),
        ];

        const getMasterDetail = await axios.post(
          `${masterService}/${endpointMaster.dashboard.getAgentServiceCountMasterDetails}`,
          {
            subServiceIds: uniqueSubServiceIds,
          }
        );

        let serviceMasterDetails = [];
        let subServiceMasterDetails = [];
        if (getMasterDetail.data.success) {
          serviceMasterDetails = getMasterDetail.data.data.services;
          subServiceMasterDetails = getMasterDetail.data.data.subServices;
        }

        for (const activityAspDetail of activityAspDetails) {
          const activityAspDetailSubService = subServiceMasterDetails.find(
            (subServiceMasterDetail: any) =>
              subServiceMasterDetail.id === activityAspDetail.subServiceId
          );

          activityAspDetail.serviceId = activityAspDetailSubService
            ? activityAspDetailSubService.serviceId
            : null;
        }

        for (const serviceMasterDetail of serviceMasterDetails) {
          const serviceCount = activityAspDetails.filter(
            (activityAspDetail: any) =>
              activityAspDetail.serviceId === serviceMasterDetail.id
          ).length;

          services.push({
            name: `${serviceMasterDetail.name} Service`,
            count: serviceCount,
          });
        }
      }

      let totalServices = services.reduce(
        (sum: any, obj: any) => sum + obj.count,
        0
      );
      return res.status(200).json({
        success: true,
        totalServices: totalServices,
        services: services,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default dashboardController;
