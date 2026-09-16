import {
  COLOMBIA_LEGAL_ADDRESS,
  COLOMBIA_LEGAL_SITE,
} from "@/lib/colombia-site";
import { SITE_CONTACT } from "@/lib/seo";

export function ColombiaMailLink({ className = "text-primary underline" }: { className?: string }) {
  return (
    <a href={`mailto:${SITE_CONTACT.email}`} className={className}>
      {SITE_CONTACT.email}
    </a>
  );
}

export function ColombiaLegalIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <p>
        El servicio es prestado por <strong>NOTIFICAS S.R.L.</strong>, sociedad constituida
        conforme las leyes de la República Argentina, CUIT {SITE_CONTACT.cuit}, con domicilio en{" "}
        {COLOMBIA_LEGAL_ADDRESS}.
      </p>
      <p>
        Los datos de la empresa son los mismos que en Argentina. No existe una sociedad
        colombiana de Notificas. El servicio dirigido a organizaciones en Colombia se presta
        desde la República Argentina.
      </p>
      {compact ? (
        <p>
          Contacto: <ColombiaMailLink />. Sitio web:{" "}
          <a href={COLOMBIA_LEGAL_SITE} className="text-primary underline">
            {COLOMBIA_LEGAL_SITE}
          </a>
          .
        </p>
      ) : (
        <ul className="space-y-1">
          <li>
            <strong>Correo electrónico:</strong> <ColombiaMailLink />
          </li>
          <li>
            <strong>Sitio web:</strong>{" "}
            <a href={COLOMBIA_LEGAL_SITE} className="text-primary underline">
              {COLOMBIA_LEGAL_SITE}
            </a>
          </li>
          <li>
            <strong>Domicilio:</strong> {COLOMBIA_LEGAL_ADDRESS}
          </li>
        </ul>
      )}
    </>
  );
}
