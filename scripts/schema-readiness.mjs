import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const results = [];

function loadEnvFile(filename) {
  const filePath = path.join(projectRoot, filename);

  if (!fs.existsSync(filePath)) {
    return false;
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

  return true;
}

function addResult(status, title, detail, nextStep) {
  results.push({ status, title, detail, nextStep });
}

function readEnvValue(name) {
  return process.env[name]?.trim() || "";
}

function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const configPath = path.join(projectRoot, "supabase", "config.toml");
  addResult(
    fs.existsSync(configPath) ? "pass" : "blocker",
    "supabase/config.toml",
    fs.existsSync(configPath)
      ? "Tracked Supabase CLI project config is present."
      : "Supabase CLI project config is missing.",
    fs.existsSync(configPath) ? undefined : "Add supabase/config.toml before trying to push migrations.",
  );

  const migrationDir = path.join(projectRoot, "supabase", "migrations");
  const migrationFiles = fs.existsSync(migrationDir)
    ? fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql"))
    : [];
  addResult(
    migrationFiles.length > 0 ? "pass" : "blocker",
    "supabase/migrations",
    migrationFiles.length > 0
      ? `${migrationFiles.length} tracked SQL migration file(s) found.`
      : "No tracked SQL migrations were found.",
    migrationFiles.length > 0 ? undefined : "Create at least one migration before trying to push schema changes.",
  );

  const schemaSnapshotPath = path.join(projectRoot, "supabase", "schema.sql");
  addResult(
    fs.existsSync(schemaSnapshotPath) ? "pass" : "warn",
    "supabase/schema.sql",
    fs.existsSync(schemaSnapshotPath)
      ? "Readable schema snapshot is present for code review and repo search."
      : "Schema snapshot is missing. Migrations still work, but reviewing full schema shape becomes harder.",
    fs.existsSync(schemaSnapshotPath) ? undefined : "Add or restore supabase/schema.sql after the next schema change.",
  );

  const localCliPath = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
  addResult(
    fs.existsSync(localCliPath) ? "pass" : "blocker",
    "Local Supabase CLI",
    fs.existsSync(localCliPath)
      ? "Local Supabase CLI binary is installed through node_modules."
      : "Local Supabase CLI binary is missing.",
    fs.existsSync(localCliPath) ? undefined : "Run `npm install` so the Supabase CLI is available to package scripts.",
  );

  const baselineContainsOffersFix = migrationFiles.some((fileName) => {
    const contents = fs.readFileSync(path.join(migrationDir, fileName), "utf8");
    return contents.includes("offers_status_check") && contents.includes("'countered'");
  });
  addResult(
    baselineContainsOffersFix ? "pass" : "blocker",
    "offers_status_check migration coverage",
    baselineContainsOffersFix
      ? "At least one tracked migration refreshes the offers status constraint with countered support."
      : "No tracked migration covers the offers_status_check refresh yet.",
    baselineContainsOffersFix ? undefined : "Add the offers_status_check refresh to a tracked migration before pushing schema changes.",
  );

  const dbUrlConfigured = Boolean(readEnvValue("SUPABASE_DB_URL"));
  const linkedProjectRefPath = path.join(projectRoot, "supabase", ".temp", "project-ref");
  const linkedProjectConfigured = fs.existsSync(linkedProjectRefPath);
  addResult(
    dbUrlConfigured || linkedProjectConfigured ? "pass" : "warn",
    "Remote schema target",
    dbUrlConfigured
      ? "SUPABASE_DB_URL is configured, so non-interactive remote pushes are ready."
      : linkedProjectConfigured
        ? "A linked Supabase project was found, so linked remote pushes are ready."
        : "No linked project or SUPABASE_DB_URL was found yet.",
    dbUrlConfigured || linkedProjectConfigured
      ? undefined
      : "Add SUPABASE_DB_URL to .env.local for non-interactive pushes, or run `npm run db:link -- --project-ref YOUR_PROJECT_REF` once.",
  );

  console.log("BuyerBoard schema workflow readiness");
  console.log("");

  for (const result of results) {
    const prefix = result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "BLOCKER";
    console.log(`[${prefix}] ${result.title}`);
    console.log(`  ${result.detail}`);
    if (result.nextStep) {
      console.log(`  Next: ${result.nextStep}`);
    }
  }

  const blockerCount = results.filter((result) => result.status === "blocker").length;
  const warningCount = results.filter((result) => result.status === "warn").length;

  console.log("");
  console.log(`Summary: ${blockerCount} blocker(s), ${warningCount} warning(s).`);

  if (blockerCount > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error("BuyerBoard schema readiness check failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
