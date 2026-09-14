/**
 * Copy de la landing colombiana. Editar aquí; no hardcodear textos argentinos.
 * Español colombiano neutro / profesional. Usted implícito. Sin voseo.
 */

export const colombiaCopy = {
  brand: {
    localeBadge: "Colombia",
    tagline: "Infraestructura digital para comunicaciones empresariales.",
    legalLine: "Servicio prestado por NOTIFICAS S.R.L.",
    markets: "Argentina · Colombia",
  },

  nav: {
    producto: "Producto",
    cobranza: "Cobranza",
    integraciones: "Integraciones",
    seguridad: "Seguridad",
    privacidad: "Privacidad",
    cookies: "Cookies",
    terminos: "Términos",
    contacto: "Contacto",
    comoFunciona: "Cómo funciona",
    evidencia: "Evidencia",
    demo: "Solicitar una demostración",
    menu: "Menú",
    abrirMenu: "Abrir menú",
    tema: "Tema: claro, oscuro o sistema",
    temaClaro: "Claro",
    temaOscuro: "Oscuro",
    temaSistema: "Sistema",
  },

  hero: {
    eyebrow: "NOTIFICAS COLOMBIA · COMUNICACIONES B2B",
    title: "Cobranza digital.\nCon evidencia.",
    subtitle:
      "Envíe comunicaciones individuales o masivas por WhatsApp y correo electrónico. Centralice la trazabilidad, genere evidencia por destinatario y reduzca procesos manuales en la gestión de cartera.",
    ctaPrimary: "Solicitar una demostración",
    ctaSecondary: "Ver cómo funciona",
    audience:
      "Para empresas de cobranza, entidades financieras, fintechs y compañías con cartera propia.",
    mockCaption: "Vista ilustrativa de una campaña. Datos de ejemplo.",
  },

  campaignMock: {
    product: "Notificas",
    workspace: "Operación de cartera",
    campaign: "Cartera septiembre",
    recipients: "12.480 destinatarios",
    channels: "WhatsApp + Email",
    status: "En proceso",
    metrics: [
      { label: "Procesados", value: "12.480" },
      { label: "Entregados", value: "11.842" },
      { label: "Lecturas disponibles", value: "7.910" },
      { label: "Evidencias generadas", value: "11.204" },
    ],
    rows: [
      { name: "Ana Restrepo", ref: "OBL-18402", channel: "WhatsApp", state: "Entregado" },
      { name: "Cooperativa Andina", ref: "OBL-18403", channel: "Email", state: "Leído" },
      { name: "Luis Patiño", ref: "OBL-18404", channel: "WhatsApp", state: "Procesado" },
      { name: "Retail del Norte", ref: "OBL-18405", channel: "Email", state: "Evidencia" },
    ],
    chips: [
      "Entrega registrada",
      "PDF generado",
      "Hash verificado",
      "Reporte descargable",
    ],
  },

  pain: {
    title: "La cobranza mueve miles de comunicaciones.\nLa evidencia no debería quedar dispersa.",
    body: "Correos enviados desde distintas cuentas, mensajes sin trazabilidad centralizada, archivos separados, comprobantes difíciles de recuperar y procesos manuales aumentan el costo operativo y dificultan demostrar qué se comunicó, cuándo y por qué canal.",
    items: [
      {
        title: "Procesos manuales",
        body: "Listas en hojas de cálculo, copiar y pegar, y gestiones una a una que no escalan con la cartera.",
      },
      {
        title: "Evidencia dispersa",
        body: "Capturas, buzones y PDFs sueltos. Recuperar un envío concreto se vuelve un trabajo aparte.",
      },
      {
        title: "Grandes volúmenes",
        body: "Miles de destinatarios con variables distintas. El canal informal no deja un registro homogéneo.",
      },
      {
        title: "Dificultad de auditoría",
        body: "Operaciones, jurídico y compliance necesitan ver el mismo rastro: contenido, canal, fecha y eventos.",
      },
    ],
    solutionEyebrow: "LA CAPA QUE FALTABA",
    solutionTitle: "Notificas es infraestructura tecnológica para comunicaciones de cobranza y notificaciones empresariales.",
    solutionBody:
      "Su organización carga cientos o miles de destinatarios, envía por WhatsApp y/o correo electrónico y obtiene evidencia individual de cada comunicación. No reemplazamos su sistema de cartera: documentamos y ejecutamos el tramo de comunicación.",
  },

  how: {
    title: "De una cartera a miles de comunicaciones documentadas.",
    steps: [
      {
        title: "Cargue su cartera",
        body: "Importe destinatarios y variables mediante archivo o integración.",
      },
      {
        title: "Defina la comunicación",
        body: "Utilice plantillas y datos personalizados para cada destinatario.",
      },
      {
        title: "Envíe por WhatsApp y email",
        body: "Procese comunicaciones individuales o campañas masivas desde una única plataforma.",
      },
      {
        title: "Obtenga la evidencia",
        body: "Cada comunicación genera trazabilidad técnica, eventos disponibles y documentación asociada.",
      },
      {
        title: "Exporte y audite",
        body: "Descargue evidencias individuales y reportes consolidados para sus procesos internos.",
      },
    ],
    apiNote:
      "También disponible mediante API para integrarse con sistemas de cartera, CRM o desarrollos propios.",
  },

  useCases: {
    eyebrow: "DISEÑADO PARA OPERACIONES DE CARTERA",
    title: "Una capa de comunicación para su proceso de cobranza.",
    body: "Notificas no reemplaza su sistema de cartera. Se integra al proceso para ejecutar y documentar las comunicaciones que su organización necesite realizar.",
    items: [
      {
        title: "Recordatorios de pago",
        body: "Comunicación automatizada de vencimientos y obligaciones.",
      },
      {
        title: "Cobranza temprana",
        body: "Gestiones digitales previas a procesos de mayor intensidad.",
      },
      {
        title: "Cobranza prejudicial",
        body: "Comunicaciones documentadas dentro del proceso de recuperación.",
      },
      {
        title: "Preaviso antes de reportes",
        body: "Gestión y acreditación de comunicaciones vinculadas con procesos de reporte de información negativa, conforme a las reglas aplicables al cliente.",
      },
      {
        title: "Campañas masivas",
        body: "Miles de destinatarios con variables individuales.",
      },
      {
        title: "Comunicación multicanal",
        body: "WhatsApp y correo electrónico gestionados desde una misma operación.",
      },
    ],
    note: "El cliente define la finalidad, el contenido, los destinatarios, los canales y la legitimidad de cada comunicación. Notificas no determina cuándo es jurídicamente procedente un reporte.",
  },

  compliance: {
    eyebrow: "PENSADO PARA EL MARCO COLOMBIANO",
    title: "La tecnología también debe acompañar su compliance.",
    body: "Las operaciones de cobranza en Colombia requieren controlar canales, procesos y evidencia. Notificas aporta infraestructura tecnológica y registros para integrar esas comunicaciones a los procedimientos de cumplimiento de cada organización.",
    blocks: [
      {
        title: "Canales de cobranza",
        body: "La Ley 2300 de 2023 establece reglas sobre los canales mediante los cuales pueden ser contactados los consumidores, además de horarios y periodicidad para las gestiones de cobranza.",
        extra:
          "Notificas ofrece herramientas que facilitan la implementación de controles. No garantiza, por sí sola, el cumplimiento de la Ley 2300.",
        linkLabel: "Conocer marco normativo",
      },
      {
        title: "Comunicación previa al reporte",
        body: "El artículo 12 de la Ley 1266 de 2008 contempla una comunicación previa al titular antes del reporte de información negativa y establece el término legal aplicable antes de efectuarlo.",
        extra:
          "Notificas permite ejecutar, registrar y conservar evidencia asociada a esas comunicaciones. La procedencia, el canal y la modalidad corresponden al Responsable. Un mensaje por WhatsApp o correo electrónico no cumple, por sí mismo, cualquier supuesto jurídico.",
        linkLabel: null,
      },
      {
        title: "Protección de datos",
        body: "Cuando un cliente colombiano utiliza Notificas para procesar datos de sus destinatarios, la plataforma puede operar como Encargado del Tratamiento, bajo instrucciones del Responsable y mediante los instrumentos contractuales correspondientes.",
        extra: null,
        linkLabel: "Protección de datos y privacidad",
      },
    ],
    disclaimer:
      "Las funcionalidades de Notificas constituyen herramientas tecnológicas. Cada organización es responsable de determinar la base jurídica, oportunidad, contenido, destinatarios y canales aplicables a sus comunicaciones.",
  },

  controls: {
    title: "Controles operativos para grandes volúmenes.",
    items: [
      {
        title: "WhatsApp + Email",
        body: "Administre ambos canales desde una misma plataforma.",
      },
      {
        title: "Envíos masivos",
        body: "Procese grandes carteras sin gestionar destinatarios uno por uno.",
      },
      {
        title: "Personalización",
        body: "Nombre, obligación, importe, referencia, vencimiento y demás variables definidas por el cliente.",
      },
      {
        title: "Evidencia individual",
        body: "Genere documentación asociada a cada comunicación.",
      },
      {
        title: "Estados y eventos",
        body: "Consulte los eventos técnicos disponibles para cada canal.",
      },
      {
        title: "Reportes",
        body: "Obtenga información consolidada sobre campañas y destinatarios.",
      },
      {
        title: "API",
        body: "Integre Notificas con su software de cartera o sistemas internos.",
      },
      {
        title: "Integridad",
        body: "Utilice mecanismos criptográficos para verificar que la evidencia no fue alterada.",
      },
    ],
  },

  evidence: {
    title: "No sólo enviar.\nPoder demostrar.",
    body: "Cada operación puede generar una evidencia individual que concentra los elementos técnicos disponibles de la comunicación y facilita su posterior consulta, auditoría o presentación.",
    items: [
      "Contenido comunicado",
      "Fecha y hora",
      "Destinatario",
      "Canal utilizado",
      "Identificadores técnicos",
      "Eventos disponibles",
      "Integridad documental",
      "Hash",
      "Código o mecanismo de verificación",
    ],
    mockCaption: "Vista ilustrativa de una evidencia. Datos de ejemplo.",
    mock: {
      kicker: "Evidencia individual",
      heading: "Comunicación documentada",
      campaign: "Cartera septiembre · OBL-18402",
      recipient: "Ana Restrepo",
      channel: "WhatsApp",
      sentAt: "12 sep 2026 · 09:14 COT",
      hash: "a7c3…e91f",
      verify: "NTF-CO-18402",
      events: [
        { label: "Procesado", detail: "09:14:02" },
        { label: "Aceptado por el canal", detail: "09:14:07" },
        { label: "Entrega registrada", detail: "09:14:21" },
        { label: "Lectura disponible", detail: "09:22:03" },
      ],
    },
  },

  blockchain: {
    title: "Integridad verificable.",
    body: "Notificas puede generar una huella criptográfica de la evidencia y registrar su hash mediante tecnología blockchain, permitiendo verificar posteriormente que el documento no fue modificado.",
    privacy:
      "Los datos personales y el contenido de la comunicación no se publican en blockchain. Se registra únicamente la huella criptográfica correspondiente.",
    steps: [
      { title: "Documento", body: "Evidencia individual generada por la operación." },
      { title: "Hash", body: "Huella criptográfica del registro técnico." },
      { title: "Blockchain", body: "Registro de esa huella, no del contenido." },
      { title: "Verificación", body: "Comprobación posterior de integridad." },
    ],
  },

  integrations: {
    title: "Conecte Notificas a su operación.",
    body: "Para organizaciones con grandes volúmenes, Notificas puede integrarse mediante API con sistemas de cartera, CRM, plataformas propias y procesos automatizados.",
    pipeline: [
      "Sistema de cartera",
      "API Notificas",
      "WhatsApp / Email",
      "Evidencia",
      "Webhook / Resultado",
    ],
    chips: ["API", "CSV", "Procesamiento masivo", "Webhooks", "Evidencias", "Reportes"],
  },

  industries: {
    title: "Para organizaciones que necesitan comunicar a escala.",
    items: [
      {
        title: "Empresas de cobranza",
        body: "Digitalice comunicaciones y centralice evidencias para múltiples carteras.",
      },
      {
        title: "Fintechs y crédito",
        body: "Automatice comunicaciones asociadas al ciclo de vida de una obligación.",
      },
      {
        title: "Entidades financieras",
        body: "Agregue trazabilidad a procesos que requieren comunicaciones documentadas.",
      },
      {
        title: "Retail y crédito propio",
        body: "Administre recordatorios, mora y comunicaciones de cartera.",
      },
      {
        title: "Aseguradoras",
        body: "Utilice comunicaciones digitales documentadas en procesos operativos y contractuales.",
      },
      {
        title: "Servicios",
        body: "Gestione grandes volúmenes de avisos a clientes desde una plataforma única.",
      },
    ],
  },

  volume: {
    title: "Diseñado para que comunicar a escala tenga sentido económico.",
    body: "Los procesos físicos, manuales o fragmentados aumentan su costo a medida que crece la cartera. Notificas utiliza una infraestructura digital preparada para procesar grandes volúmenes y reducir tareas operativas.",
    cta: "Solicitar propuesta para mi volumen",
    note: "Cuéntenos aproximadamente cuántas comunicaciones procesa por mes y prepararemos una propuesta.",
  },

  demo: {
    title: "Muéstrenos su proceso de cobranza.\nLe mostramos cómo digitalizar la comunicación.",
    body: "Solicite una demostración orientada a su operación, volumen y canales actuales.",
    submit: "Solicitar demostración",
    sending: "Enviando…",
    successTitle: "Solicitud enviada",
    successBody: "Le contactaremos para coordinar una demostración según su operación y volumen.",
    errorTitle: "No fue posible enviar",
    errorNetwork: "Revise la conexión e intente de nuevo.",
    errorFields: "Complete los campos obligatorios y acepte la política de tratamiento de datos.",
    errorEmail: "Revise el formato del correo electrónico corporativo.",
    privacyPrefix: "He leído y acepto la",
    privacyLink: "Política de Tratamiento de Datos Personales",
    fields: {
      nombre: "Nombre",
      apellido: "Apellido",
      empresa: "Empresa",
      cargo: "Cargo",
      email: "Email corporativo",
      telefono: "Teléfono / WhatsApp",
      tipo: "Tipo de organización",
      volumen: "¿Cuántas comunicaciones realizan aproximadamente por mes?",
      proceso: "Cuéntenos brevemente cómo realizan hoy sus comunicaciones",
      procesoOptional: "Opcional",
    },
  },

  marco: {
    title: "Marco normativo colombiano",
    lead: "Referencia educativa sobre normas frecuentemente relevantes para operaciones de cobranza y reporte. No constituye asesoría jurídica ni un inventario exhaustivo de obligaciones.",
    ley2300Title: "Ley 2300 de 2023",
    ley2300Body:
      "Establece reglas sobre los canales, horarios y periodicidad con los que pueden realizarse gestiones de cobranza. La implementación de esos controles corresponde a cada organización. Notificas aporta herramientas tecnológicas para documentar comunicaciones; no garantiza el cumplimiento automático de la ley.",
    ley1266Title: "Ley 1266 de 2008, artículo 12",
    ley1266Body:
      "Contempla una comunicación previa al titular antes del reporte de información negativa y el término legal aplicable. La procedencia del reporte, el contenido y el canal los define el Responsable. Notificas permite ejecutar y conservar evidencia técnica de las comunicaciones que el cliente instruya.",
    ley1581Title: "Ley 1581 de 2012",
    ley1581Body:
      "Régimen general de protección de datos personales. En el servicio B2B, el cliente actúa como Responsable del Tratamiento y Notificas puede operar como Encargado, bajo instrucciones e instrumentos contractuales.",
    sourcesLabel: "Fuentes oficiales",
  },
} as const;
