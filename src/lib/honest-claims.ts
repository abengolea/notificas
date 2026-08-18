/** Frases que el producto puede sostener. Usar en FAQ, SEO y landing. */

export const FAQ_CLAIMS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "¿Qué es Notificas?",
    answer:
      "Es una plataforma para enviar un mensaje y dejar constancia de qué se envió, a quién y cuándo. Guardamos el texto y le sacamos una huella digital. Esa huella queda en Polygon, una red pública que nadie puede reescribir. El expediente en Notificas (el texto, los destinos, los eventos) se conserva aparte: no está “en la blockchain”.",
  },
  {
    question: "¿Qué eventos se certifican en blockchain?",
    answer:
      "En la red pública no subimos el archivo entero: subimos huellas. Queda el envío (qué texto salió y si el servidor de correo lo aceptó), lo que Meta informa de WhatsApp (si el aviso llegó al teléfono o se leyó), el primer click al enlace de lectura si ocurre, la confirmación de lectura si la hay, y la huella del PDF cuando lo emitís. Cada hecho se ata al anterior.",
  },
  {
    question: "¿Qué pasa con el canal de WhatsApp?",
    answer:
      "Por WhatsApp no viaja la carta completa, salvo que tu plantilla sea exactamente ese texto. Viaja la plantilla que Meta ya aprobó, con el nombre y los datos de esa persona. Meta nos dice si el aviso llegó al celular o si lo abrieron. Eso es lo que registramos.",
  },
  {
    question: "¿Equivale a una carta documento?",
    answer:
      "No. Es más rápido y más barato, y deja un rastro comprobable. Si una norma pide carta documento u otra forma puntual, hay que usar esa forma. Un juez o un organismo decide qué valor le da a esta constancia; Notificas no lo decide.",
  },
  {
    question: "¿Qué pasa si el destinatario no abre el correo?",
    answer:
      "Queda que nuestro servidor de correo aceptó enviarlo. Eso no prueba que haya llegado a la bandeja ni que lo hayan leído. Si el buzón lo rechaza y nos llega el aviso de rebote, lo anotamos. Si también mandás WhatsApp, se suma lo que Meta reporte de esa plantilla. El PDF de lectura se arma una sola vez: si todavía esperás una lectura, no lo emitas todavía.",
  },
  {
    question: "¿Por cuánto tiempo se conserva la documentación?",
    answer:
      "Adjuntos, PDFs y el texto sellado se guardan 5 años y no se borran a pedido en ese plazo. Lo que quedó en Polygon no se borra nunca.",
  },
  {
    question: "¿Cómo se usa el certificado en un juicio o reclamo?",
    answer:
      "Hay dos documentos. La constancia de envío se genera sola cuando sale el mensaje. El certificado de lectura lo emitís vos, una sola vez, como una foto de ese instante: texto, huellas y lo que haya pasado hasta ahí. Después podés bajar la misma copia, pero no se le agregan lecturas ni rebotes nuevos. Quien juzga decide si le sirve.",
  },
  {
    question: "¿Cómo verifico que un certificado es auténtico?",
    answer:
      "En Verificar certificado subí el PDF o ingresá el ID del mensaje. Comparamos la huella del archivo con la que quedó en Polygon. También podés copiar el código de transacción del PDF y buscarlo en polygonscan.com.",
  },
  {
    question: "¿Cómo empiezo a usar Notificas?",
    answer:
      "Creá tu cuenta en Registro: lleva un par de minutos. Desde el panel cargás créditos y enviás. Para volumen, usá el acceso empresas.",
  },
  {
    question: "¿Notificas ofrece notificaciones de alto volumen para empresas?",
    answer:
      "Sí. Además de envíos uno a uno con créditos, hay campañas para cientos o miles de destinatarios por WhatsApp o correo, con datos de cada persona, seguimiento por fila y reportes. Se cotizan caso por caso.",
  },
  {
    question: "¿Cómo funcionan las campañas corporativas por WhatsApp y Email?",
    answer:
      "WhatsApp usa plantillas que Meta tiene que haber aprobado, con sus reglas y cupos. En el correo anotamos si nuestro servidor lo aceptó, si nos llega un rebote, y si la persona abrió el enlace de lectura. Cada campaña se cotiza; no publicamos tarifas de Meta.",
  },
];
