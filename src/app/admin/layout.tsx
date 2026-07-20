import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { NO_INDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = {
  ...NO_INDEX_METADATA,
  title: "Admin",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
