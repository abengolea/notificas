import type { MarketingServiceContext } from "../context";
import { marketingListMembershipId } from "../domain/ids";
import type { MarketingListMembership } from "../domain/types";
import type { MarketingMembershipRepository } from "../repositories/types";
import { nowIso } from "../persistence/timestamps";
import { requireFound } from "./scope";

/**
 * Memberships v2. NO escribe `contact.listIds[]`.
 * No está enchufado a las APIs de campañas actuales.
 */
export function createMembershipService(memberships: MarketingMembershipRepository) {
  return {
    async addContactToList(
      ctx: MarketingServiceContext,
      input: { listId: string; contactId: string; source?: string },
    ) {
      const id = marketingListMembershipId(input.listId, input.contactId, ctx.workspaceId);
      const existing = await memberships.getById(ctx.workspaceId, id);
      if (existing) return existing;
      const doc: MarketingListMembership = {
        id,
        workspaceId: ctx.workspaceId,
        listId: input.listId,
        contactId: input.contactId,
        addedAt: nowIso(),
        addedBy: ctx.actorId,
        source: input.source,
      };
      await memberships.add(doc);
      return doc;
    },

    async removeContactFromList(ctx: MarketingServiceContext, listId: string, contactId: string) {
      const id = marketingListMembershipId(listId, contactId, ctx.workspaceId);
      await memberships.remove(ctx.workspaceId, id);
    },

    async isContactInList(ctx: MarketingServiceContext, listId: string, contactId: string) {
      const id = marketingListMembershipId(listId, contactId, ctx.workspaceId);
      return Boolean(await memberships.getById(ctx.workspaceId, id));
    },

    async listContactsForList(ctx: MarketingServiceContext, listId: string, cursor?: string, limit?: number) {
      return memberships.listContactsForList(ctx.workspaceId, listId, cursor, limit);
    },

    async listListsForContact(ctx: MarketingServiceContext, contactId: string, cursor?: string, limit?: number) {
      return memberships.listListsForContact(ctx.workspaceId, contactId, cursor, limit);
    },

    async getMembership(ctx: MarketingServiceContext, id: string) {
      return requireFound(await memberships.getById(ctx.workspaceId, id), "Membresía", id);
    },
  };
}

export type MembershipService = ReturnType<typeof createMembershipService>;
