import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseDetails } from "./index";

const activities = sequelize.define(
  "activities",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseDetailId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    activityNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    isInitiallyCreated: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "1-Yes,0-No",
    },
    dealerApprovalStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dealerApprovalRejectReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dealerDocumentComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isImmediateService: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "1-Yes,0-No",
    },
    serviceInitiatingAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceExpectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspAutoAllocation: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "1-Yes,0-No",
    },
    isAspAutoAllocated: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
      comment: "1-Yes,0-No",
    },
    aspAssignedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    membershipTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    membershipNumber: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    serviceStartDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reachedBreakdownOtp: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    reachedPickupOtp: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    reachedDropOtp: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    serviceResumeDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceEndDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isServiceTimerRunning: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    serviceDuration: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    expectedServiceStartDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expectedServiceEndDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    slaAchievedDelayed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    financeStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    activityStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspActivityStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    activityAppStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    enableAspWaitingTimeInApp: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    aspWaitingTime: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    clientWaitingTime: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    isAspAcceptedCcDetail: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    aspRejectedCcDetailReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    proposedDelayReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    isDealerInvoiced: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    dealerInvoiceNumber: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    issueComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    serviceStatus: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    serviceSuccessReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    serviceFailureReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    serviceRemarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isServiceEntitlementUpdated: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    additionalServiceRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    custodyRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    isCustodySelf: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    isCustodyAspArrived: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    cabAssistanceRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    isCabAssistanceSelf: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    customerNeedToPay: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    advancePaymentMethodId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    advancePaymentPaidToId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    sendPaymentLinkTo: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    nonMembershipType: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    additionalChargeableKm: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    paidTotalKm: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Stores the total KM that customer paid for (captured during advance payment process)",
    },
    hasAdditionalKmForPayment: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "Indicates if additional KM payment is required (KM difference > 5 KM)",
    },
    additionalKmForPayment: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Stores the additional KM amount (difference > 5 KM) for payment collection",
    },
    paymentForAdditionalKmCaptured: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "Indicates if payment for additional KM has been captured in any activity with same serviceId",
    },
    customerAgreedToAdditionalPayment: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "Indicates if customer agreed to proceed with additional payment (true) or not (false)",
    },
    additionalPaymentRemarks: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Stores remarks/comments when customer does not agree to additional payment",
    },
    isVehicleHandedOver: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    vehicleHandOverOtp: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    agentPickedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspServiceAcceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceAcceptedInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    aspServiceRejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceRejectedInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    aspServiceCanceledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceCanceledInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    sentApprovalAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspStartedToBreakdownAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspReachedToBreakdownAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspStartedToPickupAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    startedToPickupInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    aspReachedToPickupAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reachedToPickupInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    pickupOtpVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pickupInventorySubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pickupSignatureSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspStartedToDropAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    startedToDropInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    aspReachedToDropAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reachedToDropInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    dropInventorySubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dropOtpVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspEndServiceAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endServiceInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    aspStartedToGarageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    startedToGarageInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    aspReachedToGarageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reachedToGarageInApp: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    dealerAdvanceInitialWarningSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    dealerAdvanceFinalWarningSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    dealerAdvanceEscalationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    isOldAspInvoicePushedToAspPortal: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    isReimbursement: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    reimbursementComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    technicianIdCardLinkId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    serviceProviderTrackLinkId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deletedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    tableName: "activities",
  }
);

//Relationships ---------------------------------

CaseDetails.hasMany(activities, {
  foreignKey: "caseDetailId",
});
activities.belongsTo(CaseDetails, {
  foreignKey: "caseDetailId",
});

export default activities;
