"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;
const TABLE = `"${SCHEMA}"."tl_default_script"`;
const SCRIPT_KEY = "interview-conclusion";
const QUESTION_KEY = "closing";

// The seeder is skip-if-exists on script_key, so editing its literal reaches new
// installs only. This carries the databases it has already run on.
const BEFORE = {
  question: `Thank you for your time today, [candidate_name]. That is everything I needed to ask.`,
  context: `Say the thank-you line word for word, then wait. Answer what they ask by looking it up - never speculate on pay, start dates or how they did, and record anything you cannot answer so someone follows up. When they have nothing further, call submit_interview with all five ratings - you always call it, it is the only thing that closes an interview, and it always comes before end_call. Only once that has gone through and you have said goodbye do you call end_call - it is the last thing you do and you cannot speak afterwards.`,
};

const AFTER = {
  question: `Thank you for your time today, [candidate_name]. That is everything I needed to ask. If you have any questions for me, now would be the time.`,
  context: `The recording tool hands you this line the moment the last question goes down - say it then, word for word, and wait. Answer what they ask by looking it up, never speculate on pay, start dates or how they did, and record anything you cannot answer so someone follows up. Then ask whether there is anything else. When they have nothing further, call submit_interview with all five ratings - you always call it, it is the only thing that closes an interview, and it always comes before end_call. Only once it has come back and you have said the sign-off do you call end_call - it is the last thing you do and you cannot speak afterwards.`,
};

/**
 * Rewrites one element of a JSONB array in place. The table is console-editable,
 * so anything already changed by hand is left alone rather than overwritten.
 */
const rewrite = async (queryInterface, from, to) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT default_script_id, questions FROM ${TABLE} WHERE script_key = :scriptKey`,
    { replacements: { scriptKey: SCRIPT_KEY } },
  );

  for (const row of rows) {
    const questions = Array.isArray(row.questions) ? row.questions : JSON.parse(row.questions ?? "[]");
    const question = questions.find((candidate) => candidate.key === QUESTION_KEY);

    if (!question) {
      console.log(`  script ${row.default_script_id}: no "${QUESTION_KEY}" question, skipped.`);
      continue;
    }
    if (question.question !== from.question) {
      console.log(`  script ${row.default_script_id}: "${QUESTION_KEY}" has been edited, left alone.`);
      continue;
    }

    question.question = to.question;
    question.context = to.context;

    await queryInterface.sequelize.query(
      `UPDATE ${TABLE} SET questions = CAST(:questions AS jsonb) WHERE default_script_id = :id`,
      { replacements: { questions: JSON.stringify(questions), id: row.default_script_id } },
    );
    console.log(`  ~ script ${row.default_script_id}: "${QUESTION_KEY}" updated.`);
  }
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await rewrite(queryInterface, BEFORE, AFTER);
  },

  async down(queryInterface) {
    await rewrite(queryInterface, AFTER, BEFORE);
  },
};
