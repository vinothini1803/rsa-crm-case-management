import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `dropDealerLatitude` VARCHAR(60) NULL AFTER `deliveryRequestDropLocation`, ADD `dropDealerLongitude` VARCHAR(60) NULL AFTER `dropDealerLatitude`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP COLUMN `dropDealerLatitude`, DROP COLUMN `dropDealerLongitude`;"
    );
  },
};
