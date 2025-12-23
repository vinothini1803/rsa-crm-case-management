import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isReimbursement` BOOLEAN NOT NULL DEFAULT 0 COMMENT '1-yes, 0-no'  AFTER `isOldAspInvoicePushedToAspPortal`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `reimbursementComments` TEXT NULL DEFAULT NULL AFTER `isReimbursement`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isReimbursement`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `reimbursementComments`"
    );
  },
};
