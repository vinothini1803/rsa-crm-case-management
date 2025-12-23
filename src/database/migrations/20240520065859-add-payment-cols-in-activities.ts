import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerNeedToPay` BOOLEAN NOT NULL DEFAULT FALSE AFTER `repairOnSiteStatus`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `nonMembershipType` VARCHAR(191) NULL DEFAULT NULL AFTER `customerNeedToPay`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `additionalChargeableKm` VARCHAR(100) NULL DEFAULT NULL AFTER `nonMembershipType`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerNeedToPay`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `nonMembershipType`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `additionalChargeableKm`"
    );
  },
};
