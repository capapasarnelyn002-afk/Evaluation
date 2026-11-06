import type { Request, Response } from 'express';
import { app, initializeServer } from '../server';

function sendJson(response: Response, statusCode: number, body: object) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export default async function handler(req: Request, res: Response) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const isHealthCheck = pathname === '/api/health' || pathname === '/health';
  const isDatabaseStatus = pathname === '/api/database/status' || pathname === '/database/status';

  try {
    if (!isHealthCheck && !isDatabaseStatus) {
      await initializeServer();
    }
    app(req, res);
  } catch (error) {
    console.error('Failed to initialize the Vercel API function:', error);
    if (isDatabaseStatus) {
      sendJson(res, 503, {
        connected: false,
        hint: 'Database initialization failed. Check the Vercel function logs and confirm supabase/schema.sql has been run.'
      });
      return;
    }
    sendJson(res, 503, { error: 'The application database is unavailable.' });
  }
}
