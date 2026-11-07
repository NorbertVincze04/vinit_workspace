import type { Request } from 'express';
import { z } from 'zod';

/** Validates part of a request. Throws ZodError, which the error handler turns into 400 + field messages. */
export const parseBody = <S extends z.ZodType>(schema: S, req: Request): z.infer<S> => schema.parse(req.body ?? {});
export const parseQuery = <S extends z.ZodType>(schema: S, req: Request): z.infer<S> => schema.parse(req.query ?? {});
export const parseParams = <S extends z.ZodType>(schema: S, req: Request): z.infer<S> => schema.parse(req.params ?? {});
