"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const APPLICATION = { tableName: "tl_application_details", schema: SCHEMA };
const STATUS = { tableName: "tl_va_meeting_status", schema: SCHEMA };
const COLUMN = "va_meeting_status_id";

const backfill = async (queryInterface, transaction) => {
  const statuses = await queryInterface.select(null, STATUS, {
    attributes: ["va_meeting_status_id", "status_code"],
    transaction,
  });

  for (const status of statuses) {
    await queryInterface.bulkUpdate(
      APPLICATION,
      { [COLUMN]: status.va_meeting_status_id },
      { application_status: status.status_code },
      { transaction },
    );
  }
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = await queryInterface.describeTable(APPLICATION, { transaction });
      if (!columns[COLUMN]) {
        await queryInterface.addColumn(
          APPLICATION,
          COLUMN,
          {
            type: Sequelize.BIGINT,
            allowNull: true,
            defaultValue: null,
            references: { model: STATUS, key: "va_meeting_status_id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          { transaction },
        );
      }

      await backfill(queryInterface, transaction);

      await queryInterface.changeColumn(
        APPLICATION,
        COLUMN,
        { type: Sequelize.BIGINT, allowNull: false },
        { transaction },
      );

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
      if (columns[COLUMN]) {
        await queryInterface.removeColumn(APPLICATION, COLUMN, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
