import { Request, Response } from "express";
import {
  CaseDetails,
  Activities,
  ActivityAspDetails,
  ActivityDetails,
  ActivityInventories,
  ActivityCharges,
  ActivityTransactions,
  ActivityLogs,
} from "../database/models/index";
import config from "../config/config.json";
import axios from "axios";
import { Op } from "sequelize";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import notificationController from "./notificationController";

export namespace deliveryControl {
  const DEFAULT_LIMIT = 10;

  //API with endpoint (Master);
  const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
  const endpointMaster = config.MasterService.endpoint;

  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  const subMasterDealers = `${config.MasterService.serviceAccess.dealers}`;

  //SEND FOR ESTIMATED AMOUNT APPROVAL
  export async function sendForApproval(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const { activityId } = req.body;

      const activityExist = await Activities.findOne({
        attributes: ["id", "caseDetailId"],
        where: {
          id: activityId,
          activityStatusId: 2, //Assigned
        },
        include: {
          model: CaseDetails,
          where: {
            statusId: 2, //In Progress
          },
          attributes: ["id"],
          required: true,
        },
      });
      if (!activityExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const activityAspDetail = await ActivityAspDetails.findOne({
        attributes: ["id", "activityId", "estimatedTotalAmount"],
        where: { activityId: activityId },
      });
      if (!activityAspDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity Asp Detail not found",
        });
      }

      const caseDetail = await CaseDetails.findByPk(
        activityExist.dataValues.caseDetailId,
        {
          attributes: [
            "id",
            "agentId",
            "vin",
            "caseNumber",
            "dealerId",
            "deliveryRequestCreatedDealerId",
          ],
        }
      );
      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case Detail not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: caseDetail.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      const notMaturedRefundActivityTransactionExists =
        await ActivityTransactions.findOne({
          attributes: ["id", "amount", "paidToDealerId"],
          where: {
            paymentTypeId: 173, //ADVANCE REFUND
            transactionTypeId: 180, //CREDIT
            paymentStatusId: 191, //SUCCESS
            isAdvanceRefundUsed: 0, //NOT USED
          },
          include: [
            {
              model: Activities,
              attributes: [],
              required: true,
              where: {
                financeStatusId: 3, // NOT MATURED
                caseDetailId: activityExist.dataValues.caseDetailId,
                id: {
                  [Op.ne]: activityId,
                },
              },
              order: [["id", "desc"]],
            },
          ],
        });

      if (notMaturedRefundActivityTransactionExists) {
        // GET DEALER DETAILS
        const getDealerDetail = await axios.get(
          `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getDealerDetail}?dealerId=${notMaturedRefundActivityTransactionExists.dataValues.paidToDealerId}`
        );
        if (!getDealerDetail.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Refund paid dealer not found",
          });
        }

        //CHECK IF ESTIMATED AMOUNT LESS THAN REFUND AMOUNT THEN DEBIT ESTIMATED AMOUNT ONLY OTHERWISE TAKE REFUND AMOUNT
        const debitAmount =
          parseFloat(activityAspDetail.dataValues.estimatedTotalAmount) <
            parseFloat(
              notMaturedRefundActivityTransactionExists.dataValues.amount
            )
            ? activityAspDetail.dataValues.estimatedTotalAmount
            : notMaturedRefundActivityTransactionExists.dataValues.amount;

        //DEBIT AMOUNT FROM DEALER WALLET ON SALES PORTAL
        const debitDealerWalletData = {
          dealerCode: getDealerDetail.data.data.code,
          amount: debitAmount,
          vin: caseDetail.dataValues.vin,
          requestId: caseDetail.dataValues.caseNumber,
          type: "advance",
        };
        const debitDealerWalletResponse = await axios.post(
          `${process.env.RSA_BASE_URL}/crm/dealer/debitWalletTransaction`,
          debitDealerWalletData
        );
        if (!debitDealerWalletResponse.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: debitDealerWalletResponse.data.error,
          });
        }

        //CREATE ACTIVITY TRANSACTION DATA FOR ADVANCE AMOUNT
        const activityTransactionData = {
          activityId: activityId,
          dealerId: caseDetail.dataValues.dealerId
            ? caseDetail.dataValues.dealerId
            : caseDetail.dataValues.deliveryRequestCreatedDealerId,
          date: new Date(),
          paymentTypeId: 170, //ADVANCE
          transactionTypeId: 181, //DEBIT
          amount: debitAmount,
          paymentStatusId: 191, //SUCCESS,
          paymentMethodId: 1, //WALLET
          paidByDealerId:
            notMaturedRefundActivityTransactionExists.dataValues.paidToDealerId,
          paidAt: new Date(),
        };

        await ActivityTransactions.create(activityTransactionData, {
          transaction: transaction,
        });

        const activityData = {
          dealerApprovalStatusId: 42, //APPROVED
          activityStatusId: 10, //PAYMENT PAID
          aspActivityStatusId: 2, //WAITING FOR SERVICE INITIATION
          activityAppStatusId: 3, //WAITING FOR SERVICE INITIATION
          sentApprovalAt: new Date(),
        };

        await Activities.update(activityData, {
          where: { id: activityId },
          transaction: transaction,
        });

        //SAVE ACTIVITY LOG
        await ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name}" has sent a payment request for the advance amount to the dealer.`,
          },
          {
            transaction: transaction,
          }
        );

        const formattedDebitAmount = Utils.convertToIndianCurrencyFormat(
          parseFloat(debitAmount)
        );

        //SAVE ACTIVITY LOG
        await ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 240, //WEB
            title: `The dealer "${getDealerDetail.data.data.name}" has paid the advance amount(${formattedDebitAmount}) of the delivery request.`,
          },
          {
            transaction: transaction,
          }
        );

        //UPDATE ADVANCE REFUND USED AS "USED"
        await ActivityTransactions.update(
          { isAdvanceRefundUsed: 1 },
          {
            where: {
              id: notMaturedRefundActivityTransactionExists.dataValues.id,
            },
            transaction: transaction,
          }
        );

        //FCM PUSH NOTIFICATIONS (SEND FOR APPROVAL)
        notificationController.sendNotification({
          caseDetailId: activityExist.dataValues.caseDetailId,
          notifyToAll: [""],
          templateId: 13,
          agentName: getAgentDetail.data.user.name,
          paidByDealerDetail:
            notMaturedRefundActivityTransactionExists.dataValues.paidToDealerId,
          paidByDealerOnly: true,
        });

        //FCM PUSH NOTIFICATIONS (ADVANCE AMOUNT AUTO DEBIT)
        notificationController.sendNotification({
          caseDetailId: activityExist.dataValues.caseDetailId,
          notifyToAll: [""],
          templateId: 20,
          paidByDealerDetail:
            notMaturedRefundActivityTransactionExists.dataValues.paidToDealerId,
          paidByDealerOnly: true,
        });

        await transaction.commit();
        return res.status(200).json({
          success: true,
          message:
            "Approval sent and dealer refund amount debited successfully",
        });
      } else {
        const advanceAmountPaidForOherActivityExists =
          await ActivityTransactions.findOne({
            attributes: ["id", "paidByDealerId"],
            where: {
              paymentTypeId: 170, //ADVANCE AMOUNT
              transactionTypeId: 181, //DEBIT
              paymentStatusId: 191, //SUCCESS
            },
            include: [
              {
                model: Activities,
                attributes: [],
                required: true,
                where: {
                  caseDetailId: activityExist.dataValues.caseDetailId,
                  id: {
                    [Op.ne]: activityId,
                  },
                },
                order: [["id", "asc"]],
              },
            ],
          });

        //CREATE ACTIVITY TRANSACTION DATA FOR ADVANCE AMOUNT
        const activityTransactionData = {
          activityId: activityId,
          dealerId: caseDetail.dataValues.dealerId
            ? caseDetail.dataValues.dealerId
            : caseDetail.dataValues.deliveryRequestCreatedDealerId,
          date: new Date(),
          paymentTypeId: 170, //ADVANCE
          transactionTypeId: 181, //DEBIT
          amount: activityAspDetail.dataValues.estimatedTotalAmount,
          paymentStatusId: 190, //PENDING
        };

        await ActivityTransactions.create(activityTransactionData, {
          transaction: transaction,
        });

        const activityData = {
          dealerApprovalStatusId: 41, // REQUESTED
          activityStatusId: 9, // WAITING FOR DEALER APPROVAL
          sentApprovalAt: new Date(),
        };

        await Activities.update(activityData, {
          where: { id: activityId },
          transaction: transaction,
        });

        //SAVE ACTIVITY LOG
        await ActivityLogs.create(
          {
            activityId: activityId,
            typeId: 240, //WEB
            title: `The agent "${getAgentDetail.data.user.name}" has sent a payment request for the advance amount to the dealer.`,
          },
          {
            transaction: transaction,
          }
        );

        if (advanceAmountPaidForOherActivityExists) {
          //FCM PUSH NOTIFICATIONS (PAID BY DEALER ONLY)
          notificationController.sendNotification({
            caseDetailId: activityExist.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 13,
            agentName: getAgentDetail.data.user.name,
            paidByDealerDetail:
              advanceAmountPaidForOherActivityExists.dataValues.paidByDealerId,
            paidByDealerOnly: true,
          });
        } else {
          //FCM PUSH NOTIFICATIONS (ALL THE DEALERS)
          notificationController.sendNotification({
            caseDetailId: activityExist.dataValues.caseDetailId,
            notifyToAll: [""],
            templateId: 13,
            agentName: getAgentDetail.data.user.name,
          });
        }

        await transaction.commit();
        return res.status(200).json({
          success: true,
          message: "Approval has been sent",
        });
      }
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Update Vehicle Registration Number
  export async function updateVehicleNumber(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const { activityId, aspId, vehicleNumber, logTypeId, authUserRoleId } =
        req.body;

      let aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`;
      //AGENT
      if (authUserRoleId == 3) {
        aspApiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}&setParanoidFalse=true`;
      }

      const [activityExist, activityAspDetailExist, getASPDetail]: any =
        await Promise.all([
          Activities.findOne({
            where: {
              id: activityId,
              activityStatusId: {
                [Op.in]: [1, 2, 3, 9, 10, 14], //1-OPEN, 2-ASSIGNED, 3-INPROGRESS, 9-WAITING FOR DEALER APPROVAL, 10-ADVANCE PAYMENT PAID, 14-ADVANCE PAY LATER
              },
            },
            attributes: ["id", "caseDetailId", "dealerApprovalStatusId"],
            include: {
              model: CaseDetails,
              where: {
                statusId: 2, //In Progress
              },
              required: true,
              attributes: ["id", "agentId"],
            },
          }),
          ActivityAspDetails.findOne({
            where: {
              activityId: activityId,
              aspId: aspId,
            },
            attributes: ["id", "aspId"],
          }),
          // GET ASP DETAILS
          axios.get(aspApiUrl),
        ]);

      if (!activityExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!activityAspDetailExist) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Activity ASP detail not found",
        });
      }

      if (!getASPDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // GET Agent DETAILS
      const getAgentDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: activityExist.caseDetail.dataValues.agentId,
        }
      );
      if (!getAgentDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Agent not found",
        });
      }

      await ActivityAspDetails.update(
        {
          aspVehicleRegistrationNumber: vehicleNumber,
        },
        { where: { activityId: activityId }, transaction: transaction }
      );

      //FCM PUSH NOTIFICATIONS
      let details: any = {
        caseDetailId: activityExist.caseDetail.dataValues.id,
        notifyToAll: [""],
      };

      //SAVE ACTIVITY LOG
      let activityLogTitle = null;
      //WEB
      if (logTypeId == 240) {
        activityLogTitle = `The vehicle registration number has been updated by the agent "${getAgentDetail.data.user.name}".`;
        details.templateId = 9;
        details.agentName = getAgentDetail.data.user.name;
      } else {
        //MOBILE
        activityLogTitle = `The vehicle registration number has been updated by the service provider "${getASPDetail.data.data.workshopName}".`;
        details.templateId = 8;
        details.workshopName = getASPDetail.data.data.workshopName;
        details.sourceFrom = 2; //Mobile
      }
      notificationController.sendNotification(details); // function get agent token details for agent, dealer, etc

      await ActivityLogs.create(
        {
          activityId: activityId,
          typeId: logTypeId,
          title: activityLogTitle,
        },
        {
          transaction: transaction,
        }
      );
      await transaction.commit();

      // CREATE REPORT SYNC TABLE RECORD FOR MOBILE APP USAGE REPORT
      Utils.createReportSyncTableRecord("mobileAppUsageReportDetails", [
        activityId,
      ]);

      return res.status(200).json({
        success: true,
        message: "Vehicle Registration Number has been updated",
        vehicleNumber: vehicleNumber,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Update Charges Details (NOT USED)
  export async function updateChargesDetails(req: Request, res: Response) {
    try {
      const { activityId, aspId, totalKm, serviceCost, ...chargesData } =
        req.body;
      const activityExist = await Activities.findOne({
        where: {
          id: activityId,
        },
      });
      if (!activityExist) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      const activityAspDetailExist = await ActivityAspDetails.findOne({
        where: {
          activityId: activityId,
          aspId: aspId,
        },
      });
      if (!activityAspDetailExist) {
        return res.status(200).json({
          success: false,
          error: "Activity ASP detail not found",
        });
      }

      const activityDetailExist = await ActivityDetails.findOne({
        where: {
          activityId: activityId,
        },
      });
      if (activityDetailExist) {
        await ActivityDetails.update(chargesData, {
          where: { activityId: activityId },
        });
      } else {
        const activityDetailData = {
          activityId: activityId,
          ...chargesData,
        };
        await ActivityDetails.create(activityDetailData);
      }

      await ActivityAspDetails.update(
        {
          totalKm: totalKm,
          serviceCost: serviceCost,
        },
        { where: { activityId: activityId } }
      );

      return res.status(200).json({
        success: true,
        message: "Charges details have been updated",
        ...chargesData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default deliveryControl;
