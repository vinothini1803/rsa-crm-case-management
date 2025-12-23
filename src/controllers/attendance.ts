import { Request, Response } from "express";
import { sendNotificationToEndUser } from "../services/notification";
import {
  Activities,
  ActivityAspDetails,
  CaseDetails,
} from "../database/models";
const config = require("../config/config.json");
import axios from "axios";
import { Op } from "sequelize";

export namespace attendanceController {
  //API with endpoint (Master);
  const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
  const endpointMaster = config.MasterService.endpoint;

  export async function processNotification(req: Request, res: Response) {
    try {
      const payload = req.body;
      for (let notificationDetail of payload.notificationDetails) {
        await sendNotificationToEndUser({
          title: notificationDetail.title,
          body: notificationDetail.body,
          to: notificationDetail.to,
          userId: notificationDetail.userId,
        });
      }

      return res.status(200).json({
        success: true,
        data: "Notification processed successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //USED FOR AUTO END SHIFT PURPOSE
  export async function getInprogress(req: Request, res: Response) {
    try {
      const payload = req.body;
      let aspMechanicInprogressAttendanceLogIds = [];
      if (payload.normalShiftAspMechanics.length > 0) {
        const aspMechanicIds = payload.normalShiftAspMechanics.map(
          (normalShiftAspMechanic: any) => normalShiftAspMechanic.aspMechanicId
        );
        const uniqueAspMechanicIds = Array.from(new Set(aspMechanicIds));

        const aspMechanicActivityAspDetails: any =
          await ActivityAspDetails.findAll({
            attributes: ["id", "aspMechanicId"],
            where: {
              aspMechanicId: {
                [Op.in]: uniqueAspMechanicIds,
              },
            },
            group: ["aspMechanicId"],
            include: [
              {
                model: Activities,
                attributes: ["id"],
                required: true,
                where: {
                  activityStatusId: 3, //In Progress
                },
                include: [
                  {
                    model: CaseDetails,
                    attributes: ["id"],
                    required: true,
                    where: {
                      statusId: 2, //In Progress
                    },
                  },
                ],
              },
            ],
          });

        if (aspMechanicActivityAspDetails.length > 0) {
          //GET INPROGRESS ASP MECHANIC IDS FROM ACTIVITY
          const inProgressAspMechanicIds = aspMechanicActivityAspDetails.map(
            (aspMechanicActivityAspDetail: any) =>
              aspMechanicActivityAspDetail.aspMechanicId
          );

          //CHECK INPROGRESS ASP MECHANIC IDS EXISTS IN THE NORMAL SHIFT ASP MECHANICS AND RETURNS THEIR ATTENDANCE LOG ID IF EXISTS
          aspMechanicInprogressAttendanceLogIds =
            payload.normalShiftAspMechanics
              .filter((filterNormalShiftAspMechanic: any) =>
                inProgressAspMechanicIds.includes(
                  filterNormalShiftAspMechanic.aspMechanicId
                )
              )
              .map(
                (filteredNormalShiftAspMechanic: any) =>
                  filteredNormalShiftAspMechanic.attendanceLogId
              );
        }
      }

      let ownPatrolVehicleInprogressAttendanceLogIds = [];
      if (payload.normalShiftOwnPatrolVehicleHelpers.length > 0) {
        const ownPatrolVehicleIds =
          payload.normalShiftOwnPatrolVehicleHelpers.map(
            (normalShiftOwnPatrolVehicleHelper: any) =>
              normalShiftOwnPatrolVehicleHelper.vehicleId
          );
        const uniqueOwnPatrolVehicleIds = Array.from(
          new Set(ownPatrolVehicleIds)
        );

        //GET OWN PATROL VEHICLE MASTER LEVEL DETAILS
        const ownPatrolVehicleDetailResponse = await axios.post(
          `${masterService}/${endpointMaster.ownPatrolVehicle.getByIds}`,
          {
            ids: uniqueOwnPatrolVehicleIds,
          }
        );
        if (!ownPatrolVehicleDetailResponse.data.success) {
          return res.status(200).json(ownPatrolVehicleDetailResponse.data);
        }

        const ownPatrolVehicleDetails =
          ownPatrolVehicleDetailResponse.data.data;
        const ownPatrolVehicleRegistrationNumbers = ownPatrolVehicleDetails.map(
          (ownPatrolVehicleDetail: any) =>
            ownPatrolVehicleDetail.vehicleRegistrationNumber
        );

        const activityAspDetails: any = await ActivityAspDetails.findAll({
          attributes: ["id", "aspVehicleRegistrationNumber"],
          where: {
            aspVehicleRegistrationNumber: {
              [Op.in]: ownPatrolVehicleRegistrationNumbers,
            },
          },
          group: ["aspVehicleRegistrationNumber"],
          include: [
            {
              model: Activities,
              attributes: ["id"],
              required: true,
              where: {
                activityStatusId: 3, //In Progress
              },
              include: [
                {
                  model: CaseDetails,
                  attributes: ["id"],
                  required: true,
                  where: {
                    statusId: 2, //In Progress
                  },
                },
              ],
            },
          ],
        });

        if (activityAspDetails.length > 0) {
          //GET INPROGRESS COCO VEHICLE NUMBERS FROM ACTIVITY
          const inProgressOwnPatrolVehicleNumbers = activityAspDetails.map(
            (activityAspDetail: any) =>
              activityAspDetail.aspVehicleRegistrationNumber
          );

          //GET INPROGRESS COCO VEHICLE IDS FROM COCO VEHICLE MASTER
          const inProgressOwnPatrolVehicleIds = ownPatrolVehicleDetails
            .filter((filterOwnPatrolVehicleDetail: any) =>
              inProgressOwnPatrolVehicleNumbers.includes(
                filterOwnPatrolVehicleDetail.vehicleRegistrationNumber
              )
            )
            .map(
              (filteredOwnPatrolVehicleDetail: any) =>
                filteredOwnPatrolVehicleDetail.id
            );

          if (inProgressOwnPatrolVehicleIds.length > 0) {
            //CHECK INPROGRESS COCO VEHICLE IDS EXISTS IN THE NORMAL SHIFT COCO VEHICLES AND RETURNS THEIR ATTENDANCE LOG ID IF EXISTS
            ownPatrolVehicleInprogressAttendanceLogIds =
              payload.normalShiftOwnPatrolVehicleHelpers
                .filter((filterNormalShiftOwnPatrolVehicleHelper: any) =>
                  inProgressOwnPatrolVehicleIds.includes(
                    filterNormalShiftOwnPatrolVehicleHelper.vehicleId
                  )
                )
                .map(
                  (filteredNormalShiftOwnPatrolVehicleHelper: any) =>
                    filteredNormalShiftOwnPatrolVehicleHelper.attendanceLogId
                );
          }
        }
      }

      const inProgressAttendanceLogIds =
        aspMechanicInprogressAttendanceLogIds.concat(
          ownPatrolVehicleInprogressAttendanceLogIds
        );

      return res.status(200).json({
        success: true,
        data: inProgressAttendanceLogIds,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function validateVehicleChange(req: Request, res: Response) {
    try {
      const { aspId, aspMechanicId } = req.validBody;
      const aspHasInprogressActivity: any = await ActivityAspDetails.findOne({
        attributes: ["id", "activityId"],
        where: {
          aspId: aspId,
          aspMechanicId: aspMechanicId,
        },
        include: [
          {
            model: Activities,
            required: true,
            attributes: ["id", "caseDetailId"],
            where: {
              activityStatusId: {
                [Op.in]: [3, 9, 10, 14], //3-INPROGESS, 9-WAITING FOR DEALER APPROVAL. 10-ADVANCE PAYMENT PAID, 14-ADVANCE PAY LATER
              },
            },
            include: [
              {
                model: CaseDetails,
                required: true,
                where: {
                  statusId: 2, //INPROGRESS
                },
              },
            ],
          },
        ],
      });

      if (aspHasInprogressActivity) {
        return res.status(200).json({
          success: false,
          error: "Vehicle change is not allowed while the case is in progress.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Validated Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default attendanceController;
