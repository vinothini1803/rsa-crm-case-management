import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const activityCharges = sequelize.define(
  "activityCharges",
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
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    amount: {
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

Activities.hasMany(activityCharges, { foreignKey: "activityId" });
activityCharges.belongsTo(Activities, { foreignKey: "activityId" });

export default activityCharges;
