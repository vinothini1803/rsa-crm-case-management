import { Request, Response } from "express";
import {
  Activities,
  ActivityAspDetails,
  ActivityCharges,
  ActivityLogs,
  CaseDetails,
  CaseInformation,
} from "../database/models";
import { Op, Sequelize } from "sequelize";
import sequelize from "../database/connection";
import moment from "moment-timezone";
const config = require("../config/config.json");
import axios from "axios";
import Utils from "../lib/utils";

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

export namespace managerController {
  //USED IN ATTENDANCE DETAIL API
  export async function getTechnicianTotalRequests(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;

      for (let activeDetail of payload.activeDetails) {
        const activities: any = await Activities.findAll({
          attributes: ["id"],
          where: {
            activityStatusId: {
              [Op.in]: [2, 3, 4, 7, 8, 9, 10, 11, 12, 14], // 2-Assigned, 3-In Progress, 4-Cancelled, 7-Successful, 8-Rejected, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later
            },
          },
          include: [
            {
              model: ActivityAspDetails,
              required: true,
              attributes: ["id"],
              where: {
                aspMechanicId: activeDetail.technicianId,
              },
            },
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                [Op.and]: [
                  sequelize.where(
                    sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
                    payload.date
                  ),
                ],
                rmId: {
                  [Op.in]: payload.rmIds,
                },
                statusId: {
                  [Op.notIn]: [3], // NOT CANCELLED
                },
              },
            },
          ],
        });

        activeDetail.totalRequests = activities.length;
      }

      return res.status(200).json({
        success: true,
        data: payload,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspMechanicRequestDetail(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      //REQUEST DETAILS
      const activityAspDetailWhere = {
        aspMechanicId: payload.aspMechanicId,
      };

      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };
      if (payload.date) {
        caseWhere.createdAt = {
          [Op.between]: [
            payload.date + " 00:00:00",
            payload.date + " 23:59:59",
          ],
        };
      }

      //GET ACCEPTED, REJECTED, AND CANCELED REQUEST COUNT
      const getRequestDetailResponse = await getRequestDetails(
        activityAspDetailWhere,
        "aspMechanicId",
        caseWhere
      );
      if (!getRequestDetailResponse.success) {
        return res.status(200).json(getRequestDetailResponse);
      }

      //SLA PERFORMANCE DETAILS
      const activities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "createdAt",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: [
              "id",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: caseWhere,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id"],
            where: activityAspDetailWhere,
          },
        ],
      });

      //GET BREAKDOWN CITY SLA & SUB SERVICE DETAILS
      const getMasterDetailResponse = await getMasterDetails(activities, []);
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;

      const slaResponse = await getSlaPerformanceDetails(
        activities,
        payload.exceededExpectationSlaMins,
        rsaSlaDetails
      );
      if (!slaResponse.success) {
        return res.status(200).json(slaResponse);
      }
      const { slaActivities, ...slaData }: any = slaResponse.data;

      const data = {
        ...getRequestDetailResponse.data,
        ...slaData,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getCaseCount(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
        agentId: {
          [Op.ne]: null,
        },
      };

      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere.createdAt = {
          [Op.between]: [
            formattedStartDate + " 00:00:00",
            formattedEndDate + " 23:59:59",
          ],
        };
      }

      const caseDetails: any = await CaseDetails.findAll({
        attributes: ["id", "typeId", "statusId"],
        where: caseWhere,
        include: [
          {
            model: CaseInformation,
            attributes: ["id", "irateCustomer", "womenAssist"],
          },
        ],
      });
      const caseIds = caseDetails.map((caseDetail: any) => caseDetail.id);

      const activityAspDetails: any = await ActivityAspDetails.findAll({
        attributes: ["id", "subServiceId", "aspId", "activityId"],
        include: {
          model: Activities,
          required: true,
          attributes: [
            "id",
            "caseDetailId",
            "activityStatusId",
            "activityAppStatusId",
          ],
          where: {
            caseDetailId: {
              [Op.in]: caseIds,
            },
          },
        },
      });

      const allActivityIds = activityAspDetails.map(
        (activityAspDetail: any) => activityAspDetail.activity.id
      );

      const activityLogs: any = await ActivityLogs.findAll({
        attributes: ["id", "activityId", "actionTypeId"],
        where: {
          activityId: {
            [Op.in]: allActivityIds,
          },
          typeId: 241, // Mobile Case
          actionTypeId: {
            [Op.in]: [1010, 1011, 1013], //Activity Accept, Activity start to pickup, Activity start to breakdown
          },
        },
      });

      let aspUnassigned = 0,
        inProgress = 0,
        financialEntryPending = 0,
        irateCustomer = 0,
        womenAssist = 0,
        delayed = 0,
        vehicleToBeDropped = 0,
        mobileAppCount = 0;

      for (let caseDetail of caseDetails) {
        const relevantCaseActivityAspDetails = activityAspDetails.filter(
          (activityAspDetail: any) =>
            activityAspDetail.activity.caseDetailId === caseDetail.id
        );

        //CASE DOES NOT HAVE ACTIVITY
        if (relevantCaseActivityAspDetails.length == 0) {
          aspUnassigned++;
        }

        const subServiceIds = [
          ...new Set(
            relevantCaseActivityAspDetails.map(
              (relevantCaseActivityAspDetail: any) =>
                relevantCaseActivityAspDetail.subServiceId
            )
          ),
        ];

        for (const subServiceId of subServiceIds) {
          const subServiceAspActivities = relevantCaseActivityAspDetails.filter(
            (relevantActivityAspDetail: any) =>
              relevantActivityAspDetail.subServiceId === subServiceId
          );

          // DOES NOT HAVE ASSIGNED ASP WITH POSITIVE FLOW
          if (
            !subServiceAspActivities.some(
              (subServiceAspActivity: any) =>
                subServiceAspActivity.aspId &&
                ![1, 4, 8].includes(
                  subServiceAspActivity.activity.activityStatusId //1-OPEN, 4-CANCELED, 8-REJECTED
                )
            )
          ) {
            aspUnassigned++;
          }

          // Activity status is inProgress then take count
          if (
            subServiceAspActivities.some(
              (subServiceAspActivity: any) =>
                subServiceAspActivity.activity.activityStatusId === 3 // In Progress
            )
          ) {
            inProgress++;
          }

          //Need to work on end service logic for RSA CRM
          // Case status is inProgress and activity status  will be any one of Successful/Balance Payment Pending/Excess Amount Credit Pending then take count
          // Case status is inProgress and activity status will be In Progress and activity app status will be any one Started To Garage/Reached Garage/Activity Ended then take count
          const isFinancialEntryPending = subServiceAspActivities.some(
            (subServiceAspActivity: any) =>
              caseDetail.statusId === 2 &&
              ([7, 11, 12].includes(
                subServiceAspActivity.activity.activityStatusId
              ) ||
                (subServiceAspActivity.activity.activityStatusId === 3 &&
                  [17, 18, 19].includes(
                    subServiceAspActivity.activity.activityAppStatusId
                  )))
          );
          if (isFinancialEntryPending) {
            financialEntryPending++;
          }

          //Mobile App Case
          const activeSubServiceActivityId = subServiceAspActivities.find(
            (subServiceAspActivity: any) =>
              ![4, 8].includes(subServiceAspActivity.activity.activityStatusId) //CANCELED, REJECTED
          )?.activity.id;

          const acceptedActivityLog = activityLogs.find(
            (activityLog: any) =>
              activityLog.dataValues.activityId == activeSubServiceActivityId &&
              activityLog.dataValues.actionTypeId == 1010 //Activity Accept
          );
          //RSA
          if (caseDetail.typeId === 31) {
            const startedBdActivityLog = activityLogs.find(
              (activityLog: any) =>
                activityLog.dataValues.activityId ==
                activeSubServiceActivityId &&
                activityLog.dataValues.actionTypeId == 1013 //Activity start to breakdown
            );

            if (acceptedActivityLog && startedBdActivityLog) {
              mobileAppCount++;
            }
          } else {
            //VDM
            const startedPickupActivityLog = activityLogs.find(
              (activityLog: any) =>
                activityLog.dataValues.activityId ==
                activeSubServiceActivityId &&
                activityLog.dataValues.actionTypeId == 1011 //Activity start to pickup
            );

            if (acceptedActivityLog && startedPickupActivityLog) {
              mobileAppCount++;
            }
          }

          //RSA
          if (caseDetail.typeId === 31 && caseDetail.caseInformation) {
            if (caseDetail.caseInformation.irateCustomer) {
              irateCustomer++;
            }

            if (caseDetail.caseInformation.womenAssist) {
              womenAssist++;
            }
          }
        }
      }

      //SLA delayed count
      const activities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "aspStartedToDropAt",
          "aspReachedToDropAt",
          "activityStatusId",
          "createdAt",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            as: "caseDetail",
            required: true,
            attributes: [
              "id",
              "rmId",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: {
              id: {
                [Op.in]: caseIds,
              },
            },
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
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

      //Vehicle to be dropped
      const uniqueSubServiceIds = [
        ...new Set(
          activities.map(
            (activity: any) => activity.activityAspDetail.subServiceId
          )
        ),
      ];

      const getMasterDetailResponse = await getMasterDetails(
        activities, //IF RSA MEANS GET BREAKDOWN CITIES SLA DETAILS
        uniqueSubServiceIds //GET SUB SERVICE DETAILS
      );
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;
      const subServiceDetails = getMasterDetailResponse.data.subServiceDetails;
      const exceededExpectationSlaMins = getMasterDetailResponse.data
        .exceededExpectationSlaMins
        ? getMasterDetailResponse.data.exceededExpectationSlaMins.name
        : null;

      const slaResponse: any = await getSlaPerformanceDetails(
        activities,
        exceededExpectationSlaMins,
        rsaSlaDetails
      );
      if (!slaResponse.success) {
        return res.status(200).json(slaResponse);
      }

      //ASP BREAKDOWN REACH TIME NOT MET SLA COUNT
      delayed = slaResponse.data.slaNotAchievedCount;

      //Towing service started to drop but not reached to drop then take count
      for (const activity of activities) {
        const subServiceDetail = subServiceDetails.find(
          (subServiceDetail: any) =>
            subServiceDetail.subServiceId ==
            activity.activityAspDetail.subServiceId
        );

        //IF IT IS TOWING SERVICE & ASP STARTED TO DROP BUT NOT REACHED DROP YET
        if (
          subServiceDetail &&
          subServiceDetail.serviceId == 1 &&
          activity.aspStartedToDropAt &&
          !activity.aspReachedToDropAt
        ) {
          vehicleToBeDropped++;
        }
      }

      const totalCases =
        aspUnassigned +
        inProgress +
        financialEntryPending +
        irateCustomer +
        womenAssist +
        delayed +
        vehicleToBeDropped +
        mobileAppCount;

      const data = {
        totalCases,
        aspUnassigned,
        inProgress,
        financialEntryPending,
        irateCustomer,
        womenAssist,
        delayed,
        vehicleToBeDropped,
        mobileAppCount,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getCaseList(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
        agentId: {
          [Op.ne]: null,
        },
      };

      //DATE RANGE FILTER
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere.createdAt = {
          [Op.between]: [
            formattedStartDate + " 00:00:00",
            formattedEndDate + " 23:59:59",
          ],
        };
      }

      const caseDetails: any = await CaseDetails.findAll({
        attributes: [
          "id",
          "typeId",
          "agentId",
          "caseNumber",
          "registrationNumber",
          "vin",
          "vehicleMakeId",
          "vehicleModelId",
          "deliveryRequestPickUpCityId",
          "deliveryRequestDropCityId",
          "statusId",
          "deliveryRequestPickupDate",
          "deliveryRequestPickupTime",
        ],
        where: caseWhere,
        include: [
          {
            model: CaseInformation,
            attributes: [
              "id",
              "irateCustomer",
              "womenAssist",
              "breakdownAreaId",
            ],
          },
        ],
        order: [["id", "DESC"]],
      });
      const caseIds = caseDetails.map((caseDetail: any) => caseDetail.id);

      const activityAspDetails: any = await ActivityAspDetails.findAll({
        attributes: ["id", "subServiceId", "aspId", "activityId"],
        include: {
          model: Activities,
          required: true,
          attributes: [
            "id",
            "caseDetailId",
            "activityStatusId",
            "activityAppStatusId",
          ],
          where: {
            caseDetailId: {
              [Op.in]: caseIds,
            },
          },
        },
      });

      const allActivityIds = activityAspDetails.map(
        (activityAspDetail: any) => activityAspDetail.activity.id
      );

      const activityLogs: any = await ActivityLogs.findAll({
        attributes: ["id", "activityId", "actionTypeId"],
        where: {
          activityId: {
            [Op.in]: allActivityIds,
          },
          typeId: 241, // Mobile Case
          actionTypeId: {
            [Op.in]: [1010, 1011, 1013], //Activity Accept, Activity start to pickup, Activity start to breakdown
          },
        },
      });

      let caseLists = [];
      for (let caseDetail of caseDetails) {
        const relevantCaseActivityAspDetails = activityAspDetails.filter(
          (activityAspDetail: any) =>
            activityAspDetail.activity.caseDetailId === caseDetail.id
        );

        const subServiceIds = [
          ...new Set(
            relevantCaseActivityAspDetails.map(
              (relevantCaseActivityAspDetail: any) =>
                relevantCaseActivityAspDetail.subServiceId
            )
          ),
        ];

        //ASP UNASSIGNED CASES
        if (payload.type == 1) {
          //CASE DOES NOT HAVE ACTIVITY
          if (relevantCaseActivityAspDetails.length == 0) {
            const formCaseListDetailResponse: any = await formCaseListDetails(
              caseDetail,
              null
            );
            if (formCaseListDetailResponse.success) {
              caseLists.push(formCaseListDetailResponse.data);
            }
          }

          for (const subServiceId of subServiceIds) {
            const subServiceAspActivities =
              relevantCaseActivityAspDetails.filter(
                (relevantActivityAspDetail: any) =>
                  relevantActivityAspDetail.subServiceId === subServiceId
              );

            // DOES NOT HAVE ASSIGNED ASP WITH POSITIVE FLOW
            if (
              !subServiceAspActivities.some(
                (subServiceAspActivity: any) =>
                  subServiceAspActivity.aspId &&
                  ![1, 4, 8].includes(
                    subServiceAspActivity.activity.activityStatusId //1-OPEN, 4-CANCELED, 8-REJECTED
                  )
              )
            ) {
              const formCaseListDetailResponse: any = await formCaseListDetails(
                caseDetail,
                subServiceId
              );
              if (formCaseListDetailResponse.success) {
                caseLists.push(formCaseListDetailResponse.data);
              }
            }
          }
        }

        //IN PROGRESS
        if (payload.type == 3) {
          for (const subServiceId of subServiceIds) {
            const subServiceAspActivities =
              relevantCaseActivityAspDetails.filter(
                (relevantActivityAspDetail: any) =>
                  relevantActivityAspDetail.subServiceId === subServiceId
              );

            // Activity status is inProgress then take count
            if (
              subServiceAspActivities.some(
                (subServiceAspActivity: any) =>
                  subServiceAspActivity.activity.activityStatusId === 3 // In Progress
              )
            ) {
              const formCaseListDetailResponse: any = await formCaseListDetails(
                caseDetail,
                subServiceId
              );
              if (formCaseListDetailResponse.success) {
                caseLists.push(formCaseListDetailResponse.data);
              }
            }
          }
        }

        //FINANCIAL ENTRY PENDING
        if (payload.type == 4) {
          for (const subServiceId of subServiceIds) {
            const subServiceAspActivities =
              relevantCaseActivityAspDetails.filter(
                (relevantActivityAspDetail: any) =>
                  relevantActivityAspDetail.subServiceId === subServiceId
              );

            //Need to work on end service logic for RSA CRM
            // Case status is inProgress and activity status  will be any one of Successful/Balance Payment Pending/Excess Amount Credit Pending then take count
            // Case status is inProgress and activity status will be In Progress and activity app status will be any one Started To Garage/Reached Garage/Activity Ended then take count
            const isFinancialEntryPending = subServiceAspActivities.some(
              (subServiceAspActivity: any) =>
                caseDetail.statusId === 2 &&
                ([7, 11, 12].includes(
                  subServiceAspActivity.activity.activityStatusId
                ) ||
                  (subServiceAspActivity.activity.activityStatusId === 3 &&
                    [17, 18, 19].includes(
                      subServiceAspActivity.activity.activityAppStatusId
                    )))
            );
            if (isFinancialEntryPending) {
              const formCaseListDetailResponse: any = await formCaseListDetails(
                caseDetail,
                subServiceId
              );
              if (formCaseListDetailResponse.success) {
                caseLists.push(formCaseListDetailResponse.data);
              }
            }
          }
        }

        //MOBILE APP CASE
        if (payload.type == 5) {
          for (const subServiceId of subServiceIds) {
            const subServiceAspActivities =
              relevantCaseActivityAspDetails.filter(
                (relevantActivityAspDetail: any) =>
                  relevantActivityAspDetail.subServiceId === subServiceId
              );

            const activeSubServiceActivityId = subServiceAspActivities.find(
              (subServiceAspActivity: any) =>
                ![4, 8].includes(
                  subServiceAspActivity.activity.activityStatusId
                ) //CANCELED, REJECTED
            )?.activity.id;

            const acceptedActivityLog = activityLogs.find(
              (activityLog: any) =>
                activityLog.dataValues.activityId ==
                activeSubServiceActivityId &&
                activityLog.dataValues.actionTypeId == 1010 //Activity Accept
            );
            //RSA
            if (caseDetail.typeId === 31) {
              const startedBdActivityLog = activityLogs.find(
                (activityLog: any) =>
                  activityLog.dataValues.activityId ==
                  activeSubServiceActivityId &&
                  activityLog.dataValues.actionTypeId == 1013 //Activity start to breakdown
              );

              if (acceptedActivityLog && startedBdActivityLog) {
                const formCaseListDetailResponse: any =
                  await formCaseListDetails(caseDetail, subServiceId);
                if (formCaseListDetailResponse.success) {
                  caseLists.push(formCaseListDetailResponse.data);
                }
              }
            } else {
              //VDM
              const startedPickupActivityLog = activityLogs.find(
                (activityLog: any) =>
                  activityLog.dataValues.activityId ==
                  activeSubServiceActivityId &&
                  activityLog.dataValues.actionTypeId == 1011 //Activity start to pickup
              );

              if (acceptedActivityLog && startedPickupActivityLog) {
                const formCaseListDetailResponse: any =
                  await formCaseListDetails(caseDetail, subServiceId);
                if (formCaseListDetailResponse.success) {
                  caseLists.push(formCaseListDetailResponse.data);
                }
              }
            }
          }
        }

        //RSA
        if (caseDetail.typeId === 31) {
          //IRATE CUSTOMER AND WOMEN ASSIST
          if (
            (payload.type == 7 || payload.type == 8) &&
            caseDetail.caseInformation &&
            (caseDetail.caseInformation.irateCustomer ||
              caseDetail.caseInformation.womenAssist)
          ) {
            for (const subServiceId of subServiceIds) {
              if (
                payload.type == 7 &&
                caseDetail.caseInformation.irateCustomer
              ) {
                const formCaseListDetailResponse: any =
                  await formCaseListDetails(caseDetail, subServiceId);
                if (formCaseListDetailResponse.success) {
                  caseLists.push(formCaseListDetailResponse.data);
                }
              }
              if (payload.type == 8 && caseDetail.caseInformation.womenAssist) {
                const formCaseListDetailResponse: any =
                  await formCaseListDetails(caseDetail, subServiceId);
                if (formCaseListDetailResponse.success) {
                  caseLists.push(formCaseListDetailResponse.data);
                }
              }
            }
          }
        }
      }

      //DELAYED OR VEHICLE TO BE DROPPED
      if (payload.type == 2 || payload.type == 9) {
        const activities: any = await Activities.findAll({
          attributes: [
            "id",
            "isInitiallyCreated",
            "isImmediateService",
            "serviceInitiatingAt",
            "aspReachedToPickupAt",
            "aspReachedToBreakdownAt",
            "activityStatusId",
            "aspStartedToDropAt",
            "aspReachedToDropAt",
            "createdAt",
          ],
          where: {
            activityStatusId: {
              [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
            },
          },
          include: [
            {
              model: CaseDetails,
              as: "caseDetail",
              required: true,
              attributes: [
                "id",
                "caseNumber",
                "registrationNumber",
                "vin",
                "vehicleMakeId",
                "vehicleModelId",
                "rmId",
                "typeId",
                "deliveryRequestPickUpCityId",
                "deliveryRequestDropCityId",
                "deliveryRequestPickupDate",
                "deliveryRequestPickupTime",
                "createdAt",
              ],
              where: {
                id: {
                  [Op.in]: caseIds,
                },
              },
              include: [
                {
                  model: CaseInformation,
                  attributes: ["id", "breakdownAreaId"],
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

        //DELAYED - ASP BREAKDOWN REACH TIME NOT MET SLA
        if (payload.type == 2) {
          const getMasterDetailResponse = await getMasterDetails(
            activities, //IF RSA MEANS GET BREAKDOWN CITIES SLA DETAILS
            []
          );
          if (!getMasterDetailResponse.success) {
            return res.status(200).json(getMasterDetailResponse);
          }
          const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;
          const exceededExpectationSlaMins = getMasterDetailResponse.data
            .exceededExpectationSlaMins
            ? getMasterDetailResponse.data.exceededExpectationSlaMins.name
            : null;

          const slaResponse: any = await getSlaPerformanceDetails(
            activities,
            exceededExpectationSlaMins,
            rsaSlaDetails
          );
          if (!slaResponse.success) {
            return res.status(200).json(slaResponse);
          }

          const slaNotAchievedActivities =
            slaResponse.data.slaActivities.filter(
              (slaActivity: any) => slaActivity.slaNotAchieved == true
            );
          for (const slaNotAchievedActivity of slaNotAchievedActivities) {
            const formCaseListDetailResponse: any = await formCaseListDetails(
              slaNotAchievedActivity.caseDetail,
              slaNotAchievedActivity.activityAspDetail.subServiceId
            );
            if (formCaseListDetailResponse.success) {
              caseLists.push(formCaseListDetailResponse.data);
            }
          }
        }

        //VEHICLE TO BE DROPPED
        if (payload.type == 9) {
          const uniqueSubServiceIds = [
            ...new Set(
              activities.map(
                (activity: any) => activity.activityAspDetail.subServiceId
              )
            ),
          ];
          const getMasterDetailResponse = await getMasterDetails(
            [],
            uniqueSubServiceIds //GET SUB SERVICE DETAILS
          );
          if (!getMasterDetailResponse.success) {
            return res.status(200).json(getMasterDetailResponse);
          }
          const subServiceDetails =
            getMasterDetailResponse.data.subServiceDetails;

          //Towing service started to drop but not reached to drop then take count
          for (const activity of activities) {
            const subServiceDetail = subServiceDetails.find(
              (subServiceDetail: any) =>
                subServiceDetail.subServiceId ==
                activity.activityAspDetail.subServiceId
            );

            //IF IT IS TOWING SERVICE & ASP STARTED TO DROP BUT NOT REACHED DROP YET
            if (
              subServiceDetail &&
              subServiceDetail.serviceId == 1 &&
              activity.aspStartedToDropAt &&
              !activity.aspReachedToDropAt
            ) {
              const formCaseListDetailResponse: any = await formCaseListDetails(
                activity.caseDetail,
                activity.activityAspDetail.subServiceId
              );
              if (formCaseListDetailResponse.success) {
                caseLists.push(formCaseListDetailResponse.data);
              }
            }
          }
        }
      }

      let limitValue: number = 10;
      if (payload.limit) {
        limitValue = payload.limit;
      }

      let offsetValue: number = 0;
      if (payload.offset) {
        offsetValue = payload.offset;
      }

      let filteredCaseLists = caseLists;
      if (payload.search) {
        const searchKeyword = payload.search.toLowerCase();
        filteredCaseLists = caseLists.filter((searchCaseList: any) => {
          return searchCaseList.caseNumber
            .toLowerCase()
            .includes(searchKeyword);
        });
      }

      let caseListsWithLimitOffset = filteredCaseLists.slice(
        offsetValue,
        offsetValue + limitValue
      );
      if (caseListsWithLimitOffset.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          caseLists: caseListsWithLimitOffset,
          caseCount: filteredCaseLists.length,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getCaseListView(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseDetail: any = await CaseDetails.findOne({
        attributes: [
          "id",
          "typeId",
          "agentId",
          "caseNumber",
          "registrationNumber",
          "vin",
          "description",
          "vehicleTypeId",
          "vehicleMakeId",
          "vehicleModelId",
          "deliveryRequestPickUpLocation",
          "deliveryRequestDropLocation",
          "deliveryRequestPickupDate",
          "deliveryRequestPickupTime",
        ],
        where: {
          id: payload.caseDetailId,
        },
        include: {
          model: CaseInformation,
          attributes: [
            "id",
            "voiceOfCustomer",
            "breakdownLocation",
            "breakdownAreaId",
            "dropLocation",
            "irateCustomer",
            "womenAssist",
          ],
        },
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      let activities = null;
      let slaDetails = null;
      if (payload.subServiceId) {
        activities = await Activities.findAll({
          attributes: [
            "id",
            "isInitiallyCreated",
            "isImmediateService",
            "serviceInitiatingAt",
            "activityStatusId",
            "aspActivityStatusId",
            "aspServiceAcceptedAt",
            "aspServiceRejectedAt",
            "aspServiceCanceledAt",
            "aspReachedToPickupAt",
            "aspReachedToBreakdownAt",
            "createdAt",
          ],
          where: {
            caseDetailId: payload.caseDetailId,
          },
          include: [
            {
              model: CaseDetails,
              as: "caseDetail",
              required: true,
              attributes: [
                "id",
                "rmId",
                "typeId",
                "deliveryRequestPickupDate",
                "deliveryRequestPickupTime",
                "createdAt",
              ],
              include: [
                {
                  model: CaseInformation,
                  attributes: ["id", "breakdownAreaId"],
                },
              ],
            },
            {
              model: ActivityAspDetails,
              required: true,
              attributes: [
                "id",
                "aspId",
                "subServiceId",
                "estimatedServiceCost",
                "estimatedAdditionalCharge",
                "estimatedTotalAmount",
                "estimatedAspServiceCost",
                "estimatedAspTotalAmount",
                "actualServiceCost",
                "actualAdditionalCharge",
                "discountAmount",
                "actualClientWaitingCharge",
                "actualTotalAmount",
                "actualAspServiceCost",
                "actualAspWaitingCharge",
                "actualAspTotalAmount",
              ],
              where: {
                subServiceId: payload.subServiceId,
              },
            },
            {
              model: ActivityCharges,
              attributes: ["id", "typeId", "chargeId", "amount"],
            },
          ],
        });
        if (activities.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Activity details not found",
          });
        }

        //GET SLA DETAILS FOR ACCEPTED ACTIVITIES
        const acceptedSubServiceActivity = activities.filter(
          (activity: any) =>
            [2, 3, 7, 9, 10, 11, 12, 14].includes(activity.activityStatusId) //2-Assigned, 3-Inprogress, 7-Successful, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later
        );
        if (acceptedSubServiceActivity.length > 0) {
          const getMasterDetailResponse = await getMasterDetails(
            acceptedSubServiceActivity,
            []
          );
          if (!getMasterDetailResponse.success) {
            return res.status(200).json(getMasterDetailResponse);
          }
          const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;
          const exceededExpectationSlaMins = getMasterDetailResponse.data
            .exceededExpectationSlaMins
            ? getMasterDetailResponse.data.exceededExpectationSlaMins.name
            : null;

          const slaResponse = await getSlaPerformanceDetails(
            activities,
            exceededExpectationSlaMins,
            rsaSlaDetails
          );
          if (!slaResponse.success) {
            return res.status(200).json(slaResponse);
          }
          const { slaActivities, ...slaData }: any = slaResponse.data;
          slaDetails = slaData;
        }
      }

      let activityIds = [];
      if (activities && activities.length > 0) {
        activityIds = activities.map((activity: any) => activity.id);
      }
      const activityLogs = await ActivityLogs.findAll({
        where: {
          [Op.or]: [
            { caseDetailId: payload.caseDetailId },
            { activityId: activityIds },
          ],
        },
        attributes: {
          exclude: ["updatedById", "deletedById", "updatedAt", "deletedAt"],
        },
        order: [["id", "ASC"]],
      });

      return res.status(200).json({
        success: true,
        data: {
          caseDetail,
          activities,
          slaDetails,
          activityLogs,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspPerformanceCount(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      // Date range filter
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      //BASED ON ASP TYPE (COCO / THIRD PARTY) AND RM IDS WE GET ASP DETAILS
      const aspByAspTypeAndRmResponse: any = await axios.post(
        `${masterService}/${endpointMaster.manager.getAspByAspTypeAndRm}`,
        {
          aspType: payload.aspType,
          rmIds: payload.rmIds,
        }
      );
      if (!aspByAspTypeAndRmResponse.data.success) {
        return res.status(200).json(aspByAspTypeAndRmResponse.data);
      }
      const aspIds = aspByAspTypeAndRmResponse.data.data.map(
        (asp: any) => asp.id
      );

      const activities: any = await Activities.findAll({
        attributes: ["id", "activityStatusId"],
        where: {
          activityStatusId: {
            [Op.in]: [2, 3, 4, 7, 8, 9, 10, 11, 12, 14], // 2-Assigned, 3-In Progress, 4-Cancelled, 7-Successful, 8-Rejected, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later
          },
        },
        include: [
          {
            model: CaseDetails,
            as: "caseDetail",
            required: true,
            attributes: ["id", "rmId", "createdAt"],
            where: caseWhere,
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id"],
            where: {
              aspId: {
                [Op.in]: aspIds,
              },
            },
          },
        ],
      });

      const activityCounts = activities.reduce(
        (acc: any, activity: any) => {
          if (
            [2, 3, 7, 9, 10, 11, 12, 14].includes(activity.activityStatusId)
          ) {
            // Assigned,In Progress,Successful,Waiting for Dealer Approval,Advance Payment Paid,Balance Payment Pending,Excess Amount Credit Pending, Advance Pay Later
            acc.acceptedCount++;
          } else if (activity.activityStatusId == 8) {
            //Rejected
            acc.rejectedCount++;
          } else if (activity.activityStatusId == 4) {
            //Cancelled
            acc.cancelledCount++;
          }
          return acc;
        },
        {
          acceptedCount: 0,
          rejectedCount: 0,
          cancelledCount: 0,
        }
      );

      const totalCount =
        activityCounts.acceptedCount +
        activityCounts.rejectedCount +
        activityCounts.cancelledCount;

      return res.status(200).json({
        success: true,
        data: {
          totalCount,
          ...activityCounts,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspPerformanceList(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      //SEARCH IN ASP MASTER
      let searchedAspIds: any = [];
      if (payload.search) {
        const getAspSearchDetail = await axios.get(
          `${masterService}/${endpointMaster.asps.getAllAsp}?apiType=dropdown&search=${payload.search}&includeParanoidFalse=1`
        );
        if (!getAspSearchDetail.data.success) {
          return res.status(200).json(getAspSearchDetail.data);
        }
        searchedAspIds = getAspSearchDetail.data.data.map((asp: any) => asp.id);
      }

      //DATE RANGE FILTER
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      //BASED ON ASP TYPE (COCO / THIRD PARTY) AND RM IDS WE GET ASP DETAILS
      const aspByAspTypeAndRmResponse: any = await axios.post(
        `${masterService}/${endpointMaster.manager.getAspByAspTypeAndRm}`,
        {
          aspType: payload.aspType,
          rmIds: payload.rmIds,
        }
      );
      if (!aspByAspTypeAndRmResponse.data.success) {
        return res.status(200).json(aspByAspTypeAndRmResponse.data);
      }
      const aspTypeAndRmBaseAspIds = aspByAspTypeAndRmResponse.data.data.map(
        (asp: any) => asp.id
      );

      //IF SEARCH IS EXISTS, THE ASP IDS BASED ON SEARCH SHOULD BE EXISTS IN THE RM BASED IDS. OTHERWISE RM BASED ASP IDS ARE ENOUGH
      let aspIds = aspTypeAndRmBaseAspIds;
      if (searchedAspIds.length > 0) {
        aspIds = searchedAspIds.filter((searchedAspId: any) =>
          aspTypeAndRmBaseAspIds.includes(searchedAspId)
        );
      }

      const caseDetails: any = await CaseDetails.findAll({
        attributes: ["id"],
        where: caseWhere,
      });
      const caseIds = caseDetails.map((caseDetail: any) => caseDetail.id);

      const activityAspDetailBaseQuery: any = {
        where: {
          aspId: {
            [Op.in]: aspIds,
          },
        },
        attributes: [
          "id",
          "aspId",
          [
            Sequelize.literal(
              `SUM(CASE WHEN activityStatusId = 4 THEN 1 ELSE 0 END)`
            ),
            "cancelledCount",
          ],
          [
            Sequelize.literal(
              `SUM(CASE WHEN activityStatusId = 8 THEN 1 ELSE 0 END)`
            ),
            "rejectedCount",
          ],
          [
            Sequelize.literal(
              `SUM(CASE WHEN activityStatusId IN (2, 3, 7, 9, 10, 11, 12, 14) THEN 1 ELSE 0 END)`
            ),
            "acceptedCount",
          ], // 2-Assigned, 3-In Progress, 4-Cancelled, 7-Successful, 8-Rejected, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later

          [
            Sequelize.literal(
              `SUM(
                CASE WHEN activityStatusId = 4 THEN 1 ELSE 0 END +
                CASE WHEN activityStatusId = 8 THEN 1 ELSE 0 END +
                CASE WHEN activityStatusId IN (2, 3, 7, 9, 10, 11, 12, 14) THEN 1 ELSE 0 END
              )`
            ),
            "totalCount",
          ], // 2-Assigned, 3-In Progress, 4-Cancelled, 7-Successful, 8-Rejected, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later
        ],
        include: {
          model: Activities,
          attributes: ["id", "activityStatusId"],
          where: {
            caseDetailId: {
              [Op.in]: caseIds,
            },
            activityStatusId: {
              [Op.in]: [2, 3, 4, 7, 8, 9, 10, 11, 12, 14], // 2-Assigned, 3-In Progress, 4-Cancelled, 7-Successful, 8-Rejected, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later
            },
          },
          required: true,
        },
        group: ["aspId"],
        order: [["id", "DESC"]],
      };

      const activityAspDetailsWithoutLimitOffset: any =
        await ActivityAspDetails.findAll(activityAspDetailBaseQuery);

      let limitValue: number = 10;
      if (payload.limit) {
        limitValue = payload.limit;
      }

      let offsetValue: number = 0;
      if (payload.offset) {
        offsetValue = payload.offset;
      }

      const activityAspDetailsWithLimitOffset =
        await ActivityAspDetails.findAll({
          ...activityAspDetailBaseQuery,
          limit: limitValue,
          offset: offsetValue,
        });
      if (activityAspDetailsWithLimitOffset.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          lists: activityAspDetailsWithLimitOffset,
          count: activityAspDetailsWithoutLimitOffset.length,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspSlaPerformanceCount(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      // Date range filter
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      //BASED ON ASP TYPE (COCO / THIRD PARTY) AND RM IDS WE GET ASP DETAILS
      const aspByAspTypeAndRmResponse: any = await axios.post(
        `${masterService}/${endpointMaster.manager.getAspByAspTypeAndRm}`,
        {
          aspType: payload.aspType,
          rmIds: payload.rmIds,
        }
      );
      if (!aspByAspTypeAndRmResponse.data.success) {
        return res.status(200).json(aspByAspTypeAndRmResponse.data);
      }
      const aspIds = aspByAspTypeAndRmResponse.data.data.map(
        (asp: any) => asp.id
      );

      //SLA PERFORMANCE DETAILS
      const activities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "createdAt",
          "activityStatusId",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            as: "caseDetail",
            required: true,
            attributes: [
              "id",
              "rmId",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: caseWhere,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id"],
            where: {
              aspId: {
                [Op.in]: aspIds,
              },
            },
          },
        ],
      });
      const exceededExpectationSlaMins = aspByAspTypeAndRmResponse.data
        .exceededExpectationSlaMinData
        ? aspByAspTypeAndRmResponse.data.exceededExpectationSlaMinData.name
        : null;

      const getMasterDetailResponse = await getMasterDetails(activities, []);
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;

      const slaResponse = await getSlaPerformanceDetails(
        activities,
        exceededExpectationSlaMins,
        rsaSlaDetails
      );
      if (!slaResponse.success) {
        return res.status(200).json(slaResponse);
      }
      const { slaActivities, ...slaData }: any = slaResponse.data;

      return res.status(200).json({
        success: true,
        data: slaData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getStateWiseAspSlaPerformanceList(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const aspIds: any = [];
      for (const state of payload.states) {
        aspIds.push(...state.aspIds);
      }

      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      //DATE RANGE FILTER
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      //SLA PERFORMANCE DETAILS
      const aspActivities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "createdAt",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: [
              "id",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: caseWhere,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "aspId"],
            where: {
              aspId: {
                [Op.in]: aspIds,
              },
            },
          },
        ],
      });

      //IF RSA MEANS GET BREAKDOWN CITIES SLA DETAILS
      const getMasterDetailResponse = await getMasterDetails(aspActivities, []);
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;

      for (const state of payload.states) {
        const activities = aspActivities.filter((aspActivity: any) =>
          state.aspIds.includes(aspActivity.activityAspDetail.aspId)
        );

        let slaResponse = null;
        if (activities && activities.length > 0) {
          slaResponse = await getSlaPerformanceDetails(
            activities,
            payload.exceededExpectationSlaMins,
            rsaSlaDetails
          );
        }

        state.slaPerformanceDetails = null;
        if (slaResponse && slaResponse.success) {
          const { slaActivities, ...slaData }: any = slaResponse.data;
          state.slaPerformanceDetails = slaData;
        }
      }

      return res.status(200).json({
        success: true,
        data: payload.states,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspSlaPerformanceList(req: Request, res: Response) {
    try {
      const payload = req.body;
      const aspIds: any = [];
      for (const nearestCity of payload.nearestCities) {
        aspIds.push(...nearestCity.aspIds);
      }

      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      //DATE RANGE FILTER
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      //SLA PERFORMANCE DETAILS
      const aspActivities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "createdAt",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: [
              "id",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: caseWhere,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "aspId"],
            where: {
              aspId: {
                [Op.in]: aspIds,
              },
            },
          },
        ],
      });

      //IF RSA MEANS GET BREAKDOWN CITIES SLA DETAILS
      const getMasterDetailResponse = await getMasterDetails(aspActivities, []);
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;

      for (const nearestCity of payload.nearestCities) {
        const activities = aspActivities.filter((aspActivity: any) =>
          nearestCity.aspIds.includes(aspActivity.activityAspDetail.aspId)
        );

        let slaResponse = null;
        if (activities && activities.length > 0) {
          slaResponse = await getSlaPerformanceDetails(
            activities,
            payload.exceededExpectationSlaMins,
            rsaSlaDetails
          );
        }

        nearestCity.slaPerformanceDetails = null;
        if (slaResponse && slaResponse.success) {
          const { slaActivities, ...slaData }: any = slaResponse.data;
          nearestCity.slaPerformanceDetails = slaData;
        }
      }

      return res.status(200).json({
        success: true,
        data: payload.nearestCities,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspSlaPerformanceListView(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const aspIds = payload.nearestCityAsps.map(
        (nearestCityAsp: any) => nearestCityAsp.id
      );

      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      //DATE RANGE FILTER
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetail.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      //SLA PERFORMANCE DETAILS
      const aspActivities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "createdAt",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: [
              "id",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: caseWhere,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "aspId"],
            where: {
              aspId: {
                [Op.in]: aspIds,
              },
            },
          },
        ],
      });

      //IF RSA MEANS GET BREAKDOWN CITIES SLA DETAILS
      const getMasterDetailResponse = await getMasterDetails(aspActivities, []);
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;

      for (const nearestCityAsp of payload.nearestCityAsps) {
        const activities = aspActivities.filter(
          (aspActivity: any) =>
            aspActivity.activityAspDetail.aspId == nearestCityAsp.id
        );

        let slaResponse = null;
        if (activities && activities.length > 0) {
          slaResponse = await getSlaPerformanceDetails(
            activities,
            payload.exceededExpectationSlaMins,
            rsaSlaDetails
          );
        }

        nearestCityAsp.slaPerformanceDetails = null;
        if (slaResponse && slaResponse.success) {
          const { slaActivities, ...slaData }: any = slaResponse.data;
          nearestCityAsp.slaPerformanceDetails = slaData;
        }
      }

      return res.status(200).json({
        success: true,
        data: payload.nearestCityAsps,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getClientPerformanceCount(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      // Date range filter
      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("caseDetails.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      const caseDetails: any = await CaseDetails.findAll({
        attributes: [
          "id",
          "clientId",
          [Sequelize.literal(`COUNT(id)`), "caseCount"],
        ],
        where: caseWhere,
        group: ["clientId"],
        order: [["id", "DESC"]],
      });
      if (caseDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          caseDetails,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getCocoAssetRequests(req: Request, res: Response) {
    try {
      const payload = req.body;
      //REQUEST DETAILS
      const activityAspDetailWhere = {
        aspId: payload.aspId,
      };
      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere.createdAt = {
          [Op.between]: [
            formattedStartDate + " 00:00:00",
            formattedEndDate + " 23:59:59",
          ],
        };
      }

      //GET ACCEPTED, REJECTED, AND CANCELED REQUEST COUNT
      const getRequestDetailResponse = await getRequestDetails(
        activityAspDetailWhere,
        "aspId",
        caseWhere
      );
      if (!getRequestDetailResponse.success) {
        return res.status(200).json(getRequestDetailResponse);
      }

      //SLA PERFORMANCE DETAILS
      const activities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "createdAt",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: [
              "id",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: caseWhere,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id"],
            where: activityAspDetailWhere,
          },
        ],
      });

      //GET BREAKDOWN CITY SLA & SUB SERVICE DETAILS
      const getMasterDetailResponse = await getMasterDetails(activities, []);
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;

      const slaResponse = await getSlaPerformanceDetails(
        activities,
        payload.exceededExpectationSlaMins,
        rsaSlaDetails
      );
      if (!slaResponse.success) {
        return res.status(200).json(slaResponse);
      }
      const { slaActivities, ...slaData }: any = slaResponse.data;

      const data = {
        ...getRequestDetailResponse.data,
        ...slaData,
      };
      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getServicePerformanceCount(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const aspIds = payload.aspIds;

      const caseWhere: any = {
        rmId: {
          [Op.in]: payload.rmIds,
        },
        statusId: {
          [Op.notIn]: [3], // NOT CANCELLED
        },
      };

      if (payload.dateRange) {
        const { formattedStartDate, formattedEndDate } =
          Utils.getStartAndEndDateFromRange(payload.dateRange);

        caseWhere.createdAt = {
          [Op.between]: [
            formattedStartDate + " 00:00:00",
            formattedEndDate + " 23:59:59",
          ],
        };
      }

      //SLA PERFORMANCE DETAILS
      const aspActivities: any = await Activities.findAll({
        attributes: [
          "id",
          "isInitiallyCreated",
          "isImmediateService",
          "serviceInitiatingAt",
          "aspReachedToPickupAt",
          "aspReachedToBreakdownAt",
          "createdAt",
        ],
        where: {
          activityStatusId: {
            [Op.notIn]: [1, 4, 5, 8], //1) Open 4) Cancelled, 5) Failure, 8) Rejected
          },
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: [
              "id",
              "typeId",
              "deliveryRequestPickupDate",
              "deliveryRequestPickupTime",
              "createdAt",
            ],
            where: caseWhere,
            include: [
              {
                model: CaseInformation,
                attributes: ["id", "breakdownAreaId"],
              },
            ],
          },
          {
            model: ActivityAspDetails,
            required: true,
            attributes: ["id", "subServiceId"],
            where: {
              aspId: {
                [Op.in]: aspIds,
              },
            },
          },
        ],
      });

      const subServiceIds = [
        ...new Set(
          aspActivities.map(
            (aspActivity: any) => aspActivity.activityAspDetail.subServiceId
          )
        ),
      ];

      const getMasterDetailResponse = await getMasterDetails(
        aspActivities, //IF RSA MEANS GET BREAKDOWN CITIES SLA DETAILS
        subServiceIds //GET SUB SERVICE DETAILS
      );
      if (!getMasterDetailResponse.success) {
        return res.status(200).json(getMasterDetailResponse);
      }
      const rsaSlaDetails = getMasterDetailResponse.data.rsaSlaDetails;
      const subServiceDetails = getMasterDetailResponse.data.subServiceDetails;

      //INCLUDE SERVICE AGAINST ACTIVITY BASED ON SUB SERVICE
      for (const aspActivity of aspActivities) {
        const subServiceDetail = subServiceDetails.find(
          (subServiceDetail: any) =>
            subServiceDetail.subServiceId ==
            aspActivity.activityAspDetail.subServiceId
        );

        aspActivity.activityAspDetail.dataValues.serviceId = subServiceDetail
          ? subServiceDetail.serviceId
          : null;
      }

      //SERVICE BASED ASP PERFORMANCE
      for (const service of payload.services) {
        //GET ACTIVITIES BASED ON SERVICE
        const activities = aspActivities.filter(
          (aspActivity: any) =>
            aspActivity.activityAspDetail.dataValues.serviceId == service.id
        );

        let slaResponse = null;
        if (activities && activities.length > 0) {
          slaResponse = await getSlaPerformanceDetails(
            activities,
            payload.exceededExpectationSlaMins,
            rsaSlaDetails
          );
        }

        service.slaPerformanceDetails = null;
        if (slaResponse && slaResponse.success) {
          const { slaActivities, ...slaData }: any = slaResponse.data;
          service.slaPerformanceDetails = slaData;
        }
      }

      const totalServices = payload.services.reduce(
        (sum: any, service: any) => {
          return (
            sum +
            (service.slaPerformanceDetails
              ? service.slaPerformanceDetails.totalCases
              : 0)
          );
        },
        0
      );

      return res.status(200).json({
        success: true,
        data: { totalServices, services: payload.services },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function addInteraction(req: Request, res: Response) {
    try {
      const inData = req.validBody;
      const caseDetailExists: any = await CaseDetails.findOne({
        attributes: ["id", "typeId"],
        where: { id: inData.caseDetailId },
      });
      if (!caseDetailExists) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      // Create activity log with interaction details (similar to customer feedback)
      const descriptionParts: string[] = [];

      // Fetch master details in a single API call (order matches form: Channel, To, Call Type)
      const masterDetailsPayload: any = {};
      if (inData.channelId) {
        masterDetailsPayload.getChannelsWithoutValidation = [inData.channelId];
      }
      if (inData.toId) {
        masterDetailsPayload.getTosWithoutValidation = [inData.toId];
      }
      if (inData.callTypeId) {
        masterDetailsPayload.getCallTypesWithoutValidation = [inData.callTypeId];
      }

      let masterDetailsResponse: any = null;
      if (Object.keys(masterDetailsPayload).length > 0) {
        try {
          masterDetailsResponse = await axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            masterDetailsPayload
          );
        } catch (error: any) {
          // If master details fetch fails, continue without them
        }
      }

      // 1. Channel (order matches form)
      if (masterDetailsResponse?.data?.success && masterDetailsResponse.data.data?.channelsWithoutValidation?.length > 0) {
        const channelName = masterDetailsResponse.data.data.channelsWithoutValidation[0].name;
        descriptionParts.push(
          `Channel: <span style="color:#999">${channelName}</span>`
        );
      }

      // 2. To (order matches form)
      if (masterDetailsResponse?.data?.success && masterDetailsResponse.data.data?.tosWithoutValidation?.length > 0) {
        const toName = masterDetailsResponse.data.data.tosWithoutValidation[0].name;
        descriptionParts.push(
          `To: <span style="color:#999">${toName}</span>`
        );
      }

      // 3. Call Type (order matches form)
      if (masterDetailsResponse?.data?.success && masterDetailsResponse.data.data?.callTypesWithoutValidation?.length > 0) {
        const callTypeName = masterDetailsResponse.data.data.callTypesWithoutValidation[0].name;
        descriptionParts.push(
          `Call Type: <span style="color:#999">${callTypeName}</span>`
        );
      }

      // 4. Subject (order matches form)
      if (inData.title) {
        descriptionParts.push(
          `Subject: <span style="color:#999">${inData.title}</span>`
        );
      }

      // 5. Description (order matches form)
      if (inData.description) {
        descriptionParts.push(
          `Description: <span style="color:#999">${inData.description}</span>`
        );
      }

      // 6. Created By (User who added the interaction)
      const authUserData = inData.authUserData;
      if (authUserData?.name) {
        descriptionParts.push(
          `Created By: <span style="color:#999">${authUserData.name}</span>`
        );
      }

      const createdInteraction = await ActivityLogs.create({
        caseDetailId: inData.caseDetailId,
        typeId: 242, // INTERACTION
        channelId: inData.channelId,
        toId: inData.toId,
        callTypeId: inData.callTypeId,
        title: "Interaction Added",
        description: descriptionParts.join('<br />'),
        createdById: inData.createdById,
      });

      //If interaction created then sync this details for crm comments data report.
      if (caseDetailExists.typeId == 31) {
        Utils.createReportSyncTableRecord("commentsDataReportDetails", [
          createdInteraction.dataValues.id,
        ]);
      }

      return res.status(200).json({
        success: true,
        message: "Interaction added successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function interactionList(req: Request, res: Response) {
    try {
      const inData = req.validBody;
      const caseDetail: any = await CaseDetails.findOne({
        attributes: ["id"],
        where: { id: inData.caseDetailId },
        include: [
          {
            model: Activities,
            attributes: ["id"],
          },
        ],
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      //ACTIVITY LOGS
      let activityIds = [];
      if (caseDetail.activities.length > 0) {
        activityIds = caseDetail.activities.map((activity: any) => activity.id);
      }

      const activityLogs: any = await ActivityLogs.findAll({
        where: {
          [Op.or]: [
            { caseDetailId: caseDetail.dataValues.id },
            { activityId: activityIds },
          ],
        },
        attributes: {
          exclude: ["updatedById", "deletedById", "updatedAt", "deletedAt"],
        },
        order: [["id", "ASC"]],
      });

      return res.status(200).json({
        success: true,
        data: activityLogs,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getTotalCases(req: Request, res: Response) {
    try {
      const inData = req.validBody;
      const successCount = await ActivityAspDetails.count({
        attributes: ["id"],
        include: [
          {
            model: Activities,
            required: true,
            attributes: ["id"],
            where: {
              [Op.or]: [
                { activityStatusId: 7 }, //SUCCESSFUL
                { activityStatusId: 11 }, //BALANCE PAYMENT PENDING
                { activityStatusId: 12 }, //EXCESS AMOUNT CREDIT PENDING
                { activityStatusId: 13 }, //PAYMENT NOT NEED
              ],
            },
            include: [
              {
                model: CaseDetails,
                required: true,
                attributes: ["id"],
                where: {
                  rmId: {
                    [Op.in]: inData.rmIds,
                  },
                },
              },
            ],
          },
        ],
      });

      const cancelledCount = await ActivityAspDetails.count({
        attributes: ["id"],
        include: [
          {
            model: Activities,
            required: true,
            attributes: ["id"],
            where: {
              activityStatusId: 4, //CANCELLED
            },
            include: [
              {
                model: CaseDetails,
                required: true,
                attributes: ["id"],
                where: {
                  rmId: {
                    [Op.in]: inData.rmIds,
                  },
                },
              },
            ],
          },
        ],
      });

      const rejectedCount = await ActivityAspDetails.count({
        attributes: ["id"],
        include: [
          {
            model: Activities,
            required: true,
            attributes: ["id"],
            where: {
              activityStatusId: 8, //REJECTED
            },
            include: [
              {
                model: CaseDetails,
                required: true,
                attributes: ["id"],
                where: {
                  rmId: {
                    [Op.in]: inData.rmIds,
                  },
                },
              },
            ],
          },
        ],
      });

      const totalCases = +successCount + +cancelledCount + +rejectedCount;

      return res.status(200).json({
        success: true,
        data: {
          totalCases,
          successCount,
          cancelledCount,
          rejectedCount,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

async function getSlaPerformanceDetails(
  activities: any,
  exceededExpectationSlaMins: string,
  rsaSlaDetails: any
) {
  try {
    let slaAchievedCount = 0;
    let slaExceedAtExpectationCount = 0;
    let slaNotAchievedCount = 0;
    let performanceInprogressCount = 0;
    for (const activity of activities) {
      activity.slaAchieved = false;
      activity.slaExceedAtExpectation = false;
      activity.slaNotAchieved = false;
      activity.performanceInprogress = false;

      //RSA
      if (
        activity.caseDetail.typeId == 31 &&
        activity.caseDetail.caseInformation &&
        activity.caseDetail.caseInformation.breakdownAreaId &&
        rsaSlaDetails.length > 0
      ) {
        let slaBaseDate = null;
        //OLD LOGIC
        // if (activity.isInitiallyCreated && !activity.isImmediateService) {
        //   //For primary and additional not immediate service on case creation
        //   slaBaseDate = activity.serviceInitiatingAt;
        // } else if (!activity.isInitiallyCreated) {
        //   //For additional service requested from mobile app or web
        //   slaBaseDate = activity.createdAt;
        // } else {
        //   //For primary and additional immediate service
        //   slaBaseDate = activity.caseDetail.createdAt;
        // }
        //NEW LOGIC
        //WHEN SERVICE IS INITIALLY CREATED AND NOT IMMEDIATE SERVICE, THEN USE SERVICE INITIATING AT ELSE USE CASE CREATED AT FOR BASE DATE
        if (activity.isInitiallyCreated && !activity.isImmediateService) {
          slaBaseDate = activity.serviceInitiatingAt;
        } else {
          slaBaseDate = activity.caseDetail.createdAt;
        }

        //GET CITY LOCATION TYPE BASED BREAKDOWN REACH TIME SLA
        const citySlaDetail = rsaSlaDetails.find(
          (rsaSlaDetail: any) =>
            rsaSlaDetail.id ==
            activity.caseDetail.caseInformation.breakdownAreaId
        );
        const slaTime = citySlaDetail ? citySlaDetail.slaTime : null;

        const slaDateTime = moment
          .tz(slaBaseDate, "Asia/Kolkata")
          .add(slaTime, "seconds")
          .format("YYYY-MM-DD HH:mm:ss");

        //If asp already reached to breakdown then check sla base date and breakdown reached date.
        if (activity.aspReachedToBreakdownAt) {
          const formattedAspReachedToBreakdownAt = moment
            .tz(activity.aspReachedToBreakdownAt, "Asia/Kolkata")
            .format("YYYY-MM-DD HH:mm:ss");

          if (formattedAspReachedToBreakdownAt > slaDateTime) {
            slaNotAchievedCount++;
            activity.slaNotAchieved = true;
          } else {
            const momentSlaDateTime = moment.tz(slaDateTime, "Asia/Kolkata");
            const slaDateTimeMinusExpectedSlaMin = momentSlaDateTime.subtract(
              exceededExpectationSlaMins,
              "minutes"
            );
            const formattedSlaDateTimeMinusExpectedSlaMin =
              slaDateTimeMinusExpectedSlaMin.format("YYYY-MM-DD HH:mm:ss");

            //If asp reached breakdown before SLA exceeded time
            if (
              formattedAspReachedToBreakdownAt <=
              formattedSlaDateTimeMinusExpectedSlaMin
            ) {
              slaExceedAtExpectationCount++;
              activity.slaExceedAtExpectation = true;
            } else {
              slaAchievedCount++;
              activity.slaAchieved = true;
            }
          }
        } else if (
          moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss") >
          slaDateTime
        ) {
          //CURRENT TIME EXCEEDS THE BREAKDOWN REACH TIME SLA
          slaNotAchievedCount++;
          activity.slaNotAchieved = true;
        } else {
          //CURRENT TIME DOES NOT EXCEEDS THE BREAKDOWN REACH TIME SLA
          performanceInprogressCount++;
          activity.performanceInprogress = true;
        }
      } else if (
        activity.caseDetail.typeId == 32 &&
        activity.caseDetail.deliveryRequestPickupDate &&
        activity.caseDetail.deliveryRequestPickupTime
      ) {
        //VDM
        const [year, month, day] =
          activity.caseDetail.deliveryRequestPickupDate.split("-");
        const [startHour, endHour] =
          activity.caseDetail.deliveryRequestPickupTime.split(" - ");
        const expectedPickupDateAndTime = `${year}-${month}-${day} ${Utils.timeConvert(
          endHour
        )}:00:00`;
        let formattedExpectedPickupDateAndTime = moment
          .tz(expectedPickupDateAndTime, "Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss");

        //if asp already reached pickup location then check sla base date and breakdown reached date.
        if (activity.aspReachedToPickupAt) {
          const formattedAspReachedToPickupAt = moment
            .tz(activity.aspReachedToPickupAt, "Asia/Kolkata")
            .format("YYYY-MM-DD HH:mm:ss");

          if (
            formattedAspReachedToPickupAt > formattedExpectedPickupDateAndTime
          ) {
            slaNotAchievedCount++;
            activity.slaNotAchieved = true;
          } else {
            const momentSlaDateTime = moment.tz(
              formattedExpectedPickupDateAndTime,
              "Asia/Kolkata"
            );
            const slaDateTimeMinusExpectedSlaMin = momentSlaDateTime.subtract(
              exceededExpectationSlaMins,
              "minutes"
            );
            const formattedSlaDateTimeMinusExpectedSlaMin =
              slaDateTimeMinusExpectedSlaMin.format("YYYY-MM-DD HH:mm:ss");

            //If asp reached pickup before SLA exceeded time
            if (
              formattedAspReachedToPickupAt <=
              formattedSlaDateTimeMinusExpectedSlaMin
            ) {
              slaExceedAtExpectationCount++;
              activity.slaExceedAtExpectation = true;
            } else {
              slaAchievedCount++;
              activity.slaAchieved = true;
            }
          }
        } else if (
          moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss") >
          formattedExpectedPickupDateAndTime
        ) {
          //CURRENT TIME EXCEEDS THE DELIVERY REQUEST PICKUP DATE TIME SLA
          slaNotAchievedCount++;
          activity.slaNotAchieved = true;
        } else {
          //CURRENT TIME DOES NOT EXCEEDS THE BREAKDOWN REACH TIME SLA
          performanceInprogressCount++;
          activity.performanceInprogress = true;
        }
      }
    }

    const totalCases =
      +slaAchievedCount +
      +slaExceedAtExpectationCount +
      +slaNotAchievedCount +
      +performanceInprogressCount;

    const getPercentage = (count: number) => {
      if (totalCases === 0) return "0"; // Avoid division by zero
      const percentage = (count / totalCases) * 100;
      return percentage % 1 === 0
        ? percentage.toString()
        : percentage.toFixed(2);
    };

    const data = {
      slaActivities: activities,
      totalCases: totalCases,
      slaAchievedCount: slaAchievedCount,
      slaExceedAtExpectationCount: slaExceedAtExpectationCount,
      slaNotAchievedCount: slaNotAchievedCount,
      performanceInprogressCount: performanceInprogressCount,
      slaAchievedPercentage: getPercentage(slaAchievedCount) + "%",
      slaExceedAtExpectationPercentage:
        getPercentage(slaExceedAtExpectationCount) + "%",
      slaNotAchievedPercentage: getPercentage(slaNotAchievedCount) + "%",
      performanceInprogressPercentage:
        getPercentage(performanceInprogressCount) + "%",
    };

    return {
      success: true,
      data: data,
    };
  } catch (error: any) {
    throw error;
  }
}
//GET ACCEPTED, REJECTED, AND CANCELED COUNT
async function getRequestDetails(
  activityAspDetailWhere: any,
  activityAspDetailGroup: string,
  caseWhere: any
) {
  try {
    const activityAspDetail: any = await ActivityAspDetails.findOne({
      where: activityAspDetailWhere,
      attributes: [
        "id",
        "aspId",
        "aspMechanicId",
        [
          Sequelize.literal(
            `SUM(CASE WHEN activityStatusId = 4 THEN 1 ELSE 0 END)`
          ),
          "cancelledCount",
        ],
        [
          Sequelize.literal(
            `SUM(CASE WHEN activityStatusId = 8 THEN 1 ELSE 0 END)`
          ),
          "rejectedCount",
        ],
        [
          Sequelize.literal(
            `SUM(CASE WHEN activityStatusId IN (2, 3, 7, 9, 10, 11, 12, 14) THEN 1 ELSE 0 END)`
          ),
          "acceptedCount",
        ], // 2-Assigned, 3-In Progress, 4-Cancelled, 7-Successful, 8-Rejected, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later
      ],
      include: {
        model: Activities,
        required: true,
        attributes: ["id", "activityStatusId"],
        where: {
          activityStatusId: {
            [Op.in]: [2, 3, 4, 7, 8, 9, 10, 11, 12, 14], // 2-Assigned, 3-In Progress, 4-Cancelled, 7-Successful, 8-Rejected, 9-Waiting for Dealer Approval, 10-Advance Payment Paid, 11-Balance Payment Pending, 12-Excess Amount Credit Pending, 14-Advance Pay Later
          },
        },
        include: [
          {
            model: CaseDetails,
            required: true,
            attributes: ["id", "createdAt"],
            where: caseWhere,
          },
        ],
      },
      group: [activityAspDetailGroup],
    });

    let acceptedCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;
    if (activityAspDetail) {
      acceptedCount = activityAspDetail.dataValues.acceptedCount;
      rejectedCount = activityAspDetail.dataValues.rejectedCount;
      cancelledCount = activityAspDetail.dataValues.cancelledCount;
    }

    const data = {
      totalCount: +acceptedCount + +rejectedCount + +cancelledCount,
      acceptedCount: acceptedCount,
      rejectedCount: rejectedCount,
      cancelledCount: cancelledCount,
    };

    return {
      success: true,
      data: data,
    };
  } catch (error: any) {
    throw error;
  }
}

//Get breakdown cities sla detail / Get sub service details
async function getMasterDetails(activities: any, subServiceIds: any) {
  try {
    //Get breakdown city ids
    const rsaBreakdownCities: any = [];
    for (const activity of activities) {
      //RSA
      if (
        activity.caseDetail.typeId == 31 &&
        activity.caseDetail.caseInformation
      ) {
        const breakdownAreaId =
          activity.caseDetail.caseInformation.breakdownAreaId;
        if (
          !rsaBreakdownCities.some(
            (rsaBreakdownCity: any) => rsaBreakdownCity.id === breakdownAreaId
          )
        ) {
          rsaBreakdownCities.push({
            id: activity.caseDetail.caseInformation.breakdownAreaId,
            typeId: 870, //ASP Breakdown Reach Time SLA - L1
          });
        }
      }
    }

    let rsaSlaDetails: any = null;
    let subServiceDetails: any = [];
    let exceededExpectationSlaMins = null;
    if (rsaBreakdownCities.length > 0 || subServiceIds.length > 0) {
      //GET CITY WISE SLA SETTING AND SUB SERVICE DETAILS
      const masterDetailResponse = await axios.post(
        `${masterService}/${endpointMaster.manager.getMasterDetails}`,
        {
          breakdownCities: rsaBreakdownCities,
          subServiceIds: subServiceIds,
        }
      );
      if (!masterDetailResponse.data.success) {
        return masterDetailResponse.data;
      }

      rsaSlaDetails = masterDetailResponse.data.data.updatedCities;
      subServiceDetails = masterDetailResponse.data.data.subServiceDetails;
      exceededExpectationSlaMins =
        masterDetailResponse.data.data.exceededExpectationSlaMins;
    }

    return {
      success: true,
      data: {
        rsaSlaDetails,
        subServiceDetails,
        exceededExpectationSlaMins,
      },
    };
  } catch (error: any) {
    throw error;
  }
}

async function formCaseListDetails(caseDetail: any, subServiceId: any) {
  try {
    const caseObject: any = {
      caseDetailId: caseDetail.id,
      caseNumber: caseDetail.caseNumber,
      caseTypeId: caseDetail.typeId,
      // subServiceId: subServiceId,
      subServiceId:
        caseDetail.typeId == 32 && !subServiceId
          ? process.env.VEHICLE_TRANSFER_SUB_SERVICE_ID
          : subServiceId,
      registrationNumber: caseDetail.registrationNumber,
      vin: caseDetail.vin,
      vehicleMakeId: caseDetail.vehicleMakeId,
      vehicleModelId: caseDetail.vehicleModelId,
      breakdownAreaId:
        caseDetail.typeId == 31 && caseDetail.caseInformation
          ? caseDetail.caseInformation.breakdownAreaId
          : null,
      deliveryRequestPickUpCityId:
        caseDetail.typeId == 32 && caseDetail.deliveryRequestPickUpCityId
          ? caseDetail.deliveryRequestPickUpCityId
          : null,
      deliveryRequestDropCityId:
        caseDetail.typeId == 32 && caseDetail.deliveryRequestDropCityId
          ? caseDetail.deliveryRequestDropCityId
          : null,
      deliveryRequestPickupDate:
        caseDetail.typeId == 32 && caseDetail.deliveryRequestPickupDate
          ? caseDetail.deliveryRequestPickupDate
          : null,
      deliveryRequestPickupTime:
        caseDetail.typeId == 32 && caseDetail.deliveryRequestPickupTime
          ? caseDetail.deliveryRequestPickupTime
          : null,
    };

    return {
      success: true,
      data: caseObject,
    };
  } catch (error: any) {
    throw error;
  }
}

export default managerController;
