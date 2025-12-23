import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualClientWaitingCharge` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualAdditionalCharge`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualAspWaitingCharge` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualAspServiceCost`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualClientWaitingCharge;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualAspWaitingCharge;"
    );
  },
};
