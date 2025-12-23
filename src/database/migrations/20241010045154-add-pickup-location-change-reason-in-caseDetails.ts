import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `pickupLocationChangeReason` TEXT NULL AFTER `pickupLocationPinCode`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `dropLocationChangeReason` TEXT NULL AFTER `dropLocationPinCode`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP pickupLocationChangeReason;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP dropLocationChangeReason;"
    );
  },
};
