import { Request, Response } from "express";
import { ActivityAspLiveLocations, Activities, CaseDetails, ActivityAspDetails } from "../database/models/index";
import moment from "moment-timezone";
import { Op } from "sequelize";
import Utils from "../lib/utils";

export namespace activityAspLiveLocations {
  export async function createActivityAspLiveLocations(
    req: Request,
    res: Response
  ) {
    try {
      const inData = req.validBody;
      const activityExists = await Activities.findOne({
        where: {
          id: inData.activityId,
          activityStatusId: {
            [Op.notIn]: [4, 8], // 4) Cancelled, 8) Rejected
          }
        },
        include: [
          {
            model: CaseDetails,
            attributes: ["id"],
            required: true,
            where: {
              statusId: 2, // INPROGRESS
            },
          },
          {
            model: ActivityAspDetails,
            attributes: ["id"],
            required: true,
            where: {
              aspId: inData.aspId,
            },
          },
        ],
      });
      if (!activityExists) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }
      const activityAspLiveLocation = await ActivityAspLiveLocations.findOne({
        where: {
          ...inData,
        },
      });

      // Fetch location from lat/lng if provided
      inData.location = null;
      if (inData.latitude && inData.longitude) {
        inData.location = await Utils.getLocationFromLatLng(inData.latitude, inData.longitude);
      }

      if (!activityAspLiveLocation) {
        await ActivityAspLiveLocations.create(inData);
      }
      return res.status(200).json({
        success: true,
        message: "Location updated successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function GetActivityAspLiveLocation(
    req: Request,
    res: Response
  ) {
    try {
      const { activityId, aspId } = req.validBody;
      const allLiveLocations = await ActivityAspLiveLocations.findAll({
        where: {
          activityId: activityId,
          aspId: aspId,
        },
        attributes: ["id", "latitude", "longitude"],
        order: [["id", "asc"]],
      });
      if (allLiveLocations.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Locations not found",
        });
      }
      const recentLiveLocation: any = await ActivityAspLiveLocations.findOne({
        where: {
          activityId: activityId,
          aspId: aspId,
        },
        order: [["id", "desc"]],
      });
      if (!recentLiveLocation) {
        return res.status(200).json({
          success: false,
          message: "Location not found",
        });
      }
      const data = {
        activityId: activityId,
        aspId: aspId,
        recentLiveLocation: {
          id: recentLiveLocation.dataValues.id,
          latitude: recentLiveLocation.dataValues.latitude,
          longitude: recentLiveLocation.dataValues.longitude,
          createdAt: moment
            .tz(recentLiveLocation.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          updatedAt: recentLiveLocation.dataValues.updatedAt
            ? moment
              .tz(recentLiveLocation.dataValues.updatedAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A")
            : null,
        },
        allLiveLocations: allLiveLocations,
      };
      return res.status(200).json({
        success: true,
        message: "Data Fetch Successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default activityAspLiveLocations;
