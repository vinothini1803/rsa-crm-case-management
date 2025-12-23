import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const activityAspDetails = sequelize.define(
  "activityAspDetails",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    activityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subServiceHasAspAssignment: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    serviceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspServiceAccepted: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    rejectReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    cancelReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspMechanicId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspMechanicAssignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspMechanicServiceAccepted: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    aspMechanicRejectReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspVehicleRegistrationNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    estimatedOnlineKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedRouteDeviationKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedTotalKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedTotalDuration: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    estimatedAspToPickupKm: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedAspToPickupKmDuration: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    estimatedPickupToDropKm: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedPickupToDropKmDuration: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },

    estimatedAspToBreakdownKm: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedAspToBreakdownKmDuration: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },

    estimatedBreakdownToAspKm: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedBreakdownToAspKmDuration: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },

    estimatedBreakdownToDropKm: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedBreakdownToDropKmDuration: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },

    estimatedDropToAspKm: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedDropToAspKmDuration: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    estimatedServiceCost: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedAdditionalCharge: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    discountPercentage: {
      type: DataTypes.DECIMAL(5, 2).UNSIGNED,
      allowNull: true,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    discountReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    discountReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    estimatedTotalTax: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedTotalAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    additionalKmEstimatedServiceCost: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
      comment: "Estimated service cost for additional KM payment",
    },
    additionalKmDiscountPercentage: {
      type: DataTypes.DECIMAL(5, 2).UNSIGNED,
      allowNull: true,
      comment: "Discount percentage for additional KM payment",
    },
    additionalKmDiscountAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
      comment: "Discount amount for additional KM payment",
    },
    additionalKmDiscountReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "Discount reason ID for additional KM payment",
    },
    additionalKmDiscountReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Discount reason for additional KM payment",
    },
    additionalKmEstimatedTotalTax: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
      comment: "Estimated total tax for additional KM payment",
    },
    additionalKmEstimatedTotalAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
      comment: "Estimated total amount for additional KM payment",
    },
    estimatedAspServiceCost: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedAspTotalTax: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    estimatedAspTotalAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualTotalKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    actualTotalKmReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actualServiceCost: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualAdditionalCharge: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualClientWaitingCharge: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualTotalTax: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualTotalAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualAspServiceCost: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualAspWaitingCharge: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualAspTotalTax: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualAspTotalAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    actualChargeCollectedFromCustomer: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
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
  }
);

//Relationships ---------------------------------

Activities.hasOne(activityAspDetails, {
  foreignKey: "activityId",
});
activityAspDetails.belongsTo(Activities, {
  foreignKey: "activityId",
});

export default activityAspDetails;
