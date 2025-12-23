import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Rename repairOnSiteStatus to serviceStatus
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` CHANGE `repairOnSiteStatus` `serviceStatus` BOOLEAN NULL"
        );

        // Rename rosFailureReasonId to serviceFailureReasonId
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` CHANGE `rosFailureReasonId` `serviceFailureReasonId` INTEGER UNSIGNED NULL"
        );

        // Rename rosRemarks to serviceRemarks
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` CHANGE `rosRemarks` `serviceRemarks` TEXT NULL"
        );

        // Add new column serviceSuccessReasonId
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` ADD `serviceSuccessReasonId` INTEGER UNSIGNED NULL AFTER `serviceStatus`"
        );
    },

    down: async (queryInterface: QueryInterface) => {
        // Remove serviceSuccessReasonId
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` DROP `serviceSuccessReasonId`"
        );

        // Rename serviceRemarks back to rosRemarks
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` CHANGE `serviceRemarks` `rosRemarks` TEXT NULL"
        );

        // Rename serviceFailureReasonId back to rosFailureReasonId
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` CHANGE `serviceFailureReasonId` `rosFailureReasonId` INTEGER UNSIGNED NULL"
        );

        // Rename serviceStatus back to repairOnSiteStatus
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` CHANGE `serviceStatus` `repairOnSiteStatus` BOOLEAN NULL"
        );
    },
};

