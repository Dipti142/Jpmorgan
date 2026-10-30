import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

interface Asset {
    label: string;
    from: string;
    to: string;
    skip?: (source: string) => boolean;
}

const skipFolders = (...names: string[]) => (source: string) =>
    !names.includes(path.basename(source));

const assets: Asset[] = [
    {
        label: "email templates",
        from: path.join(rootDir, "src", "email", "templates"),
        to: path.join(distDir, "email", "templates"),
    },
    {
        label: "knowledge base",
        from: path.join(rootDir, "knowledge"),
        to: path.join(distDir, "knowledge"),
    },
    {
        label: "web app build",
        from: path.join(rootDir, "public", ".next"),
        to: path.join(distDir, "public", ".next"),
        skip: skipFolders("cache"),
    },
    {
        label: "web app package.json",
        from: path.join(rootDir, "public", "package.json"),
        to: path.join(distDir, "public", "package.json"),
    },
    {
        label: "web app next.config.mjs",
        from: path.join(rootDir, "public", "next.config.mjs"),
        to: path.join(distDir, "public", "next.config.mjs"),
    },
];

const copyAsset = (asset: Asset): boolean => {
    if (!fs.existsSync(asset.from)) {
        console.error(`Missing ${asset.label}: ${asset.from}`);
        return false;
    }

    fs.mkdirSync(path.dirname(asset.to), { recursive: true });
    fs.cpSync(asset.from, asset.to, { recursive: true, filter: asset.skip });
    console.log(`Copied ${asset.label}`);
    return true;
};

if (!fs.existsSync(distDir)) {
    console.error("dist/ does not exist - run tsc first (npm run build does both)");
    process.exit(1);
}

const results = assets.map(copyAsset);

if (results.includes(false)) {
    process.exit(1);
}

console.log("All assets copied into dist/");
