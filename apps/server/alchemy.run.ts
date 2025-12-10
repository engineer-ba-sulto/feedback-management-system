import alchemy from "alchemy";
import { Worker } from "alchemy/cloudflare";
import { D1Database } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });

const app = await alchemy("feedback-management-system");

const db = await D1Database("database", {
	migrationsDir: "packages/db/src/migrations",
});

export const server = await Worker("server", {
	entrypoint: "src/index.ts",
	compatibility: "node",
	bindings: {
		DB: db,
		CORS_ORIGIN: process.env.CORS_ORIGIN || "",
		BETTER_AUTH_SECRET: alchemy.secret(process.env.BETTER_AUTH_SECRET),
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "",
	},
	dev: {
		port: 3000,
	},
});

console.log(`Server -> ${server.url}`);

await app.finalize();
