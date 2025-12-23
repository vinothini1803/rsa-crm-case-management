import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestPickupInitialDate` DATE NULL AFTER `contactNumberAtDrop`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestPickupInitialTime` VARCHAR(60) NULL DEFAULT NULL AFTER `deliveryRequestPickupInitialDate`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestPickupInitialDate;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestPickupInitialTime;"
    );
  },
};
