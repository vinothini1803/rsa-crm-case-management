import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CustomerService } from "./index";

const customerServiceEntitlement = sequelize.define(
  "customerServiceEntitlement",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    customerServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    subServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subServiceHasLimit: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    totalService: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    availableService: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    entitlementId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    entitlementLimit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    entitlementUnit: {
      type: DataTypes.STRING(20),
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
    indexes: [
      {
        unique: true,
        fields: ["customerServiceId", "subServiceId"],
      },
    ],
  }
);

CustomerService.hasMany(customerServiceEntitlement, {
  foreignKey: "customerServiceId",
});
customerServiceEntitlement.belongsTo(CustomerService, {
  foreignKey: "customerServiceId",
});

export default customerServiceEntitlement;
