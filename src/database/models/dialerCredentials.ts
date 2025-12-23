import { DataTypes } from "sequelize";
import sequelize from "../connection";

const dialerCredentials = sequelize.define(
  "dialerCredentials",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    apiKey: {
      type:  DataTypes.STRING(100),
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING(100),
      allowNull: true,
    }
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

export default dialerCredentials;
