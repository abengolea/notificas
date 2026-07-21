import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing-header';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structured-data';

export const metadata: Metadata = createPageMetadata({
  title: 'Política de Privacidad',
  description:
    'Política de privacidad y tratamiento de datos personales de Notificas conforme a la Ley 25.326 de Argentina.',
  path: '/privacidad',
});

export default function PrivacidadPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Política de Privacidad', path: '/privacidad' },
        ])}
      />
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: junio de 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Responsable del tratamiento</h2>
            <p>
              <strong>Notificas SRL</strong>, CUIT 33-71729868-9, con domicilio en Colón 12, primer piso,
              San Nicolás de los Arroyos, Buenos Aires, Argentina.
              Contacto: <a href="mailto:contacto@notificas.com" className="text-primary underline">contacto@notificas.com</a>.
            </p>
            <p className="mt-2">
              El tratamiento de datos personales se realiza conforme a la
              Ley 25.326 de Protección de Datos Personales de la República Argentina.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Datos que recopilamos</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Datos de registro:</strong> nombre, apellido, correo electrónico, contraseña (cifrada).</li>
              <li><strong>Datos de uso:</strong> mensajes enviados, destinatarios, marcas de tiempo, dirección IP de acceso.</li>
              <li><strong>Datos técnicos:</strong> tipo de dispositivo, navegador, registros de apertura y lectura de mensajes.</li>
              <li><strong>Datos de pago:</strong> procesados por el proveedor de pagos; Notificas no almacena datos de tarjetas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Finalidad del tratamiento</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Prestación del servicio de notificaciones certificadas.</li>
              <li>Generación de constancias y certificados con valor probatorio.</li>
              <li>Facturación y gestión de créditos.</li>
              <li>Comunicaciones operativas sobre el servicio (no publicitarias sin consentimiento).</li>
              <li>Cumplimiento de obligaciones legales.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Retención de datos</h2>
            <p>
              Los datos asociados a las comunicaciones certificadas se conservan por un período no inferior
              a <strong>cinco (5) años</strong> desde la fecha del envío, a fin de garantizar la trazabilidad
              y el respaldo probatorio. Los datos de cuenta se conservan mientras la cuenta esté activa y
              durante dos (2) años adicionales tras su cierre.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Compartición de datos</h2>
            <p>
              Notificas SRL no vende ni cede datos personales a terceros con fines comerciales. Los datos
              pueden ser accedidos por proveedores de infraestructura (servidores, correo electrónico,
              blockchain) exclusivamente en la medida necesaria para prestar el servicio, bajo acuerdos
              de confidencialidad. Podemos divulgar datos ante requerimiento de autoridad judicial o
              administrativa competente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Datos en blockchain</h2>
            <p>
              Los hashes criptográficos (no el contenido en texto plano) de los mensajes se registran en la
              red Polygon, que es pública e inmutable por diseño. Una vez registrados, estos hashes no pueden
              eliminarse de la blockchain. No se publica información personal identificable en la red pública.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Derechos del titular</h2>
            <p className="mb-2">
              Conforme a la Ley 25.326, el titular de los datos tiene derecho a:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Acceso:</strong> conocer qué datos personales se tratan.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de datos cuando no exista obligación legal de conservarlos.</li>
              <li><strong>Confidencialidad:</strong> oponerse al tratamiento para fines de marketing.</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, enviar un correo a{' '}
              <a href="mailto:contacto@notificas.com" className="text-primary underline">contacto@notificas.com</a>{' '}
              con asunto "Derechos LPDP" e identificación del titular.
              El plazo de respuesta es de cinco (5) días hábiles.
            </p>
            <p className="mt-2">
              La AAIP es el organismo de control competente:{' '}
              <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                www.argentina.gob.ar/aaip
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Seguridad</h2>
            <p>
              Implementamos medidas técnicas y organizativas para proteger los datos personales frente
              a accesos no autorizados, pérdida o alteración. Las contraseñas se almacenan cifradas y
              nunca en texto plano.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Cookies</h2>
            <p>
              El sitio utiliza cookies estrictamente necesarias para el funcionamiento de la sesión.
              No se utilizan cookies de seguimiento publicitario de terceros.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">← Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}
