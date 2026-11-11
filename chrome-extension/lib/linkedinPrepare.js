(function initPrepare(global) {
  const NS = (global.NotificasAssistant = global.NotificasAssistant || {});

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitFor(fn, timeoutMs, stepMs) {
    const deadline = Date.now() + (timeoutMs || 10000);
    const step = stepMs || 350;
    let last;
    while (Date.now() < deadline) {
      last = fn();
      if (last) return last;
      await sleep(step);
    }
    return last || null;
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  NS.prepareLinkedInAction = async function prepareLinkedInAction(doc, payload) {
    const locale = payload.locale === "es" || payload.locale === "en" ? payload.locale : "auto";
    const message = payload.message || "";
    const slug = NS.extractProfileSlug(payload.linkedinUrl || location.href);
    const onMessaging = NS.isMessagingPage(location.href);

    if (slug && !onMessaging && !NS.profileSlugMatches(location.href, slug)) {
      const error = "El perfil abierto no coincide con el prospecto.";
      NS.showPageNotice(doc, error, "error");
      return { ok: false, error };
    }

    return prepareDirectMessage(doc, message, locale, {
      slug,
      onMessaging,
      forbidCompose: Boolean(payload.forbidCompose),
      persistDraft: payload.persistDraft !== false,
    });
  };

  async function openOverflowIfNeeded(doc, locale, finder) {
    let target = finder();
    if (target) return target;
    const more = NS.findMoreButton(doc, locale);
    if (!more || NS.isFeedOrCommentArea(more)) return null;
    NS.assertSafeToClick(more);
    more.click();
    await sleep(700);
    return waitFor(finder, 2500, 200);
  }

  async function fillDirectMessageComposer(doc, message) {
    const composer = await waitFor(() => {
      const field = NS.findMessageComposer(doc);
      if (!field || NS.isCommentComposer(field)) return null;
      return field;
    }, 7000);

    if (!composer) return { inserted: false, found: false };

    if (NS.isCommentComposer(composer)) {
      return { inserted: false, found: false };
    }

    let inserted = false;
    if (message) inserted = Boolean(NS.setLinkedInText(composer, message));
    if (inserted) {
      try {
        composer.dispatchEvent(new Event("change", { bubbles: true }));
        composer.blur?.();
      } catch {
        /* ignore */
      }
    }
    return { inserted, found: true };
  }

  async function prepareDirectMessage(doc, message, locale, ctx) {
    if (ctx.onMessaging && !ctx.forbidCompose) {
      const filled = await fillDirectMessageComposer(doc, message);
      if (filled.found && filled.inserted) {
        if (ctx.persistDraft) await sleep(1800);
        NS.showPageNotice(doc, "Mensaje directo listo. Revisá y envialo vos en LinkedIn.", "ok");
        return { ok: true, prepared: "message", messageInserted: true };
      }
      if (filled.found && message) await copyText(message);
      const notice = filled.found
        ? "Abrí el chat. El texto quedó copiado: pegalo y envialo vos."
        : "Estoy en Mensajes pero no encontré el recuadro. El texto quedó copiado.";
      if (!filled.found && message) await copyText(message);
      NS.showPageNotice(doc, notice, filled.found ? "ok" : "error");
      return { ok: filled.found, prepared: "message", messageInserted: false, copied: Boolean(message) };
    }

    await waitFor(() => NS.findMessageButton(doc, locale) || NS.findMoreButton(doc, locale), 12000);

    const messageBtn = await openOverflowIfNeeded(doc, locale, () => NS.findMessageButton(doc, locale));
    if (messageBtn && !NS.isFeedOrCommentArea(messageBtn)) {
      NS.assertSafeToClick(messageBtn);
      messageBtn.click();
      await sleep(1400);
      const filled = await fillDirectMessageComposer(doc, message);
      if (filled.found) {
        if (!filled.inserted && message) await copyText(message);
        if (filled.inserted && ctx.persistDraft) await sleep(1800);
        NS.showPageNotice(
          doc,
          filled.inserted
            ? "Borrador listo en este chat. No cierres esta pestaña hasta enviarlo."
            : "Abrí el chat. El texto quedó copiado: pegalo y envialo vos.",
          filled.inserted ? "ok" : "error",
        );
        return { ok: true, prepared: "message", messageInserted: filled.inserted, isolatedTab: true };
      }
    }

    const copied = await copyText(message);
    if (ctx.forbidCompose) {
      NS.showPageNotice(
        doc,
        "No abro Nuevo mensaje: LinkedIn pisa el borrador anterior. Esta pestaña queda para este prospecto; pegá el texto acá.",
        "error",
      );
      return { ok: false, copied, isolatedTab: true, error: "Sin botón Mensaje. No uso compose para no borrar otros borradores." };
    }
    return {
      ok: false,
      fallback: "compose",
      slug: ctx.slug || "",
      copied,
      error: copied
        ? "No encontré Mensaje en el perfil. Voy a abrir el chat directo."
        : "No encontré Mensaje en el perfil.",
    };
  }

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
