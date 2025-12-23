import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `customerStateId` INT(10) UNSIGNED NULL AFTER `customerAlternateMobileNumber`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `customerCityId` INT(10) UNSIGNED NULL AFTER `customerStateId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `areaId` `area` VARCHAR(250) NULL DEFAULT NULL"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `customerStateId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `customerCityId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `area` `areaId` INT(10) UNSIGNED NULL DEFAULT NULL"
    );
  },
};
