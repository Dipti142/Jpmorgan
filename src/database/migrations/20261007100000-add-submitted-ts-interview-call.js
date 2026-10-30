"use strict";

const { Env } = require("../../config/env.config");

const TABLE = { tableName: "tl_interview_call", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // When submit_interview ran, as distinct from when the call ended. end_call
    // is Anam's system tool now and never calls back, so this is the only
    // timestamp that says the interview was declared complete rather than just
    // stopped.
    await queryInterface.addColumn(TABLE, "submitted_ts", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(TABLE, "submitted_ts");
  },
};
