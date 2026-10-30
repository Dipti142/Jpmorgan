"use strict";

const { Env } = require("../../config/env.config");
const { QUESTION_PATTERNS } = require("../../constants/questionPattern.constants");

const SCHEMA = Env.dbPostgres.schema;
const TABLE = { tableName: "tl_question_pattern", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const pattern of QUESTION_PATTERNS) {
      const existing = await queryInterface.rawSelect(
        TABLE,
        { where: { pattern_code: pattern.pattern_code } },
        ["question_pattern_id"],
      );

      if (existing) {
        await queryInterface.bulkUpdate(
          TABLE,
          {
            pattern_label: pattern.pattern_label,
            question_kind: pattern.question_kind,
            rating_required_default: pattern.rating_required_default,
            display_order: pattern.display_order,
            updated_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          { pattern_code: pattern.pattern_code },
        );
        console.log(`  = ${pattern.pattern_code} already present, refreshed.`);
        continue;
      }

      await queryInterface.bulkInsert(TABLE, [
        {
          ...pattern,
          is_active: 1,
          created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ]);
      console.log(`  + ${pattern.pattern_code} (${pattern.question_kind})`);
    }
  },

  // Deliberately not a delete: the script tables foreign-key into these rows,
  // so dropping them is the create migration's job and nothing else's.
  async down() {
    console.log("  tl_question_pattern rows are left alone - see the create migration.");
  },
};
