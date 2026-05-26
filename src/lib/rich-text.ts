const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "i",
  "li",
  "ol",
  "p",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

const DROP_TAGS = new Set([
  "applet",
  "base",
  "embed",
  "form",
  "frame",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "script",
  "style",
  "svg",
  "textarea",
]);

const BLOCK_TAGS = new Set(["blockquote", "div", "h1", "h2", "h3", "li", "ol", "p", "ul"]);
const INLINE_STYLE_PROPS = new Set(["font-style", "font-weight", "text-align", "text-decoration"]);

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'");
}

export function stripRichTextToPlainText(value: string): string {
  if (!value) return "";

  return decodeBasicEntities(
    value
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function plainTextToHtml(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeStyle(style: string, tagName: string): string {
  return style
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [rawName, ...rawValueParts] = rule.split(":");
      const name = rawName?.trim().toLowerCase();
      const value = rawValueParts.join(":").trim().toLowerCase();

      if (!name || !value || !INLINE_STYLE_PROPS.has(name)) return "";
      if (name === "text-align") {
        if (!BLOCK_TAGS.has(tagName)) return "";
        return /^(left|right|center|justify)$/.test(value) ? `${name}: ${value}` : "";
      }
      if (name === "font-weight") {
        return /^(bold|bolder|[5-9]00)$/.test(value) ? "font-weight: 700" : "";
      }
      if (name === "font-style") {
        return value === "italic" ? "font-style: italic" : "";
      }
      if (name === "text-decoration") {
        const decorations = value
          .split(/\s+/)
          .filter((part) => part === "underline" || part === "line-through");
        return decorations.length ? `text-decoration: ${decorations.join(" ")}` : "";
      }

      return "";
    })
    .filter(Boolean)
    .join("; ");
}

function sanitizeWithDom(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const source = node as HTMLElement;
    const sourceTag = source.tagName.toLowerCase();

    if (DROP_TAGS.has(sourceTag)) return null;

    const normalizedTag = sourceTag === "b" ? "strong" : sourceTag === "i" ? "em" : sourceTag;
    const children = Array.from(source.childNodes)
      .map(cleanNode)
      .filter((child): child is Node => Boolean(child));

    if (!ALLOWED_TAGS.has(sourceTag)) {
      const fragment = document.createDocumentFragment();
      children.forEach((child) => fragment.appendChild(child));
      return fragment;
    }

    const target = document.createElement(normalizedTag);

    if (source.hasAttribute("style")) {
      const style = sanitizeStyle(source.getAttribute("style") || "", normalizedTag);
      if (style) target.setAttribute("style", style);
    }

    const align = source.getAttribute("align")?.toLowerCase();
    if (align && BLOCK_TAGS.has(normalizedTag) && /^(left|right|center|justify)$/.test(align)) {
      target.style.textAlign = align;
    }

    if (normalizedTag === "a") {
      const href = source.getAttribute("href");
      const safeHref = href ? normalizeUrl(href) : null;
      if (!safeHref) {
        const fragment = document.createDocumentFragment();
        children.forEach((child) => fragment.appendChild(child));
        return fragment;
      }
      target.setAttribute("href", safeHref);
      target.setAttribute("target", "_blank");
      target.setAttribute("rel", "noopener noreferrer");
    }

    children.forEach((child) => target.appendChild(child));
    return target;
  };

  const container = document.createElement("div");
  Array.from(template.content.childNodes)
    .map(cleanNode)
    .filter((child): child is Node => Boolean(child))
    .forEach((child) => container.appendChild(child));

  return container.innerHTML
    .replace(/<p>(?:\s|&nbsp;|<br>)*<\/p>/gi, "")
    .replace(/<div>(?:\s|&nbsp;|<br>)*<\/div>/gi, "");
}

function sanitizeWithoutDom(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi, (tag) =>
      tag.replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    )
    .replace(/\s(href|src)=("|\')\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/<\/?(script|style|iframe|object|embed|svg|form|input|textarea|meta|link|base)[^>]*>/gi, "");
}

export function sanitizeRichTextHtml(html: string): string {
  if (!html?.trim()) return "";
  if (typeof document === "undefined") return sanitizeWithoutDom(html);
  return sanitizeWithDom(html);
}

export function renderRichMessageContent(content: string): string {
  if (!content?.trim()) return "";
  return looksLikeHtml(content) ? sanitizeRichTextHtml(content) : plainTextToHtml(content);
}

export function normalizeLinkInput(value: string): string | null {
  return normalizeUrl(value);
}
