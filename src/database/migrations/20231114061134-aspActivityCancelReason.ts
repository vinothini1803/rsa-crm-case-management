import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `cancelReasonId` INT(10) UNSIGNED NULL AFTER `rejectReasonId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP cancelReasonId;"
    );
  },
};
