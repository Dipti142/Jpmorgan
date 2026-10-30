"use strict";

const { Env } = require("../../config/env.config");
const { AI_RECOMMENDATION_STATUSES } = require("../../constants/aiRecommendationStatus.constants");

const STATUS = { tableName: "tl_ai_recommendation_status", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      STATUS,
      AI_RECOMMENDATION_STATUSES.map((status) => ({
        ...status,
        is_active: 1,
        created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
      })),
      {
        upsertKeys: ["status_code"],
        updateOnDuplicate: ["status_label", "client_status_label", "display_order", "updated_ts"],
      },
    );

    console.log(`  = ${AI_RECOMMENDATION_STATUSES.length} AI recommendation statuses inserted or refreshed.`);
  },

  async down() {
    console.log("  tl_ai_recommendation_status rows are left alone - tl_application_details foreign-keys into them.");
  },
};
