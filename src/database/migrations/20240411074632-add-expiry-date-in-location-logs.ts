import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` ADD `expiryDateTime` DATETIME NULL AFTER `longitude`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` DROP `expiryDateTime`"
    );
  },
};
