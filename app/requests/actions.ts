"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOptionalCurrentProfile, requireCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function saveRequestFilterPreset(formData: FormData) {
  await requireCurrentUser("/requests");
  const profile = await getOptionalCurrentProfile();
  const supabase = await createClient();

  if (!supabase || !profile) {
    redirect("/requests?error=Sign in to save board filters.");
  }

  const name = String(formData.get("filterName") ?? "").trim();
  const searchQuery = String(formData.get("searchQuery") ?? "").trim();
  const category = String(formData.get("category") ?? "All categories").trim() || "All categories";
  const subcategory = String(formData.get("subcategory") ?? "All subcategories").trim() || "All subcategories";
  const shipping = String(formData.get("shipping") ?? "Any").trim() || "Any";
  const status = String(formData.get("status") ?? "All statuses").trim() || "All statuses";
  const sort = String(formData.get("sort") ?? "Newest first").trim() || "Newest first";
  const alertEnabled = String(formData.get("alertEnabled") ?? "") === "on";

  if (!name) {
    redirect("/requests?error=Give this saved filter a short name.");
  }

  const { error } = await supabase.from("saved_request_filters").insert({
    profile_id: profile.id,
    name,
    search_query: searchQuery || null,
    category: category === "All categories" ? null : category,
    subcategory: subcategory === "All subcategories" ? null : subcategory,
    shipping: shipping === "Any" ? null : shipping,
    status: status === "All statuses" ? null : status,
    sort_order: sort === "Newest first" ? null : sort,
    alert_enabled: alertEnabled,
  });

  if (error) {
    redirect(`/requests?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/requests");
  redirect("/requests?notice=Saved filter added");
}
