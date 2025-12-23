import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspReachedToPickupAt` DATETIME NULL AFTER `sentApprovalAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspReachedToDropAt` DATETIME NULL AFTER `aspReachedToPickupAt`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspReachedToPickupAt;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspReachedToDropAt;"
    );
  },
};
