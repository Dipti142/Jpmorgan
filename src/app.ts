import fs from "node:fs";
import path from "node:path";
import express, { Request, Response } from "express";
import helmet from "helmet";
import nextServer from "next";
import { Env } from "./config/env.config";
import { customResponseHandler, notFound, routeErrors } from "./handler/errorHandlers";
import { customCors, securityMiddleware } from "./middlewares/securityMiddleware";
import { healthCheck } from "./middlewares/healthCheck";
import { setupSwagger } from "./swagger/swagger";
import { routes } from "./routes";

export const app = express();

const bundledWebDir = path.join(__dirname, "public");
const hasBundledWeb = fs.existsSync(bundledWebDir);

export const webApp = nextServer({
	dev: !Env.is_production && !hasBundledWeb,
	dir: hasBundledWeb ? bundledWebDir : path.join(__dirname, "..", "public"),
});

app.use(securityMiddleware);
app.use(customCors);
app.use(
	helmet({
		frameguard: { action: "deny" },
		contentSecurityPolicy: {
			useDefaults: true,
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: Env.is_production
					? ["'self'", "'unsafe-inline'"]
					: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
				styleSrc: [
					"'self'",
					"'unsafe-inline'",
					"https://fonts.googleapis.com",
					"https://site-assets.fontawesome.com",
				],
				fontSrc: [
					"'self'",
					"data:",
					"https://fonts.gstatic.com",
					"https://site-assets.fontawesome.com",
				],
				imgSrc: ["'self'", "data:", "blob:"],
				mediaSrc: ["'self'", "blob:"],
				connectSrc: ["'self'", "https:", "wss:"],
				workerSrc: ["'self'", "blob:"],
				frameAncestors: ["'none'"],
				objectSrc: ["'none'"],
			},
		},
	})
);


// Body parsers. The size limit matters: without it a single request can
// buffer unbounded JSON into memory before any handler runs.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(customResponseHandler);
app.set("trust proxy", true);

// Everything is mounted in src/routes/index.ts, so adding a persona kind does
// not touch this file.
app.use("/v1", routes, notFound);

if (Env.node_environment != "production") {
	setupSwagger(app);
}


app.get("/healthz", (req: Request, res: Response) => {
	res.successResponse({ message: "Ok" });
});
app.get("/readyz", healthCheck);

const webHandler = webApp.getRequestHandler();
app.use((req: Request, res: Response) => void webHandler(req, res));

/*----------------------------
/ [ EXPANSION ERROR HEELING ]
/-----------------------------*/
app.use(routeErrors);
