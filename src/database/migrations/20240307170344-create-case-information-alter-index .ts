import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `notes` TEXT NULL DEFAULT NULL AFTER `sendPaymentLinkTo`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `voiceOfCustomer` `voiceOfCustomer` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `notes`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE activityAspDetails DROP aspAdditionalCharge;"
    );
  },
};
