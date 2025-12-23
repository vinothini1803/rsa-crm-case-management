import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `repairOnSiteStatus` BOOLEAN  NULL  AFTER `issueComments`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `additionalServiceRequested` BOOLEAN NULL AFTER `notes`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `custodyRequested` BOOLEAN NULL AFTER `additionalServiceRequested`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `repairOnSiteStatus`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `additionalServiceRequested`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `custodyRequested`"
    );
  },
};
