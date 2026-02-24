import { and, eq } from 'drizzle-orm';
import { auth } from '../../core/auth';
import { db } from '../../db';
import { userWorkspaces, workspaces } from '../../db/schema';

type SessionWorkspaceErrorCode = 'UNAUTHORIZED' | 'NOT_FOUND';

type SessionWorkspaceResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: { code: SessionWorkspaceErrorCode; message: string } };

type ValidateSessionForWorkspaceInput = {
  request: Request;
  workspaceId: string;
};

export async function validateSessionForWorkspace(
  input: ValidateSessionForWorkspaceInput
): Promise<SessionWorkspaceResult> {
  const { request, workspaceId } = input;

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: { code: 'UNAUTHORIZED', message: 'No valid session' },
    };
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (!workspace || workspace.deletedAt) {
    return {
      ok: false,
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Workspace not found' },
    };
  }

  const membership = await db.query.userWorkspaces.findFirst({
    where: and(
      eq(userWorkspaces.userId, session.user.id),
      eq(userWorkspaces.workspaceId, workspaceId)
    ),
  });

  if (!membership) {
    return {
      ok: false,
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Workspace not found' },
    };
  }

  return {
    ok: true,
    userId: session.user.id,
  };
}
