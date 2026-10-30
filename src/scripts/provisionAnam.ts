import "reflect-metadata";
import crypto from "node:crypto";
import axios from "axios";
import { createTool, deleteTool, findSystemToolId, updateTool } from "../services/anam.service";
import { renderToolDefinition, toolNameFor } from "../services/anamTool.service";
import { IToolBlueprint } from "../interfaces/IAnamTool.interface";
import { toolBlueprintsByCompanyKey } from "../services/programRegistry.service";
import connection from "../models";
import AnamTool from "../models/anamTool.model";
import Company from "../models/company.model";

const RESET = process.argv.includes("--reset");

const hashOf = (definition: unknown): string =>
    crypto.createHash("sha256").update(JSON.stringify(definition)).digest("hex");

const provisionCompany = async (company: Company, blueprints: IToolBlueprint[]) => {
    console.log(`\n${company.company_name} (id ${company.company_id}, prefix "${company.tool_prefix}")`);

    const existing = await AnamTool.findAll({ where: { company_id: company.company_id } });
    const byKey = new Map(existing.map((tool) => [tool.tool_key, tool]));

    for (const blueprint of blueprints) {if (blueprint.kind === "system") {
            const remoteToolId = await findSystemToolId(blueprint.key);
            if (!remoteToolId) {
                throw new Error(
                    `Anam lists no SYSTEM tool named "${blueprint.key}" - it cannot be created, so the name must be wrong`,
                );
            }

            const held = byKey.get(blueprint.key);
            if (held && held.remote_tool_id === remoteToolId && held.is_active) {
                console.log(`  = ${blueprint.key} unchanged (system)`);
                continue;
            }

            if (held) {
                held.set({ remote_tool_id: remoteToolId, tool_kind: "system", is_active: 1, provisioned_ts: new Date() });
                await held.save();
                console.log(`  ~ ${blueprint.key} relinked (system ${remoteToolId})`);
                continue;
            }

            await AnamTool.create({
                company_id: company.company_id,
                tool_key: blueprint.key,
                tool_name: blueprint.key,
                tool_kind: "system",
                remote_tool_id: remoteToolId,
                definition_hash: null,
                provisioned_ts: new Date(),
                is_active: 1,
            });
            console.log(`  + ${blueprint.key} linked (system ${remoteToolId})`);
            continue;
        }

        const definition = renderToolDefinition(blueprint, company);
        const name = toolNameFor(company, blueprint.key);
        const hash = hashOf(definition);
        const record = byKey.get(blueprint.key);

        if (record && RESET) {
            await deleteTool(record.remote_tool_id).catch((error) =>
                console.log(`    (could not delete ${record.remote_tool_id}: ${error.message})`),
            );
            await record.destroy();
            byKey.delete(blueprint.key);
        }

        const current = byKey.get(blueprint.key);

        if (current && current.definition_hash === hash) {
            console.log(`  = ${name} unchanged`);
            continue;
        }

        if (current) {
            await updateTool(current.remote_tool_id, definition);
            current.set({
                tool_name: name,
                tool_kind: blueprint.kind,
                definition_hash: hash,
                provisioned_ts: new Date(),
                is_active: 1,
            });
            await current.save();
            console.log(`  ~ ${name} updated (${current.remote_tool_id})`);
            continue;
        }

        const created = await createTool(definition);
        if (!created?.id) throw new Error(`Anam returned no id for ${name}`);

        await AnamTool.create({
            company_id: company.company_id,
            tool_key: blueprint.key,
            tool_name: name,
            tool_kind: blueprint.kind,
            remote_tool_id: created.id,
            definition_hash: hash,
            provisioned_ts: new Date(),
            is_active: 1,
        });
        console.log(`  + ${name} created (${created.id})`);
    }

    const authored = new Set(blueprints.map((blueprint) => blueprint.key));
    for (const [key, tool] of byKey) {
        if (!authored.has(key) && tool.is_active) {
            tool.set({ is_active: 0 });
            await tool.save();
            console.log(`  - ${tool.tool_name} retired (no longer authored)`);
        }
    }
};

const main = async () => {
    if (RESET) console.log("--reset: existing tools will be deleted and recreated.");

    await connection.authenticate();

    const byCompanyKey = toolBlueprintsByCompanyKey();
    if (!byCompanyKey.size) throw new Error("No programmes registered - nothing to provision");

    for (const [companyKey, blueprints] of byCompanyKey) {
        const company = await Company.findOne({ where: { company_key: companyKey, is_active: 1 } });
        if (!company) {
            console.log(`\nSkipping "${companyKey}" - no active tl_company row`);
            continue;
        }
        await provisionCompany(company, blueprints);
    }

    console.log("\nDone.");
    await connection.close();
};

void main().catch(async (error) => {
    console.error("\nProvisioning failed:", error instanceof Error ? error.message : error);
    if (axios.isAxiosError(error)) {
        console.error(`${error.config?.method?.toUpperCase()} ${error.config?.url}`);
        console.error("Anam said:", JSON.stringify(error.response?.data));
    }
    await connection.close().catch(() => undefined);
    process.exit(1);
});
