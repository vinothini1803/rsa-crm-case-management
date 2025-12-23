import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` ADD `additionalKmEstimatedServiceCost` DECIMAL(12,2) UNSIGNED NULL AFTER `estimatedTotalAmount`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` ADD `additionalKmDiscountPercentage` DECIMAL(5,2) UNSIGNED NULL AFTER `additionalKmEstimatedServiceCost`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` ADD `additionalKmDiscountAmount` DECIMAL(12,2) UNSIGNED NULL AFTER `additionalKmDiscountPercentage`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` ADD `additionalKmDiscountReasonId` INT UNSIGNED NULL AFTER `additionalKmDiscountAmount`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` ADD `additionalKmDiscountReason` VARCHAR(255) NULL AFTER `additionalKmDiscountReasonId`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` ADD `additionalKmEstimatedTotalTax` DECIMAL(12,2) UNSIGNED NULL AFTER `additionalKmDiscountReason`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` ADD `additionalKmEstimatedTotalAmount` DECIMAL(12,2) UNSIGNED NULL AFTER `additionalKmEstimatedTotalTax`"
        );
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` DROP `additionalKmEstimatedServiceCost`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` DROP `additionalKmDiscountReason`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` DROP `additionalKmDiscountReasonId`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` DROP `additionalKmDiscountAmount`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` DROP `additionalKmDiscountPercentage`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` DROP `additionalKmEstimatedTotalTax`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activityAspDetails` DROP `additionalKmEstimatedTotalAmount`"
        );
    },
};

