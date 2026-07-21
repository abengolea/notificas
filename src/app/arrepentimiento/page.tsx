import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing-header';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structured-data';

export const metadata: Metadata = createPageMetadata({
  title: 'Derecho de Arrepentimiento',
  description:
    'Ejercé el derecho de arrepentimiento (Art. 34, Ley 24.240) sobre planes contratados en Notificas dentro de los 10 días hábiles.',
  path: '/arrepentimiento',
});

export default function ArrepentimientoPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Derecho de Arrepentimiento', path: '/arrepentimiento' },
        ])}
      />
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Derecho de Arrepentimiento</h1>
        <p className="text-sm text-muted-foreground mb-10">Art. 34, Ley 24.240 de Defensa del Consumidor</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">

          <section className="p-4 bg-muted/40 rounded-lg border">
            <p className="font-medium">
              Si contrataste un plan y no utilizaste ningún crédito de envío, podés revocar la
              contratación dentro de los <strong>10 días hábiles</strong> desde la fecha de compra,
              sin necesidad de expresar causa y sin cargo alguno.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">¿Cuándo aplica?</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Aplica:</strong> cuando adquiriste créditos pero no enviaste ninguna
                notificación y estás dentro del plazo de 10 días hábiles desde la contratación.
              </li>
              <li>
                <strong>No aplica:</strong> cuando ya utilizaste uno o más créditos de envío,
                dado que el servicio fue efectivamente prestado (Art. 34, párrafo 2°, Ley 24.240).
              </li>
              <li>
                <strong>No aplica:</strong> cuando transcurrieron más de 10 días hábiles desde
                la contratación.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">¿Cómo ejercerlo?</h2>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                Enviá un correo a{' '}
                <a href="mailto:contacto@notificas.com" className="text-primary underline">
                  contacto@notificas.com
                </a>{' '}
                con asunto: <strong>"Derecho de arrepentimiento"</strong>.
              </li>
              <li>
                Incluí en el cuerpo del correo:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Nombre y apellido completo</li>
                  <li>DNI o CUIL</li>
                  <li>Correo electrónico con el que te registraste</li>
                  <li>Fecha de contratación</li>
                  <li>Declaración de voluntad de revocar la contratación</li>
                </ul>
              </li>
              <li>
                Recibirás confirmación dentro de las <strong>48 horas hábiles</strong>.
                El reembolso se acreditará según el medio de pago utilizado en los plazos
                que correspondan al procesador de pagos.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Base legal</h2>
            <p>
              El derecho de revocación en contratos celebrados a distancia (incluyendo contrataciones
              por internet) está regulado por el{' '}
              <strong>artículo 34 de la Ley 24.240</strong> (Defensa del Consumidor) y sus
              modificatorias, particularmente la Ley 26.361.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Más información</h2>
            <p>
              Ante cualquier consulta adicional podés comunicarte con nosotros por correo a{' '}
              <a href="mailto:contacto@notificas.com" className="text-primary underline">contacto@notificas.com</a>{' '}
              o consultar la página de{' '}
              <Link href="/consumidores" className="text-primary underline">
                Defensa del Consumidor
              </Link>.
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
