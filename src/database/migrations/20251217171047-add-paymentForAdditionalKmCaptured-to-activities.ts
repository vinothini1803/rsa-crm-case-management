import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` ADD `paymentForAdditionalKmCaptured` BOOLEAN NULL AFTER `additionalKmForPayment`"
        );
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` DROP `paymentForAdditionalKmCaptured`"
        );
    },
};

