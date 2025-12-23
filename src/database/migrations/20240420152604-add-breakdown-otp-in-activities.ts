import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `reachedBreakdownOtp` VARCHAR(10) NULL DEFAULT NULL AFTER `serviceStartDateTime`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `reachedBreakdownOtp`"
    );
  },
};
