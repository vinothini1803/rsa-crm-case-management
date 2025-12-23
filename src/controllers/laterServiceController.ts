import axios from "axios";
const { Op } = require("sequelize");

import { caseInfoController } from "./caseInfoController";
import {
  Activities,
  ActivityAspDetails,
  AutoAssignmentCase,
  CaseDetails,
  CaseInformation,
} from "../database/models/index";

import * as config from "../config/config.json";

const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

export const laterServiceProcess = async (req: any, res: any) => {
  try {
    let laterServices: any = await AutoAssignmentCase.findAll({
      where: {
        cronStatus: 0, //NOT PROCESSED
      },
      include: [
        {
          model: CaseDetails,
          required: true,
          attributes: ["id", "clientId", "agentId", "agentAssignedAt"],
          include: [
            {
              model: CaseInformation,
              required: true,
              attributes: [
                "breakdownAreaId",
                "contactLanguageId",
                "breakdownLat",
                "breakdownLong",
              ],
            },
          ],
        },
        {
          model: Activities,
          required: true,
          attributes: [
            "activityStatusId",
            "serviceInitiatingAt",
            "aspAutoAllocation",
          ],
          where: { serviceInitiatingAt: { [Op.lte]: new Date() } },
          include: [
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["subServiceId", "aspId"],
            },
          ],
        },
      ],
    });

    if (laterServices.length == 0) {
      return res.status(200).json({
        success: false,
        error: "No later service found",
      });
    }

    for (let laterService of laterServices) {
      await AutoAssignmentCase.update(
        { cronStatus: 1 }, // PROCESSING
        { where: { id: laterService.id } }
      );

      const caseExists = await CaseDetails.findOne({
        attributes: ["agentId", "agentAssignedAt"],
        where: { id: laterService.caseDetail.id },
      });
      if (!caseExists) {
        await AutoAssignmentCase.update(
          {
            autoAssignResponse: "Case not found",
            cronStatus: 2, //PROCESSED
          },
          { where: { id: laterService.id } }
        );
        continue;
      }

      let agentResult: any;
      // IF AGENT IS NOT ASSIGNED
      if (
        !caseExists.dataValues.agentId &&
        !caseExists.dataValues.agentAssignedAt
      ) {
        agentResult = await caseInfoController.agentAutoAllocation({
          caseDetailId: laterService.caseDetail.id,
          languageId: laterService.caseDetail.caseInformation.contactLanguageId,
          clientId: laterService.caseDetail.clientId,
          breakDownId: laterService.caseDetail.caseInformation.breakdownAreaId,
        });
        if (agentResult.success) {
          await caseInfoController.agentActivityUpdate(
            agentResult,
            laterService.caseDetail.id
          );
        } else if (!agentResult.success) {
          await AutoAssignmentCase.update(
            {
              autoAssignResponse: agentResult.message,
              cronStatus: 2, //PROCESSED
            },
            { where: { id: laterService.id } }
          );
        }
      }

      // AGENT IS ASSIGNED AND ASP AUTO ALLOCATION IS ON AND ASP NOT ASSIGNED
      if (
        laterService.activity.aspAutoAllocation == 1 &&
        !laterService.activity.activityAspDetail.aspId &&
        ((caseExists.dataValues.agentId &&
          caseExists.dataValues.agentAssignedAt) ||
          agentResult.success)
      ) {
        let subServiceMaster: any = await axios.post(
          `${masterService}/${endpointMaster.getMasterDetails}`,
          { subServiceId: laterService.activity.activityAspDetail.subServiceId }
        );
        if (
          subServiceMaster.data &&
          subServiceMaster.data.success &&
          subServiceMaster?.data?.data?.subService?.serviceId
        ) {
          let aspResult: any = await caseInfoController.aspAutoAllocation({
            caseDetailId: laterService.caseDetailId,
            breakdownAreaId:
              laterService.caseDetail.caseInformation.breakdownAreaId,
            latitude: laterService.caseDetail.caseInformation.breakdownLat,
            longitude: laterService.caseDetail.caseInformation.breakdownLong,
            activityStatusId: laterService.activity.activityStatusId,
            serviceId: subServiceMaster.data.data.subService.serviceId,
            subServiceId: laterService.activity.activityAspDetail.subServiceId,
            activityId: laterService.activityId,
            agentId: caseExists.dataValues.agentId
              ? caseExists.dataValues.agentId
              : agentResult?.message?.agentId || null,
          });
          // console.log('aspResult', aspResult);
          if (aspResult.success) {
            await AutoAssignmentCase.destroy({
              where: { id: laterService.id },
            });
          } else if (!aspResult.success) {
            await AutoAssignmentCase.update(
              {
                autoAssignResponse: aspResult.message,
                cronStatus: 2, //PROCESSED
              },
              { where: { id: laterService.id } }
            );
          }
        }
      } else {
        await AutoAssignmentCase.update(
          { cronStatus: 2 }, //PROCESSED
          { where: { id: laterService.id } }
        );
      }
    }
    return res.status(200).json({
      success: true,
      message: "Processed Later Services Successfully",
    });
  } catch (error: any) {
    // console.log('error while processing later services', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
