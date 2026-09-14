"use client";

import { useParams } from "next/navigation";
import { MarketingContactDetail } from "@/components/admin/marketing/marketing-contact-detail";

export default function AdminMarketingContactoPage() {
  const params = useParams();
  const contactId = typeof params.contactId === "string" ? params.contactId : "";
  if (!contactId) return null;
  return <MarketingContactDetail contactId={contactId} />;
}
