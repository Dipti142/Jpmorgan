"use strict";

const { Env } = require("../../config/env.config");

const APPLICATION = { tableName: "tl_application_details", schema: Env.dbPostgres.schema };
const REQUESTED_COLUMN = "registration_email_requested";
const STATUS_COLUMN = "registration_email_status";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = await queryInterface.describeTable(APPLICATION, { transaction });

      if (!columns[REQUESTED_COLUMN]) {
        await queryInterface.addColumn(
          APPLICATION,
          REQUESTED_COLUMN,
          { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 0 },
          { transaction },
        );
      }

      if (!columns[STATUS_COLUMN]) {
        await queryInterface.addColumn(
          APPLICATION,
          STATUS_COLUMN,
          { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = await queryInterface.describeTable(APPLICATION, { transaction });

      if (columns[STATUS_COLUMN]) {
        await queryInterface.removeColumn(APPLICATION, STATUS_COLUMN, { transaction });
      }

      if (columns[REQUESTED_COLUMN]) {
        await queryInterface.removeColumn(APPLICATION, REQUESTED_COLUMN, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
