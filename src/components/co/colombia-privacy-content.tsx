import Link from "next/link";
import type { ReactNode } from "react";

import { ColombiaLegalIdentity, ColombiaMailLink } from "@/components/co/colombia-legal-identity";
import { COLOMBIA_COOKIES_PATH } from "@/lib/colombia-site";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ColombiaPrivacyContent() {
  return (
    <>
      <Section title="1. Identificación">
        <ColombiaLegalIdentity />
        <p>
          La presente Política tiene por objeto informar las condiciones conforme a las cuales
          NOTIFICAS recolecta, almacena, utiliza, circula, transmite, suprime y, en general,
          realiza tratamiento de datos personales vinculados con su sitio web y sus servicios.
        </p>
        <p>
          NOTIFICAS procura que el tratamiento de datos personales relacionado con usuarios y
          titulares ubicados en Colombia se efectúe de conformidad con la Ley 1581 de 2012, el
          Decreto 1074 de 2015, las instrucciones impartidas por la Superintendencia de Industria
          y Comercio y las demás normas colombianas aplicables.
        </p>
      </Section>

      <Section title="2. Roles de NOTIFICAS en el tratamiento de datos">
        <p>
          La posición jurídica de NOTIFICAS dependerá de la actividad concreta que origine el
          tratamiento.
        </p>
        <h3 className="text-base font-semibold">2.1. NOTIFICAS como Responsable del Tratamiento</h3>
        <p>
          NOTIFICAS podrá actuar como Responsable respecto de los datos que recolecte
          directamente para finalidades propias, entre otros, respecto de:
        </p>
        <BulletList
          items={[
            "visitantes del sitio web;",
            "personas que soliciten información o demostraciones;",
            "potenciales clientes;",
            "representantes, empleados o contactos de clientes;",
            "usuarios registrados en la plataforma;",
            "proveedores y aliados comerciales;",
            "personas que se comuniquen directamente con NOTIFICAS.",
          ]}
        />
        <p>
          En estos casos, NOTIFICAS determina las finalidades propias para las cuales los datos
          serán tratados.
        </p>
        <h3 className="text-base font-semibold">2.2. NOTIFICAS como Encargado del Tratamiento</h3>
        <p>
          Cuando una empresa, entidad, profesional u organización cliente utiliza NOTIFICAS para
          realizar comunicaciones a terceros,{" "}
          <strong>
            el cliente determina la finalidad de la comunicación, los destinatarios, los datos
            utilizados, el contenido, la causa y los canales correspondientes
          </strong>
          .
        </p>
        <p>
          En tales supuestos, el cliente reviste la calidad de{" "}
          <strong>Responsable del Tratamiento</strong> y NOTIFICAS actúa, en principio, como{" "}
          <strong>Encargado del Tratamiento</strong>, procesando los datos exclusivamente por
          cuenta y siguiendo las instrucciones documentadas de dicho cliente.
        </p>
        <p>NOTIFICAS no determina:</p>
        <BulletList
          items={[
            "la existencia o legitimidad de una deuda u obligación;",
            "quién debe recibir determinada comunicación;",
            "la procedencia de un reporte crediticio;",
            "la exactitud jurídica del contenido comunicado;",
            "la existencia de autorización para efectuar una determinada gestión de cobranza;",
            "la base jurídica que habilita al cliente para tratar los datos personales del destinatario.",
          ]}
        />
        <p>Estas cuestiones corresponden al cliente en su condición de Responsable del Tratamiento.</p>
      </Section>

      <Section title="3. Datos personales que podemos tratar">
        <p>
          Dependiendo del vínculo existente con NOTIFICAS y de las características del servicio
          utilizado, podrán tratarse las siguientes categorías de información:
        </p>
        <p>
          <strong>Datos identificatorios.</strong> Nombre, apellido, tipo y número de documento,
          empresa, cargo u otra información necesaria para identificar a una persona.
        </p>
        <p>
          <strong>Datos de contacto.</strong> Dirección de correo electrónico, número telefónico,
          número de WhatsApp y demás canales de contacto.
        </p>
        <p>
          <strong>Datos de usuarios de la plataforma.</strong> Nombre de usuario, empresa a la
          cual pertenece, perfil, permisos, historial de acceso y acciones realizadas dentro del
          sistema.
        </p>
        <p>
          <strong>Datos técnicos.</strong> Dirección IP, fecha y hora, tipo de dispositivo,
          navegador, identificadores técnicos, registros de acceso, eventos de seguridad y demás
          información necesaria para garantizar el funcionamiento, seguridad y trazabilidad del
          servicio.
        </p>
        <p>
          <strong>Datos vinculados con comunicaciones.</strong> Cuando NOTIFICAS actúe como
          Encargado, podrá procesar los datos que el cliente incorpore a una comunicación, tales
          como nombre del destinatario, medio de contacto, referencia contractual, información
          vinculada con una obligación y contenido de la comunicación.
        </p>
        <p>
          NOTIFICAS recomienda a sus clientes limitar la información incorporada a aquella
          estrictamente necesaria para cumplir la finalidad de la comunicación.
        </p>
      </Section>

      <Section title="4. Finalidades del tratamiento cuando NOTIFICAS actúa como Responsable">
        <p>Los datos recolectados directamente por NOTIFICAS podrán utilizarse para:</p>
        <BulletList
          items={[
            "responder consultas;",
            "suministrar información comercial solicitada;",
            "realizar demostraciones del servicio;",
            "crear y administrar cuentas;",
            "autenticar usuarios;",
            "celebrar y ejecutar relaciones contractuales;",
            "facturar servicios;",
            "brindar soporte técnico;",
            "gestionar comunicaciones con clientes;",
            "gestionar proveedores y aliados;",
            "prevenir fraude y accesos no autorizados;",
            "mantener la seguridad de la plataforma;",
            "generar registros de auditoría;",
            "mejorar el funcionamiento técnico del servicio;",
            "cumplir obligaciones legales, regulatorias, administrativas y judiciales;",
            "atender consultas, reclamos y solicitudes relacionadas con protección de datos;",
            "realizar comunicaciones comerciales cuando exista una base jurídica que lo permita.",
          ]}
        />
        <p>
          Los datos no serán utilizados para finalidades incompatibles con aquellas informadas al
          titular.
        </p>
      </Section>

      <Section title="5. Tratamientos realizados por cuenta de clientes">
        <p>
          Cuando NOTIFICAS actúe como Encargado, el tratamiento tendrá exclusivamente las
          finalidades instruidas por el cliente.
        </p>
        <p>Entre ellas podrán encontrarse:</p>
        <BulletList
          items={[
            "generación de comunicaciones digitales;",
            "envío mediante correo electrónico o WhatsApp;",
            "seguimiento técnico del envío;",
            "registro de eventos de aceptación, entrega y, cuando técnicamente se encuentre disponible, lectura;",
            "generación de evidencia digital;",
            "generación de documentos PDF;",
            "conservación de registros relacionados con la comunicación;",
            "generación y verificación de valores hash destinados a acreditar integridad;",
            "elaboración de reportes operativos;",
            "prestación de soporte relacionado con dichas comunicaciones.",
          ]}
        />
        <p>
          NOTIFICAS no utilizará estos datos para comercializarlos, crear bases propias de
          deudores, realizar campañas comerciales propias dirigidas a los destinatarios ni
          efectuar perfiles crediticios independientes.
        </p>
      </Section>

      <Section title="6. Autorización y bases que habilitan el tratamiento">
        <p>
          Cuando legalmente resulte necesaria, NOTIFICAS procurará obtener autorización previa,
          expresa e informada del titular para el tratamiento realizado en calidad de
          Responsable.
        </p>
        <p>
          No se solicitará una autorización adicional cuando el tratamiento se encuentre
          comprendido dentro de alguno de los supuestos en los cuales la legislación aplicable
          permite tratar información sin autorización del titular.
        </p>
        <p>
          Cuando NOTIFICAS actúe como Encargado, corresponde al cliente Responsable determinar y
          acreditar la base que legitima la recolección y utilización de los datos, así como la
          procedencia de la comunicación encomendada.
        </p>
        <p>
          El cliente deberá garantizar que los datos transmitidos a NOTIFICAS fueron obtenidos y
          son utilizados conforme al régimen jurídico que resulte aplicable.
        </p>
      </Section>

      <Section title="7. Datos sensibles">
        <p>
          NOTIFICAS no solicita, como regla general, datos sensibles para el funcionamiento
          ordinario de sus servicios.
        </p>
        <p>
          Se consideran datos sensibles aquellos que afectan la intimidad del titular o cuyo uso
          indebido pueda generar discriminación.
        </p>
        <p>
          Cuando excepcionalmente resulte necesario tratar esta clase de información se aplicarán
          las garantías adicionales exigidas por la legislación vigente.
        </p>
        <p>
          Ninguna persona estará obligada a proporcionar datos sensibles cuando la ley reconozca
          carácter facultativo a dicha respuesta.
        </p>
      </Section>

      <Section title="8. Datos de niños, niñas y adolescentes">
        <p>
          Los servicios de NOTIFICAS no están dirigidos específicamente a niños, niñas o
          adolescentes.
        </p>
        <p>
          Cuando excepcionalmente se produzca tratamiento de información de menores de edad, se
          observarán las reglas especiales establecidas por la legislación colombiana,
          garantizando la prevalencia de sus derechos fundamentales y su interés superior.
        </p>
        <p>
          Los clientes que incorporen información de menores a la plataforma serán responsables
          de verificar que cuentan con una base jurídica válida para ello.
        </p>
      </Section>

      <Section title="9. Transmisiones y flujos internacionales de información">
        <p>
          NOTIFICAS es una empresa constituida en la República Argentina y presta servicios
          tecnológicos mediante infraestructura que puede involucrar proveedores ubicados en
          distintas jurisdicciones.
        </p>
        <p>
          Por esta razón, el uso del servicio puede involucrar{" "}
          <strong>transmisiones internacionales de datos personales</strong>.
        </p>
        <p>
          Cuando NOTIFICAS reciba datos personales desde Colombia por cuenta de un cliente que
          actúe como Responsable del Tratamiento, la relación podrá instrumentarse mediante un
          acuerdo de tratamiento y transmisión internacional de datos personales que determine,
          entre otras cuestiones:
        </p>
        <BulletList
          items={[
            "objeto y finalidad del tratamiento;",
            "duración;",
            "naturaleza del procesamiento;",
            "categorías de información;",
            "obligaciones del Responsable;",
            "obligaciones de NOTIFICAS como Encargado;",
            "medidas de seguridad;",
            "confidencialidad;",
            "utilización de subencargados;",
            "atención de derechos de los titulares;",
            "incidentes de seguridad;",
            "conservación y eliminación de información;",
            "transmisiones internacionales posteriores.",
          ]}
        />
        <p>
          NOTIFICAS podrá adoptar cláusulas contractuales y demás mecanismos reconocidos por la
          regulación colombiana para garantizar un nivel adecuado de protección en los flujos
          internacionales de datos.
        </p>
      </Section>

      <Section title="10. Proveedores y subencargados">
        <p>
          Para prestar sus servicios, NOTIFICAS puede utilizar proveedores especializados de
          infraestructura tecnológica, almacenamiento, correo electrónico, mensajería, seguridad
          y otros servicios necesarios para el funcionamiento de la plataforma.
        </p>
        <p>
          Cuando estos proveedores tengan acceso a datos personales por cuenta de NOTIFICAS se
          adoptarán medidas contractuales y organizativas destinadas a limitar su tratamiento a
          las finalidades necesarias para la prestación del servicio.
        </p>
        <p>
          NOTIFICAS mantendrá información actualizada respecto de sus principales subencargados
          y podrá ponerla a disposición de sus clientes conforme las condiciones contractuales
          aplicables.
        </p>
      </Section>

      <Section title="11. Blockchain e integridad de la evidencia">
        <p>
          NOTIFICAS puede utilizar tecnología blockchain para reforzar la acreditación de
          integridad de determinada evidencia digital.
        </p>
        <p>
          Como principio de diseño, NOTIFICAS procura{" "}
          <strong>
            no incorporar a blockchain pública el contenido de las comunicaciones ni datos
            personales directamente identificatorios
          </strong>
          .
        </p>
        <p>
          La tecnología se utiliza para registrar valores criptográficos —hashes— que permiten
          posteriormente verificar la integridad de determinada información sin publicar su
          contenido.
        </p>
      </Section>

      <Section title="12. Seguridad y privacidad desde el diseño">
        <p>
          NOTIFICAS adopta medidas técnicas, administrativas y organizativas razonables y
          proporcionales a la naturaleza del tratamiento y a los riesgos involucrados.
        </p>
        <p>Entre los principios utilizados en el diseño del servicio se encuentran:</p>
        <BulletList
          items={[
            "minimización de datos;",
            "control de accesos;",
            "autenticación de usuarios;",
            "segregación de información;",
            "trazabilidad de operaciones;",
            "confidencialidad;",
            "integridad de registros;",
            "conservación limitada;",
            "gestión de incidentes;",
            "evaluación de proveedores;",
            "privacidad desde el diseño y por defecto.",
          ]}
        />
        <p>
          Ningún sistema informático permite garantizar seguridad absoluta. NOTIFICAS revisará
          periódicamente sus controles y podrá modificarlos para responder a nuevos riesgos
          tecnológicos.
        </p>
      </Section>

      <Section title="13. Conservación de información">
        <p>
          Los datos tratados por NOTIFICAS serán conservados únicamente durante el período
          necesario para cumplir las finalidades que justificaron su tratamiento, las
          obligaciones contractuales existentes y los requerimientos legales aplicables.
        </p>
        <p>
          Cuando NOTIFICAS actúe como Encargado, la conservación de la información estará
          adicionalmente sujeta a las instrucciones del cliente Responsable y a las condiciones
          establecidas contractualmente.
        </p>
        <p>
          Finalizada la necesidad de tratamiento, los datos serán eliminados, anonimizados o
          sometidos a las medidas que correspondan, salvo que exista una obligación legítima de
          conservación.
        </p>
      </Section>

      <Section title="14. Derechos de los titulares">
        <p>De acuerdo con la legislación colombiana, los titulares podrán, cuando corresponda:</p>
        <BulletList
          items={[
            "conocer los datos personales objeto de tratamiento;",
            "solicitar su actualización;",
            "solicitar su rectificación;",
            "solicitar prueba de la autorización cuando corresponda;",
            "ser informados acerca del uso dado a sus datos;",
            "presentar consultas y reclamos;",
            "solicitar la supresión cuando resulte legalmente procedente;",
            "revocar la autorización cuando exista fundamento jurídico para ello;",
            "acceder gratuitamente a sus datos personales;",
            "presentar quejas ante la Superintendencia de Industria y Comercio una vez cumplidos los requisitos previstos legalmente.",
          ]}
        />
      </Section>

      <Section title="15. Ejercicio de derechos">
        <p>
          Cuando NOTIFICAS sea Responsable del Tratamiento, los titulares podrán ejercer sus
          derechos mediante:
        </p>
        <p>
          <strong>Correo electrónico:</strong> <ColombiaMailLink />
        </p>
        <p>
          La solicitud deberá contener información suficiente para identificar al solicitante y
          permitir localizar los datos correspondientes.
        </p>
        <p>
          Cuando la petición se refiera a información que NOTIFICAS procesa exclusivamente por
          cuenta de un cliente, NOTIFICAS podrá informar al titular la identidad del Responsable
          correspondiente y remitirá o coordinará la solicitud con éste conforme las
          obligaciones legales y contractuales aplicables.
        </p>
        <p>
          NOTIFICAS colaborará con sus clientes para permitir el adecuado ejercicio de los
          derechos de los titulares.
        </p>
      </Section>

      <Section title="16. Consultas y reclamos">
        <p>
          Las consultas y reclamos relativos al tratamiento de información serán tramitados
          conforme a los procedimientos y plazos establecidos por la legislación colombiana
          aplicable.
        </p>
        <p>
          Cuando NOTIFICAS actúe únicamente como Encargado, comunicará la solicitud al
          Responsable del Tratamiento correspondiente y prestará la asistencia necesaria para su
          atención.
        </p>
      </Section>

      <Section title="17. Cookies y tecnologías similares">
        <p>El sitio web puede utilizar cookies y tecnologías equivalentes.</p>
        <p>Podrán utilizarse, entre otras:</p>
        <p>
          <strong>Cookies necesarias:</strong> indispensables para seguridad, navegación y
          funcionamiento del sitio.
        </p>
        <p>
          <strong>Cookies funcionales:</strong> permiten recordar determinadas preferencias del
          usuario.
        </p>
        <p>
          <strong>Cookies de rendimiento o analítica:</strong> permiten conocer de forma agregada
          cómo se utiliza el sitio y mejorar su funcionamiento.
        </p>
        <p>
          <strong>Cookies comerciales o de marketing:</strong> podrán emplearse cuando
          correspondan y con sujeción a los mecanismos de autorización aplicables.
        </p>
        <p>
          Los usuarios podrán consultar información más detallada y administrar sus preferencias
          mediante la{" "}
          <Link href={COLOMBIA_COOKIES_PATH} className="text-primary underline">
            Política de Cookies
          </Link>
          .
        </p>
      </Section>

      <Section title="18. Comunicaciones comerciales">
        <p>
          NOTIFICAS podrá enviar información comercial a personas que la hubieran solicitado o
          cuando exista una base jurídica válida para hacerlo.
        </p>
        <p>
          Los destinatarios dispondrán de mecanismos razonables para manifestar que no desean
          continuar recibiendo estas comunicaciones cuando ello resulte legalmente aplicable.
        </p>
        <p>
          Los datos recibidos por NOTIFICAS por cuenta de sus clientes para realizar
          comunicaciones a terceros{" "}
          <strong>
            no serán utilizados para realizar publicidad propia de NOTIFICAS dirigida a esos
            terceros
          </strong>
          .
        </p>
      </Section>

      <Section title="19. Incidentes relacionados con datos personales">
        <p>
          NOTIFICAS mantiene procedimientos destinados a identificar, evaluar, contener y
          gestionar incidentes de seguridad relacionados con datos personales.
        </p>
        <p>
          Cuando un incidente afecte información procesada por cuenta de un cliente, NOTIFICAS
          comunicará al Responsable la información pertinente para que pueda adoptar las medidas
          correspondientes conforme a la normativa aplicable.
        </p>
      </Section>

      <Section title="20. Modificaciones">
        <p>
          NOTIFICAS podrá actualizar esta Política como consecuencia de cambios legales,
          regulatorios, tecnológicos, operativos o relacionados con sus servicios.
        </p>
        <p>
          Cuando se produzcan modificaciones sustanciales se utilizarán mecanismos razonables
          para informarlas.
        </p>
        <p>La versión vigente estará permanentemente disponible en el sitio web.</p>
      </Section>

      <Section title="21. Vigencia">
        <p>
          La presente Política rige desde el <strong>14 de septiembre de 2026</strong>.
        </p>
        <p>
          Las bases de datos y tratamientos de información administrados por NOTIFICAS
          permanecerán vigentes durante el período necesario para cumplir las finalidades
          legítimas que originaron su tratamiento y las obligaciones legales o contractuales
          aplicables.
        </p>
      </Section>
    </>
  );
}
