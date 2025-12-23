import { DataTypes } from "sequelize";
import sequelize from "../connection";

const templateWhatsappDetails = sequelize.define(
  "templateWhatsappDetails",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    templateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    apiToken: {
      type: DataTypes.STRING(130),
      allowNull: true,
    },
    apiSender: {
      type: DataTypes.STRING(130),
      allowNull: true,
    },
    apiUrl: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    templateName: {
      type: DataTypes.STRING(150),
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
    tableName: "templateWhatsappDetails",
  }
);

export default templateWhatsappDetails;
