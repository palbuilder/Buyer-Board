import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiAdminUser } from "@/lib/auth";
import { resolveDispute } from "@/lib/requests";

type AdminDisputeResolutionRouteProps = {
  params: Promise<{
    disputeId: string;
  }>;
};

export async function POST(request: Request, { params }: AdminDisputeResolutionRouteProps) {
  try {
    await requireApiAdminUser();
    const { disputeId } = await params;
    const body = (await request.json()) as {
      resolution?: unknown;
      resolutionNote?: unknown;
    };

    const resolution = typeof body.resolution === "string" ? body.resolution.trim() : "";
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
    const allowedResolutions = new Set(["resolved_buyer", "resolved_seller", "closed"]);

    if (!disputeId || !resolutionNote || !allowedResolutions.has(resolution)) {
      return NextResponse.json({ error: "Choose a resolution and leave a note." }, { status: 400 });
    }

    await resolveDispute({
      disputeId,
      resolution: resolution as "resolved_buyer" | "resolved_seller" | "closed",
      resolutionNote,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/admin/disputes/[disputeId]/resolution", action: "POST" });
  }
}
