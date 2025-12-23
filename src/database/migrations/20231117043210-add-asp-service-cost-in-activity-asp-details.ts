import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedAspServiceCost` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedTotalAmount`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedAspTotalAmount` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedAspServiceCost`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualAspServiceCost` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualTotalAmount`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualAspTotalAmount` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualAspServiceCost`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedAspServiceCost;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedAspTotalAmount;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualAspServiceCost;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualAspTotalAmount;"
    );
  },
};
