"use strict";

const { Env } = require("../../config/env.config");

const RECORDING = { tableName: "tl_meeting_recording", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(RECORDING, "storage_url", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(RECORDING, "storage_url");
  },
};
