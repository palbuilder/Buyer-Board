import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiAdminUser } from "@/lib/auth";
import { reviewListingReport } from "@/lib/requests";

type AdminReportResolutionRouteProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function POST(request: Request, { params }: AdminReportResolutionRouteProps) {
  try {
    await requireApiAdminUser();
    const { reportId } = await params;
    const body = (await request.json()) as {
      requestId?: unknown;
      offerId?: unknown;
      resolution?: unknown;
      adminNote?: unknown;
    };

    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
    const resolution = typeof body.resolution === "string" ? body.resolution.trim() : "";
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
    const allowedResolutions = new Set(["reviewed", "remove_images", "removed", "dismissed"]);

    if (!reportId || !requestId || !adminNote || !allowedResolutions.has(resolution)) {
      return NextResponse.json({ error: "Choose a report resolution and leave an admin note." }, { status: 400 });
    }

    await reviewListingReport({
      reportId,
      requestId,
      offerId: offerId || undefined,
      resolution: resolution as "reviewed" | "remove_images" | "removed" | "dismissed",
      adminNote,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/admin/reports/[reportId]/resolution", action: "POST" });
  }
}
