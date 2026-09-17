import { CRM_FORBIDDEN_TOOL_NAMES, CRM_READ_TOOL_NAMES, CRM_WRITE_TOOL_NAMES, type CrmToolName, type CrmToolResult, type CrmToolRuntime, type CrmToolContext } from "./types";
import { CRM_READ_HANDLERS } from "./read";
import { CRM_WRITE_HANDLERS } from "./write";
import { crmErrorCode } from "./errors";
import { limitJson, stripClientTenant } from "./sanitize";

const READ = new Set<string>(CRM_READ_TOOL_NAMES);
const WRITE = new Set<string>(CRM_WRITE_TOOL_NAMES);
const FORBIDDEN = new Set<string>(CRM_FORBIDDEN_TOOL_NAMES);

export type CrmToolMode = "read" | "readwrite";

export function isCrmReadTool(name: string): name is (typeof CRM_READ_TOOL_NAMES)[number] {
  return READ.has(name);
}

export function isCrmWriteTool(name: string): name is (typeof CRM_WRITE_TOOL_NAMES)[number] {
  return WRITE.has(name);
}

export async function executeCrmTool(opts: {
  runtime: CrmToolRuntime;
  ctx: CrmToolContext;
  name: string;
  args: unknown;
  mode: CrmToolMode;
}): Promise<CrmToolResult> {
  const name = (opts.name || "").trim();
  if (FORBIDDEN.has(name) || name.startsWith("send_")) {
    return {
      ok: false,
      tool: name,
      write: true,
      error: {
        code: "forbidden_tool",
        message: "Esa operación no está disponible. El asistente no envía campañas ni correos y no borra entidades.",
      },
    };
  }
  if (WRITE.has(name) && opts.mode !== "readwrite") {
    return {
      ok: false,
      tool: name,
      write: true,
      error: {
        code: "read_only",
        message: "Este canal CRM es de solo lectura. Las escrituras se hacen en el asistente interno de Notificas.",
      },
    };
  }
  const handler = READ.has(name)
    ? CRM_READ_HANDLERS[name as keyof typeof CRM_READ_HANDLERS]
    : WRITE.has(name)
      ? CRM_WRITE_HANDLERS[name as keyof typeof CRM_WRITE_HANDLERS]
      : null;
  if (!handler) {
    return {
      ok: false,
      tool: name,
      write: false,
      error: { code: "unknown_tool", message: `Herramienta CRM desconocida: ${name}` },
    };
  }
  const stripped = stripClientTenant(opts.args ?? {});
  const parsed = handler.schema.safeParse(stripped);
  if (!parsed.success) {
    return {
      ok: false,
      tool: name,
      write: WRITE.has(name),
      error: {
        code: "validation_error",
        message: parsed.error.issues[0]?.message || "Argumentos de herramienta inválidos.",
      },
    };
  }
  try {
    const result = await handler.run(opts.runtime, opts.ctx, parsed.data as never);
    if (result.ok) {
      return { ...result, data: limitJson(result.data) };
    }
    return result;
  } catch (err) {
    const mapped = crmErrorCode(err);
    if (mapped.code === "internal_error") {
      console.error("crm tool", name, err instanceof Error ? err.message : err);
    }
    return {
      ok: false,
      tool: name,
      write: WRITE.has(name),
      error: mapped,
    };
  }
}

export function assertKnownCrmTool(name: string): asserts name is CrmToolName {
  if (!READ.has(name) && !WRITE.has(name)) {
    throw new Error(`unknown crm tool: ${name}`);
  }
}
