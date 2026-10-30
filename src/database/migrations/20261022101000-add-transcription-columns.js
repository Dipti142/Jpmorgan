"use strict";

const { Env } = require("../../config/env.config");

const SESSION = { tableName: "tl_meeting_session", schema: Env.dbPostgres.schema };
const PARTICIPANT = { tableName: "tl_meeting_participants", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(SESSION, "transcription_status", {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn(SESSION, "transcription_language", {
      type: Sequelize.STRING(10),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn(PARTICIPANT, "transcript_language", {
      type: Sequelize.STRING(10),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(PARTICIPANT, "transcript_language");
    await queryInterface.removeColumn(SESSION, "transcription_language");
    await queryInterface.removeColumn(SESSION, "transcription_status");
  },
};
