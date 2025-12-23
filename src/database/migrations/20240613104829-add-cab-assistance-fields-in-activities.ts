import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `cabAssistanceRequested` BOOLEAN NULL AFTER `isCustodyAspArrived`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isCabAssistanceSelf` BOOLEAN NULL AFTER `cabAssistanceRequested`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `cabAssistanceRequested` BOOLEAN NULL AFTER `custodyRequested`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cabAssistanceRequested`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isCabAssistanceSelf`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `cabAssistanceRequested`"
    );
  },
};
