import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestEstimatedStartDate;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestEstimatedEndDate;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestPickupDate` DATE NULL DEFAULT NULL AFTER `contactNumberAtDrop`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestPickupTime` VARCHAR(60) NULL DEFAULT NULL AFTER `deliveryRequestPickupDate`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestEstimatedStartDate` DATETIME NULL DEFAULT NULL AFTER `contactNumberAtDrop`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestEstimatedEndDate` DATETIME NULL DEFAULT NULL AFTER `deliveryRequestEstimatedStartDate`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestPickupDate;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestPickupTime;"
    );
  },
};
