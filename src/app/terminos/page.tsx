import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing-header';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structured-data';

export const metadata: Metadata = createPageMetadata({
  title: 'Términos y Condiciones',
  description:
    'Términos y condiciones del servicio de notificaciones fehacientes digitales de Notificas SRL.',
  path: '/terminos',
});

export default function TerminosPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Términos y Condiciones', path: '/terminos' },
        ])}
      />
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: junio de 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Identificación del prestador</h2>
            <p>
              El presente servicio es prestado por <strong>Notificas SRL</strong>, CUIT 33-71729868-9,
              con domicilio en Colón 12, primer piso, San Nicolás de los Arroyos, provincia de Buenos Aires,
              Argentina. Correo electrónico de contacto: <a href="mailto:contacto@notificas.com" className="text-primary underline">contacto@notificas.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Objeto del servicio</h2>
            <p>
              Notificas.com es una plataforma de notificaciones fehacientes digitales que permite a sus
              usuarios enviar comunicaciones electrónicas con trazabilidad certificada. El envío, contenido,
              recepción y lectura de cada mensaje se registra de forma inmutable en la red Polygon (blockchain
              pública y descentralizada), generando constancias con valor probatorio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Registro y cuenta de usuario</h2>
            <p>
              El acceso al servicio requiere la creación de una cuenta personal. El usuario es responsable
              de mantener la confidencialidad de sus credenciales y de todas las actividades realizadas
              desde su cuenta. Notificas SRL no será responsable por los daños derivados del uso no
              autorizado de la cuenta por parte de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Créditos y modalidad de pago</h2>
            <p>
              El servicio opera mediante un sistema de créditos prepagos. Cada envío de notificación
              consume créditos según el plan vigente. Los precios y condiciones de cada plan se informan
              al momento de la contratación y pueden actualizarse con aviso previo al usuario.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Uso permitido y prohibiciones</h2>
            <p className="mb-2">El usuario se compromete a utilizar el servicio exclusivamente para comunicaciones lícitas. Queda prohibido:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Enviar comunicaciones con fines de spam, fraude o engaño.</li>
              <li>Suplantar la identidad de terceros.</li>
              <li>Usar el servicio en violación de normativa vigente.</li>
              <li>Intentar vulnerar la seguridad o integridad de la plataforma.</li>
            </ul>
            <p className="mt-2">
              El incumplimiento podrá dar lugar a la suspensión inmediata de la cuenta sin derecho a
              reembolso de créditos no utilizados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Valor probatorio</h2>
            <p>
              Los certificados emitidos por Notificas.com constituyen constancias técnicas digitales.
              Su eficacia probatoria en sede administrativa o judicial depende del caso concreto y de la
              normativa aplicable. Notificas SRL no garantiza un resultado determinado en ningún
              procedimiento legal. Se recomienda contar con asesoramiento profesional habilitado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Conservación de datos</h2>
            <p>
              La documentación asociada a las comunicaciones se conserva por un período no inferior a
              cinco (5) años desde la fecha de envío, salvo disposición legal que exija un plazo mayor.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Limitación de responsabilidad</h2>
            <p>
              Notificas SRL no será responsable por interrupciones del servicio ajenas a su control
              (fallas de red, problemas con proveedores de correo electrónico, congestión de la blockchain,
              fuerza mayor). La responsabilidad máxima frente al usuario se limita al importe de los
              créditos no utilizados al momento del evento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Modificaciones</h2>
            <p>
              Notificas SRL se reserva el derecho de modificar los presentes términos con aviso previo
              de al menos diez (10) días hábiles a través del correo electrónico registrado por el usuario.
              El uso continuado del servicio tras la notificación implica la aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Ley aplicable y jurisdicción</h2>
            <p>
              Los presentes términos se rigen por la ley argentina. Ante cualquier controversia, las partes
              se someten a la jurisdicción de los tribunales ordinarios de la ciudad de San Nicolás de los
              Arroyos, provincia de Buenos Aires, con renuncia a cualquier otro fuero que pudiere
              corresponderles.
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
