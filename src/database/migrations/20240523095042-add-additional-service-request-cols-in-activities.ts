import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `additionalServiceRequested` BOOLEAN NULL AFTER `repairOnSiteStatus`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `custodyRequested` BOOLEAN NULL AFTER `additionalServiceRequested`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isCustodySelf` BOOLEAN NULL AFTER `custodyRequested`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isCustodyAspArrived` BOOLEAN NULL AFTER `isCustodySelf`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `additionalServiceRequested`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `custodyRequested`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isCustodySelf`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isCustodyAspArrived`"
    );
  },
};
