"use strict";

/**
 * One row per Workable candidate, keyed on the id Workable gives them. The
 * candidate_created webhook writes the row; candidate_moved shifts the stage it
 * is holding into previous_stage before writing the new one, so "where did they
 * come from" survives without a second table.
 */

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const CANDIDATE = { tableName: "tl_candidates", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(CANDIDATE, {
      // Workable's own id for the candidate, not a surrogate: it is what every
      // webhook for this person carries and what the row is looked up by.
      candidate_id: {
        type: Sequelize.STRING(100),
        primaryKey: true,
        allowNull: false,
      },

      // The webhook delivery that last wrote this row, kept for tracing a value
      // back to the payload it came from.
      event_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      name: { type: Sequelize.STRING(200), allowNull: true, defaultValue: null },
      firstname: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
      lastname: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
      headline: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

      job_shortcode: { type: Sequelize.STRING(50), allowNull: true, defaultValue: null },
      job_title: { type: Sequelize.STRING(200), allowNull: true, defaultValue: null },

      current_stage: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },

      // Null until the first move: a candidate who has only ever been Applied
      // has no previous stage, which is not the same as an unknown one.
      previous_stage: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },

      disqualified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      disqualified_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      disqualification_reason: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

      profile_url: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

      address: { type: Sequelize.STRING(255), allowNull: true, defaultValue: null },
      phone: { type: Sequelize.STRING(50), allowNull: true, defaultValue: null },
      email: { type: Sequelize.STRING(255), allowNull: true, defaultValue: null },

      common_source: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },

      // The application form as Workable sends it, stored whole: the questions
      // differ per job, so there is no column set that would fit them all.
      answers: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

      // Workable's timestamps for the candidate, distinct from created_ts and
      // updated_ts below, which are when this row was written.
      created_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      updated_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },

      // Presigned and short-lived, so it is refreshed on every webhook rather
      // than trusted later.
      resume_url: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
    });

    await queryInterface.addIndex(CANDIDATE, ["email"], {
      name: "idx_candidates_email",
    });

    await queryInterface.addIndex(CANDIDATE, ["job_shortcode", "current_stage"], {
      name: "idx_candidates_job_stage",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(CANDIDATE);
  },
};
