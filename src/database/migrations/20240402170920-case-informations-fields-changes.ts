import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `sentLink`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `locationLogId` INT(10) UNSIGNED NULL AFTER `sentToMobile`;"
    );
    await queryInterface.addConstraint("caseInformations", {
      fields: ["locationLogId"],
      type: "foreign key",
      name: "case_informations_location_log_fk",
      references: {
        table: "locationLogs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `area`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `breakdownAreaId` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `breakdownLong`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `dropAreaId` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `dropLocation`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `sentLink` TEXT NULL AFTER `sentToMobile`"
    );
    await queryInterface.removeConstraint(
      "caseInformations",
      "case_informations_location_log_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `locationLogId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `breakdownAreaId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `area` VARCHAR(250) NULL DEFAULT NULL AFTER `breakdownLong`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `dropAreaId`"
    );
  },
};
