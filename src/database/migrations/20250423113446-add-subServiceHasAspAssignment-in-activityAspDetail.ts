import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `subServiceHasAspAssignment` BOOLEAN NULL DEFAULT NULL COMMENT '1-Yes,0-No' AFTER `subServiceId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `serviceId` INT UNSIGNED NULL DEFAULT NULL AFTER `subServiceHasAspAssignment`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `subServiceHasAspAssignment`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `serviceId`;"
    );
  },
};
