"use strict";

const { Env } = require("../../config/env.config");

const SESSION = { tableName: "tl_meeting_session", schema: Env.dbPostgres.schema };

const CONSTRAINT = "ck_meeting_session_status";

const PREVIOUS_STATUSES = ["SCHEDULED", "ACTIVE", "ENDED", "EXPIRED", "REVOKED"];
const STATUSES = [...PREVIOUS_STATUSES, "RESCHEDULED", "CANCELLED"];

const replaceStatusCheck = async (queryInterface, statuses) => {
  await queryInterface.removeConstraint(SESSION, CONSTRAINT);
  await queryInterface.addConstraint(SESSION, {
    fields: ["meeting_status"],
    type: "check",
    name: CONSTRAINT,
    where: { meeting_status: statuses },
  });
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await replaceStatusCheck(queryInterface, STATUSES);
  },

  async down(queryInterface) {
    await replaceStatusCheck(queryInterface, PREVIOUS_STATUSES);
  },
};
