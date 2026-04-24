"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseImageUrlsFromFormValue } from "@/lib/media";
import { validateMarketplaceListing } from "@/lib/moderation";
import { createWantedRequest } from "@/lib/requests";

function parseBudget(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "").trim();
  return Number.parseFloat(cleaned);
}

export async function submitWantedRequest(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const subcategory = String(formData.get("subcategory") ?? "Other").trim() || "Other";
  const targetPriceRaw = String(formData.get("targetPrice") ?? "").trim();
  const conditionPreference = String(formData.get("conditionPreference") ?? "").trim();
  const shippingPreference = String(formData.get("shippingPreference") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrls = parseImageUrlsFromFormValue(String(formData.get("imageUrls") ?? ""));
  const vehicleYear = String(formData.get("vehicleYear") ?? "").trim();
  const vehicleMake = String(formData.get("vehicleMake") ?? "").trim();
  const vehicleModel = String(formData.get("vehicleModel") ?? "").trim();

  const targetBudget = parseBudget(targetPriceRaw);

  if (!title || !category || !description || !shippingPreference || !Number.isFinite(targetBudget) || targetBudget <= 0) {
    redirect("/requests/new?error=Please complete all required fields with a valid USD target price.");
  }

  if (category === "Auto Parts" && (!vehicleYear || !vehicleMake || !vehicleModel)) {
    redirect("/requests/new?error=Auto parts requests require year, make, and model.");
  }

  const moderationError = validateMarketplaceListing({
    title,
    description,
  });

  if (moderationError) {
    redirect(`/requests/new?error=${encodeURIComponent(moderationError)}`);
  }

  let slug: string;

  try {
    slug = await createWantedRequest({
      title,
      category,
      subcategory,
      targetBudget,
      conditionPreference,
      shippingPreference,
      description,
      imageUrls,
      vehicleFitment: category === "Auto Parts" ? `${vehicleYear} ${vehicleMake} ${vehicleModel}` : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create request right now.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/requests/new");
    }
    redirect(`/requests/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/requests");
  redirect(`/requests/${slug}?created=1`);
}
