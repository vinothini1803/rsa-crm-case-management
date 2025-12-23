import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `failureReason` TEXT NULL DEFAULT NULL AFTER `remarks`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `failureReason`;"
    );
  },
};

