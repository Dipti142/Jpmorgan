import {
    CALL_PLAN_PREAMBLE, DIRECTION, GOOD_ANSWER, JUDGING, OPENING_FIRST_JOIN, OPENING_PREAMBLE, OPENING_REJOIN, OUTCOME_DIRECTION,
    QUESTION_HEADING, RATING_DIRECTION, INTRO_DELIVERED_BY_TOOL, RECORD_UNDER, SAY_VERBATIM, SECTION_INTRO, SET_HEADING,
    VERBATIM_PATTERNS
} from "../constants/script.text";
import { DefaultScriptPattern, DefaultScriptRole, IDefaultScriptQuestion, } from "../interfaces/IProgram.interface";
import { IBuiltScript, IResolvedScript, IScriptBuildInput, IScriptPlaceholders, IScriptQuestion, IScriptSet, ScriptMode, } from "../interfaces/IScript.interface";
import * as customScripts from "../repositories/customScript.repository";
import * as defaultScripts from "../repositories/defaultScript.repository";
import { trace } from "../helpers/trace.helper";
import { toSpokenText } from "../helpers/speech.helper";
import CustomScriptSet from "../models/customScriptSet.model";
interface IScriptSetRow {
    script_name: string;
    pattern: {
        pattern_code: DefaultScriptPattern;
        rating_required_default: boolean;
    };
    questions: IDefaultScriptQuestion[];
}

const indent = (spaces: number, text: string): string => {
    const pad = " ".repeat(spaces);
    return pad + String(text ?? "").replaceAll("\n", `\n${pad}`);
};

const UNKNOWN_PERSON = "there";

export class ScriptBuilderService {
    public static async build(input: IScriptBuildInput): Promise<IBuiltScript> {
        const resolved = await this.resolve(input);
        return { ...resolved, script: this.render(resolved.sets, input) };
    }

    public static async resolve(input: IScriptBuildInput): Promise<IResolvedScript> {
        const custom = await this.loadCustomSets(input);
        const loaded = custom.length ? custom : await this.loadDefaultSets(input);
        const mode: ScriptMode = custom.length ? "custom" : "default";
        const sets = this.fill(loaded, input.placeholders);

        if (!sets.length) {
            throw new Error(
                `No active ${input.programKind} script for company ${input.companyId} ` +
                `(${input.participantRole ?? "AGENT"}) - run npm run seed:dev`,
            );
        }

        this.assertUniqueKeys(sets);
        return { sets, questions: sets.flatMap((set) => set.questions), mode };
    }

    public static placeholders(input: {
        agentName?: string | null; companyName?: string | null; candidateName?: string | null;
    }): IScriptPlaceholders {
        return {
            agent_name: String(input.agentName ?? "").trim(),
            company_name: String(input.companyName ?? "").trim(),
            candidate_name: String(input.candidateName ?? "").trim().split(/\s+/)[0] || UNKNOWN_PERSON,
        };
    }

    /** The never-aloud guidance for one question - in the console outline, and in its tool hand-over. */
    public static brief(question: IScriptQuestion): string[] {
        return [
            ...(question.context ? [DIRECTION(question.context)] : []),
            ...(question.captureFields.length ? [RECORD_UNDER(question.captureFields)] : []),
            ...(question.expectedAnswer ? [GOOD_ANSWER(question.expectedAnswer)] : []),
            ...(question.evaluationGuidance ? [JUDGING(question.evaluationGuidance)] : []),
            ...(question.ratingRequired ? [RATING_DIRECTION] : []),
            ...Object.entries(question.responses).map(([outcome, phrasing]) => OUTCOME_DIRECTION(outcome, phrasing)),
        ];
    }

    // The session's Goal: only the greeting is in it - every question arrives through a tool.
    public static renderOpening(sets: IScriptSet[], input: { rejoining: boolean; closing?: string[] }): string {
        const greeting = sets
            .filter((set) => set.pattern === "GREETING")
            .flatMap((set) => set.questions.map((question) => toSpokenText(question.question)))
            .join("\n\n");

        return [OPENING_PREAMBLE, input.rejoining ? OPENING_REJOIN : OPENING_FIRST_JOIN(greeting), ...(input.closing ?? [])]
            .join("\n\n")
            .trimEnd();
    }

    public static findByTool(questions: IScriptQuestion[], toolName: string, args: Record<string, unknown> = {},): IScriptQuestion | undefined {
        return questions.find(
            (question) =>
                question.tool?.name === toolName &&
                Object.entries(args).every(([key, value]) => question.tool?.args?.[key] === value),
        );
    }

    private static async loadCustomSets(input: IScriptBuildInput): Promise<IScriptSet[]> {
        const jobShortCode = String(input.jobShortCode ?? "").trim();
        if (!jobShortCode && !input.scriptTemplateId) {
            return [];
        }

        const row = input.scriptTemplateId
            ? null
            : await customScripts.findScriptForRole({
                companyId: input.companyId,
                programKind: input.programKind,
                participantRole: input.participantRole ?? "AGENT",
                jobShortCode,
            });
        const templateId = input.scriptTemplateId ?? Number(row?.custom_script_template_id ?? 0);
        if (!templateId) return [];

        const template = await customScripts.findTemplateById(input.companyId, templateId);
        if (!template) {
            trace("script", jobShortCode, "template_missing", {
                companyId: input.companyId,
                customScriptId: row ? Number(row.custom_script_id) : null,
                templateId,
            });
            return [];
        }

        const setIds = (template.script_set_ids ?? []).map(Number).filter(Boolean);
        const found = await customScripts.listSetsByIds(setIds, undefined, !input.isOngoing);
        const byId = new Map(found.map((set) => [Number(set.custom_script_set_id), set]));

        // Postgres cannot foreign key into an array, so an id can name a set that
        // was retired. Skipping it is the decision; going quiet about it is not.
        const missing = setIds.filter((setId) => !byId.has(setId));
        if (missing.length) {
            trace("script", jobShortCode, "sets_missing", {
                companyId: input.companyId,
                scriptUuid: template.script_uuid,
                missing,
            });
        }

        return setIds
            .map((setId) => byId.get(setId))
            .filter((set): set is CustomScriptSet => set !== undefined)
            .sort((left, right) => Number(left.question_pattern_id) - Number(right.question_pattern_id))
            .map((set, index) =>
                this.toSet(set, String(set.custom_script_set_id), index, input.participantRole ?? "AGENT"),
            )
            .filter((set) => set.questions.length > 0);
    }

    // OPTIONAL sets are left out until a programme has a way to pull from them.
    private static async loadDefaultSets(input: IScriptBuildInput): Promise<IScriptSet[]> {
        const rows = await defaultScripts.listScripts({
            companyId: input.companyId,
            programKind: input.programKind,
            participantRole: input.participantRole ?? "AGENT",
            scriptType: "DEFAULT",
        });

        return rows
            .map((row) => this.toSet(row, row.script_key, row.script_order, row.participant_role))
            .filter((set) => set.questions.length > 0);
    }

    private static toSet(row: IScriptSetRow, key: string, order: number, role: DefaultScriptRole): IScriptSet {
        // Off the pattern row, not a hardcoded comparison - and still only the
        // default, because a question may say otherwise.
        const patternDefault = row.pattern.rating_required_default;

        return {
            key,
            title: row.script_name,
            pattern: row.pattern.pattern_code,
            role,
            order,
            ratingRequired: patternDefault,
            questions: (row.questions ?? [])
                .filter((question) => question.isActive !== false)
                .sort((left, right) => left.order - right.order)
                .map((question) => this.toQuestion(question, patternDefault)),
        };
    }

    private static toQuestion(question: IDefaultScriptQuestion, patternDefault: boolean): IScriptQuestion {
        return {
            key: question.key,
            title: question.title,
            kind: question.kind,
            order: question.order,
            required: question.required !== false,
            question: question.question,
            context: question.context,
            expectedAnswer: question.expectedAnswer,
            captureFields: question.captureFields ?? [],
            evaluationGuidance: question.evaluationGuidance,
            // Explicit wins, absent falls back to what the pattern implies.
            ratingRequired: question.ratingRequired ?? patternDefault,
            tool: question.tool,
            responses: question.expected_responses ?? {},
        };
    }

    // An unknown token is left as written: authored prose has its own square
    // brackets, and eating them would be a silent edit to someone else's script.
    private static fillText(text: string, values: IScriptPlaceholders): string {
        return String(text ?? "").replaceAll(/\[(\w+)\]/g, (match, key: string) =>
            key in values ? values[key as keyof IScriptPlaceholders] : match);
    }

    /** No values means a template view - the placeholders stay visible on purpose. */
    private static fill(sets: IScriptSet[], values?: IScriptPlaceholders): IScriptSet[] {
        if (!values) return sets;

        const text = (value: string) => this.fillText(value, values);
        const optional = (value?: string) => (value === undefined ? undefined : text(value));

        return sets.map((set) => ({
            ...set,
            title: text(set.title),
            questions: set.questions.map((question) => ({
                ...question,
                question: text(question.question),
                context: optional(question.context),
                expectedAnswer: optional(question.expectedAnswer),
                evaluationGuidance: optional(question.evaluationGuidance),
                responses: Object.fromEntries(
                    Object.entries(question.responses).map(([outcome, phrasing]) => [outcome, text(phrasing)]),
                ),
            })),
        }));
    }

    private static assertUniqueKeys(sets: IScriptSet[]): void {
        const seen = new Map<string, string>();

        for (const set of sets) {
            for (const question of set.questions) {
                const owner = seen.get(question.key);
                if (owner) {
                    throw new Error(
                        `Question key "${question.key}" is in both "${owner}" and "${set.key}". ` +
                        `Keys must be unique across a call.`,
                    );
                }
                seen.set(question.key, set.key);
            }
        }
    }

    private static render(sets: IScriptSet[], input: IScriptBuildInput): string {
        const lines: string[] = [CALL_PLAN_PREAMBLE, ""];

        sets.forEach((set, setIndex) => {
            lines.push(SET_HEADING(setIndex + 1, set.title), "");

            const intro = SECTION_INTRO[set.pattern];
            if (intro) lines.push(indent(3, INTRO_DELIVERED_BY_TOOL), indent(3, toSpokenText(intro)), "");

            set.questions.forEach((question, questionIndex) => {
                lines.push(...this.renderQuestion(question, set.pattern, `${setIndex + 1}.${questionIndex + 1}`));
            });
        });

        for (const block of input.closing ?? []) lines.push(block, "");

        return lines.join("\n").trimEnd();
    }

    private static renderQuestion(question: IScriptQuestion, pattern: DefaultScriptPattern, label: string): string[] {
        return [
            indent(3, QUESTION_HEADING(label, question.title, question.key)),
            ...(VERBATIM_PATTERNS.includes(pattern) ? [indent(6, SAY_VERBATIM)] : []),
            // Only the spoken line: the direction lines below are never said aloud.
            indent(6, toSpokenText(question.question)),
            ...this.brief(question).map((line) => indent(6, line)),
            "",
        ];
    }
}
