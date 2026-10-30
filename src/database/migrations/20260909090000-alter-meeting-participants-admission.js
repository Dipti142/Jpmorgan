"use strict";

/**
 * What the lobby needs to record a refusal. "Denied" on its own cannot tell an
 * organiser saying no apart from nobody being there to say yes, and the join
 * page shows a different sentence for each.
 */

const { Env } = require("../../config/env.config");

const PARTICIPANT = { tableName: "tl_meeting_participants", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(PARTICIPANT, "denied_reason", {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
    });

    // Which participant made the call. Not a foreign key to itself: the row
    // deciding and the row decided about can be deleted independently.
    await queryInterface.addColumn(PARTICIPANT, "decided_by", {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn(PARTICIPANT, "decided_ts", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    for (const column of ["denied_reason", "decided_by", "decided_ts"]) {
      await queryInterface.removeColumn(PARTICIPANT, column);
    }
  },
};
