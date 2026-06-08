import type { Response } from 'express';

// All API responses use a { data, error } envelope — never a raw array/object
// at the top level.
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data, error: null });
}

export function fail(res: Response, status: number, message: string): Response {
  return res.status(status).json({ data: null, error: message });
}
