import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` ADD `customerAgreedToAdditionalPayment` BOOLEAN NULL AFTER `additionalKmForPayment`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` ADD `additionalPaymentRemarks` TEXT NULL AFTER `customerAgreedToAdditionalPayment`"
        );
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` DROP `customerAgreedToAdditionalPayment`"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` DROP `additionalPaymentRemarks`"
        );
    },
};

