(function initSafety(global) {
  const NS = (global.NotificasAssistant = global.NotificasAssistant || {});

  NS.FORBIDDEN_AUTO_ACTIONS = Object.freeze([
    "send_invitation",
    "send_message",
    "send_followup",
  ]);

  const SEND_LABELS = [
    /^send$/i,
    /^enviar$/i,
    /^send invitation$/i,
    /^enviar invitaci[oó]n$/i,
    /^send now$/i,
    /^enviar ahora$/i,
  ];

  NS.isForbiddenSendElement = function isForbiddenSendElement(el) {
    if (!el || !(el instanceof Element)) return false;
    const text = (el.textContent || "").trim();
    const aria = (el.getAttribute("aria-label") || "").trim();
    const combined = `${text} ${aria}`.trim();
    return SEND_LABELS.some((re) => re.test(combined));
  };

  NS.assertNotForbiddenAutoAction = function assertNotForbiddenAutoAction(action) {
    if (NS.FORBIDDEN_AUTO_ACTIONS.includes(action)) {
      throw new Error(`Acción prohibida: ${action}. El envío final debe ser manual.`);
    }
  };

  NS.assertSafeToClick = function assertSafeToClick(el) {
    if (NS.isForbiddenSendElement(el)) {
      throw new Error("Click bloqueado: elemento de envío final detectado.");
    }
  };

  NS.safeClick = function safeClick(action, el) {
    NS.assertNotForbiddenAutoAction(action);
    NS.assertSafeToClick(el);
    el.click();
  };
})(typeof window !== "undefined" ? window : self);
