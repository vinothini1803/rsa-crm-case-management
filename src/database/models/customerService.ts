import { DataTypes } from "sequelize";
import sequelize from "../connection";

const customerService = sequelize.define(
  "customerService",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    customerName: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    customerContactNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    vin: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    vehicleRegistrationNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    serviceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    policyTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    policyNumber: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    policyStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    policyEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    membershipTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    totalService: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    availedService: {
      type: DataTypes.INTEGER.UNSIGNED,
    },
    availableService: {
      // total
      type: DataTypes.INTEGER.UNSIGNED,
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
    paranoid: true,
  }
);

export default customerService;
