import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const baseUrl = (process.env.BUYERBOARD_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
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

function hasSupabaseBrowserKey() {
  return Boolean(readEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || readEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

async function checkAppRoute(pathname, options) {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, options);
    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { ok: true, status: response.status, json, text };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const hasEnvLocal = loadEnvFile(".env.local");
  loadEnvFile(".env");

  addResult(
    hasEnvLocal ? "pass" : "warn",
    hasEnvLocal ? ".env.local detected" : ".env.local missing",
    hasEnvLocal ? "Local environment overrides are available for browser QA." : "Local browser QA will be harder until .env.local is created.",
    hasEnvLocal ? undefined : "Copy .env.example to .env.local and fill in the local project values you need.",
  );

  const requiredForBrowserQa = [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      ready: Boolean(readEnvValue("NEXT_PUBLIC_SUPABASE_URL")),
      nextStep: "Add NEXT_PUBLIC_SUPABASE_URL to .env.local.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ready: hasSupabaseBrowserKey(),
      nextStep: "Add a browser-safe Supabase key to .env.local.",
    },
    {
      key: "BUYERBOARD_APP_URL",
      ready: true,
      detail: readEnvValue("BUYERBOARD_APP_URL")
        ? "Configured."
        : "Missing from the local environment, but BuyerBoard will fall back to http://localhost:3000 for local auth links and seed magic links.",
      status: readEnvValue("BUYERBOARD_APP_URL") ? "pass" : "warn",
      nextStep: readEnvValue("BUYERBOARD_APP_URL")
        ? undefined
        : "Add BUYERBOARD_APP_URL to .env.local if your local app uses a non-default URL.",
    },
  ];

  for (const check of requiredForBrowserQa) {
    addResult(
      check.status ?? (check.ready ? "pass" : "blocker"),
      check.key,
      check.detail ?? (check.ready ? "Configured." : "Missing from the local environment."),
      (check.status ?? (check.ready ? "pass" : "blocker")) === "pass" ? undefined : check.nextStep,
    );
  }

  addResult(
    readEnvValue("SUPABASE_SERVICE_ROLE_KEY") ? "pass" : "warn",
    "SUPABASE_SERVICE_ROLE_KEY",
    readEnvValue("SUPABASE_SERVICE_ROLE_KEY")
      ? "Seed apply mode is available."
      : "Seed preview works, but npm run seed:dev cannot create users, print fresh magic links, or populate other-user requests for seller testing yet.",
    readEnvValue("SUPABASE_SERVICE_ROLE_KEY")
      ? undefined
      : "Add SUPABASE_SERVICE_ROLE_KEY to .env.local before running npm run seed:dev.",
  );

  const localCaptchaBypassEnabled = readEnvValue("BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS") === "true";
  const localAppUrl = readEnvValue("BUYERBOARD_APP_URL") || "http://localhost:3000";
  const localBypassReady =
    localCaptchaBypassEnabled &&
    Boolean(readEnvValue("SUPABASE_SERVICE_ROLE_KEY")) &&
    /localhost|127\.0\.0\.1/i.test(localAppUrl);
  const localBypassStatus = localBypassReady ? "pass" : localCaptchaBypassEnabled ? "warn" : "pass";

  addResult(
    localBypassStatus,
    "Local CAPTCHA bypass",
    localBypassReady
      ? "Local localhost sign-in can bypass CAPTCHA for seeded/dev accounts."
      : localCaptchaBypassEnabled
        ? "The bypass flag is on, but it still needs localhost BUYERBOARD_APP_URL plus SUPABASE_SERVICE_ROLE_KEY."
        : "Local CAPTCHA bypass is off. Normal CAPTCHA-protected sign-in remains active.",
    localBypassReady
      ? undefined
      : localCaptchaBypassEnabled
        ? "Point BUYERBOARD_APP_URL at localhost and add SUPABASE_SERVICE_ROLE_KEY if you want the local bypass to work."
        : undefined,
  );

  addResult(
    readEnvValue("BUYERBOARD_INTERNAL_CRON_SECRET") ? "pass" : "warn",
    "BUYERBOARD_INTERNAL_CRON_SECRET",
    readEnvValue("BUYERBOARD_INTERNAL_CRON_SECRET")
      ? "Internal digest and stale-request jobs can be exercised locally."
      : "Internal digest and stale-request routes will return a clear configuration error until this secret is set.",
    readEnvValue("BUYERBOARD_INTERNAL_CRON_SECRET")
      ? undefined
      : "Add BUYERBOARD_INTERNAL_CRON_SECRET to .env.local before testing internal job routes.",
  );

  const schemaText = fs.readFileSync(path.join(projectRoot, "supabase", "schema.sql"), "utf8");
  const schemaMarkers = [
    "last_active_confirmation_at timestamptz",
    "stale_confirmation_requested_at timestamptz",
    "stale_confirmation_miss_count integer not null default 0",
    "requests_stale_confirmation_idx",
  ];
  const hasAllSchemaMarkers = schemaMarkers.every((marker) => schemaText.includes(marker));
  addResult(
    hasAllSchemaMarkers ? "pass" : "blocker",
    "Stale-request schema markers",
    hasAllSchemaMarkers
      ? "The checked-in schema includes the stale-request columns and index."
      : "The checked-in schema is missing at least one stale-request marker.",
    hasAllSchemaMarkers ? undefined : "Re-check supabase/schema.sql before running the stale-request workflow.",
  );

  const requestRoute = await checkAppRoute("/api/requests");
  if (!requestRoute.ok) {
    addResult(
      "warn",
      "Local app availability",
      `Could not reach ${baseUrl}.`,
      `Start the app with npm run dev before running browser QA or smoke scripts. Details: ${requestRoute.error}`,
    );
  } else {
    addResult(
      requestRoute.status === 200 ? "pass" : "warn",
      "Local app availability",
      `GET ${baseUrl}/api/requests returned ${requestRoute.status}.`,
      requestRoute.status === 200 ? undefined : "Check the running app before starting QA.",
    );

    const internalRoutes = [
      "/api/internal/digests/run",
      "/api/internal/requests/stale/run",
    ];

    for (const route of internalRoutes) {
      const response = await checkAppRoute(route, { method: "POST" });

      if (!response.ok) {
        addResult("warn", route, "The local app did not answer the internal job route check.", response.error);
        continue;
      }

      if (response.status === 401) {
        addResult("pass", route, "Route is live and rejecting unauthenticated cron calls as expected.");
        continue;
      }

      if (response.status === 500 && response.json?.error) {
        addResult("warn", route, response.json.error, "Set BUYERBOARD_INTERNAL_CRON_SECRET in .env.local, then rerun this readiness check.");
        continue;
      }

      addResult(
        "warn",
        route,
        `Route returned ${response.status}.`,
        "Re-check the local app logs if this route was expected to return 401 or a clear configuration error.",
      );
    }
  }

  console.log("BuyerBoard local QA readiness");
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

main().catch((error) => {
  console.error("BuyerBoard QA readiness check failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
