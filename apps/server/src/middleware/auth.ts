import { Elysia } from "elysia";
import { auth } from "../core/auth";

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        
        if (!session) {
          return status(401);
        }
        
        return {
          user: session.user,
          session: session.session,
        };
      },
    },
  });

