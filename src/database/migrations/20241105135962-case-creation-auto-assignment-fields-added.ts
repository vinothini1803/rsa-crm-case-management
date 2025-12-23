import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `agentAutoAllocation` BOOLEAN NULL DEFAULT NULL COMMENT '1-Auto Allocation,0-Self assign to the L1 agent' AFTER `agentId`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `agentAutoAllocation`;"
    );
  },
};
