"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getFlaggedMessageSenderId, reviewFlaggedMessage } from "@/lib/community";
import { createNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

async function logTrustEvent(input: {
  profileId: string;
  eventType: "account_status" | "phone_review" | "flagged_message_review" | "appeal_submitted" | "appeal_review";
  note: string;
  eventValue?: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  // The status/review action is the primary write here. If the history trail fails,
  // we still want the moderation decision to stand, but we do not want that failure
  // to disappear without a trace in the logs.
  const { error } = await supabase.from("trust_events").insert({
    profile_id: input.profileId,
    event_type: input.eventType,
    note: input.note,
    event_value: input.eventValue ?? null,
  });

  if (error) {
    console.error("BuyerBoard trust event insert failed", error);
  }
}

export async function reviewPhoneVerificationRequest(formData: FormData) {
  await requireAdminUser("/admin/trust");
  const supabase = await createClient();

  if (!supabase) {
    redirect("/admin/trust?error=Supabase is not configured.");
  }

  const requestId = String(formData.get("requestId") ?? "").trim();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "").trim();
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();
  const decision = decisionRaw === "approved" || decisionRaw === "rejected" ? decisionRaw : "";

  if (!requestId || !profileId || !decision || !reviewNote) {
    redirect("/admin/trust?error=Choose approve or reject and leave a review note.");
  }

  const reviewedAt = new Date().toISOString();

  const { error: requestError } = await supabase
    .from("verification_requests")
    .update({
      status: decision,
      reviewed_at: reviewedAt,
      review_note: reviewNote,
    })
    .eq("id", requestId);

  if (requestError) {
    redirect(`/admin/trust?error=${encodeURIComponent(requestError.message)}`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      phone_verified_at: decision === "approved" ? reviewedAt : null,
    })
    .eq("id", profileId);

  if (profileError) {
    redirect(`/admin/trust?error=${encodeURIComponent(profileError.message)}`);
  }

  await logTrustEvent({
    profileId,
    eventType: "phone_review",
    note: reviewNote,
    eventValue: decision,
  });

  await createNotification({
    profileId,
    title: decision === "approved" ? "Phone verification approved" : "Phone verification rejected",
    body: reviewNote,
    href: "/dashboard",
    preferenceKey: "trust_safety",
    sendEmail: true,
  });

  revalidatePath("/admin/trust");
  revalidatePath("/dashboard");
  redirect("/admin/trust?notice=Phone verification review saved");
}

export async function reviewMemberRiskStatus(formData: FormData) {
  await requireAdminUser("/admin/trust");
  const supabase = await createClient();

  if (!supabase) {
    redirect("/admin/trust?error=Supabase is not configured.");
  }

  const profileId = String(formData.get("profileId") ?? "").trim();
  const statusRaw = String(formData.get("accountStatus") ?? "").trim();
  const adminRiskNote = String(formData.get("adminRiskNote") ?? "").trim();
  const accountStatus = statusRaw === "flagged" || statusRaw === "suspended" ? statusRaw : "active";

  if (!profileId) {
    redirect("/admin/trust?error=Missing member profile information.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      account_status: accountStatus,
      admin_risk_note: adminRiskNote || null,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) {
    redirect(`/admin/trust?error=${encodeURIComponent(error.message)}`);
  }

  await logTrustEvent({
    profileId,
    eventType: "account_status",
    note: adminRiskNote || `Account status updated to ${accountStatus}.`,
    eventValue: accountStatus,
  });

  await createNotification({
    profileId,
    title: accountStatus === "active" ? "Account returned to active" : accountStatus === "flagged" ? "Account placed on warning / probation" : "Account suspended",
    body: adminRiskNote || `Your account status is now ${accountStatus}.`,
    href: "/dashboard",
    preferenceKey: "trust_safety",
    sendEmail: true,
  });

  revalidatePath("/admin/trust");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
  redirect("/admin/trust?notice=Member trust status updated");
}

export async function reviewFlaggedPrivateMessage(formData: FormData) {
  await requireAdminUser("/admin/trust");

  const messageId = String(formData.get("messageId") ?? "").trim();
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();

  if (!messageId || !reviewNote) {
    redirect("/admin/trust?error=Leave a moderation note before clearing a flagged message.");
  }

  try {
    const senderId = await getFlaggedMessageSenderId(messageId);
    await reviewFlaggedMessage({
      messageId,
      reviewNote,
    });
    await logTrustEvent({
      profileId: senderId,
      eventType: "flagged_message_review",
      note: reviewNote,
      eventValue: "reviewed",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review the flagged message.";
    redirect(`/admin/trust?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/trust");
  revalidatePath("/messages");
  redirect("/admin/trust?notice=Flagged private message reviewed");
}

export async function reviewTrustAppeal(formData: FormData) {
  await requireAdminUser("/admin/trust");
  const supabase = await createClient();

  if (!supabase) {
    redirect("/admin/trust?error=Supabase is not configured.");
  }

  const appealId = String(formData.get("appealId") ?? "").trim();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim();
  const decision = decisionRaw === "approved" || decisionRaw === "rejected" ? decisionRaw : "";

  if (!appealId || !profileId || !decision || !adminNote) {
    redirect("/admin/trust?error=Choose approve or reject and leave an admin note for the appeal.");
  }

  const reviewedAt = new Date().toISOString();

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", profileId)
    .single();

  if (existingProfileError || !existingProfile) {
    redirect(`/admin/trust?error=${encodeURIComponent(existingProfileError?.message ?? "Member profile not found.")}`);
  }

  const { error: appealError } = await supabase
    .from("trust_appeals")
    .update({
      status: decision,
      admin_note: adminNote,
      reviewed_at: reviewedAt,
    })
    .eq("id", appealId);

  if (appealError) {
    redirect(`/admin/trust?error=${encodeURIComponent(appealError.message)}`);
  }

  const nextStatus = decision === "approved" ? "active" : existingProfile.account_status === "suspended" ? "suspended" : "flagged";

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      account_status: nextStatus,
      admin_risk_note: adminNote,
      moderated_at: reviewedAt,
    })
    .eq("id", profileId);

  if (profileError) {
    redirect(`/admin/trust?error=${encodeURIComponent(profileError.message)}`);
  }

  await logTrustEvent({
    profileId,
    eventType: "appeal_review",
    note: adminNote,
    eventValue: decision,
  });

  if (decision === "approved") {
    await logTrustEvent({
      profileId,
      eventType: "account_status",
      note: adminNote,
      eventValue: "active",
    });
  }

  await createNotification({
    profileId,
    title: decision === "approved" ? "Appeal approved" : "Appeal rejected",
    body: adminNote,
    href: "/dashboard",
    preferenceKey: "trust_safety",
    sendEmail: true,
  });

  revalidatePath("/admin/trust");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
  redirect(`/admin/trust?notice=${encodeURIComponent(decision === "approved" ? "Appeal approved and account reinstated" : "Appeal decision saved")}`);
}
