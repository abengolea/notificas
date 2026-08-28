export function inferMcpClientFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("chatgpt") || n.includes("openai")) return "chatgpt";
  if (n.includes("claude") || n.includes("anthropic")) return "claude";
  return "unknown";
}

export function inferMcpClientFromUserAgent(ua: string | null | undefined): string | null {
  const n = (ua || "").toLowerCase();
  if (!n) return null;
  if (n.includes("chatgpt") || n.includes("openai")) return "chatgpt";
  if (n.includes("claude") || n.includes("anthropic")) return "claude";
  return null;
}
