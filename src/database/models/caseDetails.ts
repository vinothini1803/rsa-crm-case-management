import { DataTypes } from "sequelize";
import sequelize from "../connection";

const caseDetails = sequelize.define(
  "caseDetails",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    l1AgentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    agentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    agentAutoAllocation: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "1-Auto Allocation,0-Self assign to the L1 agent",
    },
    agentAssignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    agentReplacedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    previousAgentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    callCenterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    rmId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    caseNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    vin: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    vehicleTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    vehicleMakeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    vehicleModelId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    approximateVehicleValue: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    subjectID: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deliveryRequestSubServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deliveryRequestSchemeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    isActivityProcessing: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    activityProcessingStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceDescriptionId: { 
      type: DataTypes.INTEGER.UNSIGNED, 
      allowNull: true 
    },
    closureRemarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    closureRating: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    cancelReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    cancelDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelRemarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    locationTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    breakdownLocationTypeId: {
  type: DataTypes.INTEGER,
  allowNull: true,
},
    pickupLatitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    pickupLongitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    deliveryRequestPickUpLocation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deliveryRequestPickUpStateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deliveryRequestPickUpCityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    pickupLocationPinCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    pickupLocationChangeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dropLatitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    dropLongitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    deliveryRequestDropDealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deliveryRequestDropLocation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deliveryRequestDropStateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deliveryRequestDropCityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dropLocationPinCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    dropLocationChangeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contactNameAtPickUp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contactNumberAtPickUp: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    contactNameAtDrop: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contactNumberAtDrop: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    deliveryRequestPickupInitialDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveryRequestPickupInitialTime: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    deliveryRequestPickupDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveryRequestPickupTime: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hasDocuments: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    deliveryRequestCreatedDealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    feedbackRating: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    psfStatus: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
      comment: "1-Not completed, 2-Completed",
    },
    isCasePushedToAspPortal: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    inboundCallMonitorUCID: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    caseCreateClickedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isCustomerInvoiced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    customerInvoiceNumber: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    customerInvoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    customerInvoicePath: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isCancellationInvoiced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    cancellationInvoiceNumber: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    cancellationInvoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    cancellationInvoicePath: {
      type: DataTypes.TEXT,
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
    tableName: "caseDetails",
  }
);

export default caseDetails;
