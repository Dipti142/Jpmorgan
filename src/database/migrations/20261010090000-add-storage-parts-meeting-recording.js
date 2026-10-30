"use strict";

/**
 * The bucket caps one object at 500MB, and ACS writes mp4 at ~345MB/hour, so a
 * recording past about an hour and a half has to be stored as several slices.
 * storage_parts holds them in order; storage_path stays the first one so every
 * existing read path still works, and size_bytes becomes the total.
 *
 * chunk_index separates the recordings ACS itself splits a long call into: one
 * row per chunk instead of every chunk overwriting the same row.
 */

const { Env } = require("../../config/env.config");

const RECORDING = { tableName: "tl_meeting_recording", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(RECORDING, "storage_parts", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn(RECORDING, "chunk_index", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(RECORDING, "chunk_index");
    await queryInterface.removeColumn(RECORDING, "storage_parts");
  },
};
