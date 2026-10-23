import { NextRequest, NextResponse } from "next/server";
import { retryAdminInvoice } from "@/lib/admin-invoices-server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { tryBuildInvoicePdfFromTransaction } from "@/lib/invoice-from-transaction";

type RouteContext = {
  params: Promise<{ transactionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const { transactionId } = await context.params;
  if (!transactionId || transactionId.includes("/")) {
    return NextResponse.json({ error: "Transacción inválida" }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection("user_transactions").doc(transactionId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const built = tryBuildInvoicePdfFromTransaction(snap.data() as Record<string, unknown>);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  return new NextResponse(new Uint8Array(built.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${built.filename}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const { transactionId } = await context.params;
  try {
    const result = await retryAdminInvoice(transactionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/admin/invoices/[transactionId]", e);
    return NextResponse.json({ error: "No se pudo reintentar la factura" }, { status: 500 });
  }
}
