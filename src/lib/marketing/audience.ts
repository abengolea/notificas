import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CONTACTS, MARKETING_LISTS } from "./collections";
import { isMarketingCountryCode, type MarketingCountryCode } from "./countries";
import { serializeAdminDoc } from "./events";
import {
  contactMatchesSource,
  countryListKey,
  decorateRecipient,
  includeStageSet,
  listNameKey,
  namedRecipientSource,
  normalizeListName,
  parseRecipientSource,
  toRecipientRow,
  virtualCountryListName,
  type RecipientRow,
  type RecipientSource,
} from "./lists";
import type { MarketingList } from "./types";

const SCAN_LIMIT = 5000;

export type AudienceResult = {
  total: number;
  eligible: number;
  skipped: number;
  contacts: RecipientRow[];
};

function countryFromRows(countries: string[]): MarketingCountryCode | "all" {
  const unique = [...new Set(countries.filter(Boolean).map((c) => c.toUpperCase()))];
  if (unique.length === 1 && isMarketingCountryCode(unique[0])) return unique[0];
  return "all";
}

export async function getOrCreateMarketingList(input: {
  name: string;
  country: MarketingCountryCode | "all";
  source: "csv" | "manual";
}): Promise<{ id: string; name: string; country: MarketingCountryCode | "all"; created: boolean }> {
  const name = normalizeListName(input.name);
  if (name.length < 2) {
    throw Object.assign(new Error("Poné un nombre de lista (mínimo 2 caracteres)."), { status: 400 });
  }
  const db = getAdminDb();
  const key = listNameKey(name);
  const existing = await db.collection(MARKETING_LISTS).where("nameKey", "==", key).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    const currentCountry = String(doc.data().country || "all");
    const nextCountry =
      currentCountry !== "all" && input.country !== "all" && currentCountry !== input.country
        ? "all"
        : currentCountry === "all"
          ? input.country
          : currentCountry;
    if (nextCountry !== currentCountry) {
      await doc.ref.update({ country: nextCountry, updatedAt: FieldValue.serverTimestamp() });
    }
    return {
      id: doc.id,
      name: String(doc.data().name || name),
      country: (nextCountry === "all" || isMarketingCountryCode(nextCountry) ? nextCountry : "all") as MarketingCountryCode | "all",
      created: false,
    };
  }
  const ref = db.collection(MARKETING_LISTS).doc();
  await ref.set({
    name,
    nameKey: key,
    country: input.country,
    contactCount: 0,
    source: input.source,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, name, country: input.country, created: true };
}

export async function bumpListCount(listId: string, added: number): Promise<void> {
  if (!listId || added <= 0) return;
  const db = getAdminDb();
  await db.collection(MARKETING_LISTS).doc(listId).update({
    contactCount: FieldValue.increment(added),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function resolveListLabel(listId: string | null | undefined): Promise<{
  listId: string | null;
  listName: string;
  country: MarketingCountryCode | "all";
}> {
  const source = parseRecipientSource(listId);
  if (source.kind === "none") {
    return { listId: null, listName: "", country: "all" };
  }
  if (source.kind === "country") {
    const country = source.country === "all" || isMarketingCountryCode(source.country) ? source.country : "all";
    return {
      listId: countryListKey(country),
      listName: virtualCountryListName(country),
      country: country === "all" || isMarketingCountryCode(country) ? country : "all",
    };
  }
  const db = getAdminDb();
  const snap = await db.collection(MARKETING_LISTS).doc(source.listId).get();
  if (!snap.exists) {
    throw Object.assign(new Error("Esa lista no existe. Cargala en Contactos."), { status: 400 });
  }
  const data = snap.data() || {};
  const countryRaw = String(data.country || "all");
  const country =
    countryRaw.toLowerCase() === "all" || !isMarketingCountryCode(countryRaw) ? "all" : countryRaw;
  return {
    listId: snap.id,
    listName: String(data.name || "Lista"),
    country,
  };
}

export async function loadMarketingAudience(input: {
  source: RecipientSource;
  includeStages?: unknown;
  previewLimit?: number;
}): Promise<AudienceResult> {
  if (input.source.kind === "none") {
    return { total: 0, eligible: 0, skipped: 0, contacts: [] };
  }
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection(MARKETING_CONTACTS);
  if (input.source.kind === "country" && input.source.country !== "all") {
    query = query.where("country", "==", input.source.country);
  }
  if (input.source.kind === "list") {
    query = query.where("listIds", "array-contains", input.source.listId);
  }
  const snap = await query.limit(SCAN_LIMIT).get();
  const include = includeStageSet(input.includeStages);
  const rows = snap.docs
    .map((d) => serializeAdminDoc(d.id, d.data()))
    .filter((c) => contactMatchesSource(c, input.source))
    .map((c) =>
      decorateRecipient(
        toRecipientRow({
          id: String(c.id),
          email: c.email,
          name: c.name,
          company: c.company,
          title: c.title,
          country: c.country,
          stage: c.stage,
          lastSentAt: c.lastSentAt,
          listIds: c.listIds,
        }),
        include,
      ),
    )
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.email.localeCompare(b.email, "es"));

  const eligible = rows.filter((r) => r.eligible).length;
  const previewLimit = Math.min(500, Math.max(1, input.previewLimit ?? 80));
  return {
    total: rows.length,
    eligible,
    skipped: rows.length - eligible,
    contacts: rows.slice(0, previewLimit),
  };
}

export async function loadMarketingListCatalog(): Promise<MarketingList[]> {
  const db = getAdminDb();
  const [listsSnap, contactsSnap] = await Promise.all([
    db.collection(MARKETING_LISTS).limit(200).get(),
    db.collection(MARKETING_CONTACTS).limit(SCAN_LIMIT).get(),
  ]);

  const namedCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  let all = 0;
  for (const doc of contactsSnap.docs) {
    const data = doc.data();
    all += 1;
    const country = String(data.country || "").toUpperCase();
    if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    const ids = Array.isArray(data.listIds) ? data.listIds.map(String) : [];
    for (const id of ids) namedCounts.set(id, (namedCounts.get(id) || 0) + 1);
  }

  const named: MarketingList[] = listsSnap.docs
    .map((d) => {
      const data = d.data();
      const countryRaw = String(data.country || "all");
      const country =
        countryRaw.toLowerCase() === "all" || !isMarketingCountryCode(countryRaw) ? "all" : countryRaw;
      return {
        id: d.id,
        name: String(data.name || "Lista"),
        country,
        contactCount: namedCounts.get(d.id) || 0,
        source: data.source === "manual" ? "manual" : "csv",
        virtual: false,
      } satisfies MarketingList;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const virtual: MarketingList[] = [];
  if (all > 0) {
    virtual.push({
      id: countryListKey("all"),
      name: virtualCountryListName("all"),
      country: "all",
      contactCount: all,
      source: "manual",
      virtual: true,
    });
  }
  for (const [code, count] of [...countryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!isMarketingCountryCode(code) || count === 0) continue;
    virtual.push({
      id: countryListKey(code),
      name: virtualCountryListName(code),
      country: code,
      contactCount: count,
      source: "manual",
      virtual: true,
    });
  }

  return [...named, ...virtual];
}

export async function audienceForCampaign(camp: {
  listId?: unknown;
  includeStages?: unknown;
}): Promise<AudienceResult> {
  return loadMarketingAudience({
    source: namedRecipientSource(camp),
    includeStages: camp.includeStages,
  });
}

export { countryFromRows };
