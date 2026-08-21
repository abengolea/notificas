"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Campaign } from "@/lib/types";
import { mapCampaign } from "@/lib/campaign-sync";
import { OrgDashboard, OrgDashboardSkeleton } from "@/components/empresa/org-dashboard";

export default function EmpresaOrgDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "campaigns"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => mapCampaign(d.id, d.data())));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [orgId]);

  if (loading) return <OrgDashboardSkeleton />;

  return <OrgDashboard orgId={orgId} campaigns={items} />;
}
