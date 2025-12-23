import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` ADD `actionTypeId` INT(10) UNSIGNED NULL AFTER `typeId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` DROP actionTypeId;"
    );
  },
};
