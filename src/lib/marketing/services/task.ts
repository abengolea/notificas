import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { newMarketingEntityId } from "../domain/ids";
import type { MarketingTask } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { marketingPrioritySchema, marketingTaskTypeSchema } from "../schemas";
import type { MarketingTaskRepository, TaskListFilters } from "../repositories/types";
import { nowIso } from "../persistence/timestamps";
import { createStamps, requireFound, updateStamps } from "./scope";

const createSchema = z.object({
  type: marketingTaskTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  opportunityId: z.string().optional(),
  assignedTo: z.string().max(128).optional(),
  dueAt: z.string().optional(),
  priority: marketingPrioritySchema.optional(),
  source: z.enum(["manual", "system", "ai"]).optional(),
  idempotencyKey: z.string().max(80).optional(),
});

export function createTaskService(tasks: MarketingTaskRepository) {
  return {
    async createTask(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Tarea inválida", parsed.error.flatten());
      const stamps = createStamps(ctx);
      const doc: MarketingTask = {
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        type: parsed.data.type,
        title: parsed.data.title.trim(),
        description: parsed.data.description,
        companyId: parsed.data.companyId,
        contactId: parsed.data.contactId,
        opportunityId: parsed.data.opportunityId,
        assignedTo: parsed.data.assignedTo,
        dueAt: parsed.data.dueAt,
        priority: parsed.data.priority || "normal",
        status: "open",
        source: parsed.data.source || (ctx.actorType === "ai" ? "ai" : "manual"),
        createdAt: stamps.createdAt,
        updatedAt: stamps.updatedAt,
        createdBy: stamps.createdBy,
      };
      await tasks.create(doc);
      return doc;
    },

    async getTask(ctx: MarketingServiceContext, id: string) {
      return requireFound(await tasks.getById(ctx.workspaceId, id), "Tarea", id);
    },

    async updateTask(ctx: MarketingServiceContext, id: string, input: Partial<z.input<typeof createSchema>>) {
      await this.getTask(ctx, id);
      await tasks.update(ctx.workspaceId, id, { ...input, ...updateStamps(ctx) });
      return this.getTask(ctx, id);
    },

    async completeTask(ctx: MarketingServiceContext, id: string) {
      await this.getTask(ctx, id);
      await tasks.update(ctx.workspaceId, id, {
        status: "completed",
        completedAt: nowIso(),
        completedBy: ctx.actorId,
        ...updateStamps(ctx),
      });
      return this.getTask(ctx, id);
    },

    async cancelTask(ctx: MarketingServiceContext, id: string) {
      await this.getTask(ctx, id);
      await tasks.update(ctx.workspaceId, id, { status: "cancelled", ...updateStamps(ctx) });
      return this.getTask(ctx, id);
    },

    async listTasks(ctx: MarketingServiceContext, filters: TaskListFilters = {}) {
      return tasks.list(ctx.workspaceId, filters);
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
