(function initSelectors(global) {
  const NS = (global.NotificasAssistant = global.NotificasAssistant || {});

  const TEXT = {
    connect: { en: ["connect", "connect with"], es: ["conectar", "conectar con"] },
    message: { en: ["message"], es: ["mensaje", "enviar mensaje"] },
    addNote: { en: ["add a note"], es: ["añadir nota", "agregar nota"] },
    more: { en: ["more"], es: ["más", "mas"] },
  };

  function labelsFor(pref, key) {
    if (pref === "es") return TEXT[key].es;
    if (pref === "en") return TEXT[key].en;
    return [...TEXT[key].en, ...TEXT[key].es];
  }

  function findByVisibleText(root, labels) {
    const candidates = root.querySelectorAll("button, a, [role='button'], span[role='button']");
    for (const el of candidates) {
      const text = (el.textContent || "").trim().toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
      for (const label of labels) {
        if (text === label || text.startsWith(`${label} `) || aria.includes(label)) {
          return el;
        }
      }
    }
    return null;
  }

  function findByAria(root, labels) {
    for (const label of labels) {
      const el =
        root.querySelector(`[aria-label*="${label}" i]`) ||
        root.querySelector(`button[aria-label*="${label}" i]`);
      if (el) return el;
    }
    return null;
  }

  function findInteractive(root, labels) {
    return findByAria(root, labels) || findByVisibleText(root, labels);
  }

  NS.findConnectButton = function findConnectButton(doc, pref) {
    const labels = labelsFor(pref || "auto", "connect");
    const main = doc.querySelector("main") || doc.body;
    return findInteractive(main, labels);
  };

  NS.findMessageButton = function findMessageButton(doc, pref) {
    const labels = labelsFor(pref || "auto", "message");
    const main = doc.querySelector("main") || doc.body;
    let btn = findInteractive(main, labels);
    if (btn) return btn;
    const moreLabels = labelsFor(pref || "auto", "more");
    const more = findInteractive(main, moreLabels);
    if (more) {
      NS.assertSafeToClick(more);
      more.click();
      btn = findInteractive(main, labels);
    }
    return btn;
  };

  NS.findAddNoteButton = function findAddNoteButton(root, pref) {
    return findInteractive(root, labelsFor(pref || "auto", "addNote"));
  };

  NS.findMessageComposer = function findMessageComposer(doc) {
    return (
      doc.querySelector("[contenteditable='true'][role='textbox']") ||
      doc.querySelector(".msg-form__contenteditable") ||
      doc.querySelector("div[aria-label*='Write a message' i][contenteditable='true']") ||
      doc.querySelector("div[aria-label*='Escribe un mensaje' i][contenteditable='true']") ||
      doc.querySelector("textarea[name='message']")
    );
  };

  NS.findInvitationNoteField = function findInvitationNoteField(root) {
    return (
      root.querySelector("textarea[name='message']") ||
      root.querySelector("#custom-message") ||
      root.querySelector("textarea[aria-label*='note' i]") ||
      root.querySelector("textarea[aria-label*='nota' i]") ||
      root.querySelector("[contenteditable='true'][role='textbox']")
    );
  };

  NS.setLinkedInText = function setLinkedInText(field, text) {
    if (!field) return false;
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      field.focus();
      field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (field.isContentEditable) {
      field.focus();
      field.textContent = text;
      field.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      return true;
    }
    return false;
  };

  NS.extractProfileSlug = function extractProfileSlug(linkedinUrl) {
    try {
      const match = new URL(linkedinUrl).pathname.match(/\/in\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]) : "";
    } catch {
      return "";
    }
  };

  NS.profileSlugMatches = function profileSlugMatches(url, expectedSlug) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      const match = path.match(/\/in\/([^/?#]+)/);
      if (!match) return false;
      const slug = decodeURIComponent(match[1]).toLowerCase();
      const expected = expectedSlug.toLowerCase().replace(/\/$/, "");
      return slug === expected || slug.includes(expected) || expected.includes(slug);
    } catch {
      return false;
    }
  };
})(typeof window !== "undefined" ? window : self);
