import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspServiceRejectedAt` DATETIME NULL AFTER `aspServiceAcceptedAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspServiceCanceledAt` DATETIME NULL AFTER `aspServiceRejectedAt`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspServiceRejectedAt;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspServiceCanceledAt;"
    );
  },
};
