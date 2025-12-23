import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activityTransactions` ADD `totalKm` VARCHAR(100) NULL DEFAULT NULL AFTER `isForAdditionalKmPayment`"
        );
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activityTransactions` DROP `totalKm`"
        );
    },
};


