import { DefaultScriptPattern } from "../interfaces/IProgram.interface";

export const CALL_PLAN_PREAMBLE = `This is the plan for the WHOLE call, which runs for about twenty minutes and many
back-and-forth turns. Cover the numbered topics in order; each normally takes
several exchanges.

It is a plan, not a passage to read out, and you are producing only your own next
turn - so never work down this list in one go. A turn of yours that contains two of
these questions is a failure of the call.

The exception is a line told to say word for word. Say those exactly as written.`;

export const SET_HEADING = (index: number, title: string) => `${index}. ${title.toUpperCase()}`;

export const QUESTION_HEADING = (label: string, title: string, key: string) =>
    `${label} ${title}  [question key: ${key}]`;

export const DIRECTION = (context: string) => `How to handle it (never say this aloud): ${context}`;

export const RECORD_UNDER = (fields: string[]) => `Record under: ${fields.join(", ")}.`;

export const GOOD_ANSWER = (expected: string) =>
    `A good answer covers (never say this aloud, and never tell them what you are listening for): ${expected}`;

export const JUDGING = (guidance: string) => `Judging it (never say this aloud): ${guidance}`;

export const RATING_DIRECTION = `Score this one to five when you record it. Never mention the score.`;

export const OUTCOME_DIRECTION = (outcome: string, phrasing: string) => `If ${outcome}: ${phrasing}`;

export const SAY_VERBATIM = `Say the next line word for word, exactly as written - do not paraphrase, shorten, or improvise it.`;

export const INTRO_DELIVERED_BY_TOOL = `ask_question puts this line in front of the first question of this section. Do not say it yourself.`;

// Said, never asked: no tool walks to them and nothing records them.
export const VERBATIM_PATTERNS: DefaultScriptPattern[] = ["GREETING", "INTERVIEW_CONCLUSION"];

export const OPENING_PREAMBLE = `The call runs for about twenty minutes. You do not have the list of questions and you do not need it: each one is handed to you by a tool at the moment it is due, with how to handle it. Never make up a question of your own and never guess what comes next.`;

export const OPENING_FIRST_JOIN = (greeting: string) =>
    (greeting
        ? `Open the call with this, word for word - do not paraphrase, shorten, or improvise it:\n${greeting}`
        : `Open the call with a short, warm hello and your name, then wait for them to respond.`) +
    `\n\nOnce they have responded, call ask_question with no key. From then on every recording tool hands you ` +
    `the next question, and the last one hands you the close.`;

export const OPENING_REJOIN = `They are rejoining an interview already under way. Greet them back in one short line, then call ask_question with no key - it hands you the first question not yet covered. Never put a covered question to them again.`;

export const HANDOVER_GUIDANCE = `About this question - never say any of this aloud, and never tell them what you are listening for:`;

export const RECORD_WITH = (tool: string, key: string) =>
    `When they have answered, record it under question key "${key}" with ${tool} - or with verify_contact if ` +
    `what they gave you is an email address or a phone number.`;

export const RECORD_HEADING = `THE RECORD OF THIS CALL - for rating them when you submit. Never say any of it aloud and never read it back:`;


export const SECTION_INTRO: Partial<Record<DefaultScriptPattern, string>> = {
    CHECKLIST: "Ok",
    QUESTION_ANSWER: "Now let's move on to some questions.",
    SCENARIO: "Now, I’d like to walk you through a few scenarios and get your perspective.",
};
