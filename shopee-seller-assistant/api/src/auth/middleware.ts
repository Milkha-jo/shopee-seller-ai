import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { isErr } from '@core/errors';
import type { TokenUtil } from './token';
import { unauthorized } from '../http/errors';

export interface AuthedRequest extends Request {
  auth?: { userId: string };
}

/** Returns middleware that requires a valid `Authorization: Bearer <token>`
 *  header and attaches `{ userId }` to the request. */
export function requireAuth(token: TokenUtil): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (header === undefined || !header.startsWith('Bearer ')) {
      next(unauthorized('missing bearer token'));
      return;
    }
    const result = token.verify(header.slice('Bearer '.length));
    if (isErr(result)) {
      next(unauthorized(result.error.message));
      return;
    }
    (req as AuthedRequest).auth = { userId: result.value.sub };
    next();
  };
}

/** Read the authenticated user id (guaranteed present behind requireAuth). */
export function userId(req: Request): string {
  return (req as AuthedRequest).auth!.userId;
}
