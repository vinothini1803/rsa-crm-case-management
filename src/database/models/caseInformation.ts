import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseDetails } from ".";

const caseInformation = sequelize.define(
  "caseInformation",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseDetailId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    customerContactName: { type: DataTypes.STRING(255), allowNull: true },
    customerMobileNumber: { type: DataTypes.STRING(20), allowNull: true },
    customerCurrentContactName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    customerCurrentMobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    customerAlternateMobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    customerStateId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    customerCityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    voiceOfCustomer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dispositionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    contactLanguageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    customerCurrentContactLanguageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    }, //languages
    channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    caseTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    accidentTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    specialCraneNeeded: { type: DataTypes.BOOLEAN, allowNull: true },
    serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    subServiceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    conditionOfVehicleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    conditionOfVehicleOthers: { type: DataTypes.TEXT, allowNull: true },
    irateCustomer: { type: DataTypes.BOOLEAN, allowNull: true },
    womenAssist: { type: DataTypes.BOOLEAN, allowNull: true },
    hasActivePolicy: { type: DataTypes.BOOLEAN, defaultValue: 0 },
    policyNumber: { type: DataTypes.STRING(100), allowNull: true },
    fuelTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    saleDate: { type: DataTypes.DATEONLY, allowNull: true },
    runningKm: { type: DataTypes.STRING(100), allowNull: true },
    policyTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
    policyStartDate: { type: DataTypes.DATEONLY, allowNull: true },
    policyEndDate: { type: DataTypes.DATEONLY, allowNull: true },
    serviceEligibilityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    serviceEligibility: { type: DataTypes.STRING(100), allowNull: true },
    customerPolicyStateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    salesPolicyId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    policyPremiumId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    getLocationViaId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    reasonForManualLocationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    }, //configs or master
    sentToMobile: { type: DataTypes.STRING(20), allowNull: true },
    // sentLink: { type: DataTypes.TEXT, allowNull: true },
    locationLogId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    breakdownLocation: { type: DataTypes.TEXT, allowNull: true },
    nearestCity: { type: DataTypes.STRING(100), allowNull: true },
    breakdownLat: { type: DataTypes.STRING(100), allowNull: true },
    breakdownLong: { type: DataTypes.STRING(100), allowNull: true },
    breakdownAreaId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    breakdownLocationStateId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    addressByCustomer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    breakdownLandmark: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    breakdownLocationChangeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    breakdownLocationUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    customerLocation: { type: DataTypes.TEXT, allowNull: true },
    vehicleLocationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
    dropLocationTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
    customerPreferredLocationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    }, //configs
    dropDealerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    nearestDealerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    dropLocationLat: { type: DataTypes.STRING(100), allowNull: true },
    dropLocationLong: { type: DataTypes.STRING(100), allowNull: true },
    dropLocation: { type: DataTypes.TEXT, allowNull: true },
    dropAreaId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    dropLocationStateId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    dropLocationChangeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    breakdownToDropLocationDistance: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    customerNeedToPay: { type: DataTypes.BOOLEAN, allowNull: true },
    nonMembershipType: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    additionalChargeableKm: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    sendPaymentLinkTo: { type: DataTypes.STRING(20), allowNull: true },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    accidentalDocLinkId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    additionalServiceRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    custodyRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    cabAssistanceRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    hasAccidentalDocument: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    withoutAccidentalDocument: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    withoutAccidentalDocumentRemarks: {
      type: DataTypes.TEXT,
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
  }
);

caseInformation.belongsTo(CaseDetails, { foreignKey: "caseDetailId" });
CaseDetails.hasOne(caseInformation, { foreignKey: "caseDetailId" });

export default caseInformation;
