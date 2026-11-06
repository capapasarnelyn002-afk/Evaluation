import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, LoaderCircle, XCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';

type DatabaseStatus = 'checking' | 'connected' | 'disconnected';

export const DatabaseStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<DatabaseStatus>('checking');

  useEffect(() => {
    let active = true;

    const checkDatabaseStatus = async () => {
      try {
        const response = await apiFetch('/api/database/status');
        if (active) setStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
        if (active) setStatus('disconnected');
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
    <div
      role="status"
      aria-live="polite"
      title={
        status === 'connected'
          ? 'Connected to the Supabase database'
          : status === 'disconnected'
            ? 'Unable to reach the Supabase database'
            : 'Checking the Supabase database connection'
      }
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
  );
};
