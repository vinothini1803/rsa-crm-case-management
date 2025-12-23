import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` ADD `policyNumber` VARCHAR(191) NOT NULL AFTER `policyTypeId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP INDEX `unique_clientId_vin_service_policy`, ADD UNIQUE `unique_clientId_vin_serviceId_policyTypeId_policyNumber` (`clientId`, `vin`, `serviceId`, `policyTypeId`, `policyNumber`) USING BTREE;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP INDEX `unique_clientId_vin_serviceId_policyTypeId_policyNumber` (`clientId`, `vin`, `serviceId`, `policyTypeId`, `policyNumber`) USING BTREE;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP COLUMN `policyNumber`;"
    );
  },
};
