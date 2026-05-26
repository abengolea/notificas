import Link from 'next/link';
import { LandingHeader } from '@/components/landing-header';

export const metadata = {
  title: 'Defensa del Consumidor — Notificas',
};

export default function ConsumidoresPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Defensa del Consumidor</h1>
        <p className="text-sm text-muted-foreground mb-10">Información conforme a la Ley 24.240 y modificatorias</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">

          <section>
            <h2 className="text-lg font-semibold mb-2">Prestador del servicio</h2>
            <ul className="space-y-1">
              <li><strong>Razón social:</strong> Notificas SRL</li>
              <li><strong>CUIT:</strong> 33-71729868-9</li>
              <li><strong>Domicilio:</strong> Colón 12, primer piso, San Nicolás de los Arroyos, Buenos Aires, Argentina</li>
              <li><strong>Correo electrónico:</strong> <a href="mailto:contacto@notificas.com" className="text-primary underline">contacto@notificas.com</a></li>
              <li><strong>Teléfono:</strong> +54 9 336 464-5357</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">¿Tenés un reclamo?</h2>
            <p className="mb-3">
              Podés contactarnos directamente por correo electrónico a{' '}
              <a href="mailto:contacto@notificas.com" className="text-primary underline">contacto@notificas.com</a>.
              Nos comprometemos a responder en un plazo de <strong>5 días hábiles</strong>.
            </p>
            <p>
              Si no obtenés respuesta satisfactoria, podés presentar tu reclamo ante la
              <strong> Dirección Nacional de Defensa del Consumidor</strong>:
            </p>
            <div className="mt-3 p-4 bg-muted/40 rounded-lg border">
              <a
                href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline font-medium"
              >
                → Formulario de reclamo oficial (argentina.gob.ar)
              </a>
              <p className="text-muted-foreground mt-1 text-xs">
                Sistema Nacional de Arbitraje de Consumo — SERNAC
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Información del servicio contratado</h2>
            <p>
              Notificas.com es un servicio de notificaciones fehacientes digitales. El usuario adquiere
              créditos prepagos para el envío de comunicaciones certificadas. Las características, precios
              y condiciones de cada plan se informan de manera clara antes de la contratación.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Derecho de arrepentimiento</h2>
            <p>
              Conforme al artículo 34 de la Ley 24.240, el consumidor tiene derecho a revocar la
              aceptación del servicio dentro de los <strong>diez (10) días hábiles</strong> contados
              desde la contratación, siempre que <strong>no haya hecho uso de los envíos adquiridos</strong>.
            </p>
            <p className="mt-2">
              Una vez utilizados uno o más créditos de envío, el derecho de arrepentimiento no aplica
              sobre los créditos consumidos, dado que el servicio fue efectivamente prestado.
            </p>
            <p className="mt-2">
              Para ejercer este derecho, remitir un correo a{' '}
              <a href="mailto:contacto@notificas.com" className="text-primary underline">contacto@notificas.com</a>{' '}
              con asunto "Derecho de arrepentimiento" indicando nombre completo, CUIL/DNI y fecha de contratación.
              El reembolso se procesará dentro de los plazos legales.
            </p>
            <p className="mt-2">
              <Link href="/arrepentimiento" className="text-primary underline">
                Ver información detallada sobre el derecho de arrepentimiento →
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Normativa aplicable</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Ley 24.240 de Defensa del Consumidor y sus modificatorias</li>
              <li>Ley 25.065 (tarjetas de crédito, en lo aplicable)</li>
              <li>Resoluciones de la Secretaría de Comercio Interior</li>
            </ul>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">← Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}
