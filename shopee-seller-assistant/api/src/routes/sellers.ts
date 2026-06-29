import { Router } from 'express';
import type { ApiServices } from '../container';
import type { TokenUtil } from '../auth/token';
import { requireAuth, userId } from '../auth/middleware';
import { asyncHandler, sendData, take } from '../http/respond';
import { notFound } from '../http/errors';
import { presentSeller, presentVersion } from '../http/present';
import { parseAsOfDate, parseSellerBody, parseVersionBody } from '../http/validate';

export function buildSellersRouter(services: ApiServices, token: TokenUtil): Router {
  const router = Router();
  router.use(requireAuth(token));

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseSellerBody(req.body);
      const seller = take(await services.sellers.create({ userId: userId(req), ...body }));
      sendData(res, 201, presentSeller(seller));
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const sellers = take(await services.sellers.list(userId(req)));
      sendData(res, 200, sellers.map(presentSeller));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const seller = take(await services.sellers.getById(req.params.id!));
      if (seller === null) throw notFound('seller profile not found');
      sendData(res, 200, presentSeller(seller));
    }),
  );

  // Seller-scoped fee-profile reads/creates.
  router.get(
    '/:sellerId/fee-profile',
    asyncHandler(async (req, res) => {
      const asOf = parseAsOfDate(req.query.asOf);
      const version = take(await services.feeProfile.getActiveProfile(req.params.sellerId!, asOf));
      if (version === null) throw notFound('no active fee profile');
      sendData(res, 200, presentVersion(version));
    }),
  );

  router.post(
    '/:sellerId/fee-profiles',
    asyncHandler(async (req, res) => {
      const version = parseVersionBody(req.body, req.params.sellerId!);
      const created = take(await services.feeProfile.createVersion(version));
      sendData(res, 201, presentVersion(created));
    }),
  );

  return router;
}
