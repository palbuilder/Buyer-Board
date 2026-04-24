import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getDirectMessages } from "@/lib/community";

type ThreadRouteProps = {
  params: Promise<{
    threadId: string;
  }>;
};

export async function GET(_: Request, { params }: ThreadRouteProps) {
  try {
    const { threadId } = await params;

    if (!threadId) {
      return NextResponse.json({ error: "Missing thread information." }, { status: 400 });
    }

    const messages = await getDirectMessages(threadId);
    return NextResponse.json({ messages });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
