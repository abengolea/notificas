import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing-header';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structured-data';

export const metadata: Metadata = createPageMetadata({
  title: 'Términos y Condiciones',
  description:
    'Términos y condiciones del servicio de notificaciones fehacientes digitales de Notificas SRL, incluyendo notificaciones individuales y servicios corporativos de alto volumen.',
  path: '/terminos',
});

export default function TerminosPage() {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Términos y Condiciones', path: '/terminos' },
        ])}
      />
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: agosto de 2026</p>

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
            <p className="mt-2">
              Asimismo, Notificas podrá prestar a empresas y organizaciones servicios de procesamiento,
              envío, registro y certificación tecnológica de notificaciones digitales de alto volumen
              mediante WhatsApp y Email, conforme a las condiciones particulares que se establezcan en
              cada propuesta comercial.
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
            <h2 className="text-lg font-semibold mb-2">4. Modalidades de contratación</h2>
            <p>
              Los servicios de Notificas podrán contratarse mediante créditos prepagos, planes, suscripciones
              o propuestas comerciales específicas.
            </p>
            <p className="mt-2">
              Cada envío de notificación individual consume créditos según el plan vigente. Los precios y
              condiciones de cada plan se informan al momento de la contratación y pueden actualizarse con
              aviso previo al usuario.
            </p>
            <p className="mt-2">
              Para empresas, organizaciones, campañas de alto volumen, integraciones o servicios que requieran
              configuraciones especiales, Notificas podrá establecer condiciones particulares previa cotización.
            </p>
            <p className="mt-2">
              En estos casos, el presupuesto, propuesta comercial u orden de servicio aceptada determinará,
              según corresponda, el volumen contratado, los canales utilizados, precio, modalidad de facturación,
              vigencia, condiciones de ejecución y demás características particulares del servicio.
            </p>
            <p className="mt-2">
              Cuando el servicio utilice WhatsApp Business Platform, los cargos establecidos por Meta podrán
              encontrarse incluidos en el precio o ser trasladados separadamente al cliente, conforme se indique
              en la propuesta comercial.
            </p>
            <p className="mt-2">
              Cuando el servicio utilice Email, las condiciones y costos aplicables se determinarán en la
              correspondiente propuesta comercial.
            </p>
            <p className="mt-2">
              Las tarifas, políticas y condiciones establecidas por Meta podrán modificarse sin intervención
              de Notificas. Cuando dichas modificaciones produzcan una variación en los costos del servicio,
              Notificas podrá trasladar dicha variación al cliente.
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
              El cliente será responsable del contenido de las comunicaciones enviadas mediante Notificas y
              deberá abstenerse de utilizar el servicio para comunicaciones ilícitas, fraudulentas, engañosas,
              abusivas o contrarias a las políticas de WhatsApp cuando corresponda.
            </p>
            <p className="mt-2">
              El incumplimiento podrá dar lugar a la suspensión inmediata de la cuenta sin derecho a
              reembolso de créditos no utilizados, y, en los servicios corporativos, a la suspensión o
              cese de la campaña conforme a la propuesta comercial aplicable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Servicios corporativos y campañas de alto volumen</h2>
            <p>
              Notificas podrá brindar a empresas y organizaciones servicios especiales de procesamiento y
              envío de notificaciones digitales mediante WhatsApp y Email, incluyendo personalización de
              comunicaciones, procesamiento de bases de destinatarios, seguimiento de estados, trazabilidad,
              certificación tecnológica mediante blockchain, generación de constancias y elaboración de reportes.
            </p>
            <p className="mt-2">
              Las campañas podrán ejecutarse progresivamente, por lotes o conforme al cronograma acordado
              con el cliente.
            </p>
            <p className="mt-2">
              En los servicios prestados mediante WhatsApp, la disponibilidad, velocidad y volumen de
              procesamiento estarán sujetos a las políticas, límites, condiciones técnicas y capacidades
              establecidas por Meta para WhatsApp Business Platform, incluyendo los límites de capacidad
              habilitados por Meta.
            </p>
            <p className="mt-2">
              La aprobación de plantillas, clasificación de mensajes, límites de envío, calidad de la cuenta
              y demás decisiones propias de WhatsApp Business Platform dependen exclusivamente de Meta.
            </p>
            <p className="mt-2">
              Notificas no garantiza que Meta apruebe determinado contenido, plantilla, categoría tarifaria
              o incremento de capacidad.
            </p>
            <p className="mt-2">
              Las características particulares de cada campaña serán establecidas en la propuesta comercial
              o presupuesto correspondiente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Bases de destinatarios y contenido</h2>
            <p>
              Cuando el cliente proporcione bases de datos, números telefónicos, direcciones de correo
              electrónico u otros datos de destinatarios para la ejecución de una campaña, declara y garantiza
              que cuenta con facultades suficientes y con la base jurídica, autorizaciones o consentimientos
              que resulten exigibles para su tratamiento y para la comunicación solicitada mediante WhatsApp
              o Email.
            </p>
            <p className="mt-2">
              El cliente será responsable por la legitimidad, procedencia, exactitud y actualización de las
              bases proporcionadas, así como por la finalidad y contenido de las comunicaciones cuya remisión
              encomiende a Notificas.
            </p>
            <p className="mt-2">
              Notificas procesará dichos datos exclusivamente para la prestación del servicio contratado y
              conforme a las instrucciones del cliente.
            </p>
            <p className="mt-2">
              El cliente deberá cumplir asimismo las políticas aplicables de WhatsApp Business Platform cuando
              el canal utilizado sea WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Entrega, lectura y estados</h2>
            <p>
              Notificas registra los estados que los servicios utilizados ponen técnicamente a disposición.
            </p>
            <p className="mt-2">
              En WhatsApp podrán existir, según corresponda, estados tales como procesado, enviado, entregado,
              leído o fallido.
            </p>
            <p className="mt-2">
              En Email podrán registrarse los eventos técnicamente disponibles para cada comunicación,
              incluyendo, según corresponda, el envío, el acceso al contenido a través de la plataforma,
              el error y las marcas de tiempo asociadas.
            </p>
            <p className="mt-2">
              La existencia de un registro de envío o entrega no implica necesariamente que el destinatario
              haya tomado efectivo conocimiento del contenido de la comunicación.
            </p>
            <p className="mt-2">
              Notificas no garantiza la entrega o lectura cuando ello dependa de circunstancias ajenas a su
              control, incluyendo números inexistentes, cuentas sin WhatsApp, bloqueos del destinatario,
              direcciones de correo electrónico inválidas, filtros de correo, restricciones de Meta o
              cualquier otra circunstancia atribuible al destinatario o al canal utilizado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Valor probatorio</h2>
            <p>
              Los certificados emitidos por Notificas.com constituyen constancias técnicas digitales.
              Su eficacia probatoria en sede administrativa o judicial depende del caso concreto y de la
              normativa aplicable. Notificas SRL no garantiza un resultado determinado en ningún
              procedimiento legal. Se recomienda contar con asesoramiento profesional habilitado.
            </p>
            <p className="mt-2">
              La certificación tecnológica mediante blockchain aporta trazabilidad, registro de evidencia
              e integridad verificable de los hashes criptográficos correspondientes. No implica, por sí
              sola, que el destinatario haya tomado efectivo conocimiento de la comunicación, ni sustituye
              de manera automática las formas legales que la normativa exija en cada caso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Conservación de datos</h2>
            <p>
              La documentación asociada a las comunicaciones se conserva por un período no inferior a
              cinco (5) años desde la fecha de envío, salvo disposición legal que exija un plazo mayor.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Limitación de responsabilidad</h2>
            <p>
              Notificas SRL no será responsable por interrupciones del servicio ajenas a su control
              (fallas de red, problemas con los servicios de Email utilizados, restricciones o
              indisponibilidad de WhatsApp Business Platform establecidas por Meta, congestión de la
              blockchain, fuerza mayor). La responsabilidad máxima frente al usuario se limita al importe
              de los créditos no utilizados al momento del evento. En los servicios corporativos, la
              responsabilidad máxima se determina conforme a la propuesta comercial correspondiente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Modificaciones</h2>
            <p>
              Notificas SRL se reserva el derecho de modificar los presentes términos con aviso previo
              de al menos diez (10) días hábiles a través del correo electrónico registrado por el usuario.
              El uso continuado del servicio tras la notificación implica la aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">13. Ley aplicable y jurisdicción</h2>
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
