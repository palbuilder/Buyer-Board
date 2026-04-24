create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  role text not null check (role in ('buyer', 'seller', 'admin')),
  display_name text not null,
  location_label text,
  public_location_label text,
  account_status text not null default 'active'
    check (account_status in ('active', 'flagged', 'suspended')),
  admin_risk_note text,
  moderated_at timestamptz,
  preferred_shipping_name text,
  preferred_shipping_address_line1 text,
  preferred_shipping_address_line2 text,
  preferred_shipping_city text,
  preferred_shipping_state text,
  preferred_shipping_postal_code text,
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  slug text not null unique,
  title text not null,
  category text not null,
  description text not null,
  image_urls text[] not null default '{}',
  condition_preference text,
  shipping_preference text,
  location_label text,
  target_price_cents integer not null check (target_price_cents > 0),
  status text not null default 'open'
    check (status in ('open', 'negotiating', 'claimed', 'fulfilled', 'closed')),
  hold_expires_at timestamptz,
  fulfilled_offer_id uuid,
  last_active_confirmation_at timestamptz,
  stale_confirmation_requested_at timestamptz,
  stale_confirmation_miss_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  image_urls text[] not null default '{}',
  offer_price_cents integer not null check (offer_price_cents > 0),
  message text not null,
  shipping_note text,
  estimated_ship_time text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'countered', 'withdrawn')),
  created_at timestamptz not null default now()
);

create table if not exists claim_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references requests(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  final_price_cents integer not null check (final_price_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  completed_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references transactions(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now()
);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references transactions(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  reason text not null
    check (reason in ('wrong_item', 'defective_item', 'not_as_described', 'shipping_issue', 'other')),
  details text not null,
  status text not null default 'open'
    check (status in ('open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed')),
  buyer_evidence text,
  buyer_evidence_images text[] not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  seller_evidence text,
  seller_evidence_images text[] not null default '{}'
);

create table if not exists verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  phone_number text not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);

create table if not exists listing_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  offer_id uuid references offers(id) on delete cascade,
  report_target text not null default 'request'
    check (report_target in ('request', 'offer')),
  reason text not null
    check (reason in ('tos_violation', 'illegal_item', 'unsafe_item', 'harassment', 'spam', 'other')),
  details text not null,
  image_urls text[] not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'removed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text
);

create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followed_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists direct_threads (
  id uuid primary key default gen_random_uuid(),
  member_a_id uuid not null references profiles(id) on delete cascade,
  member_b_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_a_id <> member_b_id)
);

create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references direct_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  moderation_state text not null default 'clean'
    check (moderation_state in ('clean', 'flagged', 'reviewed')),
  created_at timestamptz not null default now(),
  review_note text
);

create table if not exists trust_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  event_type text not null
    check (event_type in ('account_status', 'phone_review', 'flagged_message_review', 'appeal_submitted', 'appeal_review')),
  note text not null,
  event_value text,
  created_at timestamptz not null default now()
);

create table if not exists trust_appeals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'approved', 'rejected')),
  member_message text not null,
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint_url text not null,
  event_types text[] not null default array['request.created']::text[],
  is_active boolean not null default true,
  subscription_tier text not null default 'free',
  last_delivery_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists webhook_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references webhook_subscriptions(id) on delete cascade,
  event_type text not null,
  response_status integer,
  success boolean not null default false,
  response_body text,
  created_at timestamptz not null default now()
);

create table if not exists seller_digest_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text,
  category text,
  subcategory text,
  state text,
  min_budget integer,
  since_hours integer not null default 24,
  is_active boolean not null default true,
  delivery_enabled boolean not null default false,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saved_request_filters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  search_query text,
  category text,
  subcategory text,
  shipping text,
  status text,
  sort_order text,
  alert_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists notification_preferences (
  profile_id uuid primary key references profiles(id) on delete cascade,
  watchlist_enabled boolean not null default true,
  offers_claims_enabled boolean not null default true,
  disputes_enabled boolean not null default true,
  trust_safety_enabled boolean not null default true,
  moderation_enabled boolean not null default true,
  email_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists requests_status_created_at_idx
  on requests (status, created_at desc);

create index if not exists offers_request_id_idx
  on offers (request_id, created_at desc);

create index if not exists messages_request_id_idx
  on messages (request_id, created_at asc);

create index if not exists disputes_seller_status_idx
  on disputes (seller_id, status, created_at desc);

create index if not exists verification_requests_status_idx
  on verification_requests (status, created_at desc);

create index if not exists listing_reports_status_created_at_idx
  on listing_reports (status, created_at desc);

create index if not exists follows_followed_created_idx
  on follows (followed_id, created_at desc);

create index if not exists blocks_blocked_created_idx
  on blocks (blocked_id, created_at desc);

create index if not exists direct_threads_updated_idx
  on direct_threads (updated_at desc);

create index if not exists direct_messages_thread_created_idx
  on direct_messages (thread_id, created_at asc);

create index if not exists trust_events_profile_created_idx
  on trust_events (profile_id, created_at desc);

create index if not exists trust_appeals_profile_created_idx
  on trust_appeals (profile_id, created_at desc);

create index if not exists trust_appeals_status_created_idx
  on trust_appeals (status, created_at desc);

create index if not exists notifications_profile_created_idx
  on notifications (profile_id, created_at desc);

create index if not exists saved_request_filters_profile_created_idx
  on saved_request_filters (profile_id, created_at desc);

create index if not exists reviews_seller_created_idx
  on reviews (seller_id, created_at desc);

create index if not exists reviews_buyer_created_idx
  on reviews (buyer_id, created_at desc);

-- These indexes protect the busiest "my activity" screens as marketplace volume
-- grows. Without them, buyer/seller dashboards drift toward full-table scans.
create index if not exists requests_buyer_created_idx
  on requests (buyer_id, created_at desc);

create index if not exists offers_seller_created_idx
  on offers (seller_id, created_at desc);

create index if not exists claim_events_request_claimed_idx
  on claim_events (request_id, claimed_at desc);

create index if not exists claim_events_seller_claimed_idx
  on claim_events (seller_id, claimed_at desc);

create index if not exists transactions_buyer_completed_idx
  on transactions (buyer_id, completed_at desc);

create index if not exists transactions_seller_completed_idx
  on transactions (seller_id, completed_at desc);

create index if not exists disputes_buyer_created_idx
  on disputes (buyer_id, created_at desc);

-- New-request alerts scan the alert-enabled subset across many users, so the
-- alert flag needs its own index once the board starts to fill up.
create index if not exists saved_request_filters_alert_created_idx
  on saved_request_filters (alert_enabled, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'requests_fulfilled_offer_fk'
  ) then
    alter table requests
      add constraint requests_fulfilled_offer_fk
      foreign key (fulfilled_offer_id) references offers(id)
      on delete set null;
  end if;
end $$;

alter table profiles add column if not exists public_location_label text;
alter table profiles add column if not exists preferred_shipping_name text;
alter table profiles add column if not exists preferred_shipping_address_line1 text;
alter table profiles add column if not exists preferred_shipping_address_line2 text;
alter table profiles add column if not exists preferred_shipping_city text;
alter table profiles add column if not exists preferred_shipping_state text;
alter table profiles add column if not exists preferred_shipping_postal_code text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists account_type text default 'individual';
alter table profiles add column if not exists plan_tier text default 'free';
alter table profiles add column if not exists account_status text default 'active';
alter table profiles add column if not exists admin_risk_note text;
alter table profiles add column if not exists moderated_at timestamptz;
alter table profiles add column if not exists phone_number text;
alter table profiles add column if not exists phone_verified_at timestamptz;
alter table profiles add column if not exists business_name text;
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_connect_account_id text;
alter table profiles add column if not exists stripe_customer_ready_at timestamptz;
alter table profiles add column if not exists stripe_connect_onboarded_at timestamptz;
alter table profiles add column if not exists stripe_charges_enabled_at timestamptz;
alter table profiles add column if not exists stripe_payouts_enabled_at timestamptz;
alter table webhook_subscriptions add column if not exists subscription_tier text default 'free';
alter table webhook_subscriptions add column if not exists last_delivery_at timestamptz;
alter table webhook_subscriptions add column if not exists last_error text;
alter table webhook_subscriptions add column if not exists updated_at timestamptz default now();
alter table seller_digest_subscriptions add column if not exists name text;
alter table seller_digest_subscriptions add column if not exists delivery_enabled boolean not null default false;
alter table seller_digest_subscriptions add column if not exists last_sent_at timestamptz;

alter table transactions add column if not exists payment_status text default 'completed';
alter table transactions add column if not exists stripe_payment_intent_id text;
alter table offers add column if not exists image_urls text[] default '{}';
alter table disputes add column if not exists seller_response text;
alter table disputes add column if not exists buyer_evidence text;
alter table disputes add column if not exists seller_evidence text;
alter table disputes add column if not exists buyer_evidence_images text[] default '{}';
alter table disputes add column if not exists seller_evidence_images text[] default '{}';
alter table listing_reports add column if not exists reviewed_at timestamptz;
alter table listing_reports add column if not exists admin_note text;
alter table listing_reports add column if not exists image_urls text[] default '{}';
alter table listing_reports add column if not exists offer_id uuid references offers(id) on delete cascade;
alter table listing_reports add column if not exists report_target text default 'request';
alter table requests add column if not exists image_urls text[] default '{}';
alter table requests add column if not exists last_active_confirmation_at timestamptz;
alter table requests add column if not exists stale_confirmation_requested_at timestamptz;
alter table requests add column if not exists stale_confirmation_miss_count integer not null default 0;
alter table direct_messages add column if not exists moderation_state text default 'clean';
alter table direct_messages add column if not exists review_note text;
alter table saved_request_filters add column if not exists alert_enabled boolean not null default false;

create index if not exists requests_stale_confirmation_idx
  on requests (status, stale_confirmation_requested_at, created_at desc);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'offers_status_check'
      and conrelid = 'offers'::regclass
  ) then
    alter table offers drop constraint offers_status_check;
  end if;

  -- Counteroffers are part of the live buyer decision path, so older databases
  -- need the refreshed check constraint before seed data and counteroffer flows
  -- can succeed consistently.
  alter table offers
    add constraint offers_status_check
    check (status in ('pending', 'accepted', 'declined', 'countered', 'withdrawn'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'trust_events_event_type_check'
  ) then
    alter table trust_events drop constraint trust_events_event_type_check;
  end if;

  alter table trust_events
    add constraint trust_events_event_type_check
    check (event_type in ('account_status', 'phone_review', 'flagged_message_review', 'appeal_submitted', 'appeal_review'));
exception
  when duplicate_object then null;
end $$;

create or replace function accept_claim_offer(
  p_request_id uuid,
  p_offer_id uuid,
  p_buyer_id uuid,
  p_buyer_comment text default null
)
returns table (
  seller_id uuid,
  expires_at timestamptz,
  seeded_price_cents integer,
  platform_fee_cents integer
)
language plpgsql
as $$
declare
  request_row requests%rowtype;
  offer_row offers%rowtype;
  existing_claim claim_events%rowtype;
  proposed_hours integer;
  normalized_comment text;
begin
  select *
  into request_row
  from requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if request_row.buyer_id <> p_buyer_id then
    raise exception 'Only the buyer who posted this request can review claim offers.';
  end if;

  if request_row.status in ('fulfilled', 'closed') then
    raise exception 'This request is no longer accepting claim decisions.';
  end if;

  if request_row.fulfilled_offer_id is not null and request_row.fulfilled_offer_id <> p_offer_id then
    raise exception 'This request already has an approved claim offer.';
  end if;

  select *
  into offer_row
  from offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found.';
  end if;

  if offer_row.request_id <> p_request_id then
    raise exception 'This offer does not belong to the selected request.';
  end if;

  if offer_row.status not in ('pending', 'countered', 'accepted') then
    raise exception 'This offer is no longer waiting for a buyer decision.';
  end if;

  proposed_hours := coalesce(nullif(regexp_replace(coalesce(offer_row.shipping_note, ''), '[^0-9]', '', 'g'), '')::integer, 48);
  proposed_hours := greatest(proposed_hours, 1);
  normalized_comment := nullif(trim(coalesce(p_buyer_comment, '')), '');

  if request_row.status = 'claimed' and request_row.fulfilled_offer_id = p_offer_id then
    select *
    into existing_claim
    from claim_events
    where request_id = p_request_id
      and seller_id = offer_row.seller_id
      and released_at is null
    order by claimed_at desc
    limit 1;

    if not found then
      raise exception 'Approved claim record is missing for this request.';
    end if;
  else
    update requests
    set status = 'claimed',
        hold_expires_at = now() + make_interval(hours => proposed_hours),
        fulfilled_offer_id = p_offer_id,
        updated_at = now()
    where id = p_request_id;

    update offers
    set status = 'accepted'
    where id = p_offer_id;

    update offers
    set status = 'declined'
    where request_id = p_request_id
      and id <> p_offer_id
      and status in ('pending', 'countered');

    insert into claim_events (request_id, seller_id, expires_at)
    values (
      p_request_id,
      offer_row.seller_id,
      now() + make_interval(hours => proposed_hours)
    )
    returning *
    into existing_claim;

    insert into transactions (
      request_id,
      buyer_id,
      seller_id,
      final_price_cents,
      platform_fee_cents,
      payment_status
    )
    values (
      p_request_id,
      request_row.buyer_id,
      offer_row.seller_id,
      offer_row.offer_price_cents,
      round(offer_row.offer_price_cents * 0.08),
      'awaiting_payment'
    )
    on conflict (request_id) do update
    set buyer_id = excluded.buyer_id,
        seller_id = excluded.seller_id,
        final_price_cents = excluded.final_price_cents,
        platform_fee_cents = excluded.platform_fee_cents,
        payment_status = 'awaiting_payment';
  end if;

  if normalized_comment is not null then
    insert into messages (request_id, sender_id, body)
    values (p_request_id, p_buyer_id, normalized_comment);
  end if;

  return query
  select
    offer_row.seller_id,
    existing_claim.expires_at,
    offer_row.offer_price_cents,
    round(offer_row.offer_price_cents * 0.08)::integer;
end;
$$;

create or replace function create_seller_claim_offer(
  p_request_id uuid,
  p_seller_id uuid,
  p_message text,
  p_offer_price_cents integer,
  p_image_urls text[] default '{}',
  p_claim_window_hours integer default 48,
  p_seller_display_name text default null
)
returns table (
  buyer_id uuid,
  request_slug text,
  request_title text,
  seller_id uuid
)
language plpgsql
as $$
declare
  request_row requests%rowtype;
  normalized_message text;
  proposed_hours integer;
  normalized_display_name text;
begin
  select *
  into request_row
  from requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if request_row.status not in ('open', 'negotiating') then
    raise exception 'This request is no longer accepting seller claim offers.';
  end if;

  if request_row.buyer_id = p_seller_id then
    raise exception 'You cannot send a seller offer on your own request.';
  end if;

  normalized_message := nullif(trim(coalesce(p_message, '')), '');

  if normalized_message is null then
    raise exception 'Write a message before sending your seller offer.';
  end if;

  if p_offer_price_cents is null or p_offer_price_cents <= 0 then
    raise exception 'Offer price must be greater than zero.';
  end if;

  proposed_hours := greatest(coalesce(p_claim_window_hours, 48), 1);
  normalized_display_name := coalesce(nullif(trim(coalesce(p_seller_display_name, '')), ''), 'Seller');

  insert into messages (request_id, sender_id, body)
  values (p_request_id, p_seller_id, normalized_message);

  insert into offers (
    request_id,
    seller_id,
    image_urls,
    offer_price_cents,
    message,
    shipping_note,
    estimated_ship_time,
    status
  )
  values (
    p_request_id,
    p_seller_id,
    coalesce(p_image_urls, '{}'::text[]),
    p_offer_price_cents,
    normalized_message,
    proposed_hours::text || ' hour claim window proposal',
    'Seller: ' || normalized_display_name,
    'pending'
  );

  update requests
  set status = 'negotiating',
      updated_at = now()
  where id = p_request_id;

  return query
  select
    request_row.buyer_id,
    request_row.slug,
    request_row.title,
    p_seller_id;
end;
$$;

create or replace function review_claim_offer(
  p_request_id uuid,
  p_offer_id uuid,
  p_buyer_id uuid,
  p_decision text,
  p_buyer_comment text default null
)
returns table (
  seller_id uuid,
  next_status text
)
language plpgsql
as $$
declare
  request_row requests%rowtype;
  offer_row offers%rowtype;
  normalized_comment text;
  pending_offer_count bigint;
  next_request_status text;
begin
  if p_decision not in ('declined', 'countered') then
    raise exception 'Unsupported claim offer decision.';
  end if;

  select *
  into request_row
  from requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if request_row.buyer_id <> p_buyer_id then
    raise exception 'Only the buyer who posted this request can review claim offers.';
  end if;

  if request_row.status in ('fulfilled', 'closed', 'claimed') then
    raise exception 'This request is no longer accepting claim decisions.';
  end if;

  select *
  into offer_row
  from offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found.';
  end if;

  if offer_row.request_id <> p_request_id then
    raise exception 'This offer does not belong to the selected request.';
  end if;

  if offer_row.status not in ('pending', 'countered') then
    raise exception 'This offer is no longer waiting for a buyer decision.';
  end if;

  normalized_comment := nullif(trim(coalesce(p_buyer_comment, '')), '');

  update offers
  set status = p_decision
  where id = p_offer_id;

  if normalized_comment is not null then
    insert into messages (request_id, sender_id, body)
    values (p_request_id, p_buyer_id, normalized_comment);
  end if;

  if p_decision = 'countered' then
    next_request_status := 'negotiating';
  else
    select count(*)
    into pending_offer_count
    from offers
    where request_id = p_request_id
      and id <> p_offer_id
      and status in ('pending', 'countered');

    next_request_status := case when pending_offer_count > 0 then 'negotiating' else 'open' end;
  end if;

  update requests
  set status = next_request_status,
      updated_at = now()
  where id = p_request_id;

  return query
  select
    offer_row.seller_id,
    next_request_status;
end;
$$;

create or replace function complete_seller_claim(
  p_request_id uuid,
  p_claim_id uuid,
  p_seller_id uuid
)
returns table (
  buyer_id uuid
)
language plpgsql
as $$
declare
  request_row requests%rowtype;
  offer_row offers%rowtype;
  transaction_row transactions%rowtype;
  claim_row claim_events%rowtype;
  completed_at_ts timestamptz := now();
begin
  select *
  into request_row
  from requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if request_row.status <> 'claimed' then
    raise exception 'Only claimed requests can be marked complete.';
  end if;

  if request_row.fulfilled_offer_id is null then
    raise exception 'This request does not have an approved claim offer.';
  end if;

  select *
  into offer_row
  from offers
  where id = request_row.fulfilled_offer_id
  for update;

  if not found then
    raise exception 'Approved offer not found.';
  end if;

  if offer_row.seller_id <> p_seller_id then
    raise exception 'Only the seller holding this claim can mark it complete.';
  end if;

  select *
  into transaction_row
  from transactions
  where request_id = p_request_id
  for update;

  if not found or transaction_row.payment_status = 'awaiting_payment' then
    raise exception 'Buyer funding is still required before this claim can be completed.';
  end if;

  select *
  into claim_row
  from claim_events
  where id = p_claim_id
    and request_id = p_request_id
  for update;

  if not found then
    raise exception 'Claim record not found.';
  end if;

  if claim_row.seller_id <> p_seller_id then
    raise exception 'Only the seller holding this claim can mark it complete.';
  end if;

  if claim_row.released_at is not null then
    raise exception 'This claim was already completed.';
  end if;

  update transactions
  set buyer_id = request_row.buyer_id,
      seller_id = offer_row.seller_id,
      final_price_cents = offer_row.offer_price_cents,
      platform_fee_cents = round(offer_row.offer_price_cents * 0.08),
      completed_at = completed_at_ts,
      payment_status = case
        when transaction_row.payment_status = 'funded' then 'completed'
        else transaction_row.payment_status
      end
  where request_id = p_request_id;

  update requests
  set status = 'fulfilled',
      hold_expires_at = null,
      updated_at = completed_at_ts
  where id = p_request_id;

  update claim_events
  set released_at = completed_at_ts
  where id = p_claim_id;

  return query
  select request_row.buyer_id;
end;
$$;

create or replace function report_transaction_issue(
  p_transaction_id uuid,
  p_request_id uuid,
  p_buyer_id uuid,
  p_reason text,
  p_details text,
  p_buyer_evidence text default null,
  p_buyer_evidence_images text[] default '{}'
)
returns table (
  seller_id uuid
)
language plpgsql
as $$
declare
  transaction_row transactions%rowtype;
begin
  select *
  into transaction_row
  from transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Completed purchase not found.';
  end if;

  if transaction_row.buyer_id <> p_buyer_id or transaction_row.request_id <> p_request_id then
    raise exception 'Only the buyer on this purchase can report an issue.';
  end if;

  insert into disputes (
    transaction_id,
    request_id,
    buyer_id,
    seller_id,
    reason,
    details,
    buyer_evidence,
    buyer_evidence_images,
    status
  )
  values (
    p_transaction_id,
    p_request_id,
    transaction_row.buyer_id,
    transaction_row.seller_id,
    p_reason,
    p_details,
    p_buyer_evidence,
    coalesce(p_buyer_evidence_images, '{}'::text[]),
    'open'
  )
  on conflict (transaction_id) do update
  set request_id = excluded.request_id,
      buyer_id = excluded.buyer_id,
      seller_id = excluded.seller_id,
      reason = excluded.reason,
      details = excluded.details,
      buyer_evidence = excluded.buyer_evidence,
      buyer_evidence_images = excluded.buyer_evidence_images,
      status = 'open',
      resolved_at = null,
      resolution_note = null;

  update transactions
  set payment_status = 'on_hold'
  where id = p_transaction_id;

  return query
  select transaction_row.seller_id;
end;
$$;

create or replace function respond_to_dispute(
  p_dispute_id uuid,
  p_seller_id uuid,
  p_response text,
  p_seller_evidence text default null,
  p_seller_evidence_images text[] default '{}'
)
returns table (
  buyer_id uuid
)
language plpgsql
as $$
declare
  dispute_row disputes%rowtype;
begin
  select *
  into dispute_row
  from disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found.';
  end if;

  if dispute_row.seller_id <> p_seller_id then
    raise exception 'Only the seller on this dispute can respond.';
  end if;

  update disputes
  set seller_response = p_response,
      seller_evidence = p_seller_evidence,
      seller_evidence_images = coalesce(p_seller_evidence_images, '{}'::text[]),
      status = case when dispute_row.status = 'open' then 'under_review' else dispute_row.status end
  where id = p_dispute_id;

  update transactions
  set payment_status = 'on_hold'
  where id = dispute_row.transaction_id;

  return query
  select dispute_row.buyer_id;
end;
$$;

create or replace function resolve_dispute_case(
  p_dispute_id uuid,
  p_resolution text,
  p_resolution_note text
)
returns table (
  buyer_id uuid,
  seller_id uuid
)
language plpgsql
as $$
declare
  dispute_row disputes%rowtype;
  resolved_at_ts timestamptz := now();
  next_payment_status text;
begin
  if p_resolution not in ('resolved_buyer', 'resolved_seller', 'closed') then
    raise exception 'Unsupported dispute resolution.';
  end if;

  select *
  into dispute_row
  from disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found.';
  end if;

  next_payment_status := case
    when p_resolution = 'resolved_buyer' then 'refunded'
    when p_resolution = 'resolved_seller' then 'released'
    else 'completed'
  end;

  update disputes
  set status = p_resolution,
      resolved_at = resolved_at_ts,
      resolution_note = p_resolution_note
  where id = p_dispute_id;

  update transactions
  set payment_status = next_payment_status
  where id = dispute_row.transaction_id;

  return query
  select dispute_row.buyer_id, dispute_row.seller_id;
end;
$$;

create or replace function review_listing_report(
  p_report_id uuid,
  p_request_id uuid,
  p_resolution text,
  p_admin_note text,
  p_offer_id uuid default null
)
returns table (
  request_owner_id uuid,
  offer_owner_id uuid
)
language plpgsql
as $$
declare
  report_row listing_reports%rowtype;
  request_row requests%rowtype;
  offer_row offers%rowtype;
  reviewed_at_ts timestamptz := now();
  next_report_status text;
begin
  if p_resolution not in ('reviewed', 'remove_images', 'removed', 'dismissed') then
    raise exception 'Unsupported listing report resolution.';
  end if;

  select *
  into report_row
  from listing_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Listing report not found.';
  end if;

  if report_row.request_id <> p_request_id then
    raise exception 'This report does not belong to the selected request.';
  end if;

  select *
  into request_row
  from requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if p_offer_id is not null then
    select *
    into offer_row
    from offers
    where id = p_offer_id
    for update;

    if not found then
      raise exception 'Seller offer not found.';
    end if;

    if offer_row.request_id <> p_request_id then
      raise exception 'That seller offer could not be matched to this request.';
    end if;
  elsif report_row.offer_id is not null then
    select *
    into offer_row
    from offers
    where id = report_row.offer_id
    for update;
  end if;

  next_report_status := case
    when p_resolution = 'remove_images' then 'reviewed'
    else p_resolution
  end;

  update listing_reports
  set status = next_report_status,
      reviewed_at = reviewed_at_ts,
      admin_note = p_admin_note
  where id = p_report_id;

  if p_resolution = 'remove_images' then
    if p_offer_id is not null then
      update offers
      set image_urls = '{}'::text[]
      where id = p_offer_id;
    else
      update requests
      set image_urls = '{}'::text[],
          updated_at = reviewed_at_ts
      where id = p_request_id;
    end if;
  elsif p_resolution = 'removed' then
    if p_offer_id is not null then
      update offers
      set status = 'withdrawn',
          image_urls = '{}'::text[]
      where id = p_offer_id;
    else
      update requests
      set status = 'closed',
          updated_at = reviewed_at_ts
      where id = p_request_id;
    end if;
  end if;

  return query
  select request_row.buyer_id, offer_row.seller_id;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buyerboard-media',
  'buyerboard-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'buyerboard media insert'
  ) then
    create policy "buyerboard media insert"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'buyerboard-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'buyerboard media update'
  ) then
    create policy "buyerboard media update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'buyerboard-media'
        and owner = auth.uid()
      )
      with check (
        bucket_id = 'buyerboard-media'
        and owner = auth.uid()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'buyerboard media delete'
  ) then
    create policy "buyerboard media delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'buyerboard-media'
        and owner = auth.uid()
      );
  end if;
end $$;
