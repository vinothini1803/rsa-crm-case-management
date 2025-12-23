import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspStartedToGarageAt` DATETIME NULL AFTER `aspEndServiceAt`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspReachedToGarageAt` DATETIME NULL AFTER `aspStartedToGarageAt`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspStartedToGarageAt;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspReachedToGarageAt;"
    );
  },
};
