"use strict";
const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const RECORDING = { tableName: "tl_meeting_recording", schema: SCHEMA };
const STATUS_COLUMN = "meeting_recording_status";
const ATTEMPTS_COLUMN = "meeting_join_attempts";
const STATUS_CHECK = "ck_meeting_recording_current";

const backfill = async (queryInterface, transaction) => {
  await queryInterface.sequelize.query(
    `
      WITH attempts AS (
        SELECT meeting_session_id, acs_recording_id,
               ROW_NUMBER() OVER (PARTITION BY meeting_session_id ORDER BY MIN(created_at)) - 1 AS attempt,
               COUNT(*) OVER (PARTITION BY meeting_session_id) AS total
          FROM "${SCHEMA}"."tl_meeting_recording"
         GROUP BY meeting_session_id, acs_recording_id
      )
      UPDATE "${SCHEMA}"."tl_meeting_recording" r
         SET ${ATTEMPTS_COLUMN} = a.attempt,
             ${STATUS_COLUMN} = CASE WHEN a.attempt = a.total - 1 THEN 1 ELSE 0 END
        FROM attempts a
       WHERE r.meeting_session_id = a.meeting_session_id
         AND r.acs_recording_id = a.acs_recording_id
    `,
    { transaction },
  );
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = await queryInterface.describeTable(RECORDING, { transaction });

      if (!columns[STATUS_COLUMN]) {
        await queryInterface.addColumn(
          RECORDING,
          STATUS_COLUMN,
          { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 1 },
          { transaction },
        );

        await queryInterface.addConstraint(RECORDING, {
          fields: [STATUS_COLUMN],
          type: "check",
          name: STATUS_CHECK,
          where: { [STATUS_COLUMN]: [0, 1] },
          transaction,
        });
      }

      if (!columns[ATTEMPTS_COLUMN]) {
        await queryInterface.addColumn(
          RECORDING,
          ATTEMPTS_COLUMN,
          { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          { transaction },
        );
      }

      await backfill(queryInterface, transaction);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = await queryInterface.describeTable(RECORDING, { transaction });

      if (columns[ATTEMPTS_COLUMN]) {
        await queryInterface.removeColumn(RECORDING, ATTEMPTS_COLUMN, { transaction });
      }

      if (columns[STATUS_COLUMN]) {
        await queryInterface.removeConstraint(RECORDING, STATUS_CHECK, { transaction });
        await queryInterface.removeColumn(RECORDING, STATUS_COLUMN, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
