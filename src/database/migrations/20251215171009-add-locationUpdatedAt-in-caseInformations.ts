import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `breakdownLocationUpdatedAt` DATETIME NULL AFTER `breakdownLocationChangeReason`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP breakdownLocationUpdatedAt;"
    );
  },
};
