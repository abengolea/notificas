"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { listenWhenSignedIn } from "@/lib/listen-when-signed-in";
import type { Campaign } from "@/lib/types";
import { mapCampaign } from "@/lib/campaign-sync";
import { OrgDashboard, OrgDashboardSkeleton } from "@/components/empresa/org-dashboard";
import {
  isCampaignMailDoc,
  mailBelongsToOrg,
  mapMailToIndividualSend,
  type IndividualSendSummary,
} from "@/lib/empresa-individual-stats";

export default function EmpresaOrgDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [items, setItems] = useState<Campaign[]>([]);
  const [individualSends, setIndividualSends] = useState<IndividualSendSummary[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingIndividuals, setLoadingIndividuals] = useState(true);

  useEffect(() => {
    return listenWhenSignedIn(
      () => {
        const q = query(
          collection(db, "campaigns"),
          where("orgId", "==", orgId),
          orderBy("createdAt", "desc"),
        );
        return onSnapshot(
          q,
          (snap) => {
            setItems(snap.docs.map((d) => mapCampaign(d.id, d.data())));
            setLoadingCampaigns(false);
          },
          () => setLoadingCampaigns(false),
        );
      },
      () => {
        setItems([]);
        setLoadingCampaigns(false);
      },
    );
  }, [orgId]);

  useEffect(() => {
    return listenWhenSignedIn(
      () => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setIndividualSends([]);
          setLoadingIndividuals(false);
          return () => undefined;
        }
        const q = query(collection(db, "mail"), where("createdBy", "==", uid));
        return onSnapshot(
          q,
          (snap) => {
            const rows = snap.docs
              .map((d) => {
                const data = d.data() as Record<string, unknown>;
                if (isCampaignMailDoc(data) || !mailBelongsToOrg(data, orgId)) return null;
                return mapMailToIndividualSend(d.id, data);
              })
              .filter((row): row is IndividualSendSummary => row !== null);
            setIndividualSends(rows);
            setLoadingIndividuals(false);
          },
          () => {
            setIndividualSends([]);
            setLoadingIndividuals(false);
          },
        );
      },
      () => {
        setIndividualSends([]);
        setLoadingIndividuals(false);
      },
    );
  }, [orgId]);

  if (loadingCampaigns && loadingIndividuals) return <OrgDashboardSkeleton />;

  return <OrgDashboard orgId={orgId} campaigns={items} individualSends={individualSends} />;
}
