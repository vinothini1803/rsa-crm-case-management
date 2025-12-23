import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `serviceDescriptionId` INT(10) UNSIGNED NULL AFTER `closedAt`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `closureRemarks` TEXT NULL AFTER `serviceDescriptionId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `closureRating` INT(10) UNSIGNED NULL AFTER `closureRemarks`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `cancelDate` DATETIME NULL AFTER `cancelReasonId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `cancelRemarks` TEXT NULL AFTER `cancelDate`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP serviceDescriptionId;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP closureRemarks;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP closureRating;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP cancelDate;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP cancelRemarks;"
    );
  },
};
