import {
  clearAuditQueue,
  forceFlushAuditQueue,
  logAction,
  type AuditAction,
  type ResourceType,
  type ActorType,
} from '../../../services/audit';

type SeedAuditLogInput = {
  workspaceId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourcePath?: string;
  actor?: string;
  actorType?: ActorType;
};

export function resetAuditServiceState(): void {
  clearAuditQueue();
}

export async function seedAuditLog(input: SeedAuditLogInput): Promise<void> {
  logAction({
    workspaceId: input.workspaceId,
    action: input.action,
    resourceType: input.resourceType,
    resourcePath: input.resourcePath,
    actor: input.actor,
    actorType: input.actorType,
  });
  await forceFlushAuditQueue();
}

export function logAuditAction(input: SeedAuditLogInput): void {
  logAction({
    workspaceId: input.workspaceId,
    action: input.action,
    resourceType: input.resourceType,
    resourcePath: input.resourcePath,
    actor: input.actor,
    actorType: input.actorType,
  });
}

export async function flushAuditQueue(): Promise<void> {
  await forceFlushAuditQueue();
}
