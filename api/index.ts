/**
 * Vercel deploy entry handler, for serverless deployment, please don't modify this file
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from './app.js';
import { assertRuntimeConfig, getConfig } from './config.js';

assertRuntimeConfig(getConfig());

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
