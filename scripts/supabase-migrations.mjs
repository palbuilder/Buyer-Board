import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();

function loadEnvFile(filename) {
  const filePath = path.join(projectRoot, filename);

  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function readEnvValue(name) {
  return process.env[name]?.trim() || "";
}

function getSupabaseCliPath() {
  const executable = process.platform === "win32" ? "supabase.cmd" : "supabase";
  return path.join(projectRoot, "node_modules", ".bin", executable);
}

function ensureProjectFilesExist() {
  const requiredPaths = [
    path.join(projectRoot, "supabase", "config.toml"),
    path.join(projectRoot, "supabase", "migrations"),
  ];

  for (const requiredPath of requiredPaths) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing required Supabase project path: ${path.relative(projectRoot, requiredPath)}`);
    }
  }
}

function resolveRemoteArgs() {
  const dbUrl = readEnvValue("SUPABASE_DB_URL");
  if (dbUrl) {
    return {
      args: ["--db-url", dbUrl],
      description: "SUPABASE_DB_URL",
    };
  }

  const linkedProjectRefPath = path.join(projectRoot, "supabase", ".temp", "project-ref");
  if (fs.existsSync(linkedProjectRefPath)) {
    return {
      args: ["--linked"],
      description: "linked project",
    };
  }

  throw new Error(
    "Remote Supabase target is not configured. Add SUPABASE_DB_URL to .env.local for non-interactive pushes, or run `npm run db:link -- --project-ref YOUR_PROJECT_REF` once.",
  );
}

function runSupabaseCli(args) {
  const cliPath = getSupabaseCliPath();
  if (!fs.existsSync(cliPath)) {
    throw new Error("Supabase CLI is not installed locally. Run `npm install` first.");
  }

  const result = spawnSync(cliPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  ensureProjectFilesExist();

  const [command, ...extraArgs] = process.argv.slice(2);

  if (!command || !["push", "list"].includes(command)) {
    throw new Error("Usage: node scripts/supabase-migrations.mjs <push|list> [extra args]");
  }

  const remote = resolveRemoteArgs();

  if (command === "push") {
    console.log(`BuyerBoard schema push target: ${remote.description}`);
    runSupabaseCli(["db", "push", ...remote.args, ...extraArgs]);
    return;
  }

  console.log(`BuyerBoard migration list target: ${remote.description}`);
  runSupabaseCli(["migration", "list", ...remote.args, ...extraArgs]);
}

try {
  main();
} catch (error) {
  console.error("BuyerBoard Supabase migration command failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
