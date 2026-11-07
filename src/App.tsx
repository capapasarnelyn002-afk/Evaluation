import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AdminDashboardView } from './components/dashboards/AdminDashboardView';
import { ParticipantDashboardView } from './components/dashboards/ParticipantDashboardView';
import { EvaluationReceiptModal } from './components/EvaluationReceiptModal';
import { OfflineSyncModal } from './components/OfflineSyncModal';
import { CapstoneAboutModal } from './components/CapstoneAboutModal';
import { LoginModal } from './components/LoginModal';
import { ToastContainer } from './components/ui/Toast';
import { Building2, ShieldCheck, Award } from 'lucide-react';

const normalizeContentBlocks = (blocks?: any[]) => {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(block => block && block.visible !== false);
};

const renderManagedBlock = (block: any, index: number, mode: 'footer' | 'page' = 'footer') => {
  const baseClass = mode === 'footer'
    ? 'min-w-0'
    : 'rounded-xl border border-slate-200 bg-white p-4 shadow-xs';

  if (block.type === 'heading' || block.type === 'footer-column') {
    return (
      <div key={block.id || index} className={baseClass}>
        {block.title && <p className="font-semibold text-xs mb-1 opacity-100">{block.title}</p>}
        {block.body && <p className="text-[11px] opacity-90">{block.body}</p>}
      </div>
    );
  }

  if (block.type === 'text' || block.type === 'paragraph' || block.type === 'announcement') {
    return (
      <div key={block.id || index} className={baseClass}>
        {block.title && <p className="font-semibold text-xs mb-1 opacity-100">{block.title}</p>}
        {block.body && <p className="text-[11px] opacity-90">{block.body}</p>}
      </div>
    );
  }

  if (block.type === 'button') {
    return (
      <div key={block.id || index} className={baseClass}>
        <button type="button" className="px-3 py-1.5 rounded-md bg-emerald-900 text-white text-[11px] font-semibold">
          {block.buttonLabel || block.title || 'Action'}
        </button>
      </div>
    );
  }

  return (
    <div key={block.id || index} className={baseClass}>
      {block.title && <p className="font-semibold text-xs mb-1 opacity-100">{block.title}</p>}
      {block.body && <p className="text-[11px] opacity-90">{block.body}</p>}
    </div>
  );
};

const MainLayout: React.FC = () => {
  const { 
    role, 
    isAuthenticated,
    isAuthLoading,
    sidebarCollapsed,
    lastSubmittedEvaluation, 
    setLastSubmittedEvaluation, 
    activities,
    toasts,
    dismissToast,
    theme
  } = useApp();

  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        {isAuthLoading ? (
          <p className="text-sm text-slate-600">Checking sign-in session...</p>
        ) : (
          <LoginModal />
        )}
      </div>
    );
  }

  const currentActivityForReceipt = lastSubmittedEvaluation
    ? activities.find(a => a.id === lastSubmittedEvaluation.activityId) || activities[0]
    : null;

  const footerBlocks = normalizeContentBlocks(theme.footerContent);
  const pageContentSections = Object.entries(theme.pageContent || {}).filter(([, blocks]) => Array.isArray(blocks) && blocks.length > 0);

  const renderDashboardByRole = () => {
    switch (role) {
      case 'admin':
        return <AdminDashboardView />;
      case 'participant':
      default:
        return <ParticipantDashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col">
      {/* Fixed Desktop Sidebar & Mobile Drawer */}
      <Sidebar />

      {/* Main Content Area Offset by Desktop Sidebar */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        {/* Sticky Top Bar */}
        <TopBar />

        {/* Dashboard Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-16">
          {pageContentSections.length > 0 && (
            <div className="space-y-4 mb-6">
              {pageContentSections.map(([pageKey, blocks]) => (
                <section key={pageKey} className="space-y-3">
                  {normalizeContentBlocks(blocks as any[]).map((block, index) => renderManagedBlock(block, index, 'page'))}
                </section>
              ))}
            </div>
          )}
          {renderDashboardByRole()}
        </main>

        {/* Database-backed footer */}
        {theme.footerEnabled !== false && (
          <footer
            className="border-t py-8 px-6 text-xs mt-auto"
            style={{
              backgroundColor: theme.footerBackgroundColor || '#0f172a',
              color: theme.footerTextColor || '#cbd5e1',
              borderColor: theme.footerBorderColor || '#1e293b',
              fontFamily: theme.footerFontFamily || 'Inter, system-ui, sans-serif',
              fontSize: theme.footerFontSize || '0.75rem',
              fontWeight: theme.footerFontWeight || 500,
              padding: theme.footerPadding || '2rem 1.5rem'
            }}
          >
            {footerBlocks.length > 0 ? (
              <div className="max-w-7xl mx-auto grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
                {footerBlocks.map((block, index) => renderManagedBlock(block, index, 'footer'))}
              </div>
            ) : (
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  {theme.footerLogoVisible !== false && (
                    <div
                      className="rounded-lg border flex items-center justify-center text-amber-400 font-bold shrink-0"
                      style={{
                        width: theme.footerLogoSize || '32px',
                        height: theme.footerLogoSize || '32px',
                        backgroundColor: theme.primaryColor || '#022c22',
                        borderColor: theme.secondaryColor || '#065f46'
                      }}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-white text-xs">{theme.footerTitle || 'Institutional footer'}</p>
                    <p style={{ color: theme.footerTextColor || '#cbd5e1' }} className="text-[11px] opacity-90">
                      {theme.footerSubtitle || 'Updated via administrator content settings.'}
                    </p>
                  </div>
                </div>

                <div className="text-center md:text-right space-y-1">
                  <p className="font-medium text-slate-200">Evaluation system footer</p>
                  <p style={{ color: theme.footerTextColor || '#cbd5e1' }} className="text-[11px] opacity-90">
                    Content is managed from the admin appearance settings.
                  </p>
                </div>
              </div>
            )}
          </footer>
        )}
      </div>

      {/* Official Attendance & Evaluation Receipt Modal */}
      {lastSubmittedEvaluation && currentActivityForReceipt && (
        <EvaluationReceiptModal
          evaluation={lastSubmittedEvaluation}
          activity={currentActivityForReceipt}
          onClose={() => setLastSubmittedEvaluation(null)}
        />
      )}

      {/* Offline Synchronization Modal */}
      <OfflineSyncModal />

      {/* Capstone Project Information Modal */}
      <CapstoneAboutModal />

      {/* Real-time Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
