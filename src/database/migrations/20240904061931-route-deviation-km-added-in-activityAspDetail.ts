import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedOnlineKm` DECIMAL(10,2) UNSIGNED NULL DEFAULT NULL AFTER `aspVehicleRegistrationNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedRouteDeviationKm` DECIMAL(10,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedOnlineKm`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedOnlineKm;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedRouteDeviationKm;"
    );
  },
};
