import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `notifiyUserLists` ADD `sourceFrom` TINYINT UNSIGNED NULL DEFAULT 1 COMMENT '1-Web,2-Mobile' AFTER `body`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `notifiyUserLists` DROP COLUMN `sourceFrom`"
    );
  },
};

