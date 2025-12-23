import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `proposedDelayReasonId` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `aspRejectedCcDetailReasonId`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `proposedDelayReasonId`;"
    );
  },
};

