"use strict";

const { Env } = require("../../config/env.config");
const { VA_MEETING_STATUSES } = require("../../constants/vaMeetingStatus.constants");

const STATUS = { tableName: "tl_va_meeting_status", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      STATUS,
      VA_MEETING_STATUSES.map((status) => ({
        ...status,
        is_active: 1,
        created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
      })),
      {
        upsertKeys: ["status_code"],
        updateOnDuplicate: [
          "status_label",
          "client_status_label",
          "meeting_status_code",
          "display_order",
          "updated_ts",
        ],
      },
    );

    console.log(`  = ${VA_MEETING_STATUSES.length} meeting statuses inserted or refreshed.`);
  },

  async down() {
    console.log("  tl_va_meeting_status rows are left alone - tl_va_scheduled foreign-keys into them.");
  },
};
