import { DataTypes } from "sequelize";
import sequelize from "../connection";

const attachments = sequelize.define(
  "attachments",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    attachmentTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    attachmentOfId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    entityId: {
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

export default attachments;
