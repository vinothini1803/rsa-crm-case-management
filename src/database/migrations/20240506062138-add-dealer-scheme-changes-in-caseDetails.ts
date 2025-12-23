import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP COLUMN `dropDealerLatitude`, DROP COLUMN `dropDealerLongitude`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `locationTypeId` INT UNSIGNED NULL AFTER `cancelReasonId`, ADD `pickupLatitude` VARCHAR(60) NULL AFTER `locationTypeId`, ADD `pickupLongitude` VARCHAR(60) NULL AFTER `pickupLatitude`, ADD `dropLatitude` VARCHAR(60) NULL AFTER `deliveryRequestPickUpCityId`, ADD `dropLongitude` VARCHAR(60) NULL AFTER `dropLatitude`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `dropDealerLatitude` VARCHAR(60) NULL AFTER `deliveryRequestDropLocation`, ADD `dropDealerLongitude` VARCHAR(60) NULL AFTER `dropDealerLatitude`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP COLUMN `locationTypeId`, DROP COLUMN `pickupLatitude`, DROP COLUMN `pickupLongitude`, DROP COLUMN `dropLatitude`, DROP COLUMN `dropLongitude`;"
    );
  },
};
