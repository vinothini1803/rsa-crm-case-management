import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `breakdownLocationChangeReason` TEXT NULL AFTER `breakdownAreaId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `dropLocationChangeReason` TEXT NULL AFTER `dropAreaId`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP breakdownLocationChangeReason;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP dropLocationChangeReason;"
    );
  },
};
