import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Activity, 
  EvaluationSubmission, 
  AuditLog, 
  ActivityType, 
  UserRole, 
  UserAccount,
  EvaluationForm,
  FormSection,
  Survey,
  SurveyResponse,
  WebsiteTheme,
  TypographySettings,
  SystemMetrics
} from '../types';
import { ToastMessage } from '../components/ui/Toast';
import { apiFetch } from '../utils/api';

export interface SystemSettings {
  institutionName: string;
  campusCode: string;
  leadDepartment: string;
  minimumTurnoutTargetPct: number;
  targetSatisfactionMean: number;
  autoSyncOnReconnect: boolean;
  enableDataPrivacyMasking: boolean;
  accreditationCycle: string;
  academicYear: string;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  baseFontSize: 1.0,        // 16px
  pageTitleSize: 1.5,       // 24px
  sectionHeadingSize: 1.125, // 18px
  bodyTextSize: 0.875,      // 14px
  labelSize: 0.75,          // 12px
  buttonTextSize: 0.75,     // 12px
  tableTextSize: 0.75,      // 12px
  navTextSize: 0.875,       // 14px
  metricNumberSize: 1.875,  // 30px
  smallTextSize: 0.6875,    // 11px
  pageTitleColor: '#0f172a',
  sectionHeadingColor: '#1e293b',
  bodyTextColor: '#334155',
  mutedTextColor: '#64748b',
  labelTextColor: '#475569'
};

export const DEFAULT_THEME: WebsiteTheme = {
  siteName: 'Southern Leyte State University',
  siteTagline: 'Extension Services Evaluation System & Decision Support',
  logoText: 'SLSU-Hinunangan',
  primaryColor: '#022c22', // emerald-950
  secondaryColor: '#065f46', // emerald-800
  accentColor: '#d97706', // amber-600
  pageBgColor: '#f8fafc', // slate-50
  cardBgColor: '#ffffff',
  sidebarBgColor: '#ffffff',
  sidebarTextColor: '#1e293b',
  sidebarLogoColor: '#d97706',
  sidebarLogoBg: '#022c22',
  sidebarLogoTextColor: '#1e293b',
  sidebarLogoType: 'icon',
  sidebarLogoUrl: '',
  sidebarLogoIcon: 'building',
  sidebarLogoShape: 'rounded',
  sidebarLogoHistory: [],
  sidebarActiveItemBg: '#022c22',
  sidebarActiveItemText: '#ffffff',
  sidebarBorderColor: '#e2e8f0',
  headerBgColor: '#022c22',
  headerTextColor: '#ffffff',
  buttonPrimaryBg: '#064e3b',
  buttonPrimaryText: '#ffffff',
  linkTextColor: '#065f46',
  fontColorTitle: '#0f172a',
  fontColorHeading: '#1e293b',
  fontColorBody: '#334155',
  fontColorMuted: '#64748b',
  fontColorLabel: '#475569',
  successColor: '#059669',
  warningColor: '#d97706',
  errorColor: '#dc2626',
  themeMode: 'light',
  typography: DEFAULT_TYPOGRAPHY
};

interface AppContextType {
  // Authentication & Role
  currentUser: UserAccount;
  role: UserRole;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  users: UserAccount[];
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole, status?: 'active' | 'inactive') => Promise<void>;
  createUserAccount: (accountData: Partial<UserAccount>) => Promise<UserAccount | null>;
  deleteUserAccount: (userId: string) => Promise<boolean>;
  resetUserPassword: (userId: string) => Promise<boolean>;

  // Navigation & View Layout
  currentView: string;
  setCurrentView: (view: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Domain Data: Activities
  activities: Activity[];
  selectedActivityId: string | null;
  setSelectedActivityId: (id: string | null) => void;
  createActivity: (activityData: Partial<Activity>) => Promise<Activity>;
  importEvaluation: (payload: { requestId: string; title: string; formTitle: string; description: string; instructions: string; activityType: Activity['activityType']; sections: FormSection[] }) => Promise<void>;
  updateActivity: (id: string, activityData: Partial<Activity>) => Promise<Activity>;
  deleteActivity: (id: string) => Promise<boolean>;
  duplicateActivity: (id: string) => Promise<Activity>;

  // Domain Data: Forms Builder
  forms: EvaluationForm[];
  importForm: (payload: { requestId: string; title: string; description: string; instructions: string; sections: FormSection[]; originalFileName?: string }) => Promise<EvaluationForm>;
  createForm: (formData: Partial<EvaluationForm>) => Promise<EvaluationForm>;
  updateForm: (id: string, formData: Partial<EvaluationForm>) => Promise<EvaluationForm>;
  deleteForm: (id: string) => Promise<boolean>;
  duplicateForm: (id: string) => Promise<EvaluationForm>;

  // Domain Data: Surveys
  surveys: Survey[];
  createSurvey: (surveyData: Partial<Survey>) => Promise<Survey>;
  updateSurvey: (id: string, surveyData: Partial<Survey>) => Promise<Survey>;
  deleteSurvey: (id: string) => Promise<boolean>;
  submitSurveyResponse: (surveyId: string, answers: Record<string, any>, name?: string, email?: string) => Promise<boolean>;

  // Domain Data: Website Theme Customization
  theme: WebsiteTheme;
  updateTheme: (newTheme: Partial<WebsiteTheme>, showToast?: boolean) => Promise<void>;
  resetTheme: () => Promise<void>;

  // Domain Data: Evaluations & Sync
  evaluations: EvaluationSubmission[];
  offlineQueue: EvaluationSubmission[];
  isOfflineMode: boolean;
  setIsOfflineMode: (offline: boolean) => void;
  auditLogs: AuditLog[];
  maskPII: boolean;
  setMaskPII: (mask: boolean) => void;
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  systemMetrics: SystemMetrics | null;
  refreshMetrics: () => Promise<void>;
  refreshAllData: () => Promise<void>;
  isLoading: boolean;
  
  // Toast notifications
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Actions
  submitEvaluation: (evaluationData: Partial<EvaluationSubmission>) => Promise<{ success: boolean; evaluation?: EvaluationSubmission; error?: string }>;
  syncOfflineQueue: () => Promise<{ success: boolean; count: number; error?: string }>;
  logAuditAction: (action: string, resourceId: string, reason: string, controlNumber?: string) => Promise<void>;
  updateFollowUpStatus: (evalId: string, status: 'none' | 'pending' | 'in_progress' | 'resolved', notes: string) => Promise<void>;
  
  // UI Modal states
  showAboutModal: boolean;
  setShowAboutModal: (show: boolean) => void;
  showSyncModal: boolean;
  setShowSyncModal: (show: boolean) => void;
  lastSubmittedEvaluation: EvaluationSubmission | null;
  setLastSubmittedEvaluation: (evalItem: EvaluationSubmission | null) => void;
  exportDataAsCSV: (includePII?: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_QUEUE_KEY = 'slsu_ext_offline_queue_v1';
const LOCAL_STORAGE_ACCESS_TOKEN_KEY = 'slsu_ext_access_token_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount>({
    id: '',
    name: '',
    email: '',
    role: 'participant',
    status: 'inactive'
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const role = currentUser.role;

  // Navigation layout state
  const [currentView, setCurrentView] = useState<string>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Users roster for Admin role management
  const [users, setUsers] = useState<UserAccount[]>([]);

  // System Settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    institutionName: 'Southern Leyte State University - Hinunangan Campus',
    campusCode: 'SLSU-HIN',
    leadDepartment: 'Faculty of Computer Studies and Information Technology (FCSIT)',
    minimumTurnoutTargetPct: 80,
    targetSatisfactionMean: 4.00,
    autoSyncOnReconnect: true,
    enableDataPrivacyMasking: true,
    accreditationCycle: 'AACCUP Level III Re-Accreditation (May 2026)',
    academicYear: '2025-2026'
  });

  // Website Theme Customization
  const [theme, setTheme] = useState<WebsiteTheme>(DEFAULT_THEME);

  // Data collections
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [forms, setForms] = useState<EvaluationForm[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationSubmission[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<EvaluationSubmission[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [maskPII, setMaskPII] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal triggers
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [lastSubmittedEvaluation, setLastSubmittedEvaluation] = useState<EvaluationSubmission | null>(null);

  // Apply theme and typography design tokens to CSS variables on DOM
  const applyThemeToDOM = (t: WebsiteTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', t.primaryColor);
    root.style.setProperty('--brand-secondary', t.secondaryColor);
    root.style.setProperty('--brand-accent', t.accentColor);
    root.style.setProperty('--bg-page', t.pageBgColor);
    root.style.setProperty('--bg-card', t.cardBgColor);
    root.style.setProperty('--bg-sidebar', t.sidebarBgColor);
    root.style.setProperty('--text-sidebar', t.sidebarTextColor);
    root.style.setProperty('--sidebar-logo-color', t.sidebarLogoColor || t.accentColor);
    root.style.setProperty('--sidebar-logo-bg', t.sidebarLogoBg || t.primaryColor);
    root.style.setProperty('--sidebar-logo-text', t.sidebarLogoTextColor || t.sidebarTextColor);
    root.style.setProperty('--sidebar-active-bg', t.sidebarActiveItemBg || t.primaryColor);
    root.style.setProperty('--sidebar-active-text', t.sidebarActiveItemText || '#ffffff');
    root.style.setProperty('--sidebar-border', t.sidebarBorderColor || '#e2e8f0');
    root.style.setProperty('--bg-header', t.headerBgColor);
    root.style.setProperty('--text-header', t.headerTextColor);
    root.style.setProperty('--btn-primary-bg', t.buttonPrimaryBg);
    root.style.setProperty('--btn-primary-text', t.buttonPrimaryText);
    root.style.setProperty('--color-link', t.linkTextColor);

    // Typography variables
    const typo = t.typography || DEFAULT_TYPOGRAPHY;
    root.style.setProperty('--font-size-base', `${typo.baseFontSize}rem`);
    root.style.setProperty('--font-size-title', `${typo.pageTitleSize}rem`);
    root.style.setProperty('--font-size-heading', `${typo.sectionHeadingSize}rem`);
    root.style.setProperty('--font-size-body', `${typo.bodyTextSize}rem`);
    root.style.setProperty('--font-size-label', `${typo.labelSize}rem`);
    root.style.setProperty('--font-size-button', `${typo.buttonTextSize}rem`);
    root.style.setProperty('--font-size-table', `${typo.tableTextSize}rem`);
    root.style.setProperty('--font-size-nav', `${typo.navTextSize}rem`);
    root.style.setProperty('--font-size-stat', `${typo.metricNumberSize}rem`);
    root.style.setProperty('--font-size-small', `${typo.smallTextSize}rem`);

    // Font color tokens
    const titleColor = typo.pageTitleColor || t.fontColorTitle || '#0f172a';
    const headingColor = typo.sectionHeadingColor || t.fontColorHeading || '#1e293b';
    const bodyColor = typo.bodyTextColor || t.fontColorBody || '#334155';
    const mutedColor = typo.mutedTextColor || t.fontColorMuted || '#64748b';
    const labelColor = typo.labelTextColor || t.fontColorLabel || '#475569';
    root.style.setProperty('--font-color-title', titleColor);
    root.style.setProperty('--font-color-heading', headingColor);
    root.style.setProperty('--font-color-body', bodyColor);
    root.style.setProperty('--font-color-muted', mutedColor);
    root.style.setProperty('--font-color-label', labelColor);

    // Proportional root scale: adjusts all Tailwind rem values across entire app safely
    const clampedBasePx = Math.max(12, Math.min(22, typo.baseFontSize * 16));
    root.style.fontSize = `${clampedBasePx}px`;
  };

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => {
      const isDuplicate = prev.some(
        t => t.title === toast.title && t.description === toast.description
      );
      if (isDuplicate) return prev;
      const id = `toast-${Date.now()}-${Math.random()}`;
      return [...prev.slice(-2), { ...toast, id }];
    });
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY, data.token);
        setIsAuthenticated(true);
        setCurrentView('overview');
        addToast({
          type: 'success',
          title: 'Sign In Successful',
          description: `Welcome, ${data.user.name}`
        });
        return true;
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: 'Sign In Failed',
          description: err.error || 'Invalid credentials'
        });
        return false;
      }
    } catch {
      addToast({ type: 'error', title: 'Sign In Failed', description: 'The authentication service is unavailable.' });
      return false;
    }
  };

  const logout = async () => {
    const token = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    if (token) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        addToast({ type: 'error', title: 'Sign Out Failed', description: 'Could not contact the authentication service.' });
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    setCurrentUser({ id: '', name: '', email: '', role: 'participant', status: 'inactive' });
    setIsAuthenticated(false);
    setUsers([]);
    setActivities([]);
    setEvaluations([]);
    setForms([]);
    setSurveys([]);
    setAuditLogs([]);
    setSystemMetrics(null);
    setCurrentView('overview');
    addToast({ type: 'info', title: 'Signed Out', description: 'Your session has ended.' });
  };

  // User management
  const updateUserRole = async (userId: string, newRole: UserRole, status: 'active' | 'inactive' = 'active') => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, status })
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? updated : u));
        addToast({
          type: 'success',
          title: 'User Updated',
          description: `${updated.name} updated successfully.`
        });
      }
    } catch {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, status } : u));
    }
  };

  const createUserAccount = async (accountData: Partial<UserAccount>): Promise<UserAccount | null> => {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData)
      });
      if (res.ok) {
        const created = await res.json();
        setUsers(prev => [...prev, created]);
        addToast({
          type: 'success',
          title: 'Account Created',
          description: `${created.name} (${created.role})`
        });
        return created;
      }
    } catch {}
    return null;
  };

  const deleteUserAccount = async (userId: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        addToast({ type: 'info', title: 'User Removed', description: 'Account deleted.' });
        return true;
      }
    } catch {}
    setUsers(prev => prev.filter(u => u.id !== userId));
    return true;
  };

  const resetUserPassword = async (userId: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/users/${userId}/reset`, { method: 'POST' });
      if (res.ok) {
        addToast({ type: 'success', title: 'Reset Link Dispatched', description: 'Temporary credential reset token issued.' });
        return true;
      }
    } catch {}
    return false;
  };

  // Activity management
  const createActivity = async (activityData: Partial<Activity>): Promise<Activity> => {
    const res = await apiFetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityData)
    });
    const created = await res.json();
    setActivities(prev => [created, ...prev]);
    return created;
  };

  const importEvaluation = async (payload: { requestId: string; title: string; formTitle: string; description: string; instructions: string; activityType: Activity['activityType']; sections: FormSection[] }): Promise<void> => {
    const res = await apiFetch('/api/imports/evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'The evaluation import failed.');
    setForms(previous => previous.some(form => form.id === result.form.id) ? previous : [result.form, ...previous]);
    setActivities(previous => previous.some(activity => activity.id === result.activity.id) ? previous : [result.activity, ...previous]);
    addToast({ type: 'success', title: 'Evaluation Imported', description: `Draft activity "${result.activity.title}" and its form were created.` });
  };

  const updateActivity = async (id: string, activityData: Partial<Activity>): Promise<Activity> => {
    const res = await apiFetch(`/api/activities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityData)
    });
    const updated = await res.json();
    setActivities(prev => prev.map(a => a.id === id ? updated : a));
    addToast({ type: 'success', title: 'Activity Updated', description: `Saved changes to "${updated.title}".` });
    return updated;
  };

  const deleteActivity = async (id: string): Promise<boolean> => {
    const res = await apiFetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setActivities(prev => prev.filter(a => a.id !== id));
      addToast({ type: 'info', title: 'Activity Archived', description: 'Activity moved to archives.' });
      return true;
    }
    return false;
  };

  const duplicateActivity = async (id: string): Promise<Activity> => {
    const res = await apiFetch(`/api/activities/${id}/duplicate`, { method: 'POST' });
    const cloned = await res.json();
    setActivities(prev => [cloned, ...prev]);
    addToast({ type: 'success', title: 'Activity Duplicated', description: `Created cohort clone "${cloned.title}".` });
    return cloned;
  };

  // Evaluation Form Builder
  const importForm = async (payload: { requestId: string; title: string; description: string; instructions: string; sections: FormSection[]; originalFileName?: string }): Promise<EvaluationForm> => {
    const res = await apiFetch('/api/imports/form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'The imported form could not be saved.');
    setForms(previous => previous.some(form => form.id === result.form.id) ? previous : [result.form, ...previous]);
    addToast({ type: 'success', title: 'Form Imported', description: `Draft form "${result.form.title}" is ready to edit.` });
    return result.form;
  };

  const createForm = async (formData: Partial<EvaluationForm>): Promise<EvaluationForm> => {
    const res = await apiFetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const created = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(created.error || 'The evaluation form could not be created.');
    setForms(prev => [created, ...prev]);
    if (created.activityId) setActivities(prev => prev.map(activity => activity.id === created.activityId ? { ...activity, assignedFormId: created.id } : activity));
    addToast({ type: 'success', title: 'Evaluation Form Created', description: `Rubric "${created.title}" ready.` });
    return created;
  };

  const updateForm = async (id: string, formData: Partial<EvaluationForm>): Promise<EvaluationForm> => {
    const previousForm = forms.find(form => form.id === id);
    const res = await apiFetch(`/api/forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const updated = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(updated.error || 'The evaluation form could not be updated.');
    setForms(prev => prev.map(f => f.id === id ? updated : f));
    if (previousForm?.activityId && previousForm.activityId !== updated.activityId) {
      setActivities(prev => prev.map(activity => activity.id === previousForm.activityId && activity.assignedFormId === id ? { ...activity, assignedFormId: undefined } : activity));
    }
    if (updated.activityId) setActivities(prev => prev.map(activity => activity.id === updated.activityId ? { ...activity, assignedFormId: id } : activity));
    addToast({ type: 'success', title: 'Form Rubric Updated', description: `Updated questions in "${updated.title}".` });
    return updated;
  };

  const deleteForm = async (id: string): Promise<boolean> => {
    const res = await apiFetch(`/api/forms/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setForms(prev => prev.filter(f => f.id !== id));
      addToast({ type: 'info', title: 'Form Deleted', description: 'Evaluation form removed.' });
      return true;
    }
    return false;
  };

  const duplicateForm = async (id: string): Promise<EvaluationForm> => {
    const res = await apiFetch(`/api/forms/${id}/duplicate`, { method: 'POST' });
    const cloned = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(cloned.error || 'The evaluation form could not be duplicated.');
    setForms(prev => [cloned, ...prev]);
    addToast({ type: 'success', title: 'Form Cloned', description: `Created new draft template "${cloned.title}".` });
    return cloned;
  };

  // Survey Management
  const createSurvey = async (surveyData: Partial<Survey>): Promise<Survey> => {
    const res = await apiFetch('/api/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(surveyData)
    });
    const created = await res.json();
    setSurveys(prev => [created, ...prev]);
    addToast({ type: 'success', title: 'Survey Created', description: `Stakeholder survey "${created.title}" registered.` });
    return created;
  };

  const updateSurvey = async (id: string, surveyData: Partial<Survey>): Promise<Survey> => {
    const res = await apiFetch(`/api/surveys/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(surveyData)
    });
    const updated = await res.json();
    setSurveys(prev => prev.map(s => s.id === id ? updated : s));
    addToast({ type: 'success', title: 'Survey Updated', description: `Saved changes to "${updated.title}".` });
    return updated;
  };

  const deleteSurvey = async (id: string): Promise<boolean> => {
    const res = await apiFetch(`/api/surveys/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSurveys(prev => prev.filter(s => s.id !== id));
      addToast({ type: 'info', title: 'Survey Archived', description: 'Survey removed from active list.' });
      return true;
    }
    return false;
  };

  const submitSurveyResponse = async (surveyId: string, answers: Record<string, any>, name?: string, email?: string): Promise<boolean> => {
    const res = await apiFetch(`/api/surveys/${surveyId}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, respondentName: name, respondentEmail: email })
    });
    if (res.ok) {
      addToast({ type: 'success', title: 'Survey Submitted', description: 'Thank you for your valuable feedback.' });
      refreshMetrics();
      return true;
    }
    return false;
  };

  // Website Theme Customization
  const updateTheme = async (newTheme: Partial<WebsiteTheme>, showToast = false) => {
    try {
      const merged = { ...theme, ...newTheme };
      setTheme(merged);
      applyThemeToDOM(merged);
      const res = await apiFetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      });
      if (res.ok && showToast) {
        addToast({
          type: 'success',
          title: 'Theme Customization Published',
          description: 'Global colors and branding updated across the website.'
        });
      }
    } catch {
      if (showToast) {
        addToast({ type: 'info', title: 'Theme Updated', description: 'Saved locally in browser session.' });
      }
    }
  };

  const resetTheme = async () => {
    try {
      setTheme(DEFAULT_THEME);
      applyThemeToDOM(DEFAULT_THEME);
      await apiFetch('/api/theme/reset', {
        method: 'POST'
      });
      addToast({
        type: 'info',
        title: 'Theme Reset to Default',
        description: 'Restored original SLSU Forest Green & Gold institutional palette.'
      });
    } catch {}
  };

  // System Settings
  const updateSystemSettings = async (newSettings: Partial<SystemSettings>) => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
        addToast({
          type: 'success',
          title: 'Settings Saved',
          description: 'Institutional accreditation configurations updated.'
        });
      }
    } catch {
      setSystemSettings(prev => ({ ...prev, ...newSettings }));
    }
  };

  // Refresh metrics
  const refreshMetrics = async () => {
    if (role !== 'admin') return;
    try {
      const res = await apiFetch('/api/admin/metrics');
      if (res.ok) {
        const data = await res.json();
        setSystemMetrics(data);
      }
    } catch {}
  };

  // Load all initial data from backend API
  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      const [commonResults, adminResults] = await Promise.all([
        Promise.allSettled([
          apiFetch('/api/activities'),
          apiFetch('/api/evaluations'),
          apiFetch('/api/forms'),
          apiFetch('/api/surveys'),
          apiFetch('/api/theme'),
          apiFetch('/api/settings')
        ]),
        role === 'admin'
          ? Promise.allSettled([
              apiFetch('/api/admin/metrics'),
              apiFetch('/api/users'),
              apiFetch('/api/audit-logs')
            ])
          : Promise.resolve([])
      ]);
      const [actRes, evalRes, formsRes, surveysRes, themeRes, settingsRes] = commonResults;
      const [metricsRes, usersRes, logsRes] = adminResults;

      if (actRes.status === 'fulfilled' && actRes.value.ok) {
        setActivities(await actRes.value.json());
      }
      if (evalRes.status === 'fulfilled' && evalRes.value.ok) {
        const evalData = await evalRes.value.json();
        setEvaluations(evalData);
      }
      if (formsRes.status === 'fulfilled' && formsRes.value.ok) {
        setForms(await formsRes.value.json());
      }
      if (surveysRes.status === 'fulfilled' && surveysRes.value.ok) {
        setSurveys(await surveysRes.value.json());
      }
      if (themeRes.status === 'fulfilled' && themeRes.value.ok) {
        const tData = await themeRes.value.json();
        setTheme(tData);
        applyThemeToDOM(tData);
      }
      if (metricsRes?.status === 'fulfilled' && metricsRes.value.ok) {
        setSystemMetrics(await metricsRes.value.json());
      }
      if (usersRes?.status === 'fulfilled' && usersRes.value.ok) {
        setUsers(await usersRes.value.json());
      }
      if (logsRes?.status === 'fulfilled' && logsRes.value.ok) {
        setAuditLogs(await logsRes.value.json());
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
        setSystemSettings(await settingsRes.value.json());
      }
    } catch (err) {
      console.error('Failed to load application data from the database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    localStorage.removeItem('slsu_ext_current_user_v1');
    localStorage.removeItem('slsu_ext_evals_cache_v1');
    localStorage.removeItem('slsu_ext_theme_v1');
    const savedQueue = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
    if (savedQueue) {
      try { setOfflineQueue(JSON.parse(savedQueue)); } catch {}
    }
    const token = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    if (token) {
      apiFetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(async res => {
          if (!res.ok) throw new Error('Stored sign-in session is no longer valid.');
          const data = await res.json();
          setCurrentUser(data.user);
          setIsAuthenticated(true);
        })
        .catch((error: unknown) => {
          localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
          if (error instanceof Error) {
            addToast({ type: 'info', title: 'Sign In Required', description: error.message });
          }
        })
        .finally(() => setIsAuthLoading(false));
    } else {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void refreshAllData();
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // Submit evaluation
  const submitEvaluation = async (evaluationData: Partial<EvaluationSubmission>): Promise<{ success: boolean; evaluation?: EvaluationSubmission; error?: string }> => {
    if (!evaluationData.activityId || !activities.some(activity => activity.id === evaluationData.activityId)) {
      return { success: false, error: 'Select an available activity before submitting an evaluation.' };
    }

    if (isOfflineMode) {
      const offlineRecord: EvaluationSubmission = {
        id: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        activityId: evaluationData.activityId,
        formId: evaluationData.formId,
        customAnswers: evaluationData.customAnswers,
        participantName: evaluationData.participantName || 'Anonymous Participant',
        participantEmail: evaluationData.participantEmail || '',
        participantPhone: evaluationData.participantPhone,
        participantCategory: evaluationData.participantCategory || 'community_member',
        controlNumber: evaluationData.controlNumber || `SLSU-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        verificationMethod: evaluationData.verificationMethod || 'student_id',
        coreRatings: evaluationData.coreRatings || {
          satisfaction: 5,
          objectives: 5,
          relevance: 5,
          facilities: 5,
          timeManagement: 5,
          organization: 5
        },
        specificRatings: evaluationData.specificRatings || {},
        meanRating: evaluationData.meanRating || 5,
        comments: evaluationData.comments || { strengths: '', improvements: '', suggestions: '' },
        sentiment: evaluationData.sentiment || {
          overall: 'positive',
          score: 0.8,
          topics: ['community_needs'],
          concernUrgency: 'low'
        },
        submissionSource: 'offline_synced',
        submittedAt: new Date().toISOString(),
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Offline Terminal',
        verified: true,
        consentAccepted: evaluationData.consentAccepted ?? true
      };

      setOfflineQueue(prev => [...prev, offlineRecord]);
      setEvaluations(prev => [offlineRecord, ...prev]);
      setLastSubmittedEvaluation(offlineRecord);
      addToast({
        type: 'info',
        title: 'Stored in Offline Field Queue',
        description: `Control No: ${offlineRecord.controlNumber}. Ready for local reconciliation.`
      });
      return { success: true, evaluation: offlineRecord };
    }

    try {
      const res = await apiFetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluationData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        return { success: false, error: errorData.message || 'Submission failed' };
      }

      const createdEvaluation: EvaluationSubmission = await res.json();
      setEvaluations(prev => [createdEvaluation, ...prev]);
      setLastSubmittedEvaluation(createdEvaluation);
      refreshMetrics();
      addToast({
        type: 'success',
        title: 'Evaluation Successfully Recorded',
        description: `Control No: ${createdEvaluation.controlNumber}. Verified under RA 10173.`
      });
      return { success: true, evaluation: createdEvaluation };
    } catch {
      return { success: false, error: 'Network error submitting evaluation' };
    }
  };

  const syncOfflineQueue = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    if (offlineQueue.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      const res = await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: offlineQueue })
      });

      if (res.ok) {
        const data = await res.json();
        setOfflineQueue([]);
        localStorage.removeItem(LOCAL_STORAGE_QUEUE_KEY);
        refreshAllData();
        addToast({
          type: 'success',
          title: 'Reconciliation Complete',
          description: `Successfully synced ${data.syncedCount} field evaluation records.`
        });
        return { success: true, count: data.syncedCount };
      }
      return { success: false, count: 0, error: 'Sync endpoint returned error.' };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  };

  const logAuditAction = async (action: string, resourceId: string, reason: string, controlNumber?: string) => {
    try {
      const res = await apiFetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          resourceId,
          reason,
          participantControlNumber: controlNumber,
          adminName: currentUser.name
        })
      });
      if (res.ok) {
        const newLog = await res.json();
        setAuditLogs(prev => [newLog, ...prev]);
      }
    } catch {
      const fallbackLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        adminName: currentUser.name,
        action,
        resourceId,
        participantControlNumber: controlNumber,
        reason
      };
      setAuditLogs(prev => [fallbackLog, ...prev]);
    }
  };

  const updateFollowUpStatus = async (evalId: string, status: 'none' | 'pending' | 'in_progress' | 'resolved', notes: string) => {
    try {
      const res = await apiFetch(`/api/evaluations/${evalId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
      if (res.ok) {
        setEvaluations(prev => prev.map(e => e.id === evalId ? { ...e, adminFollowUpStatus: status, adminNotes: notes } : e));
      }
    } catch {
      setEvaluations(prev => prev.map(e => e.id === evalId ? { ...e, adminFollowUpStatus: status, adminNotes: notes } : e));
    }
  };

  const exportDataAsCSV = (includePII: boolean = false) => {
    if (includePII) {
      logAuditAction(
        'FULL_PII_CSV_EXPORT',
        'evaluations_dataset',
        'Authorized administrative bulk export for AACCUP Level III accreditation review.'
      );
    }

    const headers = [
      'Control Number',
      'Activity ID',
      'Date Submitted',
      'Sector',
      'Participant Name',
      'Email',
      'Phone',
      'Overall Mean Score',
      'Sentiment',
      'Key Strengths',
      'Improvements Needed',
      'Verification Method',
      'Submission Source'
    ];

    const rows = evaluations.map(e => {
      const name = includePII ? e.participantName : `${e.participantName.charAt(0)}***`;
      const email = includePII ? e.participantEmail : `${e.participantEmail.charAt(0)}***@slsu.edu.ph`;
      const phone = includePII ? (e.participantPhone || '') : '***-***-****';

      return [
        `"${e.controlNumber}"`,
        `"${e.activityId}"`,
        `"${e.submittedAt}"`,
        `"${e.participantCategory}"`,
        `"${name}"`,
        `"${email}"`,
        `"${phone}"`,
        `"${e.meanRating}"`,
        `"${e.sentiment.overall}"`,
        `"${(e.comments.strengths || '').replace(/"/g, '""')}"`,
        `"${(e.comments.improvements || '').replace(/"/g, '""')}"`,
        `"${e.verificationMethod}"`,
        `"${e.submissionSource}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SLSU_Evaluations_${includePII ? 'AUTHORIZED_FULL' : 'ANONYMIZED'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({
      type: 'info',
      title: 'Dataset Exported',
      description: `Downloaded ${evaluations.length} evaluation records.`
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        role,
        isAuthenticated,
        isAuthLoading,
        users,
        loginWithEmail,
        logout,
        updateUserRole,
        createUserAccount,
        deleteUserAccount,
        resetUserPassword,

        currentView,
        setCurrentView,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileMenuOpen,
        setMobileMenuOpen,

        activities,
        selectedActivityId,
        setSelectedActivityId,
        createActivity,
        importEvaluation,
        updateActivity,
        deleteActivity,
        duplicateActivity,

        forms,
        importForm,
        createForm,
        updateForm,
        deleteForm,
        duplicateForm,

        surveys,
        createSurvey,
        updateSurvey,
        deleteSurvey,
        submitSurveyResponse,

        theme,
        updateTheme,
        resetTheme,

        evaluations,
        offlineQueue,
        isOfflineMode,
        setIsOfflineMode,
        auditLogs,
        maskPII,
        setMaskPII,
        systemSettings,
        updateSystemSettings,
        systemMetrics,
        refreshMetrics,
        refreshAllData,
        isLoading,

        toasts,
        addToast,
        dismissToast,

        submitEvaluation,
        syncOfflineQueue,
        logAuditAction,
        updateFollowUpStatus,

        showAboutModal,
        setShowAboutModal,
        showSyncModal,
        setShowSyncModal,
        lastSubmittedEvaluation,
        setLastSubmittedEvaluation,
        exportDataAsCSV
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
