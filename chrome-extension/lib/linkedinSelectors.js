(function initSelectors(global) {
  const NS = (global.NotificasAssistant = global.NotificasAssistant || {});

  const TEXT = {
    connect: {
      en: ["connect", "connect with", "invite to connect"],
      es: ["conectar", "conectar con", "invitar a conectar"],
    },
    message: {
      en: ["message", "send message"],
      es: ["mensaje", "enviar mensaje"],
      pt: ["mensagem", "enviar mensagem"],
    },
    addNote: {
      en: ["add a note", "add note", "include a note"],
      es: ["añadir una nota", "agregar una nota", "añadir nota", "agregar nota", "incluir una nota"],
    },
    more: { en: ["more", "more actions"], es: ["más", "mas", "más acciones"] },
  };

  const CONNECT_ARIA = [
    /invite .+ to connect/i,
    /invitar .+ a conectar/i,
    /\bconnect\b/i,
    /\bconectar\b/i,
  ];

  const IGNORE = /follow|seguir|pending|pendiente|unfollow|disconnect|dejar de|pendiente de/i;

  function labelsFor(pref, key) {
    const pack = TEXT[key];
    if (pref === "es") return pack.es;
    if (pref === "en") return pack.en;
    if (pref === "pt") return pack.pt || pack.en;
    return [...pack.en, ...pack.es, ...(pack.pt || [])];
  }

  const COMMENT_HINT = /comment|comentario|comentário|comentar|añadir un comentario|add a comment/i;
  const FEED_COMMENT_SEL =
    ".comments-comment-box, .comments-comment-texteditor, .comments-comment-item, .update-components-footer, .feed-shared-social-action-bar, .social-details-social-activity";
  const DM_SURFACE_SEL =
    ".msg-form, .msg-overlay-conversation-bubble, .msg-convo-wrapper, .shared-composer-as-container";

  function isInside(el, selector) {
    return Boolean(el?.closest?.(selector));
  }

  function visibleText(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function ariaText(el) {
    return (el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  }

  function isIgnoredAction(el) {
    const combined = `${visibleText(el)} ${ariaText(el)}`;
    return IGNORE.test(combined) && !/\bconnect\b|\bconectar\b|invite|invitar/i.test(combined);
  }

  function isConnectCandidate(el) {
    if (!el || isIgnoredAction(el)) return false;
    const text = visibleText(el);
    const aria = ariaText(el);
    if (CONNECT_ARIA.some((re) => re.test(aria) || re.test(text))) return true;
    return text === "connect" || text === "conectar" || text.startsWith("connect ") || text.startsWith("conectar ");
  }

  function actionRoots(root) {
    const doc = root.ownerDocument || root;
    const nodes = [
      root.querySelector?.(".pvs-profile-actions"),
      root.querySelector?.(".pv-top-card-v2-ctas"),
      root.querySelector?.(".pv-top-card--actions"),
      root.querySelector?.("[data-view-name='profile-overflow-button']")?.parentElement,
    ].filter(Boolean);
    if (!nodes.length) {
      const main = root.querySelector?.("main");
      if (main) nodes.push(main);
    }
    if (doc.body && !nodes.includes(doc.body) && !nodes.length) nodes.push(doc.body);
    return nodes;
  }

  NS.isCommentComposer = function isCommentComposer(el) {
    if (!el) return false;
    const bits = `${ariaText(el)} ${el.getAttribute?.("placeholder") || ""} ${el.getAttribute?.("data-placeholder") || ""}`;
    if (COMMENT_HINT.test(bits)) return true;
    if (isInside(el, FEED_COMMENT_SEL)) return true;
    if (isInside(el, ".feed-shared-update-v2") && !isInside(el, DM_SURFACE_SEL)) return true;
    return false;
  };

  NS.isDirectMessageComposer = function isDirectMessageComposer(el) {
    if (!el || NS.isCommentComposer(el)) return false;
    if (el.classList?.contains?.("msg-form__contenteditable")) return true;
    return isInside(el, DM_SURFACE_SEL);
  };

  NS.isFeedOrCommentArea = function isFeedOrCommentArea(el) {
    return Boolean(el && (NS.isCommentComposer(el) || isInside(el, FEED_COMMENT_SEL) || isInside(el, ".feed-shared-update-v2")));
  };

  function candidates(root) {
    return root.querySelectorAll(
      "button, a, [role='button'], [role='menuitem'], .artdeco-dropdown__item, span[role='button']",
    );
  }

  function findByVisibleText(root, labels) {
    for (const el of candidates(root)) {
      if (isIgnoredAction(el)) continue;
      const text = visibleText(el);
      const aria = ariaText(el);
      for (const label of labels) {
        if (text === label || text.startsWith(`${label} `) || aria.toLowerCase().includes(label)) {
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
      if (el && !isIgnoredAction(el)) return el;
    }
    return null;
  }

  function findInteractive(root, labels) {
    return findByAria(root, labels) || findByVisibleText(root, labels);
  }

  function findConnectIn(root) {
    for (const el of candidates(root)) {
      if (isConnectCandidate(el)) return el;
    }
    return null;
  }

  NS.findMoreButton = function findMoreButton(doc, pref) {
    const labels = labelsFor(pref || "auto", "more");
    for (const root of actionRoots(doc)) {
      const btn = findInteractive(root, labels);
      if (btn) return btn;
    }
    return null;
  };

  NS.findConnectButton = function findConnectButton(doc, pref) {
    for (const root of actionRoots(doc)) {
      const btn = findConnectIn(root);
      if (btn) return btn;
    }
    const labels = labelsFor(pref || "auto", "connect");
    const main = doc.querySelector("main") || doc.body;
    return findInteractive(main, labels);
  };

  NS.findMessageButton = function findMessageButton(doc, pref) {
    const labels = labelsFor(pref || "auto", "message");
    const extra = [
      doc.querySelector?.(".artdeco-dropdown__content"),
      doc.querySelector?.("[role='menu']"),
    ].filter(Boolean);
    for (const root of [...actionRoots(doc), ...extra]) {
      const btn = findInteractive(root, labels);
      if (btn && !NS.isFeedOrCommentArea(btn)) return btn;
    }
    return null;
  };

  NS.findAddNoteButton = function findAddNoteButton(root, pref) {
    return findInteractive(root, labelsFor(pref || "auto", "addNote"));
  };

  NS.findMessageComposer = function findMessageComposer(doc) {
    const nodes = doc.querySelectorAll(
      [
        ".msg-form__contenteditable",
        ".msg-form [contenteditable='true']",
        ".msg-overlay-conversation-bubble [contenteditable='true']",
        "form.msg-form [role='textbox']",
        ".msg-convo-wrapper [contenteditable='true']",
      ].join(","),
    );
    for (const el of nodes) {
      if (NS.isDirectMessageComposer(el)) return el;
    }
    return null;
  };

  NS.findInvitationNoteField = function findInvitationNoteField(root) {
    return (
      root.querySelector("textarea[name='message']") ||
      root.querySelector("#custom-message") ||
      root.querySelector("textarea[aria-label*='note' i]") ||
      root.querySelector("textarea[aria-label*='nota' i]") ||
      root.querySelector(".connect-button-send-invite__custom-message") ||
      root.querySelector("[contenteditable='true'][role='textbox']")
    );
  };

  NS.setLinkedInText = function setLinkedInText(field, text) {
    if (!field) return false;
    try {
      field.focus();
    } catch {
      /* ignore */
    }
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(field, text);
      else field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (field.isContentEditable) {
      const doc = field.ownerDocument || document;
      try {
        const selection = doc.getSelection?.();
        const range = doc.createRange?.();
        if (selection && range) {
          range.selectNodeContents(field);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        if (doc.execCommand) {
          doc.execCommand("selectAll", false, null);
          doc.execCommand("insertText", false, text);
        } else {
          field.textContent = text;
        }
      } catch {
        field.textContent = text;
      }
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return true;
    }
    return false;
  };

  NS.extractProfileSlug = function extractProfileSlug(linkedinUrl) {
    try {
      const path = new URL(linkedinUrl).pathname;
      const inMatch = path.match(/\/in\/([^/?#]+)/i);
      if (inMatch) return decodeURIComponent(inMatch[1]).replace(/\/+$/, "");
      const postMatch = path.match(/\/posts\/([^/?#]+)/i);
      if (postMatch) return decodeURIComponent(postMatch[1]).split("_")[0];
      return "";
    } catch {
      return "";
    }
  };

  NS.normalizeLinkedInProfileUrl = function normalizeLinkedInProfileUrl(linkedinUrl) {
    const slug = NS.extractProfileSlug(linkedinUrl);
    return slug ? `https://www.linkedin.com/in/${slug}/` : linkedinUrl;
  };

  NS.messagingComposeUrl = function messagingComposeUrl(linkedinUrlOrSlug) {
    const slug = String(linkedinUrlOrSlug || "").includes("/")
      ? NS.extractProfileSlug(linkedinUrlOrSlug)
      : String(linkedinUrlOrSlug || "").replace(/\/+$/, "");
    if (!slug) return "";
    return `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(slug)}`;
  };

  NS.isMessagingPage = function isMessagingPage(url) {
    try {
      return /linkedin\.com\/messaging\//i.test(url || "");
    } catch {
      return false;
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

  NS.extractOutboundMessages = function extractOutboundMessages(doc) {
    const bodies = doc.querySelectorAll(
      ".msg-s-event-listitem__body, .msg-s-event-listitem__message-bubble, .msg-s-event-listitem p",
    );
    const out = [];
    for (const el of bodies) {
      const item = el.closest?.(".msg-s-event-listitem, .msg-s-message-group");
      const incoming = Boolean(
        item?.classList?.contains?.("msg-s-event-listitem--other") ||
          item?.classList?.contains?.("msg-s-message-group--recipient"),
      );
      if (incoming) continue;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (text && !out.includes(text)) out.push(text);
    }
    return out;
  };

  NS.showPageNotice = function showPageNotice(doc, text, kind) {
    if (!doc?.body) return;
    let el = doc.getElementById("notificas-assistant-notice");
    if (!el) {
      el = doc.createElement("div");
      el.id = "notificas-assistant-notice";
      el.setAttribute("role", "status");
      doc.body.appendChild(el);
    }
    el.textContent = text;
    el.style.cssText = [
      "position:fixed",
      "top:16px",
      "right:16px",
      "z-index:2147483647",
      "max-width:360px",
      "padding:12px 14px",
      "border-radius:10px",
      "font:13px/1.4 Segoe UI,system-ui,sans-serif",
      kind === "error"
        ? "background:#fee2e2;color:#991b1b;border:1px solid #fecaca"
        : "background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0",
    ].join(";");
  };
})(typeof window !== "undefined" ? window : self);
