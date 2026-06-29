import { Router } from 'express';
import type { ApiServices } from '../container';
import type { TokenUtil } from '../auth/token';
import { requireAuth } from '../auth/middleware';
import { asyncHandler, sendData, take } from '../http/respond';
import { presentProfit, presentBreakEven, presentRecommend } from '../http/present';
import { parseProfitBody, parseBreakEvenBody, parseRecommendBody } from '../http/validate';

export function buildCalculationsRouter(services: ApiServices, token: TokenUtil): Router {
  const router = Router();
  router.use(requireAuth(token));

  router.post(
    '/profit',
    asyncHandler(async (req, res) => {
      const request = parseProfitBody(req.body);
      const result = take(await services.calculation.calculateProfit(request));
      sendData(res, 200, presentProfit(result));
    }),
  );

  router.post(
    '/break-even',
    asyncHandler(async (req, res) => {
      const request = parseBreakEvenBody(req.body);
      const result = take(await services.pricing.calculateBreakEven(request));
      sendData(res, 200, presentBreakEven(result));
    }),
  );

  router.post(
    '/recommend',
    asyncHandler(async (req, res) => {
      const request = parseRecommendBody(req.body);
      const result = take(await services.pricing.recommend(request));
      sendData(res, 200, presentRecommend(result));
    }),
  );

  return router;
}
