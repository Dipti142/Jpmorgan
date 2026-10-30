import { IQuestionPatternSeed } from "../interfaces/IProgram.interface";


export const QUESTION_PATTERNS: IQuestionPatternSeed[] = [
    {
        pattern_code: "GREETING",
        pattern_label: "Greetings & Introduction",
        question_kind: "Greetings",
        rating_required_default: false,
        display_order: 1,
    },
    {
        pattern_code: "CHECKLIST",
        pattern_label: "Checklist",
        question_kind: "checklist",
        rating_required_default: false,
        display_order: 2,
    },
    {
        pattern_code: "QUESTION_ANSWER",
        pattern_label: "Question & answer",
        question_kind: "question_answer",
        rating_required_default: true,
        display_order: 3,
    },
    {
        pattern_code: "SCENARIO",
        pattern_label: "Scenario",
        question_kind: "scenario",
        rating_required_default: true,
        display_order: 4,
    },
    {
        pattern_code: "INTERVIEW_CONCLUSION",
        pattern_label: "Interview conclusion",
        question_kind: "interview_conclusion",
        rating_required_default: false,
        display_order: 5,
    },
];

export default QUESTION_PATTERNS;
