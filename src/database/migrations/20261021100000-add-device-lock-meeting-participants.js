"use strict";
const { Env } = require("../../config/env.config");

const PARTICIPANT = { tableName: "tl_meeting_participants", schema: Env.dbPostgres.schema };
const COLUMNS = ["device_key_hash", "device_bound_ts"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable(PARTICIPANT);

    if (!columns.device_key_hash) {
      await queryInterface.addColumn(PARTICIPANT, "device_key_hash", {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!columns.device_bound_ts) {
      await queryInterface.addColumn(PARTICIPANT, "device_bound_ts", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(PARTICIPANT);

    for (const column of COLUMNS) {
      if (columns[column]) await queryInterface.removeColumn(PARTICIPANT, column);
    }
  },
};
