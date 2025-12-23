import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `approximateVehicleValue` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `vehicleModelId`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP approximateVehicleValue;"
    );
  },
};
