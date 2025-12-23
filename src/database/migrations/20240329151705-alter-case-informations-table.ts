import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `contactLanguageId` INT(10) UNSIGNED NULL AFTER `dispositionId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `dropDealerLocation` TEXT NULL AFTER `dropDealerLong`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `contactLanguageId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `dropDealerLocation`"
    );
  },
};
