import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getSellerOffersForRequest, getWantedRequestById } from "@/lib/requests";

type RequestRouteProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function GET(_: Request, { params }: RequestRouteProps) {
  try {
    const { requestId } = await params;
    const request = await getWantedRequestById(requestId);

    if (!request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const offers = await getSellerOffersForRequest(requestId);
    return NextResponse.json({ request, offers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
