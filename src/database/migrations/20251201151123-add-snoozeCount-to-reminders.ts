import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `reminders` ADD `snoozeCount` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `dismiss`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reminders` ADD `isAuto` TINYINT NOT NULL DEFAULT 0 AFTER `snoozeCount`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `reminders` DROP `isAuto`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reminders` DROP `snoozeCount`"
    );
  },
};

