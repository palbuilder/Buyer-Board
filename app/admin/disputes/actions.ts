"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { resolveDispute } from "@/lib/requests";

export async function resolveAdminDispute(formData: FormData) {
  await requireAdminUser("/admin/disputes");

  const disputeId = String(formData.get("disputeId") ?? "").trim();
  const resolutionRaw = String(formData.get("resolution") ?? "").trim();
  const resolutionNote = String(formData.get("resolutionNote") ?? "").trim();

  const resolution =
    resolutionRaw === "resolved_buyer" || resolutionRaw === "resolved_seller" || resolutionRaw === "closed"
      ? resolutionRaw
      : "";

  if (!disputeId || !resolution || !resolutionNote) {
    redirect("/admin/disputes?error=Choose a resolution and leave a note.");
  }

  try {
    await resolveDispute({
      disputeId,
      resolution,
      resolutionNote,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve dispute.";
    redirect(`/admin/disputes?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/disputes");
  revalidatePath("/dashboard");
  redirect("/admin/disputes?notice=Dispute resolution saved");
}
