import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `deliveryRequestCreatedDealerId` INT UNSIGNED NULL DEFAULT NULL AFTER `hasDocuments`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP deliveryRequestCreatedDealerId;"
    );
  },
};
