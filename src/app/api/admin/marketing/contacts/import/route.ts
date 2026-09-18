import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { bumpListCount, countryFromRows, getOrCreateMarketingList } from "@/lib/marketing/audience";
import { MARKETING_CONTACTS, MARKETING_LISTS } from "@/lib/marketing/collections";
import { contactIdForEmail, parseContactCsv } from "@/lib/marketing/csv";
import { MarketingError } from "@/lib/marketing/errors";
import { lookupStampedCompanyId, parseImportTaxonomy, stampImportedCompanies } from "@/lib/marketing/taxonomy/assign";
import { loadCampaignCatalog } from "@/lib/marketing/campaign-segment";

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const contentType = request.headers.get("content-type") || "";
    let text = "";
    let listName = "";
    let industryId = "";
    let useCaseIds: string[] = [];
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file instanceof File) text = await file.text();
      else text = String(form.get("csv") || "");
      listName = String(form.get("listName") || "");
      industryId = String(form.get("industryId") || "");
      useCaseIds = form.getAll("useCaseId").map(String).concat(String(form.get("useCaseIds") || "").split(","));
    } else {
      const body = (await request.json().catch(() => ({}))) as {
        csv?: string;
        listName?: string;
        industryId?: string;
        useCaseId?: string;
        useCaseIds?: string[];
      };
      text = String(body.csv || "");
      listName = String(body.listName || "");
      industryId = String(body.industryId || "");
      useCaseIds = [...(body.useCaseIds || []), body.useCaseId || ""];
    }
    const parsed = parseContactCsv(text);
    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "No hay filas válidas", errors: parsed.errors, skipped: parsed.skipped },
        { status: 400 },
      );
    }

    const catalog = await loadCampaignCatalog();
    const taxonomy = parseImportTaxonomy({ industryId, useCaseIds }, catalog);
    const stamped = taxonomy
      ? await stampImportedCompanies({
          items: parsed.rows.map((row) => ({ name: row.company, countryCode: row.country })),
          taxonomy,
        })
      : new Map<string, string>();

    const list = await getOrCreateMarketingList({
      name: listName,
      country: countryFromRows(parsed.rows.map((r) => r.country)),
      source: "csv",
    });
    if (taxonomy) {
      await getAdminDb().collection(MARKETING_LISTS).doc(list.id).update({
        industryId: taxonomy.industryId,
        useCaseId: taxonomy.useCaseIds[0] || null,
        useCaseIds: taxonomy.useCaseIds,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const db = getAdminDb();
    let created = 0;
    let updated = 0;
    let addedToList = 0;
    let batch = db.batch();
    let ops = 0;
    const flush = async () => {
      if (!ops) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };

    for (const row of parsed.rows) {
      const id = contactIdForEmail(row.email);
      const ref = db.collection(MARKETING_CONTACTS).doc(id);
      const existing = await ref.get();
      const alreadyInList =
        existing.exists &&
        Array.isArray(existing.data()?.listIds) &&
        existing.data()!.listIds.map(String).includes(list.id);
      const companyId = lookupStampedCompanyId(stamped, row.company, row.country);
      const base = {
        email: row.email,
        emailKey: row.email,
        name: row.name,
        company: row.company,
        title: row.title,
        country: row.country,
        notes: row.notes,
        updatedAt: FieldValue.serverTimestamp(),
        ...(companyId ? { companyId } : {}),
        ...(taxonomy ? { useCaseIds: taxonomy.useCaseIds } : {}),
      };
      if (existing.exists) {
        batch.set(
          ref,
          {
            ...base,
            listIds: FieldValue.arrayUnion(list.id),
          },
          { merge: true },
        );
        updated += 1;
      } else {
        batch.set(ref, {
          ...base,
          stage: "new",
          stageManual: false,
          source: "csv",
          tags: [],
          listIds: [list.id],
          lastCampaignId: null,
          lastSendId: null,
          lastSentAt: null,
          lastOpenedAt: null,
          lastClickedAt: null,
          lastRepliedAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
        created += 1;
      }
      if (!alreadyInList) addedToList += 1;
      ops += 1;
      if (ops >= 400) await flush();
    }
    await flush();
    await bumpListCount(list.id, addedToList);

    return NextResponse.json({
      ok: true,
      listId: list.id,
      listName: list.name,
      created,
      updated,
      addedToList,
      skipped: parsed.skipped,
      errors: parsed.errors.slice(0, 40),
      errorCount: parsed.errors.length,
      industryId: taxonomy?.industryId || null,
      useCaseId: taxonomy?.useCaseIds[0] || null,
      useCaseIds: taxonomy?.useCaseIds || [],
    });
  } catch (e) {
    const status =
      e instanceof MarketingError && e.code === "validation"
        ? 400
        : typeof (e as { status?: number }).status === "number"
          ? (e as { status: number }).status
          : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("POST marketing import", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
