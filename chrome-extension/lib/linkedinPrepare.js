(function initPrepare(global) {
  const NS = (global.NotificasAssistant = global.NotificasAssistant || {});

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  NS.prepareLinkedInAction = async function prepareLinkedInAction(doc, payload) {
    const locale = payload.locale === "es" || payload.locale === "en" ? payload.locale : "auto";
    const message = payload.message || "";
    const slug = NS.extractProfileSlug(payload.linkedinUrl || location.href);

    if (slug && !NS.profileSlugMatches(location.href, slug)) {
      return { ok: false, error: "El perfil abierto no coincide con el prospecto." };
    }

    if (payload.action === "connection") {
      return prepareConnection(doc, message, locale);
    }
    if (payload.action === "message" || payload.action === "followup") {
      return prepareMessage(doc, message, locale);
    }
    return { ok: false, error: `Acción desconocida: ${payload.action}` };
  };

  async function prepareConnection(doc, message, locale) {
    const connect = NS.findConnectButton(doc, locale);
    if (!connect) {
      return { ok: false, error: "No encontré el botón Conectar / Connect." };
    }
    NS.assertSafeToClick(connect);
    connect.click();
    await sleep(900);

    const modal = doc.querySelector("[role='dialog']") || doc.querySelector(".artdeco-modal") || doc.body;
    const addNote = NS.findAddNoteButton(modal, locale);
    if (addNote) {
      NS.assertSafeToClick(addNote);
      addNote.click();
      await sleep(500);
    }

    const field = NS.findInvitationNoteField(modal);
    if (field && message) NS.setLinkedInText(field, message);

    return { ok: true, prepared: "connection", messageInserted: Boolean(field && message) };
  }

  async function prepareMessage(doc, message, locale) {
    const messageBtn = NS.findMessageButton(doc, locale);
    if (!messageBtn) {
      return { ok: false, error: "No encontré el botón Mensaje / Message." };
    }
    NS.assertSafeToClick(messageBtn);
    messageBtn.click();
    await sleep(1200);

    const composer = NS.findMessageComposer(doc);
    if (!composer) {
      return { ok: false, error: "No encontré el cuadro de mensaje." };
    }
    if (message) NS.setLinkedInText(composer, message);

    return { ok: true, prepared: "message", messageInserted: Boolean(message) };
  };

  NS.__test_forbiddenSendBlocked = function __test_forbiddenSendBlocked() {
    for (const action of NS.FORBIDDEN_AUTO_ACTIONS) {
      let threw = false;
      try {
        NS.assertNotForbiddenAutoAction(action);
      } catch {
        threw = true;
      }
      if (!threw) throw new Error(`Expected block for ${action}`);
    }
  };
})(typeof window !== "undefined" ? window : self);
