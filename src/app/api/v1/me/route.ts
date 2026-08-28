import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse } from "@/lib/public-api/handler";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function GET(request: NextRequest) {
  return handlePublicApi(request, { scope: "notifications:read", rateBucket: "general" }, async (ctx) => {
    return NextResponse.json({
      account: {
        id: ctx.orgId,
        name: ctx.orgName,
        environment: ctx.environment,
        test_mode: ctx.testMode,
        scopes: ctx.scopes,
      },
    });
  });
}
