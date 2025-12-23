import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const activityAspLiveLocations = sequelize.define(
  "activityAspLiveLocations",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    activityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    aspId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    location: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedAt: {
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

Activities.hasMany(activityAspLiveLocations, { foreignKey: "activityId" });
activityAspLiveLocations.belongsTo(Activities, { foreignKey: "activityId" });

export default activityAspLiveLocations;
