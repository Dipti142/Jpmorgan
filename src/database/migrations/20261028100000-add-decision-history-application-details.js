"use strict";

const { Env } = require("../../config/env.config");

const APPLICATION = { tableName: "tl_application_details", schema: Env.dbPostgres.schema };
const HISTORY_COLUMN = "decision_history";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable(APPLICATION);
    if (columns[HISTORY_COLUMN]) return;

    await queryInterface.addColumn(APPLICATION, HISTORY_COLUMN, {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(APPLICATION);
    if (!columns[HISTORY_COLUMN]) return;

    await queryInterface.removeColumn(APPLICATION, HISTORY_COLUMN);
  },
};
