import type { RequestHandler } from 'express';
import { config } from '../config';

// Lightweight HTTP access log: method, path, status, and duration. Logged once
// the response finishes. Silent under NODE_ENV=test to keep test output clean.
export const requestLogger: RequestHandler = (req, res, next) => {
  if (config.isTest) return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`
    );
  });
  next();
};
