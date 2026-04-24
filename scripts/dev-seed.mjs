import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const projectRoot = process.cwd();
const applyMode = process.argv.includes("--apply");
const seedBaseTime = Date.now();

function hoursAgoIso(hoursAgo) {
  return new Date(seedBaseTime - hoursAgo * 60 * 60 * 1000).toISOString();
}

const seedUsers = [
  {
    key: "buyerAlex",
    email: "alex.buyer.dev@buyerboard.local",
    displayName: "Alex Mercer",
    role: "buyer",
    publicLocation: "Pittsburgh, PA",
    shippingName: "Alex Mercer",
    shippingAddressLine1: "101 Steel City Way",
    shippingCity: "Pittsburgh",
    shippingState: "PA",
    shippingPostalCode: "15222",
    businessName: "",
    accountStatus: "active",
    phoneNumber: "+15555550101",
    phoneVerified: true,
  },
  {
    key: "buyerTaylor",
    email: "taylor.collector.dev@buyerboard.local",
    displayName: "Taylor Nguyen",
    role: "buyer",
    publicLocation: "Columbus, OH",
    shippingName: "Taylor Nguyen",
    shippingAddressLine1: "202 Discovery Ave",
    shippingCity: "Columbus",
    shippingState: "OH",
    shippingPostalCode: "43215",
    businessName: "",
    accountStatus: "active",
    phoneNumber: "+15555550102",
    phoneVerified: true,
  },
  {
    key: "sellerMorgan",
    email: "morgan.parts.dev@buyerboard.local",
    displayName: "Morgan Reed",
    role: "seller",
    publicLocation: "Cleveland, OH",
    shippingName: "Morgan Reed",
    shippingAddressLine1: "18 Salvage Row",
    shippingCity: "Cleveland",
    shippingState: "OH",
    shippingPostalCode: "44114",
    businessName: "Northside Parts",
    accountStatus: "active",
    phoneNumber: "+15555550103",
    phoneVerified: true,
  },
  {
    key: "sellerJamie",
    email: "jamie.tools.dev@buyerboard.local",
    displayName: "Jamie Cruz",
    role: "seller",
    publicLocation: "Indianapolis, IN",
    shippingName: "Jamie Cruz",
    shippingAddressLine1: "77 Tool Shed Ln",
    shippingCity: "Indianapolis",
    shippingState: "IN",
    shippingPostalCode: "46204",
    businessName: "",
    accountStatus: "active",
    phoneNumber: "+15555550104",
    phoneVerified: true,
  },
  {
    key: "adminRiley",
    email: "riley.admin.dev@buyerboard.local",
    displayName: "Riley Chen",
    role: "admin",
    publicLocation: "Chicago, IL",
    shippingName: "Riley Chen",
    shippingAddressLine1: "10 Review Desk",
    shippingCity: "Chicago",
    shippingState: "IL",
    shippingPostalCode: "60601",
    businessName: "",
    accountStatus: "active",
    phoneNumber: "+15555550105",
    phoneVerified: true,
  },
];

const seedRequests = [
  {
    key: "impactKit",
    slug: "dev-seed-milwaukee-m18-impact-kit",
    buyerKey: "buyerAlex",
    title: "Milwaukee M18 impact driver kit",
    category: "Tools",
    subcategory: "Power Tools",
    details: "Looking for a clean brushless kit with battery, charger, and case included. Light cosmetic wear is fine.",
    shippingPreference: "Ship only",
    locationLabel: "Pittsburgh, PA",
    targetPriceCents: 26000,
    status: "open",
    createdAt: hoursAgoIso(20),
  },
  {
    key: "outbackLight",
    slug: "dev-seed-2019-subaru-outback-headlight",
    buyerKey: "buyerTaylor",
    title: "2019 Subaru Outback passenger headlight",
    category: "Auto Parts",
    subcategory: "Lighting",
    details: "Need an OEM passenger-side headlight with tabs intact. No cracks or major haze. Please confirm fitment before sending an offer.",
    vehicleFitment: "2019 Subaru Outback",
    shippingPreference: "Any",
    locationLabel: "Columbus, OH",
    targetPriceCents: 18500,
    status: "negotiating",
    createdAt: hoursAgoIso(12),
  },
  {
    key: "routerKit",
    slug: "dev-seed-bosch-router-combo-kit",
    buyerKey: "buyerAlex",
    title: "Bosch 1617 router combo kit",
    category: "Tools",
    subcategory: "Woodworking",
    details: "Need the fixed base and plunge base together. Collets should be clean and the motor should not smell burnt.",
    shippingPreference: "Pickup only",
    locationLabel: "Pittsburgh, PA",
    targetPriceCents: 21000,
    status: "open",
    createdAt: hoursAgoIso(4),
  },
];

const seedOffers = [
  {
    requestKey: "impactKit",
    sellerKey: "sellerMorgan",
    priceCents: 27500,
    message: "Clean kit with two batteries, charger, and hard case. I can ship inside a 48 hour claim window.",
    claimWindowHours: 48,
    status: "pending",
    createdAt: hoursAgoIso(18),
  },
  {
    requestKey: "outbackLight",
    sellerKey: "sellerJamie",
    priceCents: 19500,
    message: "OEM light with all tabs intact. Lens is clean and I can get more photos before you accept.",
    claimWindowHours: 36,
    status: "countered",
    createdAt: hoursAgoIso(9),
  },
  {
    requestKey: "routerKit",
    sellerKey: "sellerMorgan",
    priceCents: 22500,
    message: "Router combo has both bases and a case. Happy to arrange a local handoff.",
    claimWindowHours: 24,
    status: "pending",
    createdAt: hoursAgoIso(3),
  },
];

const seedNotifications = [
  {
    userKey: "buyerAlex",
    title: "Dev seed: seller offer waiting",
    body: "Morgan Reed sent an offer on your Milwaukee request.",
    href: "/dashboard?tab=buyer",
    createdAt: hoursAgoIso(2),
    readAt: null,
  },
  {
    userKey: "sellerMorgan",
    title: "Dev seed: direct message ready",
    body: "Alex Mercer replied in your seeded direct thread.",
    href: "/messages",
    createdAt: hoursAgoIso(1.5),
    readAt: hoursAgoIso(1),
  },
];

const seedMessages = [
  {
    senderKey: "buyerAlex",
    body: "Thanks for the fast reply. Can you confirm the batteries are genuine Milwaukee packs?",
    moderationState: "clean",
    createdAt: hoursAgoIso(1.25),
  },
  {
    senderKey: "sellerMorgan",
    body: "Yes. They are genuine packs and I can send close-up photos of the labels in this thread.",
    moderationState: "clean",
    createdAt: hoursAgoIso(1.1),
  },
];

const seedReport = {
  reporterKey: "buyerTaylor",
  requestKey: "impactKit",
  reason: "unsafe_item",
  details: "Seeding one open unsafe-listing report so the admin queue always has a reviewable example.",
  createdAt: hoursAgoIso(0.75),
};

const userTestingGuide = [
  {
    userKey: "buyerAlex",
    flows: [
      "Owns the Milwaukee impact-driver request and the Bosch router request",
      "Has one normal direct thread with Morgan Reed",
      "Has an unread notification for notification bell and cleanup testing",
    ],
  },
  {
    userKey: "buyerTaylor",
    flows: [
      "Owns the Subaru Outback headlight request in negotiating status",
      "Owns the seeded unsafe-listing report that the admin queue should display",
      "Good buyer account for request confirmation and moderation follow-up testing",
    ],
  },
  {
    userKey: "sellerMorgan",
    flows: [
      "Owns offers on the Milwaukee request and the Bosch router request",
      "Participates in the seeded direct-message thread with Alex Mercer",
      "Uses a business-name seller profile for payout-onboarding testing",
    ],
  },
  {
    userKey: "sellerJamie",
    flows: [
      "Owns the seeded counteroffer on the Subaru headlight request",
      "Uses an individual seller profile with no business name",
      "Good seller account for direct-message and payout-onboarding testing",
    ],
  },
  {
    userKey: "adminRiley",
    flows: [
      "Admin account for the listing-report queue and trust/dispute shortcuts",
      "Should see the seeded unsafe-listing report in /admin/reports",
      "Use this account for moderation resolution-path testing",
    ],
  },
];

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

function buildRequestDescription(request) {
  return [
    `Subcategory: ${request.subcategory}`,
    request.vehicleFitment ? `Vehicle fitment: ${request.vehicleFitment}` : undefined,
    request.details,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function printPlan() {
  console.log("BuyerBoard dev seed plan");
  console.log("");
  console.log(`Users: ${seedUsers.length}`);
  for (const user of seedUsers) {
    console.log(`- ${user.displayName} (${user.role}) -> ${user.email}`);
  }

  console.log("");
  console.log(`Requests: ${seedRequests.length}`);
  for (const request of seedRequests) {
    console.log(`- ${request.slug} -> ${request.title}`);
  }

  console.log("");
  console.log(`Offers: ${seedOffers.length}`);
  console.log(`Notifications: ${seedNotifications.length}`);
  console.log("Direct threads: 1");
  console.log("Open admin listing reports: 1");
  console.log("");
  console.log("Seed timing");
  console.log("- Requests are stamped within the last 24 hours so the seller opportunity feed shows them immediately.");
  console.log("- The stale-request workflow should be tested with force=true or with specially aged data, not with the default fresh seed.");
  console.log("");
  console.log("Seeded user guide");
  for (const guide of userTestingGuide) {
    const user = seedUsers.find((entry) => entry.key === guide.userKey);
    console.log(`- ${user?.displayName} (${user?.role}) -> ${user?.email}`);
    for (const flow of guide.flows) {
      console.log(`  - ${flow}`);
    }
  }
  console.log("");
  console.log("Run with --apply once NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are available.");
}

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for the dev seed script. Add it to .env.local, then rerun npm run seed:dev.`);
  }

  return value;
}

async function listAllUsers(adminClient) {
  const allUsers = [];
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    allUsers.push(...users);

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  return allUsers;
}

async function ensureSeedUsers(supabase) {
  const existingUsers = await listAllUsers(supabase);
  const usersByEmail = new Map(existingUsers.map((user) => [user.email?.toLowerCase(), user]));
  const seedUserIds = new Map();

  for (const user of seedUsers) {
    const existingUser = usersByEmail.get(user.email.toLowerCase());

    if (existingUser) {
      seedUserIds.set(user.key, existingUser.id);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      user_metadata: {
        full_name: user.displayName,
      },
    });

    if (error || !data.user) {
      throw error ?? new Error(`Unable to create ${user.email}`);
    }

    seedUserIds.set(user.key, data.user.id);
  }

  return seedUserIds;
}

async function clearExistingSeedData(supabase, seedUserIds) {
  const userIds = [...seedUserIds.values()];
  const requestSlugs = seedRequests.map((request) => request.slug);

  const { data: existingRequests, error: existingRequestError } = await supabase
    .from("requests")
    .select("id")
    .in("slug", requestSlugs);

  if (existingRequestError) {
    throw existingRequestError;
  }

  const existingRequestIds = (existingRequests ?? []).map((request) => request.id);

  if (existingRequestIds.length > 0) {
    const { error: deleteRequestsError } = await supabase
      .from("requests")
      .delete()
      .in("id", existingRequestIds);

    if (deleteRequestsError) {
      throw deleteRequestsError;
    }
  }

  const { data: directThreads, error: directThreadError } = await supabase
    .from("direct_threads")
    .select("id")
    .in("member_a_id", userIds)
    .in("member_b_id", userIds);

  if (directThreadError) {
    throw directThreadError;
  }

  const directThreadIds = (directThreads ?? []).map((thread) => thread.id);

  if (directThreadIds.length > 0) {
    const { error: deleteThreadsError } = await supabase
      .from("direct_threads")
      .delete()
      .in("id", directThreadIds);

    if (deleteThreadsError) {
      throw deleteThreadsError;
    }
  }

  if (userIds.length > 0) {
    const { error: deleteNotificationsError } = await supabase
      .from("notifications")
      .delete()
      .in("profile_id", userIds);

    if (deleteNotificationsError) {
      throw deleteNotificationsError;
    }
  }
}

async function seedProfiles(supabase, seedUserIds) {
  const profileRows = seedUsers.map((user) => ({
    id: seedUserIds.get(user.key),
    role: user.role,
    email: user.email,
    display_name: user.displayName,
    public_location_label: user.publicLocation,
    preferred_shipping_name: user.shippingName,
    preferred_shipping_address_line1: user.shippingAddressLine1,
    preferred_shipping_city: user.shippingCity,
    preferred_shipping_state: user.shippingState,
    preferred_shipping_postal_code: user.shippingPostalCode,
    business_name: user.businessName || null,
    phone_number: user.phoneNumber,
    phone_verified_at: user.phoneVerified ? "2026-04-01T12:00:00.000Z" : null,
    account_type: user.businessName ? "business" : "individual",
    plan_tier: user.businessName ? "business" : "free",
    account_status: user.accountStatus,
  }));

  const { error } = await supabase.from("profiles").upsert(profileRows);

  if (error) {
    throw error;
  }
}

async function seedRequestsAndOffers(supabase, seedUserIds) {
  const requestRows = seedRequests.map((request) => ({
    buyer_id: seedUserIds.get(request.buyerKey),
    slug: request.slug,
    title: request.title,
    category: request.category,
    description: buildRequestDescription(request),
    image_urls: [],
    condition_preference: "Any",
    shipping_preference: request.shippingPreference,
    location_label: request.locationLabel,
    target_price_cents: request.targetPriceCents,
    status: request.status,
    created_at: request.createdAt,
    updated_at: request.createdAt,
  }));

  const { data: insertedRequests, error: requestError } = await supabase
    .from("requests")
    .insert(requestRows)
    .select("id, slug");

  if (requestError) {
    throw requestError;
  }

  const requestIdsBySlug = new Map((insertedRequests ?? []).map((request) => [request.slug, request.id]));

  const offerRows = seedOffers.map((offer) => {
    const seller = seedUsers.find((user) => user.key === offer.sellerKey);

    return {
      request_id: requestIdsBySlug.get(seedRequests.find((request) => request.key === offer.requestKey).slug),
      seller_id: seedUserIds.get(offer.sellerKey),
      image_urls: [],
      offer_price_cents: offer.priceCents,
      message: offer.message,
      shipping_note: `Claim window: ${offer.claimWindowHours} hours`,
      estimated_ship_time: `Seller: ${seller?.businessName || seller?.displayName || "BuyerBoard Seller"}`,
      status: offer.status,
      created_at: offer.createdAt,
    };
  });

  const { data: insertedOffers, error: offerError } = await supabase
    .from("offers")
    .insert(offerRows)
    .select("id, request_id");

  if (offerError) {
    throw offerError;
  }

  return {
    requestIdsBySlug,
    insertedOffers,
  };
}

async function seedDirectMessages(supabase, seedUserIds) {
  const { data: thread, error: threadError } = await supabase
    .from("direct_threads")
    .insert({
      member_a_id: seedUserIds.get("buyerAlex"),
      member_b_id: seedUserIds.get("sellerMorgan"),
      created_at: "2026-04-05T09:00:00.000Z",
      updated_at: "2026-04-05T09:16:00.000Z",
    })
    .select("id")
    .single();

  if (threadError || !thread) {
    throw threadError ?? new Error("Unable to create the seeded direct thread.");
  }

  const messageRows = seedMessages.map((message) => ({
    thread_id: thread.id,
    sender_id: seedUserIds.get(message.senderKey),
    body: message.body,
    moderation_state: message.moderationState,
    created_at: message.createdAt,
  }));

  const { error: messageError } = await supabase.from("direct_messages").insert(messageRows);

  if (messageError) {
    throw messageError;
  }
}

async function seedNotificationsAndReports(supabase, seedUserIds, seededRecords) {
  const notificationRows = seedNotifications.map((notification) => ({
    profile_id: seedUserIds.get(notification.userKey),
    title: notification.title,
    body: notification.body,
    href: notification.href,
    created_at: notification.createdAt,
    read_at: notification.readAt,
  }));

  const { error: notificationError } = await supabase.from("notifications").insert(notificationRows);

  if (notificationError) {
    throw notificationError;
  }

  const impactRequestId = seededRecords.requestIdsBySlug.get(seedRequests.find((request) => request.key === seedReport.requestKey).slug);
  const impactOffer = seededRecords.insertedOffers.find((offer) => offer.request_id === impactRequestId);

  const { error: reportError } = await supabase.from("listing_reports").insert({
    request_id: impactRequestId,
    reporter_id: seedUserIds.get(seedReport.reporterKey),
    offer_id: impactOffer?.id ?? null,
    report_target: impactOffer?.id ? "offer" : "request",
    reason: seedReport.reason,
    details: seedReport.details,
    image_urls: [],
    status: "open",
    created_at: seedReport.createdAt,
  });

  if (reportError) {
    throw reportError;
  }
}

async function printMagicLinks(supabase) {
  const appUrl = process.env.BUYERBOARD_APP_URL?.trim() || "http://localhost:3000";

  console.log("");
  console.log("Fresh local magic links");
  for (const user of seedUsers) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      throw error;
    }

    console.log(`- ${user.email}`);
    console.log(`  ${data.properties.action_link}`);
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  printPlan();

  if (!applyMode) {
    console.log("DRY RUN ONLY: no seed users, requests, notifications, or reports were written.");
    console.log("If you expected other-user requests on the board or seller feed, add SUPABASE_SERVICE_ROLE_KEY and rerun npm run seed:dev.");
    return;
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const seedUserIds = await ensureSeedUsers(supabase);

  // Cleanup is intentionally scoped to the known seed users and fixed seed slugs so reruns
  // stay deterministic without touching any unrelated real local data.
  await clearExistingSeedData(supabase, seedUserIds);
  await seedProfiles(supabase, seedUserIds);
  const seededRecords = await seedRequestsAndOffers(supabase, seedUserIds);
  await seedDirectMessages(supabase, seedUserIds);
  await seedNotificationsAndReports(supabase, seedUserIds, seededRecords);

  console.log("");
  console.log("BuyerBoard dev seed applied successfully.");
  console.log(`Seeded users: ${seedUsers.length}`);
  console.log(`Seeded requests: ${seedRequests.length}`);
  console.log(`Seeded offers: ${seedOffers.length}`);
  console.log("Seeded direct threads: 1");
  console.log("Seeded admin listing reports: 1");

  await printMagicLinks(supabase);
}

main().catch((error) => {
  console.error("");
  console.error("BuyerBoard dev seed failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
