"use strict";

const { Env } = require("../../config/env.config");

const TABLE = { tableName: "tl_interview_call_answer", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TABLE, "raw_transcript", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(TABLE, "raw_transcript");
  },
};
