import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP INDEX `unique_clientId_vin`, ADD UNIQUE `unique_clientId_vin_service_policy` (`clientId`, `vin`, `serviceId`, `policyTypeId`) USING BTREE;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP INDEX `unique_clientId_vin_service_policy` USING BTREE;"
    );
  },
};
