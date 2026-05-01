import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, snippet, message) {
  assert(text.includes(snippet), message);
}

function main() {
  const dashboardActions = readProjectFile("app/dashboard/actions.ts");
  assertIncludes(
    dashboardActions,
    "Read-after-write keeps profile persistence honest.",
    "Profile save flow should verify that the data really persisted.",
  );
  assertIncludes(
    dashboardActions,
    'redirect("/dashboard?error=Your profile changes did not stick. Please try again.");',
    "Profile save flow should fail loudly when the saved row does not round-trip correctly.",
  );

  const turnstileConfig = readProjectFile("lib/turnstile/config.ts");
  assertIncludes(turnstileConfig, "BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS", "Turnstile config should check the explicit local bypass flag.");
  assertIncludes(turnstileConfig, 'nodeEnv !== "production"', "Local captcha bypass must stay disabled in production mode.");
  assertIncludes(turnstileConfig, "isLocalHostValue(host)", "Local captcha bypass must stay limited to localhost-style hosts.");
  assertIncludes(turnstileConfig, "serviceRoleReady", "Local captcha bypass should require the service role key to be present.");

  const authActions = readProjectFile("app/auth/actions.ts");
  assertIncludes(authActions, "adminClient.auth.admin.generateLink", "Local captcha bypass should generate a local magic link instead of weakening production auth.");
  assertIncludes(authActions, "data.properties?.hashed_token", "Local captcha bypass should use Supabase's hashed token for app-domain session verification.");
  assertIncludes(authActions, 'callbackUrl.searchParams.set("token_hash", tokenHash);', "Local captcha bypass should send magic links through the app callback.");
  assertIncludes(authActions, "Local CAPTCHA bypass needs SUPABASE_SERVICE_ROLE_KEY in .env.local.", "Auth action should explain the missing local bypass prerequisite clearly.");

  const authCallback = readProjectFile("app/auth/callback/route.ts");
  assertIncludes(authCallback, "exchangeCodeForSession(code)", "Auth callback should keep supporting normal code-exchange sign-in links.");
  assertIncludes(authCallback, "verifyOtp({", "Auth callback should support token-hash magic links generated for seeded users.");
  assertIncludes(authCallback, "token_hash: tokenHash!", "Auth callback should verify Supabase token hashes on the app domain.");

  const community = readProjectFile("lib/community.ts");
  assertIncludes(community, 'if (input.actorRole === "admin") {', "Messaging rules should still give admins a special outreach path.");
  assertIncludes(community, 'throw new Error("Start new conversations from a request or completed order on BuyerBoard.");', "Regular-user messaging should stay tied to marketplace context.");

  const notificationBell = readProjectFile("app/components/notification-bell-client.tsx");
  assertIncludes(notificationBell, "setOpen(nextOpenState);", "Notification bell should open an in-place tray instead of navigating away.");
  assertIncludes(notificationBell, "Stay on the current page while you read and clear updates.", "Notification tray copy should reinforce in-place behavior.");
  assert(!notificationBell.includes('href="/notifications"'), "Notification bell tray should not be wired as a redirect-first notifications page.");

  const requestsPage = readProjectFile("app/requests/page.tsx");
  assertIncludes(requestsPage, "node scripts/dev-seed.mjs", "Requests page should help local testers understand the seed preview vs apply path.");

  const seedPreviewOutput = execFileSync(process.execPath, ["scripts/dev-seed.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  assertIncludes(seedPreviewOutput, "DRY RUN ONLY: no seed users, requests, notifications, or reports were written.", "Seed preview should say clearly that nothing was written.");
  assertIncludes(seedPreviewOutput, "seller opportunity feed shows them immediately", "Seed preview should explain that the seeded requests are fresh enough for seller testing.");

  const devSeed = readProjectFile("scripts/dev-seed.mjs");
  assertIncludes(devSeed, "data.properties?.hashed_token", "Dev seed magic links should use token hashes instead of Supabase-hosted action links.");
  assertIncludes(devSeed, 'appMagicLink.searchParams.set("token_hash", tokenHash);', "Dev seed magic links should point at BuyerBoard's callback.");
  assert(!devSeed.includes("data.properties.action_link"), "Dev seed should not print Supabase action links for SSR sign-in.");

  console.log("BuyerBoard regression audit checks passed.");
}

try {
  main();
} catch (error) {
  console.error("BuyerBoard regression audit checks failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
