import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isAspAutoAllocated` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '1-Yes,0-No' AFTER `aspAutoAllocation`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP isAspAutoAllocated;"
    );
  },
};
