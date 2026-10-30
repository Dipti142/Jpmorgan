/**
 * The "I do not have that" path.
 *
 * A persona that improvises a rate or a start date is worse than one that says
 * a person will come back to you, so not-knowing has to be as easy to do as
 * answering.
 *
 * Routing only now - an escalation is stored on the call it came from
 * (tl_interview_call.escalations), so there is no table and no query here. Kept
 * as its own file because who-follows-up is not interview-specific: an
 * orientation persona routes the same way.
 */

/**
 * Who follows up, inferred from what was asked. Only ever a suggestion - the
 * persona speaks a team name, never a person, so a wrong guess is a routing
 * detail and not a promise made to the candidate.
 */
const OWNER_RULES: Array<{ owner: string; pattern: RegExp }> = [
    { owner: "payroll", pattern: /\b(pay|rate|invoice|paid|salary|wage|tax|1099|w-?9)\b/i },
    { owner: "compliance", pattern: /\b(background|screening|hipaa|exclusion|licen[cs]e|certif|training)\b/i },
    { owner: "scheduling", pattern: /\b(schedul|assign|shift|availab|cancel|short notice|travel|mileage)\b/i },
    { owner: "IT support", pattern: /\b(app|login|password|portal|device|platform|software)\b/i },
];

const FALLBACK_TEAM = "the team";

const defaultOwnerFor = (companyName: string | null | undefined): string => {
    const name = String(companyName ?? "").trim();
    return name ? `${name} Team` : FALLBACK_TEAM;
};

export const suggestOwner = (question: string, companyName?: string | null): string => {
    const asked = String(question ?? "");
    for (const rule of OWNER_RULES) {
        if (rule.pattern.test(asked)) return rule.owner;
    }
    return defaultOwnerFor(companyName);
};
