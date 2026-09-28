(function initCrmBridge() {
  const EVENT = "NOTIFICAS_LINKEDIN_ASSISTANT_PREPARE";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== EVENT) return;
    const payload = event.data.payload;
    if (!payload?.action?.contact?.linkedinUrl) return;

    chrome.runtime.sendMessage({
      type: "OPEN_AND_PREPARE",
      action: payload.action,
      memberId: payload.memberId || payload.action?.memberId,
    });
  });
})();
