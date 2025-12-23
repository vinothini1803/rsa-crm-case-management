import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` CHANGE `contactNameAtPickUp` `contactNameAtPickUp` VARCHAR(220)  NULL DEFAULT NULL"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` CHANGE `contactNameAtDrop` `contactNameAtDrop` VARCHAR(220)  NULL DEFAULT NULL"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `rmId` INT(10) UNSIGNED NULL AFTER `dealerId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP rmId;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` CHANGE `contactNameAtPickUp` `contactNameAtPickUp` VARCHAR(255)  NULL DEFAULT NULL"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` CHANGE `contactNameAtDrop` `contactNameAtDrop` VARCHAR(255)  NULL DEFAULT NULL"
    );
  },
};
