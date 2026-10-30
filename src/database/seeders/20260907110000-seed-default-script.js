"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;
const TABLE = { tableName: "tl_default_script", schema: SCHEMA };
const PATTERN = { tableName: "tl_question_pattern", schema: SCHEMA };

// The interpreter is the AGENT, so this is the set the AGENT is always asked.
const SCRIPTS = [
  {
    company_id: 7,
    program_kind: "INTERVIEW",
    question_pattern: "GREETING",
    participant_role: "AGENT",
    script_type: "DEFAULT",
    script_key: "greeting-introduction",
    script_name: "Greetings & Introduction",
    // Zero rather than renumbering the sets already seeded, which this seeder skips.
    script_order: 0,
    questions: [
      {
        key: "greeting",
        title: "Greeting and introduction",
        kind: "Greetings",
        order: 1,
        // Spoken, never recorded - a required greeting would block submission forever.
        required: false,
        question: `Hello [candidate_name], I am [agent_name] from [company_name]. Thank you for making the time today. This is the interpreter screening interview, and it should take about twenty to forty minutes. Is now still a good time to go ahead?`,
        context: `Say this word for word as your very first turn - the same wording every call, with only the names differing. Then stop and wait for their reply before you say anything else. If they say now is not a good time, tell them the team will be in touch to rearrange, then call end_call.`,
      },
    ],
  },
  {
    company_id: 7,
    program_kind: "INTERVIEW",
    question_pattern: "CHECKLIST",
    participant_role: "AGENT",
    script_type: "DEFAULT",
    script_key: "checklist-questions",
    script_name: "Checklist Questions",
    script_order: 1,
    questions: [
      {
        key: "email-checklist",
        title: "Email on file is current",
        kind: "checklist",
        order: 1,
        required: true,
        question: `Is the email address we have on file still the best one for your assignments?`,
        context: `A yes moves straight on. A no means we have it wrong - ask them to spell it out letter by letter, like "d e m o at g m a i l dot c o m", because an address said at normal speed is the easiest thing on this call to get wrong. Never read out what we hold.`,
        captureFields: ["email_confirmed", "email_provided"],
        tool: { name: "record_checklist", args: { field: "email" } },
        expected_responses: {
          yes: `Confirmed. Acknowledge it once, briefly, and go to the next question.`,
          no: `Ask them to spell the correct address out letter by letter, saying "at" and "dot" where those go. Read the spelling back once so they can correct you, then record what they confirm. Tell them our record looks out of date and the team will update it from what they just gave you.`,
          notHeard: `You did not catch a yes or a no. Ask them again, a little slower.`,
        },
      },
      {
        key: "phone-checklist",
        title: "Phone on file is current",
        kind: "checklist",
        order: 2,
        required: true,
        question: `Is the number we have on file the best one to reach you on for assignments?`,
        context: `A yes moves straight on. A no means we have it wrong - ask for the right number digit by digit and record exactly what they say. Do not read out the number we hold.`,
        captureFields: ["phone_confirmed", "phone_provided"],
        tool: { name: "record_checklist", args: { field: "phone" } },
        expected_responses: {
          yes: `Confirmed. Acknowledge it once and go to the next question.`,
          no: `Ask for the right number, digit by digit. Read it back once so they can correct you, then record what they confirm, and tell them the team will update the record from it.`,
          notHeard: `You did not catch a yes or a no. Ask them again, slower.`,
        },
      },
    ],
  },
  {
    company_id: 7,
    program_kind: "INTERVIEW",
    question_pattern: "QUESTION_ANSWER",
    participant_role: "AGENT",
    script_type: "DEFAULT",
    script_key: "question-answer-questions",
    script_name: "Question Answer Questions",
    script_order: 2,
    questions: [
      {
        key: "language-pairs",
        title: "Language pairs",
        kind: "question_answer",
        order: 1,
        required: true,
        question: `Which languages do you interpret between, and which direction are you strongest in?`,
        context: `Their file already lists pairs, so confirm those in one sentence rather than asking from scratch. What the file cannot tell you is which direction they are stronger in - that is the part to get.`,
        expectedAnswer: `Names each pair and says which direction is stronger, rather than claiming both are equal.`,
        captureFields: ["language_pairs", "strongest_direction"],
        evaluationGuidance: `Higher for a clear sense of which direction is stronger. Lower for a broad fluency claim with nothing behind it.`,
        tool: { name: "record_answer" },
        expected_responses: {
          vague: `They named a language but not a pair or a direction. Ask once, specifically, then take what you get.`,
          declined: `Record that they would not say, and move on without pressing.`,
          notHeard: `You did not catch it. Ask them to say the languages again, a little slower.`,
        },
      },
      {
        key: "certification",
        title: "Certification",
        kind: "question_answer",
        order: 2,
        required: true,
        question: `Are you certified in any of those pairs, and who certified you?`,
        context: `The body that certified them matters more than the word "certified" - ask for the name. If their file lists a pair with no certification against it, ask about that pair specifically.`,
        expectedAnswer: `Names the certifying body, and says which pairs it covers. "No" is a complete answer if that is the truth.`,
        captureFields: ["certifications", "certifying_body", "uncertified_pairs"],
        evaluationGuidance: `Higher for a named body and a clear scope. Do not mark down an honest no - mark down a yes with no body behind it.`,
        tool: { name: "record_answer" },
        expected_responses: {
          vague: `They said certified but not by whom. Ask for the name of the body once, then move on.`,
          declined: `Record that they would not say, and move on.`,
          notHeard: `You did not catch it. Ask again, slower.`,
        },
      },
      {
        key: "language-use",
        title: "How the languages are used",
        kind: "question_answer",
        order: 3,
        required: true,
        question: `How did you come to each of those languages, and where do you use them now?`,
        context: `Two things in one - how they learned it, and where it gets used day to day. Let them answer the first before you nudge toward the second. Someone offering a language professionally should be able to say how they got it.`,
        expectedAnswer: `Says how each language was learned - upbringing, schooling, or formal training - and names the settings they use it in.`,
        captureFields: ["how_learned", "settings_used", "recent_use"],
        evaluationGuidance: `Higher for formal training or sustained professional use. Lower for someone who cannot say how they learned a language they are offering to work in.`,
        tool: { name: "record_answer" },
        expected_responses: {
          vague: `They covered how they learned it but not where they use it, or the other way round. Ask for the missing half once.`,
          declined: `Record that they would not say, and move on.`,
          notHeard: `You did not catch it. Ask again, slower.`,
        },
      },
    ],
  },
  {
    company_id: 7,
    program_kind: "INTERVIEW",
    question_pattern: "SCENARIO",
    participant_role: "AGENT",
    script_type: "DEFAULT",
    script_key: "scenario-questions",
    script_name: "Scenario Questions",
    script_order: 3,
    questions: [
      {
        key: "unknown-term",
        title: "Handling a term they do not know",
        kind: "scenario",
        order: 1,
        required: true,
        question: `You are mid-appointment and a term comes up that you do not know. What do you do?`,
        context: `This is the question that separates a careful interpreter from a confident one. Let them answer without prompting - do not offer them the good answer. If they only say they would ask, ask who they would ask and what they would say.`,
        expectedAnswer: `Stops and asks for clarification rather than guessing or paraphrasing around it, and says so to both parties rather than quietly filling the gap.`,
        captureFields: ["unknown_term_approach", "asks_for_clarification", "flags_to_both_parties"],
        evaluationGuidance: `Higher for stopping and asking, and for telling both parties that is what is happening. Lower for guessing, for approximating, or for anything that leaves one party unaware a term was not carried across.`,
        tool: { name: "record_answer" },
        expected_responses: {
          vague: `They gave a general answer about being careful. Ask what they would actually say in the room, once.`,
          declined: `Record that they would not say, and move on.`,
          notHeard: `You did not catch it. Put the situation to them again, a little slower.`,
        },
      },
      {
        key: "real-incident",
        title: "A time it actually happened",
        kind: "scenario",
        order: 2,
        required: true,
        question: `Has that actually come up in an assignment? Talk me through what happened.`,
        context: `Warn them first not to use any patient or client names or identifying details. A real incident tells you far more than the tidy answer to the question before it - if the two do not match, record what they did, not what they said they would do.`,
        expectedAnswer: `A specific assignment rather than a general description, with what they actually did and how it turned out. No identifying details of anyone involved.`,
        captureFields: ["incident_setting", "incident_actions", "incident_outcome"],
        evaluationGuidance: `Score what they did, not how dramatic the story was. Someone who asked a clinician to repeat themselves scores higher than someone who says it has never happened to them.`,
        tool: { name: "record_answer" },
        expected_responses: {
          vague: `They stayed general. Ask for one specific occasion, once, then take what you get.`,
          identifying: `They are naming people or places. Stop them gently, remind them to keep it anonymous, and let them carry on.`,
          declined: `Record that they had no example or would not give one, and move on without pressing.`,
          notHeard: `You did not catch it. Ask again, slower.`,
        },
      },
    ],
  },
  {
    company_id: 7,
    program_kind: "INTERVIEW",
    question_pattern: "INTERVIEW_CONCLUSION",
    participant_role: "AGENT",
    script_type: "DEFAULT",
    script_key: "interview-conclusion",
    script_name: "Interview Conclusion",
    script_order: 4,
    questions: [
      {
        // Keyed "closing" because submitInterview reads its phrasing by that key.
        key: "closing",
        title: "Questions and close",
        kind: "interview_conclusion",
        order: 1,
        // Spoken, never recorded - submission would refuse itself otherwise.
        required: false,
        question: `Thank you for your time today, [candidate_name]. That is everything I needed to ask. If you have any questions for me, now would be the time.`,
        context: `The recording tool hands you this line the moment the last question goes down - say it then, word for word, and wait. Answer what they ask by looking it up, never speculate on pay, start dates or how they did, and record anything you cannot answer so someone follows up. Then ask whether there is anything else. When they have nothing further, call submit_interview with all five ratings - you always call it, it is the only thing that closes an interview, and it always comes before end_call. Only once it has come back and you have said the sign-off do you call end_call - it is the last thing you do and you cannot speak afterwards.`,
        captureFields: ["candidate_questions"],
        tool: { name: "submit_interview" },
        expected_responses: {
          submitted: `Do not mention any reference number. Say [company_name] will come back to them within two working days. Do not tell them the recommendation and do not hint at it. Wait for them to respond, say goodbye, then call end_call.`,
          alreadySubmitted: `This one is already submitted. Do not mention any reference number. Nothing to change - close warmly, then call end_call.`,
          incomplete: `{{missingCount}} of the things you need are still not covered: {{missingTitles}}. Go back and cover those before closing.`,
        },
      },
    ],
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const script of SCRIPTS) {
      // Matches the unique constraint, so a re-run finds its own earlier insert.
      const existing = await queryInterface.rawSelect(
        TABLE,
        {
          where: {
            company_id: script.company_id,
            program_kind: script.program_kind,
            participant_role: script.participant_role,
            script_type: script.script_type,
            script_key: script.script_key,
          },
        },
        ["default_script_id"],
      );
      if (existing) {
        console.log(`  "${script.script_key}" already present, left alone.`);
        continue;
      }

      // The pattern is a row now, so the code above resolves to its id. The
      // create migration seeds those rows, so they are there before any seeder.
      const { question_pattern, ...columns } = script;
      const questionPatternId = await queryInterface.rawSelect(
        PATTERN,
        { where: { pattern_code: question_pattern } },
        ["question_pattern_id"],
      );
      if (!questionPatternId) {
        throw new Error(
          `Question pattern "${question_pattern}" is not in tl_question_pattern - run migrate:up first`,
        );
      }

      await queryInterface.bulkInsert(TABLE, [
        {
          ...columns,
          question_pattern_id: questionPatternId,
          // bulkInsert has no column type to work from, so a raw array is escaped
          // as a Postgres array literal instead of being cast to JSONB.
          questions: JSON.stringify(script.questions),
          is_active: 1,
          created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ]);
      console.log(`  + ${script.script_key} (${script.questions.length} questions)`);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(TABLE, {
      script_key: SCRIPTS.map((script) => script.script_key),
    });
  },
};
