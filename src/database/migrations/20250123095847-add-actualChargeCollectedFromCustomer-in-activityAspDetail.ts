import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualChargeCollectedFromCustomer` DECIMAL(12,2) UNSIGNED NULL AFTER `actualAspTotalAmount`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualChargeCollectedFromCustomer;"
    );
  },
};
