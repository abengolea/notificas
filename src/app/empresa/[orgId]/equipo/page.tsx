import { OrgEquipoPanel } from "@/components/empresa/org-equipo-panel";

export default async function EmpresaEquipoPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgEquipoPanel orgId={orgId} />;
}
