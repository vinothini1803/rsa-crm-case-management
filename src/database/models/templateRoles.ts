import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Templates } from ".";

const templateRoles = sequelize.define(
  "templateRoles",
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
    roleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    mailSendType: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "1-to,2-cc",
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
    tableName: "templateRoles",
  }
);

Templates.hasMany(templateRoles, { foreignKey: "templateId" });

export default templateRoles;
