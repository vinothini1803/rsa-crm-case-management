import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `hasAdditionalKmForPayment` BOOLEAN NULL AFTER `notes`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `additionalKmForPayment` VARCHAR(100) NULL AFTER `hasAdditionalKmForPayment`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `hasAdditionalKmForPayment`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `additionalKmForPayment`"
    );
  },
};


