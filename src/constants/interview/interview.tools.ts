import { IToolBlueprint } from "../../interfaces/IAnamTool.interface";


export const INTERVIEW_ROUTE_PREFIX = "/v1/interview";
const TOOLS_PATH = `${INTERVIEW_ROUTE_PREFIX}/tools`;


const interviewReference = {
    type: "string",
    description: "The reference for this interview, exactly as given to you at the start of the call.",
};

/** The five bands submit_interview rates, each on its own evidence. */
export const EVALUATION_BANDS = [
    {
        key: "languageProficiency",
        label: "Language proficiency",
        bar: "grammar, vocabulary, pronunciation and fluency in every language they used",
    },
    {
        key: "scenarioResponse",
        label: "Scenario-based response",
        bar: "judgement on the scenarios - the steps they chose, and whether they addressed the situation " +
            "actually put to them rather than one adjacent to it",
    },
    {
        key: "culturalCompetence",
        label: "Cultural competence",
        bar: "awareness of cultural difference and how they handled it, without stereotyping",
    },
    {
        key: "professionalism",
        label: "Professionalism",
        bar: "conduct, confidentiality, impartiality and how they held the boundaries of the role",
    },
    {
        key: "communicationSkills",
        label: "Communication skills",
        bar: "clarity, listening, turn-taking and whether they stayed understandable throughout",
    },
] as const;

export const bandBasisKey = (bandKey: string) => `${bandKey}Basis`;

/** What submit_interview recommends to the recruiter, strongest first. */
export const HIRE_RECOMMENDATIONS = ["strong hire", "hire", "weak hire", "no hire"] as const;

export const INTERVIEW_TOOL_BLUEPRINTS: IToolBlueprint[] = [
    {
        key: "ask_question",
        kind: "webhook",
        path: `${TOOLS_PATH}/ask-question`,
        description:
            "Hands you the question to put to them, with how to handle it. Call it with no key once they have " +
            "responded to your greeting, with no key again if you have lost your place, and with the same key if " +
            "you put a question and heard nothing at all - after three silences it tells you to leave the call, " +
            "and you do. Never for a question a recording tool has just handed you: that one is already put. Say " +
            "the line it gives you and END YOUR TURN: no second question, no answering it yourself, no other tool.",
        parameters: {
            type: "object",
            properties: {
                interviewReference,
                questionKey: {
                    type: "string",
                    description:
                        "The key of the question you heard nothing back on. Leave it out to be given the next " +
                        "question still uncovered.",
                },
            },
            required: ["interviewReference"],
        },
    },
    {
        key: "verify_contact",
        kind: "webhook",
        path: `${TOOLS_PATH}/verify-contact`,
        description:
            "Check an email address or phone number the person just said against what we hold, and record it. " +
            "Use this the moment they say one, before you respond - you do not know whether it matches until you do. " +
            "It IS the recording for that question - no record_answer or record_checklist as well - and like them " +
            "it hands you what comes next. If it says the detail does not match, the question is not covered yet " +
            "and it tells you how to ask again. Never say the value we hold out loud; this tells you what you may say.",
        disableInterruptions: true,
        parameters: {
            type: "object",
            properties: {
                interviewReference,
                questionKey: {
                    type: "string",
                    description:
                        "The key of the question that asked for this detail, as its hand-over gave it. " +
                        "Without it the answer is recorded against nothing and the question stays uncovered.",
                },
                field: {
                    type: "string",
                    description: "Which detail they gave.",
                    enum: ["email", "phone"],
                },
                statedValue: {
                    type: "string",
                    description: "Exactly what they said, as you heard it, including spelled-out words.",
                },
            },
            required: ["interviewReference", "questionKey", "field", "statedValue"],
        },
    },
    {
        key: "record_answer",
        kind: "webhook",
        path: `${TOOLS_PATH}/record-answer`,
        description:
            "Record what they said for an open question or a scenario - a plain yes/no item goes through " +
            "record_checklist instead. Once they have finished answering and before you say anything else, never " +
            "in a batch at the end. If they asked to skip it or refused, ask them why first, then record their " +
            "reason with outcome skipped. Record it as they gave it, not tidied up. It usually hands you the next " +
            "question, already put: acknowledge their answer and say that question in the same turn.",
        parameters: {
            type: "object",
            properties: {
                interviewReference,
                questionKey: {
                    type: "string",
                    description: "The key the hand-over gave for the question you just covered.",
                },
                summary: {
                    type: "string",
                    description:
                        "Your own short account of their answer in two or three sentences, in their terms. Not " +
                        "a transcript - rawResponse carries their words, so never send the same text for both.",
                },
                rawResponse: {
                    type: "string",
                    description:
                        "Their answer word for word, from when you finished asking to when they stopped - false " +
                        "starts, filler and broken sentences kept, grammar uncorrected, nothing shortened. Several " +
                        "turns are joined with a space. Never your own words or a question of yours.",
                },
                data: {
                    type: "object",
                    description:
                        "The specific things this question asks you to capture, keyed by the field names its hand-over gave.",
                    properties: {},
                },
                outcome: {
                    type: "string",
                    description:
                        "How it went: answered, skipped if they asked to move on rather than answer, declined if " +
                        "they would not say, unclear if you could not pin it down.",
                    enum: ["answered", "skipped", "declined", "unclear"],
                },
                score: {
                    type: "string",
                    description:
                        "One to five against this question's guidance, where its hand-over asks for a score. " +
                        "Never mention it aloud.",
                },
            },
            required: ["interviewReference", "questionKey", "summary", "rawResponse"],
        },
    },
    {
        key: "record_checklist",
        kind: "webhook",
        path: `${TOOLS_PATH}/record-checklist`,
        description:
            "Record a plain yes/no checklist item, once you have a clear yes or no - if you did not catch it, ask " +
            "again rather than guessing. If they would not answer, record no with their reason. It usually hands " +
            "you the next question, already put: acknowledge their answer and say that question in the same turn.",
        parameters: {
            type: "object",
            properties: {
                interviewReference,
                questionKey: {
                    type: "string",
                    description: "The key the hand-over gave for the checklist item you just covered.",
                },
                outcome: {
                    type: "string",
                    description: "What they said: yes or no.",
                    enum: ["yes", "no"],
                },
                summary: {
                    type: "string",
                    description: "What they actually said, in their words, if it adds anything beyond yes or no.",
                },
                rawResponse: {
                    type: "string",
                    description:
                        "Their reply word for word, exactly as they said it, filler and all - even when it is " +
                        "only \"yeah, that's right\". A transcript, not a summary: do not tidy it or shorten it.",
                },
            },
            required: ["interviewReference", "questionKey", "outcome", "rawResponse"],
        },
    },
    {
        key: "search_knowledge",
        kind: "knowledge",
        description:
            "Search the candidate FAQs for anything factual about working with us: pay rates and how pay is " +
            "decided, mileage, assignment minimums, hours and how much work to expect, where assignments are and " +
            "what kinds, how and how often interpreters are paid, whether training is paid and its cost, " +
            "onboarding, immunisation and medical requirements, working for other agencies, declining work, " +
            "availability, cancellations, no-shows, technical problems, and required experience or languages. " +
            "Use it every time such a question comes up, even for something you feel sure of - you are not sure, " +
            "and a wrong figure is the worst outcome of this call. Not for this candidate's own application or " +
            "interview outcome. It returns the closest documents, which may not be the subject they asked about: " +
            "if what comes back does not answer their question, you have nothing. Follow every call with " +
            "record_candidate_question.",
        disableInterruptions: true,
    },
    {
        key: "record_candidate_question",
        kind: "webhook",
        path: `${TOOLS_PATH}/record-candidate-question`,
        description:
            "Record a question the candidate asked you. Call this once after every search_knowledge, whatever " +
            "came back - it is the only record that they asked at all. When nothing that came back answers them, " +
            "send found false: that is what puts it in front of a person, so only after it may you say someone " +
            "will come back to them - no flag_for_staff as well. If they asked it while answering your question, " +
            "call this and the recording tool together. Not for the questions you were handed to ask.",
        parameters: {
            type: "object",
            properties: {
                interviewReference,
                question: {
                    type: "string",
                    description: "What they asked, in their own words, as close to how they said it as you can.",
                },
                found: {
                    type: "string",
                    description:
                        "Whether the search actually answered their question. Send false when it came back " +
                        "empty, and also when it returned documents that were not about what they asked.",
                    enum: ["true", "false"],
                },
                answer: {
                    type: "string",
                    description: "What you told them, in one or two sentences. Leave out when you had nothing to tell them.",
                },
            },
            required: ["interviewReference", "question", "found"],
        },
    },
    {
        key: "flag_for_staff",
        kind: "webhook",
        path: `${TOOLS_PATH}/flag-for-staff`,
        description:
            "Put something in front of a person: a complaint, a correction you cannot make, a question of yours " +
            "they would not answer after three goes, or anything else outside this call. Call it BEFORE you tell " +
            "them it has been passed on - that promise is only true once this has gone through. Not for a question " +
            "they asked you: record_candidate_question with found false already flags those.",
        parameters: {
            type: "object",
            properties: {
                interviewReference,
                question: {
                    type: "string",
                    description: "What they asked or raised, in their words.",
                },
                context: {
                    type: "string",
                    description: "Anything that helps whoever picks this up - what you had already told them, if relevant.",
                },
            },
            required: ["interviewReference", "question"],
        },
    },
     {
        key: "submit_interview",
        kind: "webhook",
        path: `${TOOLS_PATH}/submit`,
        description:
            "The last thing you call in the interview, and you always call it. Once they have no more " +
            "questions, call this; its reply tells you to say your goodbye, and the call ends once you " +
            "have said it. Nothing else closes an interview: end the call without this and " +
            "nothing you recorded is ever reviewed. The close handed you their record and how to rate " +
            "them: all five ratings, each with its own basis, the recommendation and the summary are " +
            "required every time - a one-line basis will be sent back to you. If something is still " +
            "uncovered it hands you that question instead: put it, record it, and call this again. " +
            "Never say the reference or any of this aloud.",
        disableInterruptions: true,
        parameters: {
            type: "object",
            properties: {
                interviewReference,
                closingNote: {
                    type: "string",
                    description: "Anything about how the call went that a recruiter should know. Not a verdict.",
                },
                ...Object.fromEntries(EVALUATION_BANDS.flatMap((band) => [
                    [
                        band.key,
                        {
                            type: "string",
                            description: `One to five for ${band.label.toLowerCase()} - ${band.bar}. Required on every submit.`,
                        },
                    ],
                    [
                        bandBasisKey(band.key),
                        {
                            type: "string",
                            description: `Required with the ${band.label.toLowerCase()} rating: three or four ` +
                                "sentences - what they did well, what fell short, and why it is this number " +
                                "and not one higher or lower, each with something they actually said.",
                        },
                    ],
                ])),
                recommendation: {
                    type: "string",
                    description: "Required on every submit. One of these, agreeing with the five ratings.",
                    enum: [...HIRE_RECOMMENDATIONS],
                },
                evaluationSummary: {
                    type: "string",
                    description:
                        "Required. Three or four sentences of your own judgement of how they did overall - " +
                        "what carried each rating and where they were weakest. Not a recap of what was asked.",
                },
            },
            required: ["interviewReference"],
        },
    },
    {
        /**
         * Anam's own built-in, matched by this exact name. It is what actually
         * tears the session down - a webhook could only ever write a row and
         * leave the persona sitting in the room. Nothing here is sent to Anam;
         * the description is for whoever reads this file.
         */
        key: "end_call",
        kind: "system",
        description:
            "Anam's system end_call. Ends the session and drops the persona out of the meeting. Attached by " +
            "id, not authored - the wording the model sees is Anam's own.",
    },
];

/** Anam's own tools. They never call back, so nothing here serves them. */
export const SYSTEM_TOOL_KEYS = INTERVIEW_TOOL_BLUEPRINTS
    .filter((blueprint) => blueprint.kind === "system")
    .map((blueprint) => blueprint.key);

/** Webhook keys only - what the tool router has to answer, and what probing checks. */
export const INTERVIEW_WEBHOOK_KEYS = INTERVIEW_TOOL_BLUEPRINTS
    .filter((blueprint) => blueprint.kind === "webhook")
    .map((blueprint) => blueprint.key);

/** Every key a session attaches, system tools included. */
export const INTERVIEW_TOOL_KEYS = INTERVIEW_TOOL_BLUEPRINTS.map((blueprint) => blueprint.key);
