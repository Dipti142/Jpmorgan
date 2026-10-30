"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const APPLICATION = { tableName: "tl_application_details", schema: SCHEMA };
const AI_RECOMMENDATION = { tableName: "tl_ai_recommendation_status", schema: SCHEMA };
const STATUS = { tableName: "tl_va_meeting_status", schema: SCHEMA };
const DECISION_COLUMN = "ai_recommendation_status_id";
const OVERRIDE_COLUMN = "overridden_application_status";
const OVERRIDE_CONSTRAINT = "tl_application_details_overridden_application_status_fkey";

const hasOverrideConstraint = async (queryInterface, transaction) => {
  const references = await queryInterface.getForeignKeyReferencesForTable(APPLICATION, { transaction });
  return references.some((reference) => reference.constraintName === OVERRIDE_CONSTRAINT);
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = await queryInterface.describeTable(APPLICATION, { transaction });
      if (!columns[DECISION_COLUMN]) {
        await queryInterface.addColumn(
          APPLICATION,
          DECISION_COLUMN,
          {
            type: Sequelize.BIGINT,
            allowNull: true,
            defaultValue: null,
            references: { model: AI_RECOMMENDATION, key: "ai_recommendation_status_id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          { transaction },
        );
      }

      if (await hasOverrideConstraint(queryInterface, transaction)) {
        await queryInterface.removeConstraint(APPLICATION, OVERRIDE_CONSTRAINT, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      if (!(await hasOverrideConstraint(queryInterface, transaction))) {
        await queryInterface.addConstraint(APPLICATION, {
          fields: [OVERRIDE_COLUMN],
          type: "foreign key",
          name: OVERRIDE_CONSTRAINT,
          references: { table: STATUS, field: "status_code" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
          transaction,
        });
      }

      const columns = await queryInterface.describeTable(APPLICATION, { transaction });
      if (columns[DECISION_COLUMN]) {
        await queryInterface.removeColumn(APPLICATION, DECISION_COLUMN, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
