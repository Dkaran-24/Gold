import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@showroom/database';
import { ZodError } from 'zod';
import type { Logger } from 'pino';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted fields.', fields: error.flatten() } });
      return;
    }
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2034'].includes(error.code)) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'This record already exists or is still referenced by another record.' } });
      return;
    }
    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
      return;
    }
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'This request exceeds the maximum permitted size.' } });
      return;
    }
    // Do not log request bodies, SQL parameters, credentials, or raw Prisma error messages.
    logger.error({ errorType: error instanceof Error ? error.name : 'UnknownError' }, 'Request failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to complete this request. Please try again.' } });
  };
}
