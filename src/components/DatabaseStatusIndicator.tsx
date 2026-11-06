import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, LoaderCircle, XCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';

type DatabaseStatus = 'checking' | 'connected' | 'disconnected';

interface DatabaseStatusIndicatorProps {
  showHint?: boolean;
}

export const DatabaseStatusIndicator: React.FC<DatabaseStatusIndicatorProps> = ({ showHint = false }) => {
  const [status, setStatus] = useState<DatabaseStatus>('checking');
  const [hint, setHint] = useState('');

  useEffect(() => {
    let active = true;

    const checkDatabaseStatus = async () => {
      try {
        const response = await apiFetch('/api/database/status');
        if (active && response.ok) {
          setStatus('connected');
          setHint('');
        } else if (active) {
          const result = await response.json() as { hint?: string };
          setStatus('disconnected');
          setHint(result.hint || (response.status === 404
            ? 'The Vercel API route is missing. Redeploy after adding the API function.'
            : 'Check the Vercel function logs for the database connection error.'));
        }
      } catch {
        if (active) {
          setStatus('disconnected');
          setHint('Could not reach the application API. Confirm the Vercel deployment is up to date.');
        }
      }
    };

    void checkDatabaseStatus();
    const intervalId = window.setInterval(() => void checkDatabaseStatus(), 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="status"
        aria-live="polite"
        title={hint || (
          status === 'connected'
            ? 'Connected to the Supabase database'
            : status === 'disconnected'
              ? 'Unable to reach the Supabase database'
              : 'Checking the Supabase database connection'
        )}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
          status === 'connected'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
            : status === 'disconnected'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-slate-50 text-slate-600 border-slate-300'
        }`}
      >
        {status === 'connected' ? (
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        ) : status === 'disconnected' ? (
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <LoaderCircle className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        )}
        <Database className="w-3.5 h-3.5" aria-hidden="true" />
        <span>
          {status === 'connected'
            ? 'Database connected'
            : status === 'disconnected'
              ? 'Database unavailable'
              : 'Checking database'}
        </span>
      </div>
      {showHint && status === 'disconnected' && hint && (
        <p className="max-w-sm text-center text-xs text-rose-700">{hint}</p>
      )}
    </div>
  );
};
