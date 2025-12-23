import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` CHANGE `caseReasonId` `violateReasonId` INT(10) UNSIGNED NULL DEFAULT NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` CHANGE `activityReasonId` `violateReasonComments` TEXT NULL DEFAULT NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` ADD `updatedById` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `violateReasonComments`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` DROP comments;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` CHANGE `violateReasonId` `caseReasonId` INT(10) UNSIGNED NULL DEFAULT NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` CHANGE `violateReasonComments` `activityReasonId` INT(10) UNSIGNED NULL DEFAULT NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` DROP updatedById;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `crmSlas` ADD `comments` TECT NULL DEFAULT NULL AFTER `activityReasonId`;"
    );
  },
};
