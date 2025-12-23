import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isServiceEntitlementUpdated` BOOLEAN NOT NULL DEFAULT 0 COMMENT '1-yes, 0-no'  AFTER `repairOnSiteStatus`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isServiceEntitlementUpdated`"
    );
  },
};
