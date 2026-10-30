import "reflect-metadata";
import fs from "node:fs/promises";
import path from "node:path";
import { Env } from "../config/env.config";
import { searchKnowledgeGroup } from "../services/anam.service";

const headingsFromFiles = async (): Promise<string[]> => {
    const root = path.isAbsolute(Env.anam.knowledge_dir)
        ? Env.anam.knowledge_dir
        : path.join(process.cwd(), Env.anam.knowledge_dir);

    const files = (await fs.readdir(root)).filter(
        (name) => name.toLowerCase().endsWith(".md") && name.toLowerCase() !== "readme.md",
    );

    const headings: string[] = [];
    for (const name of files.sort()) {
        const markdown = await fs.readFile(path.join(root, name), "utf8");
        for (const line of markdown.split(/\r?\n/)) {
            if (!/^##\s+/.test(line)) continue;
            const heading = line.replace(/^##\s+/, "").trim();
            if (heading !== "What this covers") headings.push(heading);
        }
    }

    return headings;
};

const main = async () => {
    const groupId = Env.anam.knowledge_group_id;
    if (!groupId) throw new Error("ANAM_KNOWLEDGE_GROUP_ID is not set - run sync:knowledge:dev first");

    // npm splits a quoted argument on spaces, so the words are rejoined and a pipe
    // is what separates one phrasing from the next.
    const asked = process.argv
        .slice(2)
        .filter((argument) => !argument.startsWith("--"))
        .join(" ")
        .split("|")
        .map((query) => query.trim())
        .filter(Boolean);

    const queries = asked.length ? asked : await headingsFromFiles();

    let answered = 0;

    for (const query of queries) {
        console.log(`\n"${query}"`);

        const passages = await searchKnowledgeGroup(groupId, query, 3).catch((error) => {
            console.log(`  FAILED ${error.response?.status ?? ""} ${error.message}`);
            return null;
        });

        if (!passages) continue;
        if (!passages.length) {
            console.log("  NOTHING FOUND");
            continue;
        }

        answered += 1;
        for (const passage of passages) {
            console.log(`  ${passage.score?.toFixed(3) ?? "-"}  ${passage.filename ?? passage.documentId}`);
            console.log(`        ${passage.content.replace(/\s+/g, " ").trim().slice(0, 200)}`);
        }
    }

    console.log(`\n${answered}/${queries.length} queries returned something.`);
};

void main().catch((error) => {
    console.error("\nProbe failed:", error instanceof Error ? error.message : error);
    process.exit(1);
});
