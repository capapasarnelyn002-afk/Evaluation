import type { Request, Response } from 'express';
import { app, initializeServer } from '../server';

export default async function handler(req: Request, res: Response) {
  try {
    await initializeServer();
    app(req, res);
  } catch (error) {
    console.error('Failed to initialize the Vercel API function:', error);
    if (req.url?.startsWith('/api/database/status')) {
      return res.status(503).json({
        connected: false,
        hint: 'Database initialization failed. Check the Vercel function logs and confirm supabase/schema.sql has been run.'
      });
    }
    return res.status(503).json({ error: 'The application database is unavailable.' });
  }
}
