(function initContent() {
  const NS = window.NotificasAssistant;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "RUN_PREPARE") return false;
    NS.prepareLinkedInAction(document, message.payload)
      .then(async (result) => {
        if (result.ok && message.memberId) {
          const auditEvent =
            result.prepared === "connection" ? "prepared_connection" : "prepared_message";
          chrome.runtime.sendMessage({
            type: "AUDIT_EVENT",
            memberId: message.memberId,
            body: { event: auditEvent },
          });
        }
        sendResponse(result);
      })
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  });
})();
