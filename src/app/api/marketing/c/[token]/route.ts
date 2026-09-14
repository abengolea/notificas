import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_SENDS } from "@/lib/marketing/collections";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { decodeClickTarget, verifyMarketingToken } from "@/lib/marketing/tokens";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const encoded = request.nextUrl.searchParams.get("u") || "";
  const sendId = verifyMarketingToken(token, "c", encoded);
  const target = decodeClickTarget(encoded);
  if (sendId && target) {
    try {
      const snap = await getAdminDb().collection(MARKETING_SENDS).doc(sendId).get();
      if (snap.exists) {
        const data = snap.data() || {};
        await recordMarketingEvent({
          sendId,
          campaignId: String(data.campaignId || ""),
          contactId: String(data.contactId || ""),
          type: "clicked",
          meta: { source: "redirect", url: target },
        });
      }
    } catch (e) {
      console.error("marketing click", e);
    }
    return NextResponse.redirect(target);
  }
  return NextResponse.redirect(new URL("/", request.url));
}
