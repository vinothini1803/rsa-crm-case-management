import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callInitiations` ADD `caseId` INT(10) UNSIGNED NULL AFTER `dispositionId`;"
    );
    await queryInterface.addConstraint("callInitiations", {
      fields: ["caseId"],
      type: "foreign key",
      name: "callInitiations_caseId_fk",
      references: {
        table: "caseDetails",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint(
      "callInitiations",
      "callInitiations_caseId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `callInitiations` DROP `caseId`"
    );
  },
};
