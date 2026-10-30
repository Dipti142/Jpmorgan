import { IToolBlueprint } from "../interfaces/IAnamTool.interface";
import interviewProgram from "../constants/interview/interview.script";
import { INTERVIEW_TOOL_BLUEPRINTS } from "../constants/interview/interview.tools";
import { IProgramManifest } from "../interfaces/IProgram.interface";

/**
 * Every programme this service knows how to run, and the tools each needs.
 *
 * Adding one - an orientation programme, a second company's interview - is one
 * import and one entry. Read only by the sync and provisioning scripts: at
 * runtime a session reads the database, never this file, so editing a script
 * without running the sync changes nothing and is easy to spot.
 */

export interface IRegisteredProgram {
    manifest: IProgramManifest;
    tools: IToolBlueprint[];
}

export const PROGRAMS: IRegisteredProgram[] = [
    { manifest: interviewProgram, tools: INTERVIEW_TOOL_BLUEPRINTS },
];

export const findProgram = (programKey: string, companyKey?: string): IRegisteredProgram | undefined =>
    PROGRAMS.find(
        (entry) =>
            entry.manifest.programKey === programKey &&
            (!companyKey || entry.manifest.companyKey === companyKey),
    );

/**
 * Tool blueprints per company, de-duplicated by key. Two programmes for the same
 * company that both want search_knowledge share one provisioned tool rather than
 * creating two that do the same thing.
 */
export const toolBlueprintsByCompanyKey = (): Map<string, IToolBlueprint[]> => {
    const byCompany = new Map<string, Map<string, IToolBlueprint>>();

    for (const entry of PROGRAMS) {
        const companyKey = entry.manifest.companyKey;
        if (!byCompany.has(companyKey)) byCompany.set(companyKey, new Map());
        const blueprints = byCompany.get(companyKey)!;
        for (const blueprint of entry.tools) blueprints.set(blueprint.key, blueprint);
    }

    const result = new Map<string, IToolBlueprint[]>();
    for (const [companyKey, blueprints] of byCompany) {
        result.set(companyKey, Array.from(blueprints.values()));
    }
    return result;
};
