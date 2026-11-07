import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Menu, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Award, 
  ChevronRight
} from 'lucide-react';
import { DatabaseStatusIndicator } from './DatabaseStatusIndicator';

export const TopBar: React.FC = () => {
  const { 
    currentUser, 
    role, 
    currentView, 
    setMobileMenuOpen, 
    isOfflineMode, 
    setIsOfflineMode, 
    offlineQueue, 
    setShowSyncModal, 
    setShowAboutModal,
    theme
  } = useApp();

  const getViewTitle = () => {
    switch (currentView) {
      case 'overview':
        if (role === 'admin') return 'Executive Dashboard & Live System Monitoring';
        return 'Participant Portal';
      case 'activities': return 'Evaluation Activity Management';
      case 'form_builder': return 'Evaluation Form Builder & Rubrics';
      case 'surveys': return 'Survey Management & Stakeholder Assessments';
      case 'reports': return 'Evaluation Results, AI Synthesis & Analytics';
      case 'submissions': return 'Participant Evaluation Submissions Feed';
      case 'users': return 'User Management & Role Permissions';
      case 'appearance': return 'Website Appearance & Typography Settings';
      case 'audit': return 'Activity Logs & RA 10173 Audit Trail';
      case 'settings': return 'System Settings & Accreditation Benchmarks';
      case 'account': return 'My Account & Profile Details';
      case 'portal': return 'Extension Services Participant Portal';
      case 'evaluate': return 'Submit Extension Evaluation';
      case 'surveys_participant': return 'Community Stakeholder Surveys';
      case 'history': return 'My Evaluation Receipts & Certificates';
      case 'calendar': return 'Upcoming Extension Calendar';
      default: return 'Extension Services Evaluation System';
    }
  };

  const headerBg = theme.headerBackgroundColor || theme.headerBgColor || '#022c22';
  const headerText = theme.headerTextColor || '#ffffff';
  const headerVisible = theme.headerEnabled !== false;
  const headerHeight = theme.headerHeight || '52px';
  const headerPadding = theme.headerPadding || '0.5rem 1.5rem';

  return (
    <header
      className="sticky top-0 z-20 bg-white border-b border-slate-200"
      style={{
        borderRadius: theme.headerBorderRadius || '0px',
        overflow: 'hidden'
      }}
    >
      {headerVisible && (
        <div
          className="px-4 sm:px-6 text-xs flex items-center justify-between border-b"
          style={{
            backgroundColor: headerBg,
            color: headerText,
            borderColor: theme.headerBorderColor || 'rgba(255,255,255,0.12)',
            minHeight: headerHeight,
            height: headerHeight,
            padding: headerPadding,
            fontFamily: theme.headerFontFamily || 'Inter, system-ui, sans-serif',
            fontSize: theme.headerFontSize || '0.75rem',
            fontWeight: theme.headerFontWeight || 600,
            letterSpacing: '0.01em'
          }}
        >
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap" />
          <div className="flex items-center gap-3 shrink-0 text-[11px]">
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="hover:opacity-100 opacity-90 transition-opacity cursor-pointer font-medium flex items-center gap-1"
              style={{ color: theme.accentColor }}
            >
              <Award className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Top Bar */}
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4" style={{ minHeight: headerVisible ? 'auto' : '52px' }}>
        
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="truncate">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 capitalize">
              <span>{role} Portal</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-slate-600 font-medium">{currentView.replace('_', ' ')}</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate tracking-tight">
              {getViewTitle()}
            </h1>
          </div>
        </div>

        {/* Right action controls: network mode and offline sync */}
        <div className="flex items-center gap-2 shrink-0">
          <DatabaseStatusIndicator />
          
          {/* Offline/Online Network Indicator Button */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              isOfflineMode
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
            }`}
            title={isOfflineMode ? 'Field mode active. Click to switch to online.' : 'Online connected. Click to simulate field offline mode.'}
          >
            {isOfflineMode ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Offline Field</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">Online Sync</span>
              </>
            )}
          </button>

          {/* Sync Queue Trigger Button */}
          {offlineQueue.length > 0 && (
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer animate-pulse"
              title="Review pending offline evaluations"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sync ({offlineQueue.length})</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
