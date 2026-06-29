import { Router } from 'express';
import type { ApiServices } from '../container';
import type { TokenUtil } from '../auth/token';
import { requireAuth } from '../auth/middleware';
import { asyncHandler, sendData, take } from '../http/respond';
import { notFound } from '../http/errors';
import { presentVersion } from '../http/present';
import { parseSellerProfileId, parseVersionBody } from '../http/validate';

export function buildFeeProfilesRouter(services: ApiServices, token: TokenUtil): Router {
  const router = Router();
  router.use(requireAuth(token));

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const sellerProfileId = parseSellerProfileId(req.body);
      const version = parseVersionBody(req.body, sellerProfileId);
      const updated = take(await services.feeProfile.replaceVersion(req.params.id!, version));
      sendData(res, 200, presentVersion(updated));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const removed = take(await services.feeProfile.deactivateVersion(req.params.id!));
      if (!removed) throw notFound('fee profile not found');
      sendData(res, 200, { deactivated: true });
    }),
  );

  return router;
}
