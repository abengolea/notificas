/** Frases que el producto puede sostener. Usar en FAQ, SEO y landing. */

export const FAQ_CLAIMS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "¿Qué es Notificas?",
    answer:
      "Notificas es una plataforma de notificaciones digitales con constancia técnica. Al enviar, el texto se hashea (SHA-256) y ese hash se ancla en Polygon, una red pública. Las transacciones en cadena no se pueden alterar. El expediente en la plataforma (texto, destinos, eventos) se conserva; no es una blockchain.",
  },
  {
    question: "¿Qué eventos se certifican en blockchain?",
    answer:
      "En cadena anclamos hashes, no el archivo completo: el envío (hash del texto e ID SMTP si el servidor aceptó el correo), hitos de WhatsApp que firma Meta (template entregado o leído), el primer acceso al lector cuando ocurre, la confirmación explícita de lectura, y el hash del PDF de lectura cuando se emite. Cada hito se encadena al anterior.",
  },
  {
    question: "¿Qué pasa con el canal de WhatsApp?",
    answer:
      "WhatsApp lleva el texto de la plantilla aprobada por Meta, con los datos de ese destinatario — no el cuerpo libre de la carta, salvo que esa plantilla sea el texto. Meta informa si el mensaje llegó al dispositivo o se leyó. Eso queda firmado y, si corresponde, anclado en Polygon.",
  },
  {
    question: "¿Equivale a una carta documento?",
    answer:
      "No. Es una constancia técnica con hashes verificables, más rápida y barata que una carta documento. No reemplaza una forma que la ley exija. Si el caso pide una solemnidad puntual, consultá a tu abogado. El valor de la prueba lo califica quien juzga, no Notificas.",
  },
  {
    question: "¿Qué pasa si el destinatario no abre el correo?",
    answer:
      "Queda constancia de que el servidor de correo aceptó el mensaje (o de que rebotó, si nos llega el aviso). Eso no prueba que haya llegado a la casilla ni que lo hayan leído. Si también notificás por WhatsApp, se suma lo que Meta reporte sobre el template. El PDF de lectura se emite una sola vez, con los eventos de ese momento.",
  },
  {
    question: "¿Por cuánto tiempo se conserva la documentación?",
    answer:
      "Adjuntos y PDFs lacrados se guardan 5 años y no se pisan ni se borran en ese plazo. Las TX en Polygon son permanentes. El texto sellado queda en el expediente y en una copia lacrada. Un envío sellado no se elimina a pedido durante esos 5 años.",
  },
  {
    question: "¿Cómo se usa el certificado en un juicio o reclamo?",
    answer:
      "El certificado de lectura es un PDF que se emite una sola vez. Incluye el texto, hashes, TX de Polygon y los eventos hasta esa emisión. Después no se recertifica: lecturas o rebotes posteriores no entran en ese archivo. Podés volver a descargar la misma copia. Quien juzga decide qué valor le da.",
  },
  {
    question: "¿Cómo verifico que un certificado es auténtico?",
    answer:
      "En Verificar certificado subí el PDF o ingresá el ID del mensaje. El sistema compara el hash con el anclado en Polygon. También podés chequear la TX en polygonscan.com con el hash que figura en el PDF.",
  },
  {
    question: "¿Cómo empiezo a usar Notificas?",
    answer:
      "Creá tu cuenta en Registro: lleva un par de minutos. Desde el dashboard cargás créditos y enviás. Para volumen, usá el acceso empresas.",
  },
  {
    question: "¿Notificas ofrece notificaciones de alto volumen para empresas?",
    answer:
      "Sí. Además de envíos individuales con créditos, hay campañas para cientos o miles de destinatarios por WhatsApp o email, con personalización, trazabilidad por fila, anclaje en Polygon y reportes. Se cotizan caso por caso.",
  },
  {
    question: "¿Cómo funcionan las campañas corporativas por WhatsApp y Email?",
    answer:
      "WhatsApp usa plantillas aprobadas por Meta, sujetas a sus políticas y cupos. En email registramos lo que el servidor aceptó, un rebote si nos llega, y el acceso al lector si ocurre. Cada campaña se cotiza; no publicamos tarifas de Meta.",
  },
];
