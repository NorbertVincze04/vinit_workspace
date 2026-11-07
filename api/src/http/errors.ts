import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** An error with an HTTP status and a stable machine-readable code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Record'): HttpError => new HttpError(404, 'not_found', `${what} not found.`);

/** { "amountBani": "Expected integer" } — first message per field. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Postgres errors that are the client's fault, mapped to a status instead of a 500. */
const PG_ERRORS: Record<string, [number, string, string]> = {
  '23503': [409, 'invalid_reference', 'A linked record does not exist, or is still in use.'],
  '23505': [409, 'conflict', 'A record with the same value already exists.'],
  '23514': [400, 'validation', 'A value is outside the allowed range.'],
  '23502': [400, 'validation', 'A required value is missing.'],
  '22P02': [400, 'validation', 'A value has the wrong format.'],
  '22001': [400, 'validation', 'A value is too long.'],
  '22003': [400, 'validation', 'A number is too large.'],
  '22007': [400, 'validation', 'A date has the wrong format.'],
  '22008': [400, 'validation', 'A date is out of range.'],
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('Endpoint'));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'validation', message: 'Some fields are not valid.', fields: zodFields(err) } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
    return;
  }
  // Body-parser and multer errors carry a 4xx status (bad JSON, payload too large…).
  const e = err as { status?: number; statusCode?: number; code?: string; constraint?: string; message?: string };
  const status = Number(e.status ?? e.statusCode);
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: { code: 'bad_request', message: e.message || 'Bad request.' } });
    return;
  }
  if (e.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: { code: 'too_large', message: 'The file is larger than 50 MB.' } });
    return;
  }
  if (e.code && PG_ERRORS[e.code]) {
    const [s, code, message] = PG_ERRORS[e.code];
    res.status(s).json({ error: { code, message, detail: e.constraint } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong on the server.' } });
};
