import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedTotalTax` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedAdditionalCharge`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedAspTotalTax` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedAspServiceCost`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualTotalTax` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualAdditionalCharge`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualAspTotalTax` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualAspServiceCost`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedTotalTax;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedAspTotalTax;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualTotalTax;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualAspTotalTax;"
    );
  },
};
