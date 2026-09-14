import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_SENDS } from "@/lib/marketing/collections";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { verifyMarketingToken } from "@/lib/marketing/tokens";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sendId = verifyMarketingToken(token, "o");
  if (sendId) {
    try {
      const snap = await getAdminDb().collection(MARKETING_SENDS).doc(sendId).get();
      if (snap.exists) {
        const data = snap.data() || {};
        await recordMarketingEvent({
          sendId,
          campaignId: String(data.campaignId || ""),
          contactId: String(data.contactId || ""),
          type: "opened",
          meta: { source: "pixel" },
        });
      }
    } catch (e) {
      console.error("marketing open pixel", e);
    }
  }
  return new NextResponse(GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(GIF.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
