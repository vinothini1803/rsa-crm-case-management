import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityInventories` ADD `typeId` INT UNSIGNED NULL DEFAULT NULL AFTER `activityId`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityInventories` DROP typeId;"
    );
  },
};
