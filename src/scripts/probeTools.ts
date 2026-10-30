import "reflect-metadata";
import { Env } from "../config/env.config";
import { getTool } from "../services/anam.service";
import { renderToolDefinition } from "../services/anamTool.service";
import { toolBlueprintsByCompanyKey } from "../services/programRegistry.service";
import connection from "../models";
import AnamTool from "../models/anamTool.model";
import Company from "../models/company.model";

/**
 * Reads every provisioned tool back from Anam and prints what it stored against
 * what we sent.
 *
 * Every tool webhook arriving with an empty body points at one of two things:
 * the model is not filling the arguments, or Anam never stored the parameter
 * schema and the model has nothing to fill. Only Anam can say which, so this
 * asks it rather than reasoning about the docs.
 *
 *   npm run probe:tools:dev
 */

const paramsOf = (definition: Record<string, unknown>): Record<string, unknown> | null => {
    // Anam has moved this between top level and config before, so look in both.
    const config = (definition.config ?? {}) as Record<string, unknown>;
    return (definition.parameters ?? config.parameters ?? null) as Record<string, unknown> | null;
};

const describe = (params: Record<string, unknown> | null): string => {
    if (!params) return "MISSING";
    const properties = (params.properties ?? {}) as Record<string, unknown>;
    const names = Object.keys(properties).sort();
    if (!names.length) return "EMPTY (no properties)";
    return `${names.join(", ")}  required=[${[...((params.required as string[]) ?? [])].sort().join(", ")}]`;
};

// Anam returns properties in its own order, so a plain stringify compares unequal
// on schemas that match.
const stable = (value: unknown): string =>
    JSON.stringify(value, (_key, inner) =>
        inner && typeof inner === "object" && !Array.isArray(inner)
            ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
            : inner,
    );

const main = async () => {
    for (const [companyKey, blueprints] of toolBlueprintsByCompanyKey()) {
        const company = await Company.findOne({ where: { company_key: companyKey, is_active: 1 } });
        if (!company) {
            console.log(`\nSkipping "${companyKey}" - no active tl_company row`);
            continue;
        }

        console.log(`\n${company.company_name} (id ${company.company_id})`);
        const provisioned = await AnamTool.findAll({ where: { company_id: company.company_id } });
        const byKey = new Map(provisioned.map((tool) => [tool.tool_key, tool]));

        for (const blueprint of blueprints) {
            const record = byKey.get(blueprint.key);
            if (!record) {
                console.log(`  ? ${blueprint.key} not provisioned - run provision:anam:dev`);
                continue;
            }
            if (blueprint.kind === "system") {
                const remote = await getTool(record.remote_tool_id).catch(() => null);
                const live = String((remote as { type?: string } | null)?.type ?? "").toUpperCase() === "SYSTEM";
                console.log(`  ${live ? "=" : "x"} ${record.tool_key} (system ${record.remote_tool_id})`);
                continue;
            }
            if (blueprint.kind === "knowledge") {
                // Anam owns the query parameter here, so the folder ids are what can be wrong.
                const remote = await getTool(record.remote_tool_id).catch(() => null);
                const type = String((remote as { type?: string } | null)?.type ?? "").toUpperCase();
                const config = ((remote as { config?: Record<string, unknown> } | null)?.config ?? {});
                const folders = (config.documentFolderIds as string[] | undefined) ?? [];

                console.log(`  ${type === "SERVER_RAG" ? "=" : "x"} ${record.tool_name} (${type || "unreadable"})`);
                console.log(`      folders : ${folders.join(", ") || "NONE"}`);
                console.log(`      we send : ${Env.anam.knowledge_group_id || "NONE"}`);
                continue;
            }

            const sent = paramsOf(renderToolDefinition(blueprint, company) as unknown as Record<string, unknown>);

            try {
                const remote = await getTool(record.remote_tool_id);
                const stored = paramsOf(remote);
                const agrees = stable(sent) === stable(stored);

                console.log(`  ${agrees ? "=" : "!"} ${record.tool_name} (${record.remote_tool_id})`);
                console.log(`      we send : ${describe(sent)}`);
                console.log(`      anam has: ${describe(stored)}`);
                if (!agrees) console.log(`      raw     : ${JSON.stringify(remote).slice(0, 600)}`);
            } catch (error) {
                console.log(`  x ${record.tool_name} could not be read: ${error instanceof Error ? error.message : error}`);
            }
        }
    }

    console.log("\nDone.");
    await connection.close();
};

void main().catch(async (error) => {
    console.error("\nProbe failed:", error instanceof Error ? error.message : error);
    await connection.close().catch(() => undefined);
    process.exit(1);
});
