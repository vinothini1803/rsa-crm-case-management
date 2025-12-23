import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `serviceAcceptedInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspServiceAcceptedAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `startedToPickupInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspStartedToPickupAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `reachedToPickupInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspReachedToPickupAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `startedToDropInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspStartedToDropAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `reachedToDropInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspReachedToDropAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `endServiceInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspEndServiceAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `startedToGarageInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspStartedToGarageAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `reachedToGarageInApp` BOOLEAN NULL DEFAULT NULL AFTER `aspReachedToGarageAt`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP serviceAcceptedInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP startedToPickupInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP reachedToPickupInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP startedToDropInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP reachedToDropInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP endServiceInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP startedToGarageInApp;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP reachedToGarageInApp;"
    );
  },
};
