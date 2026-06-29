import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { ApiServices } from './container';
import type { TokenUtil } from './auth/token';
import { HttpError } from './http/errors';
import { buildAuthRouter } from './routes/auth';
import { buildSellersRouter } from './routes/sellers';
import { buildFeeProfilesRouter } from './routes/feeProfiles';
import { buildCalculationsRouter } from './routes/calculations';

export interface AppDeps {
  readonly services: ApiServices;
  readonly token: TokenUtil;
}

function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'route not found' } });
}

function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.body() });
    return;
  }
  // body-parser / express client errors (e.g. malformed JSON) carry a 4xx status.
  const status =
    typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined;
  if (status !== undefined && status >= 400 && status < 500) {
    res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'invalid request body' } });
    return;
  }
  res.status(500).json({ error: { code: 'INTERNAL', message: 'internal server error' } });
}

/** Build the Express app (not listening). Pure given its deps — used directly
 *  by supertest in integration tests. */
export function buildApp({ services, token }: AppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ data: { status: 'ok' } });
  });

  app.use('/api/auth', buildAuthRouter(services, token));
  app.use('/api/sellers', buildSellersRouter(services, token));
  app.use('/api/fee-profiles', buildFeeProfilesRouter(services, token));
  app.use('/api/calculations', buildCalculationsRouter(services, token));

  app.use(notFoundHandler);
  app.use(errorMiddleware);
  return app;
}
