import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activityTransactions` ADD `isForAdditionalKmPayment` BOOLEAN NULL AFTER `cancellationRejectedReason`"
        );
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activityTransactions` DROP `isForAdditionalKmPayment`"
        );
    },
};

