import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getPublicSellerProfile } from "@/lib/requests";

type SellerRouteProps = {
  params: Promise<{
    sellerId: string;
  }>;
};

export async function GET(_: Request, { params }: SellerRouteProps) {
  try {
    const { sellerId } = await params;
    const seller = await getPublicSellerProfile(sellerId);

    if (!seller) {
      return NextResponse.json({ error: "Seller not found." }, { status: 404 });
    }

    return NextResponse.json({ seller });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
