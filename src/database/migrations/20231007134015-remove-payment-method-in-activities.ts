import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP paymentMethodId;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `paymentMethodId` INT UNSIGNED NULL DEFAULT NULL AFTER `dealerApprovalRejectReason`;"
    );
  },
};
