import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `customerPolicyStateId` INT UNSIGNED NULL AFTER `serviceEligibility`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `salesPolicyId` INT UNSIGNED NULL AFTER `customerPolicyStateId`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `customerPolicyStateId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `salesPolicyId`;"
    );
  },
};
