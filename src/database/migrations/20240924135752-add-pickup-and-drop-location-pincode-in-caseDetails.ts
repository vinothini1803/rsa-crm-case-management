import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `pickupLocationPinCode` VARCHAR(10) NULL AFTER `deliveryRequestPickUpCityId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `dropLocationPinCode` VARCHAR(10) NULL AFTER `deliveryRequestDropCityId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP pickupLocationPinCode;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP dropLocationPinCode;"
    );
  },
};
