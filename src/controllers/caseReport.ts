import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import moment from "moment-timezone";
import {
  Activities,
  ActivityAspDetails,
  ActivityAspLiveLocations,
  ActivityAspRateCards,
  ActivityChargeAttachments,
  ActivityCharges,
  ActivityDetails,
  ActivityInventories,
  ActivityLogs,
  ActivityTransactions,
  CaseDetails,
  ReportColumns,
  RoleBasedColumns,
  CaseSla,
} from "../database/models/index";
import { Op, where } from "sequelize";

export namespace caseReportController {
  const defaultLimit = 10;
  const defaultOffset = 0;
  interface CaseDetail {
    model: any;
    attribute: string[];
    include?: Activity[];
  }

  interface Activity {
    model: any;
    attribute: string[];
  }

  const calculateTimeDifferene = async (
    caseDetails: any,
    reportColumnsIds: any
  ) => {
    try {
      for (let caseDetail of caseDetails) {
        if (
          caseDetail.deliveryRequestPickupDate &&
          caseDetail.deliveryRequestPickupTime &&
          caseDetail["activities.aspReachedToPickupAt"]
        ) {
          const [startTime, endTime] =
            caseDetail.deliveryRequestPickupTime.split(" - ");
          const maxDateTime = moment
            .tz(
              `${caseDetail.deliveryRequestPickupDate} ${endTime}`,
              "YYYY-MM-DD h A",
              "Asia/Kolkata"
            )
            .format("YYYY-MM-DD HH:mm:ss");
          const minDateTime = moment
            .tz(
              `${caseDetail.deliveryRequestPickupDate} ${startTime}`,
              "YYYY-MM-DD h A",
              "Asia/Kolkata"
            )
            .format("YYYY-MM-DD HH:mm:ss");
          let duration = moment.duration(
            Math.abs(
              moment
                .tz(maxDateTime, "Asia/Kolkata")
                .diff(
                  moment.tz(
                    caseDetail["activities.aspReachedToPickupAt"],
                    "Asia/Kolkata"
                  )
                )
            )
          );

          caseDetail.aspPickUpTimeDiff = customTimeFormat(duration);

          if (reportColumnsIds.includes(100)) {
            caseDetail.aspSlaStatus = "";
            // Determine the status
            if (
              moment
                .tz(
                  caseDetail["activities.aspReachedToPickupAt"],
                  "Asia/Kolkata"
                )
                .isBefore(minDateTime)
            ) {
              caseDetail.aspSlaStatus = "Before";
            } else if (
              moment
                .tz(
                  caseDetail["activities.aspReachedToPickupAt"],
                  "Asia/Kolkata"
                )
                .isBetween(minDateTime, maxDateTime, null, "[]")
            ) {
              caseDetail.aspSlaStatus = "Ontime";
            } else {
              caseDetail.aspSlaStatus = "Delayed";
            }
          }
        }

        if (
          caseDetail["activities.aspStartedToDropAt"] &&
          caseDetail["activities.aspReachedToDropAt"]
        ) {
          caseDetail.aspDropTimeDiff = customTimeFormat(
            moment.duration(
              moment
                .tz(caseDetail["activities.aspReachedToDropAt"], "Asia/Kolkata")
                .diff(
                  moment.tz(
                    caseDetail["activities.aspStartedToDropAt"],
                    "Asia/Kolkata"
                  )
                )
            )
          );
        }

        // agent pickup assigned time difference
        if (caseDetail.agentAssignedAt && caseDetail.createdAt) {
          caseDetail.agentTimeDiff = customTimeFormat(
            moment.duration(
              moment
                .tz(caseDetail.agentAssignedAt, "Asia/Kolkata")
                .diff(moment.tz(caseDetail.createdAt, "Asia/Kolkata"))
            )
          );
        }

        // dealer time diff payment request vs paid
        if (
          caseDetail["activities.sentApprovalAt"] &&
          caseDetail["activities.activityTransactions.paidAt"]
        ) {
          caseDetail.dealerTimeDiff = customTimeFormat(
            moment.duration(
              moment
                .tz(
                  caseDetail["activities.activityTransactions.paidAt"],
                  "Asia/Kolkata"
                )
                .diff(
                  moment.tz(
                    caseDetail["activities.sentApprovalAt"],
                    "Asia/Kolkata"
                  )
                )
            )
          );
        }

        // asp total waiting time
        if (
          caseDetail["activities.aspReachedToPickupAt"] &&
          caseDetail["activities.aspReachedToDropAt"] &&
          caseDetail["activities.aspStartedToDropAt"] &&
          caseDetail["activities.aspEndServiceAt"]
        ) {
          // (Asp Reach to Pickup Location - Asp Started to Drop Location)
          // + (Asp Reached to Drop Location - Asp Started to Garage(end service))
          let durationOne = moment.duration(
            moment
              .tz(caseDetail["activities.aspStartedToDropAt"], "Asia/Kolkata")
              .diff(
                moment.tz(
                  caseDetail["activities.aspReachedToPickupAt"],
                  "Asia/Kolkata"
                )
              )
          );
          let durationTwo = moment.duration(
            moment
              .tz(caseDetail["activities.aspEndServiceAt"], "Asia/Kolkata")
              .diff(
                moment.tz(
                  caseDetail["activities.aspReachedToDropAt"],
                  "Asia/Kolkata"
                )
              )
          );
          let totalDuration = durationOne.add(durationTwo);
          caseDetail.aspTotalWaitTimeDiff = customTimeFormat(totalDuration);
        }
      }
      return caseDetails;
    } catch (error: any) {
      throw error;
    }
  };
  export async function caseReporting(req: Request, res: Response) {
    try {
      const payload = req.validBody;

      const reportColumnIds = payload.columns;
      const startDate = payload.startDate;
      const endDate = payload.endDate;
      const agents = payload.agents;
      const dealers = payload.dealers;
      const asps = payload.asps;

      let caseDetail: string[] = ["id"];
      let activity: string[] = [];
      let activityAspDetail: string[] = [];
      let activityAspRateCard: string[] = [];
      let activityTransaction: string[] = [];
      let agentAssignmentSla: string[] = [];
      let aspAssignmentSla: string[] = [];
      let dealerPaymentSla: string[] = [];
      let firstCaseSla: string[] = [];
      // let masterTables: string[] = [];
      let masterTables: any = {
        master: [],
        case: [],
        user: [],
      };
      let collection: any = Object();

      let caseWhere = Object();
      let activityAspWhere = Object();

      if (
        startDate !== undefined &&
        endDate !== undefined &&
        startDate != null &&
        endDate != null &&
        startDate != "" &&
        endDate != ""
      ) {
        const startOfDay = moment
          .tz(startDate, "Asia/Kolkata")
          .startOf("day")
          .format();
        const endOfDay = moment
          .tz(endDate, "Asia/Kolkata")
          .endOf("day")
          .format();
        caseWhere.createdAt = {
          [Op.between]: [startOfDay, endOfDay],
        };
      }
      if (agents && agents.length > 0) {
        caseWhere.agentId = agents;
      }
      if (dealers && dealers.length > 0) {
        caseWhere[Op.or] = [
          { dealerId: dealers },
          { deliveryRequestCreatedDealerId: dealers },
          { deliveryRequestDropDealerId: dealers },
        ];
      }
      if (asps && asps.length > 0) {
        activityAspWhere.aspId = asps;
      }

      let allColumns: any = await ReportColumns.findAll({
        where: { id: reportColumnIds },
      });

      for (let i = 0; i < allColumns.length; i++) {
        let tableName = allColumns[i];

        //IF FROM TABLE IS ACTIVITY
        if (tableName && tableName.fromTable === "activities") {
          //PUSH ACTIVITY RELATED COLUMN TO ACTIVITY ARRAY
          activity.push(tableName.fromColumn);
          //PUSH TO MASTER TABLES IF IT HAS MAPPING
          if (tableName.mapping) {
            masterTables[tableName.fromService].push(tableName.targetTable);
          }
          //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
          collection[tableName.id] = [
            `activities.${tableName.fromColumn}`,
            `${tableName.columnName}`,
            tableName.mapping,
            tableName.targetTable,
            tableName.targetColumn,
            tableName.fieldType,
            tableName.fromService,
            tableName.targetTableHasRelation,
            tableName.relationTable,
            tableName.relationName,
            tableName.relationTableColumn,
          ];
        } else if (tableName && tableName.fromTable === "caseDetails") {
          //IF FROM TABLE IS CASE DETAIL

          //PUSH CASE DETAIL RELATED COLUMN TO CASEDETAIL ARRAY
          caseDetail.push(tableName.fromColumn);
          //PUSH TO MASTER TABLES IF IT HAS MAPPING
          if (tableName.mapping) {
            masterTables[tableName.fromService].push(tableName.targetTable);
          }
          //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
          collection[tableName.id] = [
            `${tableName.fromColumn}`,
            `${tableName.columnName}`,
            tableName.mapping,
            tableName.targetTable,
            tableName.targetColumn,
            tableName.fieldType,
            tableName.fromService,
            tableName.targetTableHasRelation,
            tableName.relationTable,
            tableName.relationName,
            tableName.relationTableColumn,
          ];
        } else if (tableName && tableName.fromTable === "activityAspDetails") {
          //IF FROM TABLE IS ACTIVITY ASP DETAIL

          //PUSH ACTIVITY ASP DETAIL RELATED COLUMN TO ACTIVITY ASP DETAIL ARRAY
          activityAspDetail.push(tableName.fromColumn);
          //PUSH TO MASTER TABLES IF IT HAS MAPPING
          if (tableName.mapping) {
            masterTables[tableName.fromService].push(tableName.targetTable);
          }
          //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
          collection[tableName.id] = [
            `activities.activityAspDetail.${tableName.fromColumn}`,
            `${tableName.columnName}`,
            tableName.mapping,
            tableName.targetTable,
            tableName.targetColumn,
            tableName.fieldType,
            tableName.fromService,
            tableName.targetTableHasRelation,
            tableName.relationTable,
            tableName.relationName,
            tableName.relationTableColumn,
          ];
        } else if (
          tableName &&
          tableName.fromTable === "activityAspRateCards"
        ) {
          //IF FROM TABLE IS ACTIVITY ASP RATE CARD

          //PUSH ACTIVITY ASP RATE CARD RELATED COLUMN TO ACTIVITY ASP RATE CARD ARRAY
          activityAspRateCard.push(tableName.fromColumn);
          //PUSH TO MASTER TABLES IF IT HAS MAPPING
          if (tableName.mapping) {
            masterTables[tableName.fromService].push(tableName.targetTable);
          }
          //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
          collection[tableName.id] = [
            `activities.activityAspRateCard.${tableName.fromColumn}`,
            `${tableName.columnName}`,
            tableName.mapping,
            tableName.targetTable,
            tableName.targetColumn,
            tableName.fieldType,
            tableName.fromService,
            tableName.targetTableHasRelation,
            tableName.relationTable,
            tableName.relationName,
            tableName.relationTableColumn,
          ];
        } else if (
          tableName &&
          tableName.fromTable === "activityTransactions"
        ) {
          //IF FROM TABLE IS ACTIVITY TRANSACTION

          //PUSH ACTIVITY TRANSACTION RELATED COLUMN TO ACTIVITY TRANSACTION ARRAY
          activityTransaction.push(tableName.fromColumn);
          //PUSH TO MASTER TABLES IF IT HAS MAPPING
          if (tableName.mapping) {
            masterTables[tableName.fromService].push(tableName.targetTable);
          }
          //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
          collection[tableName.id] = [
            `activities.activityTransactions.${tableName.fromColumn}`,
            `${tableName.columnName}`,
            tableName.mapping,
            tableName.targetTable,
            tableName.targetColumn,
            tableName.fieldType,
            tableName.fromService,
            tableName.targetTableHasRelation,
            tableName.relationTable,
            tableName.relationName,
            tableName.relationTableColumn,
          ];
        } else if (tableName && tableName.fromTable === "caseSlas") {
          //IF FROM TABLE IS CASE SLA

          //PUSH TO MASTER TABLES IF IT HAS MAPPING
          if (tableName.mapping) {
            masterTables[tableName.fromService].push(tableName.targetTable);
          }

          if (tableName.columnName == "Agent Reason for SLA Violation") {
            //PUSH AGENT ASSIGNMENT SLA RELATED COLUMN TO AGENT ASSIGNMENT SLA ARRAY
            agentAssignmentSla.push(tableName.fromColumn);
            //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
            collection[tableName.id] = [
              `agentAssignmentSla.${tableName.fromColumn}`,
              `${tableName.columnName}`,
              tableName.mapping,
              tableName.targetTable,
              tableName.targetColumn,
              tableName.fieldType,
              tableName.fromService,
              tableName.targetTableHasRelation,
              tableName.relationTable,
              tableName.relationName,
              tableName.relationTableColumn,
            ];
          } else if (
            tableName.columnName == "ASP Reason for SLA Violation" ||
            tableName.columnName == "Dealer Reason for SLA Violation"
          ) {
            let tableFromColumn: any = "";
            //PUSH ASP ASSIGNMENT SLA RELATED COLUMN TO ASP ASSIGNMENT SLA ARRAY
            if (tableName.columnName == "ASP Reason for SLA Violation") {
              aspAssignmentSla.push(tableName.fromColumn);
              tableFromColumn = `activities.aspAssignmentSla.${tableName.fromColumn}`;
            } else if (
              tableName.columnName == "Dealer Reason for SLA Violation"
            ) {
              //PUSH DEALER PAYMENT SLA RELATED COLUMN TO DEALER PAYMENT SLA ARRAY
              dealerPaymentSla.push(tableName.fromColumn);
              tableFromColumn = `activities.dealerPaymentSla.${tableName.fromColumn}`;
            }
            //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
            collection[tableName.id] = [
              tableFromColumn,
              `${tableName.columnName}`,
              tableName.mapping,
              tableName.targetTable,
              tableName.targetColumn,
              tableName.fieldType,
              tableName.fromService,
              tableName.targetTableHasRelation,
              tableName.relationTable,
              tableName.relationName,
              tableName.relationTableColumn,
            ];
          } else {
            //PUSH ACTIVE CASE SLA RELATED COLUMN TO ACTIVE CASE SLA ARRAY
            firstCaseSla.push(tableName.fromColumn);
            //PUSH ALL THE TABLE RELATED DETAILS TO COLLECTION ARRAY
            collection[tableName.id] = [
              `firstCaseSla.${tableName.fromColumn}`,
              `${tableName.columnName}`,
              tableName.mapping,
              tableName.targetTable,
              tableName.targetColumn,
              tableName.fieldType,
              tableName.fromService,
              tableName.targetTableHasRelation,
              tableName.relationTable,
              tableName.relationName,
              tableName.relationTableColumn,
            ];
          }
        } else if (tableName && tableName.fromTable === "notAtable") {
          if (
            tableName.columnName ==
            "ASP PickupTime Difference of Actual vs Expected"
          ) {
            // aspPickUpTimeDiff
            activity.push("aspReachedToPickupAt");
            caseDetail.push("deliveryRequestPickupDate");
            caseDetail.push("deliveryRequestPickupTime");
          }
          if (tableName.columnName == "ASP DropTime Difference") {
            // aspDropTimeDiff
            activity.push("aspStartedToDropAt");
            activity.push("aspReachedToDropAt");
          }
          if (
            tableName.columnName ==
            "Agent Time Difference of Pickup vs Assigned"
          ) {
            // agentTimeDiff
            caseDetail.push("agentAssignedAt");
            caseDetail.push("createdAt");
          }
          if (
            tableName.columnName ==
            "Dealer Time Difference Payment Request Vs paid"
          ) {
            // dealerTimeDiff
            activity.push("sentApprovalAt");
            activityTransaction.push("paidAt");
          }
          if (tableName.columnName == "ASP Total Waiting time") {
            // aspTotalWaitTimeDiff
            activity.push("aspReachedToPickupAt");
            activity.push("aspReachedToDropAt");
            activity.push("aspStartedToDropAt");
            activity.push("aspEndServiceAt");
          }

          collection[tableName.id] = [
            `${tableName.fromColumn}`,
            `${tableName.columnName}`,
            tableName.mapping,
            tableName.targetTable,
            tableName.targetColumn,
            tableName.fieldType,
            tableName.fromService,
            tableName.targetTableHasRelation,
            tableName.relationTable,
            tableName.relationName,
            tableName.relationTableColumn,
          ];
        }
      }

      let mainInclude: any = [];
      let relationTableInclude: any = [];
      let groupByColumn: any = ["caseDetails.id"];
      if (
        activity.length > 0 ||
        activityTransaction.length > 0 ||
        activityAspRateCard.length > 0 ||
        activityAspDetail.length > 0 ||
        agentAssignmentSla.length > 0 ||
        aspAssignmentSla.length > 0 ||
        dealerPaymentSla.length > 0 ||
        firstCaseSla.length > 0
      ) {
        //INCLUDE ActivityAspDetails IF ACTIVITY ASP DETAIL ARRAY HAS VALUE(WHICH MEANS ACTIVITY ASP DETAIL RELATED COLUMNS EXISTS)
        if (activityAspDetail.length > 0) {
          relationTableInclude.push({
            model: ActivityAspDetails,
            attributes: ["id", ...activityAspDetail],
            where: activityAspWhere,
            required: false,
          });
        }
        //INCLUDE ActivityAspRateCards IF ACTIVITY ASP RATE CARD ARRAY HAS VALUE(WHICH MEANS ACTIVITY ASP RATE CARD RELATED COLUMNS EXISTS)
        if (activityAspRateCard.length > 0) {
          relationTableInclude.push({
            required: false,
            model: ActivityAspRateCards,
            attributes: ["id", ...activityAspRateCard],
          });
        }
        //INCLUDE ActivityTransactions IF ACTIVITY TRANSACTION ARRAY HAS VALUE(WHICH MEANS ACTIVITY TRANSACTION RELATED COLUMNS EXISTS)
        if (activityTransaction.length > 0) {
          relationTableInclude.push({
            required: false,
            model: ActivityTransactions,
            attributes: ["id", ...activityTransaction],
            where: { paymentTypeId: 170 },
          });
        }

        //INCLUDE CASE SLA IF ASP ASSIGNMENT SLA ARRAY HAS VALUE(WHICH MEANS ACTIVITY SLA RELATED COLUMNS EXISTS)
        if (aspAssignmentSla.length > 0) {
          relationTableInclude.push({
            required: false,
            model: CaseSla,
            as: "aspAssignmentSla",
            attributes: ["id", ...aspAssignmentSla],
            where: { slaConfigId: 361 }, //ASP Assignment & Acceptance
          });
        }

        //INCLUDE CASE SLA IF DEALER PAYMENT SLA ARRAY HAS VALUE(WHICH MEANS ACTIVITY SLA RELATED COLUMNS EXISTS)
        if (dealerPaymentSla.length > 0) {
          relationTableInclude.push({
            required: false,
            model: CaseSla,
            as: "dealerPaymentSla",
            attributes: ["id", ...dealerPaymentSla],
            where: { slaConfigId: 363 }, //Dealer Advance Payment - Final Warning
          });
        }

        mainInclude = [
          {
            model: Activities,
            attributes: ["id", ...activity],
            required: false,
            include: relationTableInclude,
          },
        ];

        //INCLUDE CASE SLA IF AGENT ASSIGNMENT SLA ARRAY HAS VALUE(WHICH MEANS CASE SLA RELATED COLUMNS EXISTS)
        if (agentAssignmentSla.length > 0) {
          mainInclude.push({
            model: CaseSla,
            as: "agentAssignmentSla",
            attributes: ["id", ...agentAssignmentSla],
            required: false,
            where: { slaConfigId: 360 }, //Agent Assignment
          });
        }

        //INCLUDE CASE SLA IF ACTIVE CASE SLA ARRAY HAS VALUE(WHICH MEANS CASE SLA RELATED COLUMNS EXISTS)
        if (firstCaseSla.length > 0) {
          mainInclude.push({
            model: CaseSla,
            as: "firstCaseSla",
            attributes: ["id", ...firstCaseSla],
            required: false,
          });
        }

        groupByColumn = ["activities.id", "caseDetails.id"];
      }

      let fetchedCaseDetails: any = await CaseDetails.findAll({
        raw: true,
        attributes: caseDetail,
        where: caseWhere,
        include: mainInclude,
        group: groupByColumn,
      });
      fetchedCaseDetails = await calculateTimeDifferene(
        fetchedCaseDetails,
        reportColumnIds
      );

      const caseDetailIds = fetchedCaseDetails.map((detail: any) => detail.id);
      const caseSlas = await CaseSla.findAll({
        attributes: ["id", "slaConfigId", "slaStatus", "caseDetailId"],
        where: {
          caseDetailId: caseDetailIds,
        },
        order: [["id", "desc"]],
      });

      let tablePrimaryIds = Object();
      let tableColumns = Object();
      const finalData: any = await Promise.all(
        fetchedCaseDetails.map((fetchedCaseDetail: any) => {
          let mappedData = Object();
          const activeCaseSla = caseSlas.find(
            (sla: any) => sla.caseDetailId === fetchedCaseDetail.id
          );
          for (const reportColumnId of reportColumnIds) {
            let fromColumn = collection[reportColumnId][0]; //FROM COLUMN
            let columnName = collection[reportColumnId][1]; //COLUMN NAME
            let hasMapping = collection[reportColumnId][2]; //MAPPING
            let targetTable = collection[reportColumnId][3]; //TARGET TABLE
            let targetColumn = collection[reportColumnId][4]; //TARGET COLUMN

            if (
              fromColumn === "firstCaseSla.slaStatus" ||
              fromColumn === "firstCaseSla.slaConfigId"
            ) {
              fetchedCaseDetail["firstCaseSla.id"] =
                activeCaseSla?.dataValues.id || null;
              fetchedCaseDetail["firstCaseSla.slaConfigId"] =
                activeCaseSla?.dataValues.slaConfigId || null;
              fetchedCaseDetail["firstCaseSla.slaStatus"] =
                activeCaseSla?.dataValues.slaStatus || null;
            }

            // IF REPORT COLUMN HAS MAPPING
            if (hasMapping) {
              //DEFINE tablePrimaryIds & tableColumns ARRAY IF THE VALUE NOT SET
              if (tablePrimaryIds[targetTable] == undefined) {
                tablePrimaryIds[targetTable] = Array();
                tableColumns[targetTable] = ["id"];
              }
              // IF THE CASE DETAIL OR RELATIONAL TABLE COLUMN HAS VALUE
              if (
                fetchedCaseDetail[fromColumn] != null &&
                fetchedCaseDetail[fromColumn] != ""
              ) {
                tablePrimaryIds[targetTable].push(
                  fetchedCaseDetail[fromColumn]
                ); //PUSH ID VALUE AGAINST TARGET TABLE IN tablePrimaryIds ARRAY
                tableColumns[targetTable].push(targetColumn); //PUSH TARGET COLUMNS AGAINST TARGET TABLE IN tableColumns ARRAY
              }
            }
            // ASSIGN THE VALUE TO HEADER
            // LIKE Agent Name = 246
            mappedData[columnName] = fetchedCaseDetail[fromColumn];
          }

          return mappedData;
        })
      );

      let caseObject = await getCaseObjects(
        masterTables,
        tablePrimaryIds,
        tableColumns
      );

      return res.status(200).json({
        success: true,
        data: {
          fetchedCaseDetails,
          finalData,
          collection,
          reportColumnIds,
          masterTables,
          caseObject,
          tablePrimaryIds,
          tableColumns,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
  async function getCaseObjects(
    masterTables: any,
    tablePrimaryIds: any,
    tableColumns: any
  ) {
    const mastersData = Object();
    const defaultMasters: any = {
      activities: Activities,
      activityAspDetails: ActivityAspDetails,
      activityAspLiveLocations: ActivityAspLiveLocations,
      activityAspRateCards: ActivityAspRateCards,
      activityChargeAttachments: ActivityChargeAttachments,
      activityCharges: ActivityCharges,
      activityDetails: ActivityDetails,
      activityInventories: ActivityInventories,
      activityLogs: ActivityLogs,
      activityTransactions: ActivityTransactions,
      caseDetails: CaseDetails,
    };
    let tempCases: any = Array.from(new Set(masterTables.case));
    for (const masters of tempCases) {
      if (
        defaultMasters[masters] &&
        tablePrimaryIds[masters] &&
        tablePrimaryIds[masters].length > 0
      ) {
        let temp = await defaultMasters[masters].findAll({
          where: { id: tablePrimaryIds[masters] },
          attributes: tableColumns[masters],
        });
        mastersData[masters] = temp;
      }
    }

    const caseTableValues = Object();
    for (const masters in mastersData) {
      const caseObjects = mastersData[masters].reduce(
        (accumulator: any, caseData: any) => {
          accumulator[caseData.id] = caseData.dataValues;
          return accumulator;
        },
        {}
      );
      caseTableValues[masters] = caseObjects;
    }
    return caseTableValues;
  }

  function camelCaseToTitleCase(str: any) {
    return str
      .replace(/([A-Z])/g, " $1") // Add space before capital letters
      .replace(/^./, function (match: any) {
        return match.toUpperCase();
      }); // Convert first character to uppercase
  }
  export async function reportColumnListing(req: Request, res: Response) {
    try {
      const payload = req.validBody;
      let requiredColumn = [];
      let where = Object();

      if (payload.roleId != null && payload.roleId != undefined) {
        let reportColumn: any = await RoleBasedColumns.findOne({
          where: { roleId: payload.roleId },
          attributes: ["reportColumn"],
        });
        requiredColumn =
          reportColumn == null ? [] : JSON.parse(reportColumn.reportColumn);
      }
      if (payload.filter) {
        let reportColumn: any = await RoleBasedColumns.findOne({
          where: { roleId: payload.orgRoleId },
          attributes: ["reportColumn"],
        });
        requiredColumn =
          reportColumn == null ? [] : JSON.parse(reportColumn.reportColumn);
        where.id = requiredColumn;
      }
      let allColumns: any = await ReportColumns.findAll({
        where: where,
        attributes: ["id", "columnName"],
      });
      let markedColumns = new Set(requiredColumn); // Convert the array to a Set

      let result = allColumns.map((column: any) => ({
        id: column.id,
        columnName: column.columnName,
        checked: markedColumns.has(column.id), // Use Set's has method for checking
      }));

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
  export async function roleBasedColumnList(req: Request, res: Response) {
    try {
      //Require data destructure;
      const inData = req.validBody;
      const limit = parseInt(inData.limit as string);
      const offset = parseInt(inData.offset as string);
      const search = inData.search;
      const startDate = inData.startDate;
      const endDate = inData.endDate;
      const roleList = inData.roleList;
      const roleObject = roleList.reduce((acc: any, user: any) => {
        acc[user.id] = user;
        return acc;
      }, {});
      let whereColumns: any = {};

      if (
        startDate !== undefined &&
        endDate !== undefined &&
        startDate !== null &&
        endDate !== null
      ) {
        whereColumns[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("createdAt")),
            ">=",
            moment
              .tz(startDate, "YYYY-MM-DD", "Asia/Kolkata")
              .format("YYYY-MM-DD")
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("createdAt")),
            "<=",
            moment
              .tz(endDate, "YYYY-MM-DD", "Asia/Kolkata")
              .format("YYYY-MM-DD")
          ),
        ];
      }
      const result: any = await RoleBasedColumns.findAll({
        attributes: ["id", "roleId", "reportColumn", "createdAt"],
        order: [["id", "asc"]],
        where: whereColumns,
      });
      let data = [];
      if (search !== undefined) {
        data = result
          .filter((item: any) => {
            const roleName = roleObject[item.roleId]?.name.toLowerCase(); // Convert name to lowercase
            const searchLowerCase = search.toLowerCase(); // Convert search string to lowercase
            return roleName.includes(searchLowerCase);
          })
          .map((res: any) => {
            return {
              id: res.id,
              roleId: res.roleId,
              name: roleObject[res.roleId]?.name,
              columnCount: JSON.parse(res.reportColumn).length,
              createdAt: moment
                .tz(res.createdAt, "Asia/Kolkata")
                .format("DD/MM/YYYY h:mm A"),
            };
          });
      } else {
        data = result.map((res: any) => {
          return {
            id: res.id,
            roleId: res.roleId,
            name: roleObject[res.roleId]?.name,
            columnCount: JSON.parse(res.reportColumn).length,
            createdAt: moment
              .tz(res.createdAt, "Asia/Kolkata")
              .format("DD/MM/YYYY h:mm A"),
          };
        });
      }
      return res.status(200).json({
        success: true,
        data: {
          count: data.length,
          rows: data.slice(
            offset ? offset : defaultOffset,
            limit ? limit : defaultLimit
          ),
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function roleBasedColumn(req: Request, res: Response) {
    try {
      const payload = req.validBody;
      if (payload.reportColumn.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Report Fields Required",
        });
      }
      if (payload.id == null || payload.id == undefined) {
        let found = await RoleBasedColumns.findOne({
          where: {
            [Op.or]: [{ roleId: payload.roleId }],
          },
        });
        if (!found) {
          let newData = {
            roleId: payload.roleId,
            reportColumn: JSON.stringify(payload.reportColumn),
          };
          let allColumns = await RoleBasedColumns.create(newData);
          return res.status(200).json({
            success: true,
            data: allColumns,
            message: "Columns created Sucessfully",
          });
        } else {
          return res.status(200).json({
            success: false,
            error: "Role already Mapped",
          });
        }
      } else {
        let found = await RoleBasedColumns.findOne({
          where: {
            id: {
              [Op.not]: payload.id,
            },
            [Op.or]: [{ roleId: payload.roleId }],
          },
        });
        if (!found) {
          let updateData = {
            roleId: payload.roleId,
            reportColumn: JSON.stringify(payload.reportColumn),
          };
          await RoleBasedColumns.update(updateData, {
            where: { id: payload.id },
          });
          return res.status(200).json({
            success: true,
            data: updateData,
            message: "Columns updated Sucessfully",
          });
        } else {
          return res.status(200).json({
            success: false,
            error: "Role already Mapped",
          });
        }
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
  export async function delRoleBasedColumn(req: Request, res: Response) {
    try {
      const payload = req.validBody;
      let found = await RoleBasedColumns.findOne({
        where: { id: payload.id },
      });
      if (!found) {
        return res.status(200).json({
          success: false,
          error: `Id ${payload.id} Not Found`,
        });
      } else {
        await RoleBasedColumns.destroy({
          where: { id: payload.id },
        });
        return res.status(200).json({
          success: true,
          message: `Deleted Sucessfully`,
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

const customTimeFormat = (duration: any) => {
  // Calculate the total hours including days
  const totalHours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  // Format the result as HH:mm:ss
  return `${String(totalHours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
};
