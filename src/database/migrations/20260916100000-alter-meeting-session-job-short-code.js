"use strict";

/**
 * The job role a meeting is for, held on the meeting itself.
 *
 * Today it is only reachable through meeting_participant.candidate_id ->
 * tl_candidates.job_shortcode, which means a meeting with no matched candidate
 * row cannot say which job it is for. Spelled job_short_code to match
 * tl_interview_call and tl_custom_script, which are what a role's script is
 * looked up by.
 *
 * Nullable and unindexed: nothing writes or filters on it yet.
 */

const { Env } = require("../../config/env.config");

const SESSION = { tableName: "tl_meeting_session", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(SESSION, "job_short_code", {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(SESSION, "job_short_code");
  },
};
