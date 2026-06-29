import { Router } from 'express';
import type { ApiServices } from '../container';
import type { TokenUtil } from '../auth/token';
import { requireAuth, userId } from '../auth/middleware';
import { asyncHandler, sendData, take } from '../http/respond';
import { notFound } from '../http/errors';
import { presentUser } from '../http/present';
import { parseRegisterBody } from '../http/validate';

export function buildAuthRouter(services: ApiServices, token: TokenUtil): Router {
  const router = Router();

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const { email } = parseRegisterBody(req.body);
      const user = take(await services.auth.register(email));
      sendData(res, 201, { user: presentUser(user), token: token.sign(user.id) });
    }),
  );

  router.get(
    '/me',
    requireAuth(token),
    asyncHandler(async (req, res) => {
      const user = take(await services.auth.getUser(userId(req)));
      if (user === null) throw notFound('user not found');
      sendData(res, 200, { user: presentUser(user) });
    }),
  );

  return router;
}
