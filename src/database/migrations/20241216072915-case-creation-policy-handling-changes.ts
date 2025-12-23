import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `hasActivePolicy` BOOLEAN NOT NULL DEFAULT FALSE AFTER `womenAssist`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `sendPaymentLinkTo` VARCHAR(20) NULL AFTER `customerNeedToPay`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP hasActivePolicy;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP sendPaymentLinkTo;"
    );
  },
};
