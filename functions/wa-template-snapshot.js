/**
 * Arma el texto/botones a lacrar en waRequestSnapshot.
 * No toca Merkle ni Polygon: solo campos extra del snapshot de envío.
 */

function paramTexts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    if (p && typeof p === 'object' && p.text != null) return String(p.text);
    return String(p ?? '');
  });
}

function fillPlaceholders(template, values) {
  return String(template || '').replace(/\{\{(\d+)\}\}/g, (_, raw) => {
    const i = Number(raw) - 1;
    return values[i] != null && String(values[i]) !== '' ? String(values[i]) : `{{${raw}}}`;
  });
}

function findComponent(components, type) {
  if (!Array.isArray(components)) return null;
  const t = String(type || '').toUpperCase();
  return (
    components.find((c) => String(c?.type || '').toUpperCase() === t) || null
  );
}

function headerText(component) {
  if (!component) return null;
  const format = String(component.format || 'TEXT').toUpperCase();
  if (format !== 'TEXT') return null;
  const text = String(component.text || '').trim();
  return text || null;
}

function pickApprovedTemplate(list, templateLang) {
  const rows = Array.isArray(list) ? list : [];
  if (!rows.length) return null;
  const lang = String(templateLang || 'es_AR').toLowerCase();
  const approved = rows.filter((t) => {
    const st = String(t.status || '').toUpperCase();
    return !st || st === 'APPROVED';
  });
  const pool = approved.length ? approved : rows;
  return (
    pool.find((t) => String(t.language || '').toLowerCase() === lang) || pool[0] || null
  );
}

/**
 * URL que vio el usuario: prefijo aprobado en Meta + parámetro del request, o URL estática.
 * Si falta cualquiera de las dos piezas de un botón dinámico, no inventa host.
 */
function effectiveButtonUrl(templateUrl, urlParameter) {
  const base = String(templateUrl || '').trim();
  if (!base) return null;
  if (/\{\{\s*1\s*\}\}/.test(base)) {
    const param = String(urlParameter || '').trim();
    if (!param) return null;
    return base.replace(/\{\{\s*1\s*\}\}/g, param);
  }
  return base;
}

function buttonsFromMeta(components, urlParameter) {
  const block = findComponent(components, 'BUTTONS');
  const raw = block && Array.isArray(block.buttons) ? block.buttons : [];
  const out = [];
  for (const b of raw) {
    const type = String(b?.type || '').toUpperCase();
    const text = String(b?.text || '').trim() || null;
    if (type === 'URL') {
      const param = urlParameter != null && String(urlParameter).trim() ? String(urlParameter).trim() : null;
      out.push({
        type: 'URL',
        text,
        urlParameter: param,
        url: effectiveButtonUrl(b.url, param),
      });
    } else if (text) {
      out.push({ type: type || 'QUICK_REPLY', text, urlParameter: null, url: null });
    }
  }
  return out;
}

/**
 * @param {object} input
 * @param {object|null} input.metaTemplate  Template Graph (components, id, …) o null si el GET falló
 * @param {string|null} [input.fallbackBody] BODY local de confianza (solo template default Notificas)
 * @param {unknown} input.bodyParameters
 * @param {unknown} input.buttonParameters  Parámetros del componente button del POST, o null
 * @param {boolean} input.requestIncludedUrlButton
 */
function buildWhatsAppTemplateEvidence(input) {
  const bodyValues = paramTexts(input.bodyParameters);
  const buttonValues = paramTexts(input.buttonParameters);
  const urlParameter = buttonValues[0] || null;
  const meta = input.metaTemplate && typeof input.metaTemplate === 'object' ? input.metaTemplate : null;
  const components = meta && Array.isArray(meta.components) ? meta.components : null;

  let renderedBody = null;
  let templateBodyMissing = true;
  if (components) {
    const bodyComp = findComponent(components, 'BODY');
    const bodyTpl = bodyComp && String(bodyComp.text || '').trim();
    if (bodyTpl) {
      renderedBody = fillPlaceholders(bodyTpl, bodyValues);
      templateBodyMissing = false;
    }
  }
  if (templateBodyMissing && input.fallbackBody && String(input.fallbackBody).trim()) {
    renderedBody = fillPlaceholders(String(input.fallbackBody).trim(), bodyValues);
    templateBodyMissing = false;
  }

  const renderedHeader = components ? headerText(findComponent(components, 'HEADER')) : null;
  const footerComp = components ? findComponent(components, 'FOOTER') : null;
  const renderedFooter =
    footerComp && String(footerComp.text || '').trim() ? String(footerComp.text).trim() : null;

  let sentButtons = [];
  if (components) {
    sentButtons = buttonsFromMeta(components, urlParameter);
  } else if (input.requestIncludedUrlButton && urlParameter) {
    sentButtons = [
      {
        type: 'URL',
        text: null,
        urlParameter,
        url: null,
      },
    ];
  }

  return {
    renderedBody,
    renderedHeader: renderedHeader || null,
    renderedFooter: renderedFooter || null,
    templateBodyMissing,
    templateId: meta && meta.id ? String(meta.id) : null,
    sentButtons,
  };
}

module.exports = {
  fillPlaceholders,
  pickApprovedTemplate,
  effectiveButtonUrl,
  buildWhatsAppTemplateEvidence,
  paramTexts,
};
