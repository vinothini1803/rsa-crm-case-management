import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `serviceRejectedInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspServiceRejectedAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `serviceCanceledInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspServiceCanceledAt`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP serviceRejectedInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP serviceCanceledInApp;"
    );
  },
};
