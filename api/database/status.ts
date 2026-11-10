import type { Request, Response } from 'express';

function getSupabaseCredentials() {
  const projectUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.replace(/\/+$/, '');
  const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_SECRET;

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
    const snapshotHeaders = new Headers(headers);
    snapshotHeaders.set('Content-Type', 'application/json');
    const [databaseResponse, snapshotResponse, themeResponse, settingsResponse] = await Promise.all([
      fetch(`${credentials.projectUrl}/rest/v1/users?select=id&limit=1`, {
        headers,
        signal: AbortSignal.timeout(8_000)
      }),
      fetch(`${credentials.projectUrl}/rest/v1/rpc/load_app_snapshot`, {
        method: 'POST',
        headers: snapshotHeaders,
        body: '{}',
        signal: AbortSignal.timeout(8_000)
      }),
      fetch(`${credentials.projectUrl}/rest/v1/website_themes?id=eq.default&select=data%2C%22updatedAt%22&limit=1`, {
        headers,
        signal: AbortSignal.timeout(8_000)
      }),
      fetch(`${credentials.projectUrl}/rest/v1/system_settings?id=eq.default&select=data%2C%22updatedAt%22&limit=1`, {
        headers,
        signal: AbortSignal.timeout(8_000)
      })
    ]);

    if (databaseResponse.ok && snapshotResponse.ok && themeResponse.ok && settingsResponse.ok) {
      const snapshot = await snapshotResponse.json() as { themePersistenceReady?: boolean };
      if (!snapshot.themePersistenceReady) {
        sendJson(response, 503, {
          connected: false,
          hint: 'The application database needs the latest supabase/schema.sql so appearance settings can be saved.'
        });
        return;
      }
      sendJson(response, 200, { connected: true });
      return;
    }

    const failedResponse = [databaseResponse, snapshotResponse, themeResponse, settingsResponse].find((item) => !item.ok)!;
    const hint = failedResponse.status === 401 || failedResponse.status === 403
      ? 'Supabase rejected the server key. Confirm it belongs to the project in SUPABASE_URL.'
      : failedResponse.status === 404
        ? 'The Supabase application schema or configuration tables are missing. Run the latest supabase/schema.sql in the SQL Editor.'
        : 'Supabase could not complete the database or application persistence check.';
    console.error(`Supabase database status check failed with HTTP ${failedResponse.status}.`);
    sendJson(response, 503, { connected: false, hint });
  } catch (error) {
    console.error('Supabase database status request failed:', error);
    sendJson(response, 503, {
      connected: false,
      hint: 'Could not reach Supabase. Check the project URL and database availability.'
    });
  }
}
