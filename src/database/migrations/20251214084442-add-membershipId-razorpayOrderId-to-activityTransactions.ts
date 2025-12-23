import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `membershipId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `activityId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `razorpayOrderId` VARCHAR(191) NULL DEFAULT NULL AFTER `membershipId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `razorpayTransactionId` VARCHAR(191) NULL DEFAULT NULL AFTER `razorpayOrderId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `razorpayTransactionId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `razorpayOrderId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `membershipId`;"
    );
  },
};
