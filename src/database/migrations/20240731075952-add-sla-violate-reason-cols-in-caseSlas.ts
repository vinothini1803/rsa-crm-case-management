import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSlas` ADD `userId` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `statusColor`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSlas` ADD `violateReasonId` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `userId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSlas` ADD `violateReasonComments` TEXT  NULL DEFAULT NULL AFTER `violateReasonId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSlas` ADD `updatedById` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `violateReasonComments`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query("ALTER TABLE `caseSlas` DROP userId;");
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSlas` DROP violateReasonId;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSlas` DROP violateReasonComments;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSlas` DROP updatedById;"
    );
  },
};
