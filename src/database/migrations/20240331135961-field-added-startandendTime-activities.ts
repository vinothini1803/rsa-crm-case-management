import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `expectedServiceStartDateTime` DATETIME NULL AFTER `serviceEndDateTime`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `expectedServiceEndDateTime` DATETIME NULL AFTER `expectedServiceStartDateTime`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `expectedServiceStartDateTime`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `expectedServiceEndDateTime`;"
    );
  },
};
