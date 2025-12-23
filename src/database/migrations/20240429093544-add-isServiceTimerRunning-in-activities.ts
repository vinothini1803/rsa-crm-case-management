import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isServiceTimerRunning` BOOLEAN NOT NULL DEFAULT FALSE  AFTER `serviceEndDateTime`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isServiceTimerRunning`"
    );
  },
};
