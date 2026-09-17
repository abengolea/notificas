import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "../context";
import { createMemoryCrmToolRuntime } from "../tools/runtime";
import { createMemoryConversationStore } from "./conversations";
import { runCrmAssistantTurn } from "./loop";
import type { CrmLlmPort, CrmLlmTurn } from "./provider";

function scriptedLlm(steps: CrmLlmTurn[]): CrmLlmPort {
  let i = 0;
  return {
    async generate() {
      const step = steps[Math.min(i, steps.length - 1)];
      i += 1;
      return step;
    },
  };
}

function fnCall(name: string, args: unknown, call_id = `call_${name}`): CrmLlmTurn {
  return { text: "", functionCalls: [{ call_id, name, arguments: args }] };
}

test("Chile companies question calls search_companies", async () => {
  const { runtime } = createMemoryCrmToolRuntime();
  const conversations = createMemoryConversationStore();
  const convo = await conversations.create({ workspaceId: "notificas-internal", userId: "adrian", title: "t" });
  const calls: string[] = [];
  const llm = scriptedLlm([
    fnCall("search_companies", { countryCode: "CL" }),
    { text: "En Chile hay las empresas que devolvió el CRM.", functionCalls: [] },
  ]);
  const wrapped: CrmLlmPort = {
    async generate(input) {
      const res = await llm.generate(input);
      for (const call of res.functionCalls) calls.push(call.name);
      return res;
    },
  };
  await runtime.services.companies.createCompany(marketingContext("notificas-internal", { actorType: "user" }), {
    name: "Acme Chile",
    countryCode: "CL",
  });
  const result = await runCrmAssistantTurn({
    runtime,
    llm: wrapped,
    conversations,
    ai: {
      workspaceId: "notificas-internal",
      userId: "adrian",
      actorType: "ai",
      actorId: "ai:adrian",
      conversationId: convo.id,
    },
    message: "¿Qué empresas tenemos en Chile?",
    audit: async () => undefined,
  });
  assert.ok(calls.includes("search_companies"));
  assert.ok(result.message.includes("Chile"));
});

test("create Acme Chile uses create_company", async () => {
  const { runtime } = createMemoryCrmToolRuntime();
  const conversations = createMemoryConversationStore();
  const convo = await conversations.create({ workspaceId: "notificas-internal", userId: "adrian", title: "t" });
  const llm = scriptedLlm([
    fnCall("create_company", { name: "Acme Chile", countryCode: "CL" }),
    { text: "Empresa creada: Acme Chile", functionCalls: [] },
  ]);
  const result = await runCrmAssistantTurn({
    runtime,
    llm,
    conversations,
    ai: {
      workspaceId: "notificas-internal",
      userId: "adrian",
      actorType: "ai",
      actorId: "ai:adrian",
      conversationId: convo.id,
    },
    message: "Creá Acme Chile",
    audit: async () => undefined,
  });
  assert.ok(result.actions.some((a) => a.tool === "create_company" && a.write));
  const listed = await runtime.services.companies.searchCompanies(
    marketingContext("notificas-internal"),
    { query: "Acme Chile" },
  );
  assert.equal(listed.items.length, 1);
});

test("add Juan to Acme searches then creates contact", async () => {
  const { runtime } = createMemoryCrmToolRuntime();
  await runtime.services.companies.createCompany(marketingContext("notificas-internal"), {
    name: "Acme",
    countryCode: "CL",
  });
  const conversations = createMemoryConversationStore();
  const convo = await conversations.create({ workspaceId: "notificas-internal", userId: "adrian", title: "t" });
  const llm = scriptedLlm([
    fnCall("search_companies", { query: "Acme" }),
    fnCall("create_contact", { email: "juan@acme.test", name: "Juan", companyName: "Acme" }),
    { text: "Contacto creado", functionCalls: [] },
  ]);
  const result = await runCrmAssistantTurn({
    runtime,
    llm,
    conversations,
    ai: {
      workspaceId: "notificas-internal",
      userId: "adrian",
      actorType: "ai",
      actorId: "ai:adrian",
      conversationId: convo.id,
    },
    message: "Agregá Juan a Acme",
    audit: async () => undefined,
  });
  assert.ok(result.actions.some((a) => a.tool === "search_companies"));
  assert.ok(result.actions.some((a) => a.tool === "create_contact"));
});
