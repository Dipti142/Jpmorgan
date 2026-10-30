import "reflect-metadata";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Env } from "../config/env.config";
import {
    confirmKnowledgeUpload,
    createKnowledgeGroup,
    deleteKnowledgeDocument,
    getKnowledgeDocument,
    listKnowledgeDocuments,
    presignKnowledgeUpload,
    putKnowledgeFile,
} from "../services/anam.service";

const GROUP_NAME = "Interpreter Candidate FAQs";
const GROUP_DESCRIPTION =
    "Frequently asked questions by interpreter candidates, with the approved candidate-facing response for each.";

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 25 * 60 * 1000;

const root = path.isAbsolute(Env.anam.knowledge_dir)
    ? Env.anam.knowledge_dir
    : path.join(process.cwd(), Env.anam.knowledge_dir);

const manifestPath = path.join(root, ".synced.json");

interface IManifest {
    groupId: string;
    documents: Record<string, { documentId: string; hash: string; syncedTs: string }>;
}

const readManifest = async (): Promise<IManifest> => {
    try {
        return JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch {
        return { groupId: "", documents: {} };
    }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A document is not searchable until READY, so an upload is not done until it is. */
const waitUntilReady = async (documentId: string, filename: string): Promise<void> => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const { status } = await getKnowledgeDocument(documentId);
        if (status === "READY") return;
        if (status === "FAILED") throw new Error(`Anam could not process ${filename}`);

        await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`${filename} was still not READY after 25 minutes`);
};

const main = async () => {
    if (!Env.anam.anam_api_key) throw new Error("ANAM_API_KEY is not set");

    const held = await readManifest();

    let groupId = Env.anam.knowledge_group_id || held.groupId;
    if (!groupId) {
        const group = await createKnowledgeGroup(GROUP_NAME, GROUP_DESCRIPTION);
        groupId = group.id;
        console.log(`\nCreated knowledge folder "${GROUP_NAME}"\n`);
        console.log(`  Put this in your .env:  ANAM_KNOWLEDGE_GROUP_ID=${groupId}\n`);
    } else {
        console.log(`\nKnowledge folder ${groupId}\n`);
    }

    // The ids belong to one folder, so pointing at another one starts over rather
    // than trying to supersede documents that were never in it.
    const manifest = held.groupId === groupId ? held : { groupId, documents: {} };
    if (held.groupId && held.groupId !== groupId) {
        console.log(`  (manifest was for ${held.groupId} - uploading everything fresh)\n`);
    }

    const files = (await fs.readdir(root))
        .filter((name) => name.toLowerCase().endsWith(".md") && name.toLowerCase() !== "readme.md")
        .sort();

    if (!files.length) throw new Error(`No markdown files in ${root}`);

    const synced: IManifest = { groupId, documents: {} };

    for (const filename of files) {
        const body = await fs.readFile(path.join(root, filename));
        const hash = crypto.createHash("sha256").update(body).digest("hex");
        const current = manifest.documents[filename];

        if (current && current.hash === hash) {
            console.log(`  = ${filename} unchanged`);
            synced.documents[filename] = current;
            continue;
        }

        const { uploadUrl, documentId } = await presignKnowledgeUpload(groupId, {
            filename,
            contentType: "text/markdown",
            fileSize: body.length,
        });

        await putKnowledgeFile(uploadUrl, body, "text/markdown");
        await confirmKnowledgeUpload(documentId, body.length);

        process.stdout.write(`  ${current ? "~" : "+"} ${filename} processing`);
        await waitUntilReady(documentId, filename);
        console.log(` - READY (${documentId})`);

        // Replaced only now: Anam's update endpoint renames a document, it does not
        // replace its content, and the old one must outlive a failed upload.
        if (current) {
            await deleteKnowledgeDocument(current.documentId).catch((error) =>
                console.log(`    (could not delete superseded ${current.documentId}: ${error.message})`),
            );
        }

        synced.documents[filename] = { documentId, hash, syncedTs: new Date().toISOString() };
    }

    // Reconciled against the folder itself, not the manifest: a run with no manifest
    // uploads everything again, and anything it left behind is invisible to a manifest
    // that never knew about it. Duplicates of a file are the same document twice, which
    // costs the search a result slot each time.
    const keep = new Set(Object.values(synced.documents).map((entry) => entry.documentId));

    for (const document of await listKnowledgeDocuments(groupId)) {
        if (keep.has(document.id)) continue;

        await deleteKnowledgeDocument(document.id).catch((error) =>
            console.log(`    (could not delete ${document.id}: ${error.message})`),
        );
        console.log(`  - ${document.filename ?? document.id} removed (not in ${Env.anam.knowledge_dir}/)`);
    }

    await fs.writeFile(manifestPath, `${JSON.stringify(synced, null, 4)}\n`, "utf8");

    console.log(`\nDone. ${Object.keys(synced.documents).length} documents in the folder.`);
    if (!Env.anam.knowledge_group_id) {
        console.log("Set ANAM_KNOWLEDGE_GROUP_ID, then run npm run provision:anam:reset:dev.");
    }
};

void main().catch((error) => {
    console.error("\nKnowledge sync failed:", error instanceof Error ? error.message : error);
    process.exit(1);
});
