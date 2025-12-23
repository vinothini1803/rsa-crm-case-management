import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const activityClientRateCards = sequelize.define(
  "activityClientRateCards",
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
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    rangeLimit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    belowRangePrice: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    aboveRangePrice: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    waitingChargePerHour: {
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

Activities.hasOne(activityClientRateCards, {
  foreignKey: "activityId",
});
activityClientRateCards.belongsTo(Activities, {
  foreignKey: "activityId",
});

export default activityClientRateCards;
