import { Elysia } from 'elysia';
import { zMeResponse, zLogoutResponse, zError } from '@mdplane/shared';
import { handleGetMe, handleLogout } from './handlers';

export const authRoute = new Elysia()
  .get('/auth/me', async ({ request, set }) => {
    const result = await handleGetMe(request);
    set.status = result.status;
    if (result.status === 200) {
      return zMeResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    response: {
      200: zMeResponse,
      401: zError,
    },
  })
  .post('/auth/logout', async ({ request, set }) => {
    const result = await handleLogout(request);
    set.status = result.status;
    if (result.setCookieHeader) {
      set.headers['Set-Cookie'] = result.setCookieHeader;
    }
    if (result.status === 200) {
      return zLogoutResponse.parse(result.body);
    }
    return zError.parse(result.body);
  }, {
    response: {
      200: zLogoutResponse,
      401: zError,
    },
  });
