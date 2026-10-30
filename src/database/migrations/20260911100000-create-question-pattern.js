"use strict";

/**
 * The question patterns, lifted out of a string column into a table.
 *
 * tl_question_pattern is reference data: one row per pattern, carrying what the
 * pattern implies rather than leaving it hardcoded. question_kind replaces the
 * KIND_BY_PATTERN map in customScript.service.ts and rating_required_default
 * replaces the `!== "CHECKLIST"` test in scriptBuilder.service.ts.
 *
 * tl_default_script.question_pattern and tl_custom_script_set.question_pattern
 * were STRING(30) holding the code. Both become question_pattern_id, a real
 * foreign key, so a typo cannot reach the table. The rows are inserted here
 * rather than left to the seeder because the backfill and the NOT NULL below
 * cannot run without them; the seeder maintains the list afterwards.
 */

const { Env } = require("../../config/env.config");
const { QUESTION_PATTERNS } = require("../../constants/questionPattern.constants");

const SCHEMA = Env.dbPostgres.schema;

const PATTERN = { tableName: "tl_question_pattern", schema: SCHEMA };
const DEFAULT_SCRIPT = { tableName: "tl_default_script", schema: SCHEMA };
const CUSTOM_SET = { tableName: "tl_custom_script_set", schema: SCHEMA };

const QUALIFIED = `"${SCHEMA}"."tl_question_pattern"`;

// Both script tables carry the pattern the same way, so they convert the same way
// (the FK's onDelete still differs per table - see the addConstraint call below).
const CONVERTING = [
  { table: DEFAULT_SCRIPT, name: "tl_default_script" },
  { table: CUSTOM_SET, name: "tl_custom_script_set" },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        PATTERN,
        {
          question_pattern_id: {
            type: Sequelize.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },

          // CHECKLIST | QUESTION_ANSWER | SCENARIO - what the API still speaks.
          pattern_code: { type: Sequelize.STRING(30), allowNull: false },

          pattern_label: { type: Sequelize.STRING(100), allowNull: false },

          // Stamped on every question in a set of this pattern.
          question_kind: { type: Sequelize.STRING(30), allowNull: false },

          // Answers "is this scored" when a question does not say either way.
          rating_required_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

          display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

          is_active: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        },
        { transaction },
      );

      // The code is how a caller names a pattern, so it has to be the unique one.
      await queryInterface.addConstraint(PATTERN, {
        fields: ["pattern_code"],
        type: "unique",
        name: "uq_question_pattern_code",
        transaction,
      });

      await queryInterface.bulkInsert(
        PATTERN,
        QUESTION_PATTERNS.map((pattern) => ({
          ...pattern,
          is_active: 1,
          created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
        })),
        { transaction },
      );

      for (const { table, name } of CONVERTING) {
        await queryInterface.addColumn(
          table,
          "question_pattern_id",
          { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
          { transaction },
        );

        // Backfill off the code the old column already holds.
        await queryInterface.sequelize.query(
          `UPDATE "${SCHEMA}"."${name}" AS target
              SET question_pattern_id = pattern.question_pattern_id
             FROM ${QUALIFIED} AS pattern
            WHERE pattern.pattern_code = target.question_pattern`,
          { transaction },
        );

        // Fails loudly if any row held a code the table does not know, rather
        // than quietly leaving a null behind.
        await queryInterface.changeColumn(
          table,
          "question_pattern_id",
          { type: Sequelize.BIGINT, allowNull: false },
          { transaction },
        );

        await queryInterface.addConstraint(table, {
          fields: ["question_pattern_id"],
          type: "foreign key",
          name: `fk_${name}_question_pattern`,
          references: { table: PATTERN, field: "question_pattern_id" },
          onUpdate: "CASCADE",
          // Sets are a disposable library entry, not an audited assignment - a
          // retired pattern should take its sets with it rather than block on them.
          onDelete: table === CUSTOM_SET ? "CASCADE" : "RESTRICT",
          transaction,
        });

        await queryInterface.removeColumn(table, "question_pattern", { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      for (const { table, name } of CONVERTING) {
        await queryInterface.addColumn(
          table,
          "question_pattern",
          { type: Sequelize.STRING(30), allowNull: true, defaultValue: null },
          { transaction },
        );

        await queryInterface.sequelize.query(
          `UPDATE "${SCHEMA}"."${name}" AS target
              SET question_pattern = pattern.pattern_code
             FROM ${QUALIFIED} AS pattern
            WHERE pattern.question_pattern_id = target.question_pattern_id`,
          { transaction },
        );

        await queryInterface.changeColumn(
          table,
          "question_pattern",
          { type: Sequelize.STRING(30), allowNull: false },
          { transaction },
        );

        await queryInterface.removeConstraint(table, `fk_${name}_question_pattern`, { transaction });
        await queryInterface.removeColumn(table, "question_pattern_id", { transaction });
      }

      await queryInterface.dropTable(PATTERN, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
