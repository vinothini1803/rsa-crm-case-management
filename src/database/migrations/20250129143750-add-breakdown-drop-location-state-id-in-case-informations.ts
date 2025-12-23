import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `breakdownLocationStateId` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `breakdownAreaId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `dropLocationStateId` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `dropAreaId`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `breakdownLocationStateId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `dropLocationStateId`"
    );
  },
};

