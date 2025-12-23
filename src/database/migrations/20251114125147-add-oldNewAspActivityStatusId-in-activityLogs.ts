import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` ADD `aspActivityReportNewValue` VARCHAR(199) NULL AFTER `description`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` DROP `aspActivityReportNewValue`;"
    );
  },
};

