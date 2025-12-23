import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` ADD `host` VARCHAR(120) NULL AFTER `entityNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` ADD `url` TEXT NULL AFTER `host`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` ADD `token` VARCHAR(255) NULL AFTER `url`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` ADD `isInbound` BOOLEAN NULL DEFAULT NULL COMMENT '1-Inbound,0-Outbound' AFTER `status`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query("ALTER TABLE `apiLogs` DROP host;");
    await queryInterface.sequelize.query("ALTER TABLE `apiLogs` DROP url;");
    await queryInterface.sequelize.query("ALTER TABLE `apiLogs` DROP token;");
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` DROP isInbound;"
    );
  },
};
