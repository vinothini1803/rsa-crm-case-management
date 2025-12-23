import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestEstimatedAt;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestEstimatedStartDate` DATETIME NULL DEFAULT NULL AFTER `contactNumberAtDrop`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestEstimatedEndDate` DATETIME NULL DEFAULT NULL AFTER `deliveryRequestEstimatedStartDate`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestEstimatedAt` DATETIME NULL DEFAULT NULL AFTER `contactNumberAtDrop`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestEstimatedStartDate;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestEstimatedEndDate;"
    );
  },
};
