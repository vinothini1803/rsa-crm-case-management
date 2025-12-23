import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `rosFailureReasonId` INTEGER UNSIGNED NULL AFTER `repairOnSiteStatus`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `rosRemarks` TEXT NULL AFTER `rosFailureReasonId`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `rosFailureReasonId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `rosRemarks`"
    );
  },
};



