(function initContent() {
  const NS = window.NotificasAssistant;
  let lastReported = "";

  function currentProfileUrl() {
    try {
      const match = location.pathname.match(/\/in\/([^/]+)/i);
      if (!match) return "";
      return `https://www.linkedin.com/in/${decodeURIComponent(match[1])}/`;
    } catch {
      return "";
    }
  }

  function reportProfile() {
    const linkedinUrl = currentProfileUrl();
    if (!linkedinUrl || linkedinUrl === lastReported) return;
    lastReported = linkedinUrl;
    chrome.runtime.sendMessage({ type: "PROFILE_DETECTED", linkedinUrl }).catch(() => {});
  }

  reportProfile();
  setInterval(reportProfile, 2000);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PING") {
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "GET_PAGE_PROFILE") {
      sendResponse({ ok: true, linkedinUrl: currentProfileUrl() || location.href });
      return false;
    }
    if (message?.type === "GET_OUTBOUND_MESSAGES") {
      const messages = NS?.extractOutboundMessages ? NS.extractOutboundMessages(document) : [];
      sendResponse({ ok: true, messages, href: location.href });
      return false;
    }
    if (message?.type !== "RUN_PREPARE") return false;
    if (!NS?.prepareLinkedInAction) {
      sendResponse({ ok: false, error: "La extensión no cargó en esta página. Recargá LinkedIn y reintentá." });
      return false;
    }
    NS.prepareLinkedInAction(document, message.payload)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  });
})();
