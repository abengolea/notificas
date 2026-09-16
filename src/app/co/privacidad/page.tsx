import type { Metadata } from "next";

import { ColombiaLegalShell } from "@/components/co/colombia-legal-shell";
import { ColombiaPrivacyContent } from "@/components/co/colombia-privacy-content";
import {
  COLOMBIA_LEGAL_UPDATED_LABEL,
  COLOMBIA_PATH,
  COLOMBIA_PRIVACY_PATH,
  colombiaPageMetadata,
} from "@/lib/colombia-site";

export const metadata: Metadata = colombiaPageMetadata({
  title: "Política de Tratamiento de Datos Personales | Notificas Colombia",
  description:
    "Política de tratamiento y protección de datos personales de NOTIFICAS S.R.L., sociedad argentina, para el servicio dirigido a organizaciones en Colombia.",
  path: COLOMBIA_PRIVACY_PATH,
});

export default function ColombiaPrivacyPage() {
  return (
    <ColombiaLegalShell
      title="Política de Tratamiento y Protección de Datos Personales"
      updated={`Última actualización: ${COLOMBIA_LEGAL_UPDATED_LABEL}`}
      crumbs={[
        { name: "Notificas Colombia", path: COLOMBIA_PATH },
        { name: "Privacidad", path: COLOMBIA_PRIVACY_PATH },
      ]}
    >
      <ColombiaPrivacyContent />
    </ColombiaLegalShell>
  );
}
