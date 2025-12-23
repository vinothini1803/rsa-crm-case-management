import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` CHANGE `title` `title` VARCHAR(255) NULL DEFAULT NULL;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` CHANGE `title` `title` VARCHAR(191) NULL DEFAULT NULL;"
    );
  },
};
