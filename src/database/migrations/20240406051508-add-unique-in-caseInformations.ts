import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addConstraint("caseInformations", {
      type: "unique",
      fields: ["caseDetailId"],
      name: "caseInformations_caseDetailId_unique",
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP INDEX `caseInformations_caseDetailId_unique`"
    );
  },
};
