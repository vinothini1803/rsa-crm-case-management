import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` ADD `caseDetailId` INT(10) UNSIGNED NULL AFTER `id`"
    );

    await queryInterface.addConstraint("activityLogs", {
      fields: ["caseDetailId"],
      type: "foreign key",
      name: "activity_logs_case_detail_fk",
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
      "activityLogs",
      "activity_logs_case_detail_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` DROP caseDetailId;"
    );
  },
};
