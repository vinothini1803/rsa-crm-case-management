import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` CHANGE `id` `id` INT UNSIGNED NOT NULL AUTO_INCREMENT"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` ADD `token` VARCHAR(250) NULL AFTER `id`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` ADD `customerName` VARCHAR(191) NULL AFTER `token`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` ADD `customerMobileNumber` VARCHAR(20) NULL AFTER `customerName`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` CHANGE `latitude` `latitude` VARCHAR(70) NULL DEFAULT NULL"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` CHANGE `longitude` `longitude` VARCHAR(70) NULL DEFAULT NULL"
    );
    await queryInterface.removeConstraint("locationLogs", "id");
    await queryInterface.addConstraint("locationLogs", {
      fields: ["token"],
      type: "unique",
      name: "locationLogs_uk",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` ADD `url` TEXT NULL AFTER `customerMobileNumber`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` ADD `status` BOOLEAN NOT NULL DEFAULT FALSE AFTER `longitude`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint("locationLogs", "locationLogs_uk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` CHANGE `id` `id` CHAR(36) NOT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` DROP `token`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` DROP `customerName`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` DROP `customerMobileNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` CHANGE `latitude` `latitude` TEXT NULL"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` CHANGE `longitude` `longitude` TEXT NULL"
    );
    await queryInterface.addConstraint("locationLogs", {
      fields: ["id"],
      type: "unique",
      name: "id",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` DROP `url`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `locationLogs` DROP `status`;"
    );
  },
};
