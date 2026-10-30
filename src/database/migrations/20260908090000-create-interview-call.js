"use strict";

/**
 * One row per attempt to reach a candidate, the words that were said, and the
 * answers that were given. The call *is* the interview - there is no separate
 * interview row, so "we tried three times and they never picked up" is a
 * question this table can answer on its own.
 *
 * Three tables, split by how they are read. The call is read constantly and
 * stays narrow. The transcript is paged and redacted line by line, so it is
 * rows. The answer sheet is wanted only when someone opens one call, so it is a
 * single JSONB document off to the side.
 *
 * Almost everything is a snapshot rather than a join. An avatar can be retired,
 * a candidate's phone number corrected and a question reworded, and "what
 * actually happened on that call" has to stay answerable afterwards.
 */

const { Op } = require("sequelize");

// The schema is deployment-dependent, so it comes from the one place that
// reads the environment. ts-node is already registered by migration.config.js,
// which sequelize-cli loads before any migration or seeder.
const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const MEETING = { tableName: "tl_meeting_session", schema: SCHEMA };
const PROGRAM = { tableName: "tl_persona_program", schema: SCHEMA };
const AVATAR = { tableName: "tl_anam_avatar", schema: SCHEMA };
const CALL = { tableName: "tl_interview_call", schema: SCHEMA };
const TURN = { tableName: "tl_interview_call_turn", schema: SCHEMA };
const ANSWER = { tableName: "tl_interview_call_answer", schema: SCHEMA };

// Two axes, deliberately not one column. A call can be admitted to the meeting
// and still fail, so "where it got to" and "how it ended" cannot share a field.
const CALL_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_ANSWER",
  "DECLINED",
  "FAILED_TO_JOIN",
  "INTERRUPTED",
  "ABANDONED",
  "CANCELLED",
  "FAILED",
];

// Anam owns this vocabulary, so it is indexed but not constrained.
const CHANNELS = ["meeting", "virtual_avatar"];
const MEETING_PROVIDERS = ["teams", "zoom", "meet"];
const MEETING_STATUSES = ["pending", "active", "cancelled", "ended", "failed"];
// "guest" is anyone in the room who is not the persona and not the candidate -
// an organiser, a second interviewer. Recorded as themselves rather than folded
// into the candidate, because a transcript is evidence about the candidate
const SPEAKER_ROLES = ["persona", "candidate", "guest", "system"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(CALL, {
      interview_call_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      /* -- who and what this call belongs to ----------------------------- */

      company_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: COMPANY, key: "company_id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      // The room the call happened in - the only identity a VA call has.
      meeting_session_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: MEETING, key: "meeting_session_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      persona_program_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: PROGRAM, key: "persona_program_id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      // Snapshot, so a history row reads without joining the interview
      interview_reference: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      // "the third time we tried them" is a column, not a count over rows
      attempt_no: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      job_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },

      job_label: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },

      /* -- the candidate in the upstream system -------------------------- */

      // Named for the role, not the vendor: Workable today, something else in
      // two years, and a column called workable_id would outlive the tool
      ats_system: {
        type: Sequelize.STRING(30),
        allowNull: true,
        defaultValue: null,
      },

      ats_candidate_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      /* -- who spoke, as drawn for this call ----------------------------- */

      // A persona is not a table - it is authored in a script file - so what is
      // stored is the key that resolves it, not a foreign key
      persona_key: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      persona_role: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      anam_avatar_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: { model: AVATAR, key: "anam_avatar_id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // Copied rather than joined: an avatar row can be retired or re-voiced,
      // and the face and voice that actually spoke must stay answerable
      avatar_key: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      avatar_display_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      avatar_model: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      voice_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      /* -- the candidate, as they were at call time ---------------------- */

      // PII. Snapshotted because a corrected phone number must not rewrite the
      // history of a call placed to the old one - and cleared by the retention
      // job through pii_redacted_ts, not left here forever
      candidate_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },

      candidate_email: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },

      candidate_phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      /* -- which knowledge base was in play ------------------------------ */

      kb_folder: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      kb_domain: {
        type: Sequelize.STRING(60),
        allowNull: true,
        defaultValue: null,
      },

      // How often the persona looked something up, and what it actually read.
      // "kb used" is two questions - which base was configured, and which of it
      // was consulted - and only the second explains an answer it gave
      kb_lookup_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      kb_sources_used: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      // Who was in the room. Seeded with the persona and the candidate at the
      // open, then grown from the transcript - anyone who speaks and matches
      // neither is a guest. PII, so redactCallPii clears it with the rest
      participants: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      /* -- how the call was carried -------------------------------------- */

      channel: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "meeting",
      },

      meeting_provider: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },

      meeting_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },

      meeting_invite_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      meeting_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },

      // joining | waiting_room | in_call | left. Anam owns this vocabulary, so
      // it is stored and indexed but never constrained
      meeting_join_state: {
        type: Sequelize.STRING(30),
        allowNull: true,
        defaultValue: null,
      },

      // Null until the persona joins. The key a transcript is read by
      anam_session_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      /* -- how it went ---------------------------------------------------- */

      call_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "SCHEDULED",
      },

      // A short code to group on, and prose for a person to read. Grouping a
      // report on free text is how "failure reason" becomes useless
      failure_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      failure_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },

      // Whatever the provider actually returned, kept for the debugging that
      // happens days later with nothing else to go on
      error_payload: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      },

      // Counted rather than a status: a call interrupted twice and finished is
      // a completed call, and collapsing that into the outcome loses both facts
      interrupted_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      /* -- the timeline --------------------------------------------------- */

      scheduled_for_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      initiated_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      // When the persona got in, which is not when the candidate started talking
      joined_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      answered_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      declined_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      ended_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      // Stored rather than derived, so a report does not recompute it per row
      // and a clock correction cannot silently change last quarter's numbers
      duration_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      /* -- consent and recording ------------------------------------------ */

      // Per call, not per interview: recording covers a whole session or none
      // of it, so consent is given against the call that was recorded
      consent_version: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },

      consent_accepted_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      recording_requested: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      recording_id: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },

      recording_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },

      // Split from the key so a bucket move is an update of one column
      recording_bucket: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },

      recording_key: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },

      recording_expires_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      /* -- what the call produced ----------------------------------------- */

      questions_total: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      questions_answered: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      average_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        defaultValue: null,
      },

      // Which version of the script the persona was actually given, so "was it
      // a bad call or a bad script" stays answerable after the next sync
      script_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null,
      },

      // What the persona could not answer and promised someone would follow up
      // on. On the call rather than in its own table: an escalation is only ever
      // read with the call it came from, and the promise is what matters.
      escalations: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      /* -- retention ------------------------------------------------------ */

      retention_expires_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      pii_redacted_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      updated_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
    });

    // One attempt number per room per programme - the series a retry belongs to.
    await queryInterface.addConstraint(CALL, {
      fields: ["meeting_session_id", "persona_program_id", "attempt_no"],
      type: "unique",
      name: "uq_interview_call_attempt",
    });

    // The whole identity a tool call arrives with, so a collision would file one
    // candidate's answers onto another's call.
    await queryInterface.addConstraint(CALL, {
      fields: ["company_id", "interview_reference"],
      type: "unique",
      name: "uq_interview_call_reference",
    });

    await queryInterface.addConstraint(CALL, {
      fields: ["call_status"],
      type: "check",
      name: "ck_interview_call_status",
      where: { call_status: CALL_STATUSES },
    });

    await queryInterface.addConstraint(CALL, {
      fields: ["channel"],
      type: "check",
      name: "ck_interview_call_channel",
      where: { channel: CHANNELS },
    });

    await queryInterface.addConstraint(CALL, {
      fields: ["meeting_provider"],
      type: "check",
      name: "ck_interview_call_meeting_provider",
      where: { [Op.or]: [{ meeting_provider: null }, { meeting_provider: MEETING_PROVIDERS }] },
    });

    await queryInterface.addConstraint(CALL, {
      fields: ["meeting_status"],
      type: "check",
      name: "ck_interview_call_meeting_status",
      where: { [Op.or]: [{ meeting_status: null }, { meeting_status: MEETING_STATUSES }] },
    });

    // The history listing: a company's calls, newest first, filtered by outcome
    await queryInterface.addIndex(CALL, ["company_id", "call_status", "initiated_ts"], {
      name: "idx_interview_call_company_status",
    });

    // One room's history, which is the other way this table is read
    await queryInterface.addIndex(CALL, ["meeting_session_id", "initiated_ts"], {
      name: "idx_interview_call_meeting_session",
    });

    // Both are how a state refresh from Anam finds the row it belongs to
    await queryInterface.addIndex(CALL, ["meeting_invite_id"], {
      name: "idx_interview_call_meeting_invite",
    });

    await queryInterface.addIndex(CALL, ["anam_session_id"], {
      name: "idx_interview_call_session",
    });

    /* -- the transcript ------------------------------------------------- */

    await queryInterface.createTable(TURN, {
      interview_call_turn_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      // CASCADE, unlike everything else here: a turn has no meaning without the
      // call, and nothing else points at it
      interview_call_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: CALL, key: "interview_call_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // Ordering is explicit, not by id: a transcript can be re-fetched from
      // Anam and rewritten, and insertion order is not the order it was said in
      turn_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      speaker_role: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      // The provider's own name for the speaker, when it gives one. Role cannot
      // tell three humans apart, and guessing is worse than admitting it
      speaker_label: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },

      // Free text spoken by a candidate - treat as PHI-bearing
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      // Per turn, not per call: an interpreter interview switches language
      // mid-conversation, which is the thing being assessed
      language_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },

      // The code resolved to a name once, at write time, so reading the
      // transcript back never needs a lookup table
      language_name: {
        type: Sequelize.STRING(60),
        allowNull: true,
        defaultValue: null,
      },

      spoken_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      // Offsets into the call, not wall-clock: this is what lines a transcript
      // up with the recording once it is in S3
      start_offset_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      end_offset_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      // Which question was live when this was said. Not a foreign key: the
      // question can be retired, and the key is what the persona quoted
      question_key: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint(TURN, {
      fields: ["interview_call_id", "turn_index"],
      type: "unique",
      name: "uq_interview_call_turn_index",
    });

    await queryInterface.addConstraint(TURN, {
      fields: ["speaker_role"],
      type: "check",
      name: "ck_interview_call_turn_role",
      where: { speaker_role: SPEAKER_ROLES },
    });

    await queryInterface.addIndex(TURN, ["interview_call_id", "turn_index"], {
      name: "idx_interview_call_turn_order",
    });

    /* -- what was asked and answered ------------------------------------ */

    // One row per call, holding the whole question-and-answer sheet in order.
    // A child table rather than a column on the call because the sheet is the
    // largest thing a call produces and almost every read of a call does not
    // want it.
    await queryInterface.createTable(ANSWER, {
      interview_call_answer_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      // CASCADE: the sheet has no meaning without the call it came from
      interview_call_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: CALL, key: "interview_call_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // Denormalised so the house rule that every read is company-scoped does
      // not need a join through the call to be honoured
      company_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: COMPANY, key: "company_id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      // The sheet, in the order it was asked:
      //   [{ questionKey, type, question: { body }, answer: { body } }, ...]
      // Ordered inside the document, so reordering is a rewrite of one row and
      // never a renumbering of many.
      answers: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
    });

    // One sheet per call, enforced rather than assumed: record_answer updates
    // the row in place, and a second sheet would silently take half the answers
    await queryInterface.addConstraint(ANSWER, {
      fields: ["interview_call_id"],
      type: "unique",
      name: "uq_interview_call_answer_call",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(ANSWER);
    await queryInterface.dropTable(TURN);
    await queryInterface.dropTable(CALL);
  },
};
