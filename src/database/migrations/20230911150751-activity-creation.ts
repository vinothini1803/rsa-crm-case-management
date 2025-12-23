import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("activities", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      caseDetailId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "caseDetails",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      activityNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dealerApprovalStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      dealerApprovalRejectReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      paymentMethodId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      membershipTypeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      membershipNumber: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      serviceStartDateTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reachedPickupOtp: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      reachedDropOtp: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      serviceEndDateTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      slaAchievedDelayed: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
      },
      financeStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      activityStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      aspActivityStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("activities");
  },
};
