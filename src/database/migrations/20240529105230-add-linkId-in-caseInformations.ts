import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `accidentalDocLinkId` INT(10) UNSIGNED NULL AFTER `notes`"
    );

    await queryInterface.addConstraint("caseInformations", {
      fields: ["accidentalDocLinkId"],
      type: "foreign key",
      name: "caseInformations_accidentalDocLink_fk",
      references: {
        table: "links",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint(
      "caseInformations",
      "caseInformations_accidentalDocLink_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP accidentalDocLinkId;"
    );
  },
};
