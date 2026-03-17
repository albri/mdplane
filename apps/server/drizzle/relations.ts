import { relations } from "drizzle-orm/relations";
import { workspaces, apiKeys, files, appends, auditLogs, user, account, session, capabilityKeys, exportJobs, folders, users, sessions, userWorkspaces, webhooks, webhookDeliveries } from "./schema";

export const apiKeysRelations = relations(apiKeys, ({one}) => ({
	workspace: one(workspaces, {
		fields: [apiKeys.workspaceId],
		references: [workspaces.id]
	}),
}));

export const workspacesRelations = relations(workspaces, ({many}) => ({
	apiKeys: many(apiKeys),
	auditLogs: many(auditLogs),
	capabilityKeys: many(capabilityKeys),
	exportJobs: many(exportJobs),
	files: many(files),
	folders: many(folders),
	userWorkspaces: many(userWorkspaces),
	webhooks: many(webhooks),
}));

export const appendsRelations = relations(appends, ({one}) => ({
	file: one(files, {
		fields: [appends.fileId],
		references: [files.id]
	}),
}));

export const filesRelations = relations(files, ({one, many}) => ({
	appends: many(appends),
	workspace: one(workspaces, {
		fields: [files.workspaceId],
		references: [workspaces.id]
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	workspace: one(workspaces, {
		fields: [auditLogs.workspaceId],
		references: [workspaces.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	sessions: many(session),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const capabilityKeysRelations = relations(capabilityKeys, ({one}) => ({
	workspace: one(workspaces, {
		fields: [capabilityKeys.workspaceId],
		references: [workspaces.id]
	}),
}));

export const exportJobsRelations = relations(exportJobs, ({one}) => ({
	workspace: one(workspaces, {
		fields: [exportJobs.workspaceId],
		references: [workspaces.id]
	}),
}));

export const foldersRelations = relations(folders, ({one}) => ({
	workspace: one(workspaces, {
		fields: [folders.workspaceId],
		references: [workspaces.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	sessions: many(sessions),
}));

export const userWorkspacesRelations = relations(userWorkspaces, ({one}) => ({
	workspace: one(workspaces, {
		fields: [userWorkspaces.workspaceId],
		references: [workspaces.id]
	}),
}));

export const webhooksRelations = relations(webhooks, ({one, many}) => ({
	workspace: one(workspaces, {
		fields: [webhooks.workspaceId],
		references: [workspaces.id]
	}),
	deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({one}) => ({
	webhook: one(webhooks, {
		fields: [webhookDeliveries.webhookId],
		references: [webhooks.id]
	}),
}));