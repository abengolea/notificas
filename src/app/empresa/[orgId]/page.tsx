import { redirect } from "next/navigation";

export default async function EmpresaOrgIndexPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/empresa/${orgId}/dashboard`);
}
