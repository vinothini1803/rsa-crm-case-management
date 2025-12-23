import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add cancellationStatusId and cancellationRejectedReason to activityTransactions
  await queryInterface.sequelize.query(
    "ALTER TABLE `activityTransactions` ADD `cancellationStatusId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `refundStatusId`"
  );
  await queryInterface.sequelize.query(
    "ALTER TABLE `activityTransactions` ADD `cancellationRejectedReason` TEXT NULL DEFAULT NULL AFTER `cancellationStatusId`"
  );

  // Remove cancellationStatusId and cancellationRejectedReason from caseDetails
  await queryInterface.sequelize.query(
    "ALTER TABLE `caseDetails` DROP `cancellationStatusId`;"
  );
  await queryInterface.sequelize.query(
    "ALTER TABLE `caseDetails` DROP `cancellationRejectedReason`;"
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Add back cancellationStatusId and cancellationRejectedReason to caseDetails
  await queryInterface.sequelize.query(
    "ALTER TABLE `caseDetails` ADD `cancellationStatusId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `cancellationInvoicePath`"
  );

  await queryInterface.sequelize.query(
    "ALTER TABLE `caseDetails` ADD `cancellationRejectedReason` TEXT NULL DEFAULT NULL AFTER `cancellationStatusId`"
  );

  // Remove cancellationStatusId and cancellationRejectedReason from activityTransactions
  await queryInterface.sequelize.query(
    "ALTER TABLE `activityTransactions` DROP `cancellationStatusId`;"
  );
  await queryInterface.sequelize.query(
    "ALTER TABLE `activityTransactions` DROP `cancellationRejectedReason`;"
  );
}


