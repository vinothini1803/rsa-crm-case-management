import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const activityChargeAttachments = sequelize.define(
  "activityChargeAttachments",
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
    chargeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    originalName: {
      type: DataTypes.STRING(250),
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

Activities.hasMany(activityChargeAttachments, {
  foreignKey: "activityId",
});
activityChargeAttachments.belongsTo(Activities, {
  foreignKey: "activityId",
});

export default activityChargeAttachments;
