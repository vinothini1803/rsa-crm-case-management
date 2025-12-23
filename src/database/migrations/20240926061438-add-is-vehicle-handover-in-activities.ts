import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isVehicleHandedOver` BOOLEAN NOT NULL DEFAULT 0 COMMENT '1-yes, 0-no'  AFTER `notes`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `vehicleHandOverOtp` VARCHAR(10) NULL AFTER `isVehicleHandedOver`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isVehicleHandedOver`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `vehicleHandOverOtp`"
    );
  },
};
