import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { type Result, isErr } from '@core/errors';
import type { CalcError } from '@core/errors';
import { fromCalcError } from './errors';

/** Consistent success envelope: `{ data: ... }`. */
export function sendData(res: Response, status: number, data: unknown): void {
  res.status(status).json({ data });
}

/** Wrap an async handler so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

/** Unwrap a service Result, throwing a typed HttpError(400) on a CalcError. */
export function take<T>(result: Result<T, CalcError>): T {
  if (isErr(result)) {
    throw fromCalcError(result.error);
  }
  return result.value;
}
