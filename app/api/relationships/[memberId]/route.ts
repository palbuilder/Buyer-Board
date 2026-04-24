import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { blockMember, followMember, getRelationshipStatus, unblockMember, unfollowMember } from "@/lib/community";

type RelationshipRouteProps = {
  params: Promise<{
    memberId: string;
  }>;
};

export async function GET(_: Request, { params }: RelationshipRouteProps) {
  try {
    await requireApiCurrentUser();
    const { memberId } = await params;

    if (!memberId) {
      return NextResponse.json({ error: "Missing member information." }, { status: 400 });
    }

    const relationship = await getRelationshipStatus(memberId);
    return NextResponse.json({ relationship });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/relationships/[memberId]", action: "GET" });
  }
}

export async function POST(request: Request, { params }: RelationshipRouteProps) {
  try {
    await requireApiCurrentUser();
    const { memberId } = await params;
    const body = (await request.json()) as {
      action?: unknown;
    };

    const action = body.action;

    if (!memberId || (action !== "follow" && action !== "unfollow" && action !== "block" && action !== "unblock")) {
      return NextResponse.json({ error: "Choose a valid relationship action." }, { status: 400 });
    }

    if (action === "follow") {
      await followMember(memberId);
    } else if (action === "unfollow") {
      await unfollowMember(memberId);
    } else if (action === "block") {
      await blockMember(memberId);
    } else {
      await unblockMember(memberId);
    }

    const relationship = await getRelationshipStatus(memberId);
    return NextResponse.json({ success: true, relationship });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/relationships/[memberId]", action: "POST" });
  }
}
