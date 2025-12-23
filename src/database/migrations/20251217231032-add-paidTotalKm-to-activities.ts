import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` ADD `paidTotalKm` VARCHAR(100) NULL AFTER `notes`"
        );
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `activities` DROP `paidTotalKm`"
        );
    },
};

