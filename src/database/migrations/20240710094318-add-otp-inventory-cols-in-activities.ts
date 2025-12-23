import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `pickupOtpVerifiedAt` DATETIME NULL AFTER `aspReachedToPickupAt`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `pickupInventorySubmittedAt` DATETIME NULL AFTER `pickupOtpVerifiedAt`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `pickupSignatureSubmittedAt` DATETIME NULL AFTER `pickupInventorySubmittedAt`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `dropInventorySubmittedAt` DATETIME NULL AFTER `aspReachedToDropAt`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `dropOtpVerifiedAt` DATETIME NULL AFTER `dropInventorySubmittedAt`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP pickupOtpVerifiedAt;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP pickupInventorySubmittedAt;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP pickupSignatureSubmittedAt;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP dropInventorySubmittedAt;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP dropOtpVerifiedAt;"
    );
  },
};
