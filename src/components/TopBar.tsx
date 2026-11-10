import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Menu, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Award, 
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { DatabaseStatusIndicator } from './DatabaseStatusIndicator';

export const TopBar: React.FC = () => {
  const { 
    currentUser, 
    role, 
    currentView, 
    goBack,
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

  const headerBg = theme.headerBackgroundColor || theme.headerBgColor || '#FFFFFF';
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
          className="min-h-12 px-3 sm:px-6 text-xs flex flex-wrap items-center justify-between gap-y-2 border-b"
          style={{
            backgroundColor: headerBg,
            color: headerText,
            borderColor: theme.headerBorderColor || 'rgba(255,255,255,0.12)',
            minHeight: headerHeight,
            height: 'auto',
            padding: headerPadding,
            fontFamily: theme.headerFontFamily || 'Inter, system-ui, sans-serif',
            fontSize: theme.headerFontSize || '0.75rem',
            fontWeight: theme.headerFontWeight || 600,
            letterSpacing: '0.01em'
          }}
        >
          <div className="min-w-0 flex-1" />
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
      <div className="px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-2" style={{ minHeight: headerVisible ? 'auto' : '52px' }}>
        
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[#D9E4F0] bg-white px-3 text-xs font-semibold text-[#003366] transition-colors hover:bg-[#EAF3FC]"
            aria-label="Go back to the previous page"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 capitalize flex-wrap">
              <span>Administrator Portal</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-slate-600 font-medium">{currentView.replace('_', ' ')}</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 break-words">
              {getViewTitle()}
            </h1>
          </div>
        </div>

        {/* Right action controls: network mode and offline sync */}
        <div className="flex w-full sm:w-auto items-center justify-end gap-2 shrink-0 flex-wrap">
          <DatabaseStatusIndicator compact />
          
          {/* Offline/Online Network Indicator Button */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              isOfflineMode
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                : 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
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
                <Wifi className="w-3.5 h-3.5 text-blue-700" />
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
