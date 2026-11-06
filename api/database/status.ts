import type { Request, Response } from 'express';

function getSupabaseCredentials() {
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const apiKey = process.env.SUPABASE_SECRET_KEY;

  if (!projectUrl || !apiKey) return null;

  try {
    const url = new URL(projectUrl);
    if (url.protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return { projectUrl, apiKey };
}

function sendJson(response: Response, statusCode: number, body: object) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export default async function handler(_request: Request, response: Response) {
  const credentials = getSupabaseCredentials();
  if (!credentials) {
    sendJson(response, 503, {
      connected: false,
      hint: 'Check SUPABASE_URL and SUPABASE_SECRET_KEY in the Vercel project settings.'
    });
    return;
  }

  const headers = new Headers({ apikey: credentials.apiKey });
  if (!credentials.apiKey.startsWith('sb_secret_')) {
    headers.set('Authorization', `Bearer ${credentials.apiKey}`);
  }

  try {
    const databaseResponse = await fetch(`${credentials.projectUrl}/rest/v1/users?select=id&limit=1`, {
      headers,
      signal: AbortSignal.timeout(8_000)
    });

    if (databaseResponse.ok) {
      sendJson(response, 200, { connected: true });
      return;
    }

    const hint = databaseResponse.status === 401 || databaseResponse.status === 403
      ? 'Supabase rejected the server key. Confirm it belongs to the project in SUPABASE_URL.'
      : databaseResponse.status === 404
        ? 'The Supabase users table was not found. Run supabase/schema.sql in the SQL Editor.'
        : 'Supabase could not complete the database check.';
    console.error(`Supabase database status check failed with HTTP ${databaseResponse.status}.`);
    sendJson(response, 503, { connected: false, hint });
  } catch (error) {
    console.error('Supabase database status request failed:', error);
    sendJson(response, 503, {
      connected: false,
      hint: 'Could not reach Supabase. Check the project URL and database availability.'
    });
  }
}
