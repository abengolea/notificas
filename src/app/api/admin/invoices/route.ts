import { NextRequest, NextResponse } from "next/server";
import { ADMIN_INVOICE_STATUSES } from "@/lib/admin-invoice-status";
import { listAdminInvoices } from "@/lib/admin-invoices-server";
import { assertAdminSession } from "@/lib/assert-admin-session";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const statusParam = request.nextUrl.searchParams.get("status")?.trim();
  const status =
    statusParam && (ADMIN_INVOICE_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof ADMIN_INVOICE_STATUSES)[number])
      : "all";
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    const payload = await listAdminInvoices({ status, q });
    return NextResponse.json(payload);
  } catch (e) {
    console.error("GET /api/admin/invoices", e);
    return NextResponse.json({ error: "No se pudieron cargar las facturas" }, { status: 500 });
  }
}
