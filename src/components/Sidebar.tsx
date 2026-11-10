import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { 
  Building2, 
  BarChart3, 
  Users, 
  FileSpreadsheet, 
  ShieldCheck, 
  Settings, 
  Calendar, 
  Sparkles, 
  FileText, 
  Award, 
  Home, 
  CheckCircle2, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  X,
  UserCheck,
  HelpCircle,
  Palette,
  FileEdit,
  ClipboardList,
  GraduationCap,
  Landmark,
  BookOpen
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    currentUser, 
    role, 
    currentView, 
    setCurrentView, 
    sidebarCollapsed, 
    setSidebarCollapsed, 
    mobileMenuOpen, 
    setMobileMenuOpen, 
    setShowAboutModal, 
    logout,
    evaluations,
    activities,
    forms,
    surveys,
    theme
  } = useApp();

  interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }

  const getNavItems = (): NavItem[] => {
    if (role !== 'admin') return [];
    return [
          { id: 'overview', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'activities', label: 'Evaluation Activities', icon: <Calendar className="w-4 h-4" />, badge: activities.length },
          { id: 'form_builder', label: 'Evaluation Form Builder', icon: <FileEdit className="w-4 h-4" />, badge: forms.length },
          { id: 'surveys', label: 'Surveys', icon: <ClipboardList className="w-4 h-4" />, badge: surveys.length },
          { id: 'reports', label: 'Results & Reports', icon: <Sparkles className="w-4 h-4" /> },
          { id: 'submissions', label: 'Submissions Feed', icon: <FileSpreadsheet className="w-4 h-4" />, badge: evaluations.length },
          { id: 'users', label: 'User Management', icon: <Users className="w-4 h-4" /> },
          { id: 'appearance', label: 'Sidebar & Appearance', icon: <Palette className="w-4 h-4" /> },
          { id: 'audit', label: 'Activity Logs', icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
          { id: 'account', label: 'My Account', icon: <UserCheck className="w-4 h-4" /> }
        ];
  };

  const navItems = getNavItems();

  const getRoleBadgeStyle = (userRole: UserRole) => {
    return userRole === 'admin'
      ? 'bg-[#EAF3FC] text-[#003366] border-[#D9E4F0]'
      : 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const renderLogoIcon = (iconName?: string) => {
    switch (iconName) {
      case 'graduation':
        return <GraduationCap className="w-5 h-5 shrink-0" />;
      case 'award':
        return <Award className="w-5 h-5 shrink-0" />;
      case 'shield':
        return <ShieldCheck className="w-5 h-5 shrink-0" />;
      case 'landmark':
        return <Landmark className="w-5 h-5 shrink-0" />;
      case 'book':
        return <BookOpen className="w-5 h-5 shrink-0" />;
      case 'sparkles':
        return <Sparkles className="w-5 h-5 shrink-0" />;
      case 'building':
      default:
        return <Building2 className="w-5 h-5 shrink-0" />;
    }
  };

  const getLogoShapeClass = (shape?: string) => {
    switch (shape) {
      case 'circle':
        return 'rounded-full';
      case 'square':
        return 'rounded-xs';
      case 'rounded':
      default:
        return 'rounded-xl';
    }
  };

  const logoBg = theme.sidebarLogoBg || theme.primaryColor;
  const logoColor = theme.sidebarLogoColor || theme.accentColor;
  const logoTextColor = theme.sidebarLogoTextColor || theme.sidebarTextColor || '#1e293b';
  const sidebarBorder = theme.sidebarBorderColor || '#e2e8f0';
  const activeItemBg = theme.sidebarActiveItemBg || theme.primaryColor;
  const activeItemText = theme.sidebarActiveItemText || '#ffffff';

  const renderLogoContent = (collapsed = false) => {
    if (theme.sidebarLogoType === 'image' && theme.sidebarLogoUrl) {
      return (
        <img
          src={theme.sidebarLogoUrl}
          alt={theme.logoText || 'University Logo'}
          className={`${collapsed ? 'w-6 h-6' : 'w-5.5 h-5.5'} object-contain shrink-0`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }
    return renderLogoIcon(theme.sidebarLogoIcon);
  };

  const sidebarContent = (
    <div 
      className="h-full min-h-0 flex flex-col text-slate-800 border-r select-none"
      style={{ backgroundColor: theme.sidebarBgColor, color: theme.sidebarTextColor, borderColor: sidebarBorder }}
    >
      {/* Top Brand Header */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`h-16 flex items-center border-b ${sidebarCollapsed ? 'justify-center px-2 relative' : 'justify-between px-4'}`} style={{ borderColor: sidebarBorder }}>
          {sidebarCollapsed ? (
            <div className="relative flex items-center justify-center">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className={`w-10 h-10 ${getLogoShapeClass(theme.sidebarLogoShape)} flex items-center justify-center font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer relative group overflow-hidden`}
                style={{ backgroundColor: logoBg, color: logoColor }}
                title="Click to expand sidebar"
              >
                {renderLogoContent(true)}
                <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 shadow-xs group-hover:bg-slate-100 transition-colors">
                  <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <div 
                  className={`w-9 h-9 ${getLogoShapeClass(theme.sidebarLogoShape)} flex items-center justify-center font-bold shrink-0 shadow-xs transition-colors overflow-hidden`}
                  style={{ backgroundColor: logoBg, color: logoColor }}
                >
                  {renderLogoContent(false)}
                </div>
                <div className="flex flex-col truncate min-w-0">
                  <span 
                    className="font-bold text-sm tracking-tight truncate leading-tight"
                    style={{ color: logoTextColor }}
                  >
                    {theme.logoText || 'SLSU-Hinunangan'}
                  </span>
                  <span 
                    className="text-[10px] font-semibold tracking-wide uppercase truncate opacity-80"
                    style={{ color: logoTextColor }}
                  >
                    {theme.siteTagline ? 'Evaluation System' : 'Extension Evaluation'}
                  </span>
                </div>
              </div>

              {/* Desktop Collapse Toggle */}
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Mobile Close Toggle */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Identity / Role Pill */}
        {!sidebarCollapsed && (
          <div
            className="px-4 py-3 border-b"
            style={{ backgroundColor: theme.sidebarBgColor, borderColor: sidebarBorder }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Current Role
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${getRoleBadgeStyle(role)}`}>
                {role}
              </span>
            </div>
            <p className="text-xs font-bold mt-1 truncate" style={{ color: theme.sidebarTextColor }}>
              {currentUser.name}
            </p>
            <p className="text-[11px] truncate opacity-70" style={{ color: theme.sidebarTextColor }}>
              {currentUser.title || currentUser.department}
            </p>
          </div>
        )}

        {/* Main Navigation List */}
        <nav className="min-h-0 flex-1 p-2 space-y-1 mt-2 overflow-y-auto overscroll-contain">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'shadow-xs'
                    : 'hover:bg-slate-50'
                } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                style={{
                  color: isActive ? activeItemText : theme.sidebarTextColor,
                  ...(isActive ? { backgroundColor: activeItemBg } : {})
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div style={isActive ? { color: logoColor } : {}}>
                  {item.icon}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between text-left truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom profile and account actions */}
      <div
        className="p-3 border-t space-y-2"
        style={{ borderColor: sidebarBorder, backgroundColor: theme.sidebarBgColor, color: theme.sidebarTextColor }}
      >
        {/* Capstone Project Info */}
        <button
          onClick={() => setShowAboutModal(true)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors cursor-pointer ${
            sidebarCollapsed ? 'justify-center px-2' : ''
          }`}
          style={{ color: theme.sidebarTextColor }}
          title="Capstone Defense Information (May 2026)"
        >
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
          {!sidebarCollapsed && <span>Developer Info</span>}
        </button>

        {/* Logout button */}
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer ${
            sidebarCollapsed ? 'justify-center px-2' : ''
          }`}
          title="Sign out"
        >
          <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>

      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside 
        className={`hidden lg:block fixed top-0 left-0 h-dvh z-30 transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-80 max-w-[calc(100vw-2rem)] h-full bg-white shadow-2xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
