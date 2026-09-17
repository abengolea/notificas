import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { newMarketingEntityId } from "../domain/ids";
import { MARKETING_AI_CONVERSATIONS, MARKETING_AI_MESSAGES } from "../collections";
import { CRM_AI_HISTORY_MESSAGES } from "./config";

export type StoredAiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  toolNames?: string[];
  createdAt: string;
};

export type StoredAiConversation = {
  id: string;
  workspaceId: string;
  userId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};

export type ConversationStore = {
  get(id: string, workspaceId: string, userId: string): Promise<StoredAiConversation | null>;
  create(input: { workspaceId: string; userId: string; title: string }): Promise<StoredAiConversation>;
  touch(id: string): Promise<void>;
  listMessages(conversationId: string): Promise<StoredAiMessage[]>;
  addMessage(msg: Omit<StoredAiMessage, "id" | "createdAt"> & { createdAt?: string }): Promise<StoredAiMessage>;
};

export function createMemoryConversationStore(): ConversationStore {
  const convos = new Map<string, StoredAiConversation>();
  const messages = new Map<string, StoredAiMessage[]>();
  return {
    async get(id, workspaceId, userId) {
      const row = convos.get(id);
      if (!row || row.workspaceId !== workspaceId || row.userId !== userId) return null;
      return row;
    },
    async create(input) {
      const now = new Date().toISOString();
      const row: StoredAiConversation = {
        id: newMarketingEntityId(),
        workspaceId: input.workspaceId,
        userId: input.userId,
        title: input.title.slice(0, 80),
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
      };
      convos.set(row.id, row);
      messages.set(row.id, []);
      return row;
    },
    async touch(id) {
      const row = convos.get(id);
      if (!row) return;
      const now = new Date().toISOString();
      convos.set(id, { ...row, updatedAt: now, lastMessageAt: now });
    },
    async listMessages(conversationId) {
      return messages.get(conversationId) || [];
    },
    async addMessage(msg) {
      const row: StoredAiMessage = {
        ...msg,
        id: newMarketingEntityId(),
        createdAt: msg.createdAt || new Date().toISOString(),
      };
      const list = messages.get(msg.conversationId) || [];
      list.push(row);
      messages.set(msg.conversationId, list);
      return row;
    },
  };
}

export function createLiveConversationStore(): ConversationStore {
  return {
    async get(id, workspaceId, userId) {
      try {
        const snap = await getAdminDb().collection(MARKETING_AI_CONVERSATIONS).doc(id).get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        if (data.workspaceId !== workspaceId || data.userId !== userId) return null;
        return { id: snap.id, ...(data as Omit<StoredAiConversation, "id">) };
      } catch {
        return null;
      }
    },
    async create(input) {
      const now = new Date().toISOString();
      const id = newMarketingEntityId();
      const row: StoredAiConversation = {
        id,
        workspaceId: input.workspaceId,
        userId: input.userId,
        title: input.title.slice(0, 80),
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
      };
      await getAdminDb().collection(MARKETING_AI_CONVERSATIONS).doc(id).set({
        ...row,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastMessageAt: FieldValue.serverTimestamp(),
      });
      return row;
    },
    async touch(id) {
      await getAdminDb().collection(MARKETING_AI_CONVERSATIONS).doc(id).update({
        updatedAt: FieldValue.serverTimestamp(),
        lastMessageAt: FieldValue.serverTimestamp(),
      });
    },
    async listMessages(conversationId) {
      try {
        const snap = await getAdminDb()
          .collection(MARKETING_AI_MESSAGES)
          .where("conversationId", "==", conversationId)
          .limit(50)
          .get();
        return snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              conversationId,
              role: data.role,
              content: String(data.content || ""),
              toolNames: Array.isArray(data.toolNames) ? data.toolNames.map(String) : undefined,
              createdAt: String(data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || ""),
            } as StoredAiMessage;
          })
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      } catch {
        return [];
      }
    },
    async addMessage(msg) {
      const id = newMarketingEntityId();
      const createdAt = msg.createdAt || new Date().toISOString();
      await getAdminDb().collection(MARKETING_AI_MESSAGES).doc(id).set({
        ...msg,
        id,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ...msg, id, createdAt };
    },
  };
}

export function conversationWindow(messages: StoredAiMessage[], limit = CRM_AI_HISTORY_MESSAGES): StoredAiMessage[] {
  return messages.slice(-limit);
}
