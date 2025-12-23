import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const activityDetails = sequelize.define(
  "activityDetails",
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    aspReachedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspStartLocation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    aspEndLocation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    onwardGoogleKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    dealerGoogleKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    returnGoogleKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    onwardKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    dealerKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    returnKm: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    dropLocationTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dropDealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dropLocation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dropLocationLat: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    dropLocationLong: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    dropLocationDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    paidToId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    paymentModeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    paymentReceiptNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ccBorderCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    ccGreenTaxCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    ccTollCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    ccEatableItemCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    ccFuelCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    aspBorderCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    aspGreenTaxCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    aspTollCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    aspEatableItemCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    aspFuelCharges: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    aspWaitingStartDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aspWaitingEndDateTime: {
      type: DataTypes.DATE,
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

Activities.hasOne(activityDetails, {
  foreignKey: "activityId",
});
activityDetails.belongsTo(Activities, {
  foreignKey: "activityId",
});

export default activityDetails;
