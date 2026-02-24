import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '../../core/auth';
import { db } from '../../db';
import { userWorkspaces, workspaces } from '../../db/schema';
import { serverEnv } from '../../config/env';

const APP_URL = serverEnv.appUrl;

const BETTERAUTH_COOKIE_NAME = 'better-auth.session_token';
const BETTERAUTH_SECURE_COOKIE_NAME = '__Secure-better-auth.session_token';

export async function handleGetMe(request: Request): Promise<{ status: number; body: Record<string, unknown> }> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      status: 401,
      body: {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No valid session',
        },
      },
    };
  }

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
    })
    .from(userWorkspaces)
    .innerJoin(workspaces, eq(userWorkspaces.workspaceId, workspaces.id))
    .where(and(eq(userWorkspaces.userId, session.user.id), isNull(workspaces.deletedAt)));

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || undefined,
        image: session.user.image || undefined,
        workspaces: rows.map((w) => ({
          id: w.id,
          name: w.name?.trim() || `Workspace ${w.id.slice(-6)}`,
        })),
        createdAt: session.user.createdAt.toISOString(),
        webUrl: `${APP_URL}/control`,
      },
    },
  };
}

export async function handleLogout(request: Request): Promise<{
  status: number;
  body: Record<string, unknown>;
  setCookieHeader?: string;
}> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      status: 401,
      body: {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No valid session',
        },
      },
    };
  }

  try {
    await auth.api.signOut({ headers: request.headers });
  } catch {
    // Ignore sign-out errors when session has already been invalidated.
  }

  const setCookieHeader = [
    `${BETTERAUTH_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    `${BETTERAUTH_SECURE_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`,
  ].join(', ');

  return {
    status: 200,
    setCookieHeader,
    body: {
      ok: true,
      data: {
        status: 'logged_out',
      },
    },
  };
}
