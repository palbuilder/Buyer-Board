"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { reviewListingReport } from "@/lib/requests";

export async function resolveListingReport(formData: FormData) {
  await requireAdminUser("/admin/reports");

  const reportId = String(formData.get("reportId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const offerId = String(formData.get("offerId") ?? "").trim();
  const resolutionRaw = String(formData.get("resolution") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim();
  const resolution =
    resolutionRaw === "reviewed" || resolutionRaw === "remove_images" || resolutionRaw === "removed" || resolutionRaw === "dismissed"
      ? resolutionRaw
      : "";

  if (!reportId || !requestId || !resolution || !adminNote) {
    redirect("/admin/reports?error=Choose a report resolution and leave an admin note.");
  }

  try {
    await reviewListingReport({
      reportId,
      requestId,
      offerId: offerId || undefined,
      resolution: resolution as "reviewed" | "remove_images" | "removed" | "dismissed",
      adminNote,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve listing report.";
    redirect(`/admin/reports?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/reports");
  revalidatePath("/requests");
  redirect("/admin/reports?notice=Listing report resolved");
}
