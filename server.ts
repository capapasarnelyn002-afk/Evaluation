import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseSecretKey || !supabasePublishableKey) {
  throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY must be configured.');
}

let persistenceQueue = Promise.resolve();

app.use((req, res, next) => {
  const isStateMutation =
    req.path.startsWith('/api/') &&
    !req.path.startsWith('/api/ai/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (isStateMutation) {
    const sendJson = res.json.bind(res);
    let saveStarted = false;
    res.json = ((body: unknown) => {
      if (res.statusCode >= 400 || saveStarted) return sendJson(body);
      saveStarted = true;

      const currentSave = persistenceQueue.then(() => saveServerState());
      persistenceQueue = currentSave.catch((error: unknown) => {
        console.error('Failed to persist application data to Supabase:', error);
      });
      void currentSave.then(
        () => sendJson(body),
        (error: unknown) => {
          console.error('Failed to persist application data to Supabase:', error);
          if (!res.headersSent) {
            res.status(500);
            sendJson({ error: 'The database could not save this change.' });
          }
        }
      );
      return res;
    }) as typeof res.json;
  }

  next();
});

// Initialize Gemini SDK with User-Agent as instructed by skill
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory data store for server-side persistence during session
interface ServerActivity {
  id: string;
  title: string;
  activityType: 'training' | 'livelihood' | 'seminar' | 'outreach' | 'community_service';
  description: string;
  instructions?: string;
  date: string;
  startDate?: string;
  deadline?: string;
  venue: string;
  targetBeneficiaries: string;
  organizingDepartment: string;
  leadCoordinator: string;
  trainerOrSpeaker: string;
  status: 'active' | 'completed' | 'upcoming' | 'draft' | 'archived';
  totalTargetParticipants: number;
  assignedFormId?: string;
  createdAt?: string;
}

interface ServerEvaluation {
  id: string;
  activityId: string;
  formId?: string;
  formSnapshot?: any;
  customAnswers?: Record<string, unknown>;
  participantName: string;
  participantEmail: string;
  participantPhone?: string;
  participantCategory: string;
  controlNumber: string;
  verificationMethod: string;
  coreRatings: Record<string, number>;
  specificRatings: Record<string, number>;
  meanRating: number;
  comments: {
    strengths: string;
    improvements: string;
    suggestions: string;
  };
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
    topics: string[];
    concernUrgency: 'low' | 'medium' | 'high' | 'critical';
  };
  submissionSource: 'online' | 'offline_synced';
  submittedAt: string;
  syncedAt?: string;
  deviceInfo: string;
  verified: boolean;
  consentAccepted: boolean;
  adminFollowUpStatus?: 'none' | 'pending' | 'in_progress' | 'resolved';
  adminNotes?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  adminName: string;
  action: string;
  resourceId: string;
  participantControlNumber?: string;
  reason: string;
  ipAddress?: string;
}

export interface ServerUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'participant';
  department: string;
  title: string;
  status: 'active' | 'inactive';
  lastLogin: string;
}

const users: ServerUser[] = [];

let systemSettings = {
  institutionName: 'Southern Leyte State University - Hinunangan Campus',
  campusCode: 'SLSU-HIN',
  leadDepartment: 'Faculty of Computer Studies and Information Technology (FCSIT)',
  minimumTurnoutTargetPct: 80,
  targetSatisfactionMean: 4.00,
  autoSyncOnReconnect: true,
  enableDataPrivacyMasking: true,
  accreditationCycle: 'AACCUP Level III Re-Accreditation (May 2026)',
  academicYear: '2025-2026'
};

const activities: ServerActivity[] = [];

const evaluations: ServerEvaluation[] = [];

const auditLogs: AuditLog[] = [];

async function getAuthenticatedAccount(accessToken: string): Promise<ServerUser | null> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase authentication configuration is missing.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabasePublishableKey, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;

  const authUser = await response.json() as { id?: string };
  if (!authUser.id) return null;
  const account = users.find(user => user.id === authUser.id);
  if (!account || account.status !== 'active') return null;

  return account;
}

app.use('/api', async (req, res, next) => {
  if (['/auth/login', '/auth/me', '/auth/logout'].includes(req.path)) return next();

  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'A valid sign-in session is required.' });

  try {
    const account = await getAuthenticatedAccount(accessToken);
    if (!account) return res.status(401).json({ error: 'Your sign-in session is invalid or has expired.' });
    res.locals.user = account;

    const adminOnly =
      req.path.startsWith('/users') ||
      (req.path.startsWith('/settings') && req.method !== 'GET') ||
      req.path.startsWith('/audit-logs') ||
      req.path.startsWith('/admin/') ||
      req.path.startsWith('/trainer/') ||
      req.path.startsWith('/imports/') ||
      req.path.startsWith('/ai/') ||
      (req.path.startsWith('/activities') && req.method !== 'GET') ||
      (req.path.startsWith('/forms') && req.method !== 'GET') ||
      (req.path.startsWith('/surveys') && (
        (req.method === 'GET' && req.path.includes('/responses')) ||
        (req.method !== 'GET' && !(req.method === 'POST' && req.path.endsWith('/responses')))
      )) ||
      (req.path.startsWith('/theme') && req.method !== 'GET') ||
      (req.path.startsWith('/evaluations') && req.method === 'PATCH');
    if (adminOnly && account.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }

    if (req.path === '/evaluations' && req.method === 'POST' &&
      typeof req.body?.participantEmail === 'string' &&
      req.body.participantEmail.toLowerCase() !== account.email.toLowerCase()) {
      return res.status(403).json({ error: 'You can only submit evaluations for your signed-in account.' });
    }

    return next();
  } catch (error) {
    console.error('Supabase API authentication failed:', error);
    return res.status(502).json({ error: 'The authentication service is unavailable.' });
  }
});

// Helper for local heuristic sentiment & topic classification
function analyzeSentimentAndTopics(commentsText: string) {
  const lower = commentsText.toLowerCase();
  
  let posCount = 0;
  let negCount = 0;

  const positiveWords = ['patient', 'excellent', 'useful', 'great', 'outstanding', 'gentle', 'clear', 'helpful', 'high quality', 'beneficial', 'timely', 'success', 'good', 'well', 'enthusiastic'];
  const negativeWords = ['interrupted', 'sluggish', 'buzzing', 'slow', 'hot', 'late', 'ran out', 'limited', 'dizzy', 'poor', 'bad', 'problem', 'delay', 'lack', 'noisy', 'echo'];

  positiveWords.forEach(w => { if (lower.includes(w)) posCount++; });
  negativeWords.forEach(w => { if (lower.includes(w)) negCount++; });

  let score = 0.5;
  let overall: 'positive' | 'neutral' | 'negative' = 'positive';

  if (posCount > negCount) {
    score = Math.min(1.0, 0.5 + (posCount - negCount) * 0.15);
    overall = 'positive';
  } else if (negCount > posCount) {
    score = Math.max(-1.0, 0.0 - (negCount - posCount) * 0.25);
    overall = 'negative';
  } else {
    score = 0.2;
    overall = 'neutral';
  }

  const topics: string[] = [];
  if (lower.includes('lab') || lower.includes('venue') || lower.includes('aircon') || lower.includes('wifi') || lower.includes('internet') || lower.includes('acoustic') || lower.includes('shade') || lower.includes('sound') || lower.includes('facilities') || lower.includes('room')) {
    topics.push('facilities');
  }
  if (lower.includes('trainer') || lower.includes('speaker') || lower.includes('patient') || lower.includes('mastery') || lower.includes('explained') || lower.includes('lecture') || lower.includes('teach')) {
    topics.push('speaker_mastery');
  }
  if (lower.includes('material') || lower.includes('module') || lower.includes('handout') || lower.includes('booklet') || lower.includes('presentation') || lower.includes('kit') || lower.includes('slides')) {
    topics.push('learning_materials');
  }
  if (lower.includes('snack') || lower.includes('food') || lower.includes('catering') || lower.includes('transport') || lower.includes('pen') || lower.includes('logistics') || lower.includes('tent')) {
    topics.push('logistics');
  }
  if (lower.includes('time') || lower.includes('schedule') || lower.includes('late') || lower.includes('flow') || lower.includes('started') || lower.includes('duration') || lower.includes('hours')) {
    topics.push('time_management');
  }
  if (lower.includes('community') || lower.includes('barangay') || lower.includes('livelihood') || lower.includes('income') || lower.includes('farmer') || lower.includes('fisherfolk') || lower.includes('needs')) {
    topics.push('community_needs');
  }
  if (topics.length === 0) {
    topics.push('organization');
  }

  let concernUrgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (lower.includes('accident') || lower.includes('injury') || lower.includes('collapsed') || lower.includes('threat')) {
    concernUrgency = 'critical';
  } else if (lower.includes('dizzy') || lower.includes('ran out') || lower.includes('late') || lower.includes('hot sun')) {
    concernUrgency = 'medium';
  } else if (negCount >= 2) {
    concernUrgency = 'medium';
  }

  return { overall, score, topics, concernUrgency };
}

// REST API Endpoints

// 1. Get activities
app.get('/api/activities', (_req, res) => {
  const enhanced = activities.map(act => {
    const actEvals = evaluations.filter(e => e.activityId === act.id);
    const ratedEvals = actEvals.filter(e => e.meanRating > 0);
    const evalCount = actEvals.length;
    const avgRating = ratedEvals.length > 0
      ? Number((ratedEvals.reduce((acc, curr) => acc + curr.meanRating, 0) / ratedEvals.length).toFixed(2))
      : 0;
    return {
      ...act,
      evaluatedParticipants: evalCount,
      averageRating: avgRating
    };
  });
  res.json(enhanced);
});

// 2. Create activity
app.post('/api/activities', (req, res) => {
  const newActivity: ServerActivity = {
    id: `act-${Date.now()}`,
    title: req.body.title || 'Untitled Extension Activity',
    activityType: req.body.activityType || 'training',
    description: req.body.description || '',
    date: req.body.date || new Date().toISOString().split('T')[0],
    venue: req.body.venue || 'SLSU-Hinunangan',
    targetBeneficiaries: req.body.targetBeneficiaries || 'Community members',
    organizingDepartment: req.body.organizingDepartment || 'Faculty of Computer Studies and Information Technology',
    leadCoordinator: req.body.leadCoordinator || 'Extension Coordinator',
    trainerOrSpeaker: req.body.trainerOrSpeaker || 'Faculty Resource Speaker',
    status: req.body.status || 'active',
    totalTargetParticipants: req.body.totalTargetParticipants || 30
  };
  activities.unshift(newActivity);
  res.status(201).json(newActivity);
});

// 3. Get evaluations (supports filter by activityId)
app.get('/api/evaluations', (req, res) => {
  const { activityId, source } = req.query;
  const account = res.locals.user as ServerUser;
  let list = account.role === 'admin'
    ? [...evaluations]
    : evaluations.filter(evaluation => evaluation.participantEmail.toLowerCase() === account.email.toLowerCase());
  if (activityId && typeof activityId === 'string') {
    list = list.filter(e => e.activityId === activityId);
  }
  if (source && typeof source === 'string') {
    list = list.filter(e => e.submissionSource === source);
  }
  res.json(list);
});

// 4. Submit single evaluation
app.post('/api/evaluations', (req, res) => {
  const payload = req.body;
  const account = res.locals.user as ServerUser;
  if (account.role !== 'admin') {
    payload.participantName = account.name;
    payload.participantEmail = account.email;
  }
  if (!payload.activityId || !payload.participantName || !payload.participantEmail) {
    res.status(400).json({ error: 'Missing mandatory fields (activityId, participantName, participantEmail)' });
    return;
  }

  const activity = activities.find(item => item.id === payload.activityId);
  if (!activity) return res.status(404).json({ error: 'Evaluation activity not found.' });
  let submittedForm: any;
  let submittedCoreRatings = payload.coreRatings || {};
  let submittedWeightedMean: number | undefined;
  if (payload.formId) {
    submittedForm = evaluationForms.find(form => form.id === payload.formId);
    if (!submittedForm) return res.status(404).json({ error: 'Evaluation form not found.' });
    if (submittedForm.status !== 'published') return res.status(409).json({ error: 'This evaluation form is not published.' });
    if (activity.assignedFormId !== submittedForm.id) return res.status(400).json({ error: 'This form is not assigned to the selected activity.' });
  } else if (activity.assignedFormId) {
    return res.status(400).json({ error: 'The assigned evaluation form is required.' });
  }

  let submittedSpecificRatings = payload.specificRatings || {};
  if (submittedForm) {
    const answers = payload.customAnswers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return res.status(400).json({ error: 'Form answers are required.' });
    const questions = submittedForm.sections.flatMap((section: any) => section.questions || []);
    const questionIds = new Set(questions.map((question: any) => question.id));
    if (Object.keys(answers).some(questionId => !questionIds.has(questionId))) return res.status(400).json({ error: 'The submission contains answers for unknown questions.' });
    for (const question of questions) {
      const answer = answers[question.id];
      const isEmpty = answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0);
      if (question.required && isEmpty) return res.status(400).json({ error: `A response is required for "${question.label}".` });
      if (isEmpty) continue;
      if (['single_choice', 'dropdown'].includes(question.type) && !(question.options || []).includes(answer)) return res.status(400).json({ error: `The response for "${question.label}" is not an allowed option.` });
      if (question.type === 'yes_no' && !['Yes', 'No'].includes(answer)) return res.status(400).json({ error: `The response for "${question.label}" must be Yes or No.` });
      if (question.type === 'multiple_choice' && (!Array.isArray(answer) || answer.some(option => !(question.options || []).includes(option)))) return res.status(400).json({ error: `The response for "${question.label}" contains an invalid option.` });
      if (question.type === 'multiple_choice' && ((question.minSelections !== undefined && answer.length < question.minSelections) || (question.maxSelections !== undefined && answer.length > question.maxSelections))) return res.status(400).json({ error: `The response for "${question.label}" has an invalid number of selections.` });
      if (['rating_scale', 'star_rating', 'likert_scale'].includes(question.type)) {
        const min = question.scaleMin ?? 1;
        const max = question.scaleMax ?? 5;
        if (!Number.isInteger(answer) || answer < min || answer > max) return res.status(400).json({ error: `The response for "${question.label}" must be a whole number from ${min} to ${max}.` });
      }
      if (question.type === 'rubric_table') {
        if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return res.status(400).json({ error: `The response for "${question.label}" must include rubric ratings.` });
        const criteria: string[] = question.criteria || [];
        if (Object.keys(answer).some(criterion => !criteria.includes(criterion))) return res.status(400).json({ error: `The response for "${question.label}" includes an unknown criterion.` });
        const min = question.scaleMin ?? 1;
        const max = question.scaleMax ?? 5;
        if (criteria.some(criterion => question.required && !Number.isInteger(answer[criterion])) || Object.values(answer).some((score: any) => !Number.isInteger(score) || score < min || score > max)) return res.status(400).json({ error: `The response for "${question.label}" must rate every criterion from ${min} to ${max}.` });
      }
      if (question.type === 'instructions') continue;
      if (question.type === 'number' && (typeof answer !== 'number' || !Number.isFinite(answer))) return res.status(400).json({ error: `The response for "${question.label}" must be a number.` });
      if (['short_text', 'long_text'].includes(question.type) && typeof answer !== 'string') return res.status(400).json({ error: `The response for "${question.label}" must be text.` });
      if (typeof answer === 'string' && answer.length > 10000) return res.status(400).json({ error: `The response for "${question.label}" is too long.` });
      if (question.type === 'email' && (typeof answer !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer))) return res.status(400).json({ error: `The response for "${question.label}" must be a valid email address.` });
      if (question.type === 'date') {
        if (typeof answer !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(answer)) return res.status(400).json({ error: `The response for "${question.label}" must be a valid date.` });
        const date = new Date(`${answer}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== answer) return res.status(400).json({ error: `The response for "${question.label}" must be a valid date.` });
      }
    }
    submittedSpecificRatings = Object.fromEntries(questions.flatMap((question: any) => {
      const answer = answers[question.id];
      if (['rating_scale', 'star_rating', 'likert_scale'].includes(question.type) && Number.isInteger(answer)) return [[question.id, answer]];
      if (question.type === 'rubric_table' && answer && typeof answer === 'object') return Object.entries(answer).map(([criterion, score]) => [`${question.id}:${criterion}`, score]);
      return [];
    }));
    let weightedScoreTotal = 0;
    let totalWeight = 0;
    for (const question of questions) {
      const answer = answers[question.id];
      if (['rating_scale', 'star_rating', 'likert_scale'].includes(question.type) && Number.isInteger(answer)) {
        const weight = question.weight ?? 1;
        weightedScoreTotal += answer * weight;
        totalWeight += weight;
      } else if (question.type === 'rubric_table' && answer && typeof answer === 'object') {
        const criteria: string[] = question.criteria || [];
        const weightPerCriterion = (question.weight ?? criteria.length) / Math.max(criteria.length, 1);
        for (const criterion of criteria) {
          const score = answer[criterion];
          if (Number.isInteger(score)) {
            weightedScoreTotal += score * weightPerCriterion;
            totalWeight += weightPerCriterion;
          }
        }
      }
    }
    submittedWeightedMean = totalWeight > 0 ? Number((weightedScoreTotal / totalWeight).toFixed(2)) : 0;
    submittedCoreRatings = {};
  }

  // Duplicate prevention check: One evaluation per participant per activity
  const existing = evaluations.find(
    e => e.activityId === payload.activityId &&
      (e.participantEmail.toLowerCase() === payload.participantEmail.toLowerCase() ||
       (payload.participantPhone && e.participantPhone === payload.participantPhone) ||
       (payload.controlNumber && e.controlNumber === payload.controlNumber))
  );

  if (existing) {
    res.status(409).json({
      error: 'DUPLICATE_SUBMISSION',
      message: 'An evaluation for this participant and activity has already been recorded in SLSU system.',
      existingControlNumber: existing.controlNumber
    });
    return;
  }

  const allComments = `${payload.comments?.strengths || ''} ${payload.comments?.improvements || ''} ${payload.comments?.suggestions || ''}`;
  const sentimentAnalysis = analyzeSentimentAndTopics(allComments);

  // Compute mean rating
  const coreVals = Object.values(submittedCoreRatings) as number[];
  const specVals = Object.values(submittedSpecificRatings) as number[];
  const allRatings = [...coreVals, ...specVals];
  const meanRating = submittedForm
    ? submittedWeightedMean || 0
    : allRatings.length > 0
    ? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
    : 4.0;

  const controlNumber = payload.controlNumber || `SLSU-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newEval: ServerEvaluation = {
    id: `eval-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    activityId: payload.activityId,
    formId: payload.formId,
    formSnapshot: submittedForm,
    customAnswers: payload.customAnswers && typeof payload.customAnswers === 'object' ? payload.customAnswers : undefined,
    participantName: payload.participantName,
    participantEmail: payload.participantEmail,
    participantPhone: payload.participantPhone || '',
    participantCategory: payload.participantCategory || 'community_member',
    controlNumber,
    verificationMethod: payload.verificationMethod || 'student_id',
    coreRatings: submittedCoreRatings,
    specificRatings: submittedSpecificRatings,
    meanRating,
    comments: {
      strengths: payload.comments?.strengths || '',
      improvements: payload.comments?.improvements || '',
      suggestions: payload.comments?.suggestions || ''
    },
    sentiment: {
      overall: sentimentAnalysis.overall,
      score: sentimentAnalysis.score,
      topics: sentimentAnalysis.topics,
      concernUrgency: sentimentAnalysis.concernUrgency
    },
    submissionSource: payload.submissionSource || 'online',
    submittedAt: payload.submittedAt || new Date().toISOString(),
    syncedAt: payload.submissionSource === 'offline_synced' ? new Date().toISOString() : undefined,
    deviceInfo: payload.deviceInfo || 'Web Browser',
    verified: true,
    consentAccepted: payload.consentAccepted !== false,
    adminFollowUpStatus: 'none'
  };

  evaluations.unshift(newEval);
  res.status(201).json(newEval);
});

// 5. Offline Sync Endpoint (Batch synchronizes evaluations collected on laptop or local field server)
app.post('/api/sync', (req, res) => {
  const { batch } = req.body;
  if (!Array.isArray(batch)) {
    res.status(400).json({ error: 'Batch must be an array of evaluations' });
    return;
  }
  const account = res.locals.user as ServerUser;
  if (account.role !== 'admin' && batch.some((item: Partial<ServerEvaluation>) =>
    typeof item.participantEmail !== 'string' || item.participantEmail.toLowerCase() !== account.email.toLowerCase()
  )) {
    return res.status(403).json({ error: 'You can only synchronize evaluations for your signed-in account.' });
  }

  const results: { syncedCount: number; duplicateCount: number; items: ServerEvaluation[] } = {
    syncedCount: 0,
    duplicateCount: 0,
    items: []
  };

  batch.forEach((item: Partial<ServerEvaluation>) => {
    if (!item.activityId || !item.participantName || !item.participantEmail) return;

    // Duplicate check
    const existing = evaluations.find(
      e => e.activityId === item.activityId &&
        (e.participantEmail.toLowerCase() === item.participantEmail!.toLowerCase() ||
         (item.controlNumber && e.controlNumber === item.controlNumber))
    );

    if (existing) {
      results.duplicateCount++;
      return;
    }

    const allComments = `${item.comments?.strengths || ''} ${item.comments?.improvements || ''} ${item.comments?.suggestions || ''}`;
    const sentimentAnalysis = analyzeSentimentAndTopics(allComments);

    const coreVals = Object.values(item.coreRatings || {}) as number[];
    const specVals = Object.values(item.specificRatings || {}) as number[];
    const allRatings = [...coreVals, ...specVals];
    const meanRating = allRatings.length > 0
      ? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
      : 4.0;

    const newEval: ServerEvaluation = {
      id: item.id || `eval-sync-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      activityId: item.activityId!,
      formId: item.formId,
      formSnapshot: item.formSnapshot || evaluationForms.find(form => form.id === item.formId),
      customAnswers: item.customAnswers,
      participantName: account.role === 'admin' ? item.participantName! : account.name,
      participantEmail: account.role === 'admin' ? item.participantEmail! : account.email,
      participantPhone: item.participantPhone || '',
      participantCategory: item.participantCategory || 'community_member',
      controlNumber: item.controlNumber || `SLSU-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      verificationMethod: item.verificationMethod || 'offline_form',
      coreRatings: item.coreRatings || {},
      specificRatings: item.specificRatings || {},
      meanRating,
      comments: {
        strengths: item.comments?.strengths || '',
        improvements: item.comments?.improvements || '',
        suggestions: item.comments?.suggestions || ''
      },
      sentiment: {
        overall: sentimentAnalysis.overall,
        score: sentimentAnalysis.score,
        topics: sentimentAnalysis.topics,
        concernUrgency: sentimentAnalysis.concernUrgency
      },
      submissionSource: 'offline_synced',
      submittedAt: item.submittedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      deviceInfo: item.deviceInfo || 'Offline Field Device',
      verified: true,
      consentAccepted: true,
      adminFollowUpStatus: 'none'
    };

    evaluations.unshift(newEval);
    results.syncedCount++;
    results.items.push(newEval);
  });

  res.json({
    success: true,
    message: `Batch sync complete: ${results.syncedCount} synchronized, ${results.duplicateCount} duplicate(s) reconciled.`,
    syncedCount: results.syncedCount,
    duplicateCount: results.duplicateCount,
    items: results.items
  });
});

// 6. Update Admin Follow-up Status
app.patch('/api/evaluations/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, notes, adminName } = req.body;
  const evalItem = evaluations.find(e => e.id === id);
  if (!evalItem) {
    res.status(404).json({ error: 'Evaluation not found' });
    return;
  }

  evalItem.adminFollowUpStatus = status || evalItem.adminFollowUpStatus;
  if (notes !== undefined) evalItem.adminNotes = notes;

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: adminName || 'Extension Administrator',
    action: 'STATUS_UPDATE',
    resourceId: id,
    participantControlNumber: evalItem.controlNumber,
    reason: `Updated follow-up status to ${status}. Notes: ${notes || 'none'}`
  });

  res.json(evalItem);
});

// 7. Audit Logging (Compliant with Data Privacy Act RA 10173)
app.get('/api/audit-logs', (_req, res) => {
  res.json(auditLogs);
});

app.post('/api/audit-logs', (req, res) => {
  const { adminName, action, resourceId, participantControlNumber, reason } = req.body;
  const newLog: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: adminName || 'Extension Coordinator',
    action: action || 'UNMASK_PARTICIPANT_PII',
    resourceId: resourceId || '',
    participantControlNumber: participantControlNumber || '',
    reason: reason || 'Authorized institutional follow-up under RA 10173.'
  };
  auditLogs.unshift(newLog);
  res.status(201).json(newLog);
});

// 8. AI-Assisted Feedback Analysis & Executive Report Generation via Gemini API
app.post('/api/ai/executive-report', async (req, res) => {
  const { activityId, focusAreas, timeFrame } = req.body;
  
  // Collect matching activity and evaluations
  const targetActivity = activityId ? activities.find(a => a.id === activityId) : null;
  const targetEvals = activityId
    ? evaluations.filter(e => e.activityId === activityId)
    : evaluations;

  const totalCount = targetEvals.length;
  if (totalCount === 0) {
    res.status(400).json({ error: 'No evaluations available to generate report.' });
    return;
  }
  if (!ai) {
    res.status(503).json({ error: 'AI reporting is unavailable because GEMINI_API_KEY is not configured.' });
    return;
  }

  const ratedEvals = targetEvals.filter(e => e.meanRating > 0);
  const avgRating = ratedEvals.length > 0
    ? Number((ratedEvals.reduce((total, evaluation) => total + evaluation.meanRating, 0) / ratedEvals.length).toFixed(2))
    : 0;
  const positiveCount = targetEvals.filter(e => e.sentiment.overall === 'positive').length;
  const neutralCount = targetEvals.filter(e => e.sentiment.overall === 'neutral').length;
  const negativeCount = targetEvals.filter(e => e.sentiment.overall === 'negative').length;

  const sampleComments = targetEvals.map(e => ({
    category: e.participantCategory,
    rating: e.meanRating,
    strengths: e.comments.strengths,
    improvements: e.comments.improvements,
    suggestions: e.comments.suggestions
  }));

  const prompt = `
You are the AI Data Analytics & Institutional Reporting Engine for Southern Leyte State University (SLSU) - Hinunangan Campus, specifically for the Faculty of Computer Studies and Information Technology (FCSIT) and the Office of Extension Services.

Generate a comprehensive, formal AI-Assisted Executive Report for Extension Activity Evaluation.
Target Scope: ${targetActivity ? `Activity: "${targetActivity.title}" (${targetActivity.activityType.toUpperCase()})` : 'All Extension Activities Combined'}
Total Participants Evaluated: ${totalCount}
Average Likert Rating (out of 5.0): ${avgRating}
Sentiment Breakdown: ${positiveCount} Positive (${Math.round((positiveCount/totalCount)*100)}%), ${neutralCount} Neutral, ${negativeCount} Negative.
Focus Areas Requested: ${focusAreas || 'Comprehensive (Facilities, Trainer Mastery, Logistics, Community Impact, Recommendations)'}
Reporting Period: ${timeFrame || 'Academic Year 2025-2026'}

Here are actual participant comments and feedback:
${JSON.stringify(sampleComments, null, 2)}

Provide a structured JSON output with the following schema:
{
  "reportTitle": "Title of the Executive Report",
  "generatedDate": "Formatted date",
  "executiveSummary": "2-3 well-articulated paragraphs highlighting institutional performance, participation, and primary findings.",
  "keyPerformanceIndicators": [
    { "metric": "Overall Participant Satisfaction", "value": "Percentage or score", "status": "Excellent|Good|Needs Attention", "benchmark": "Target 85%" }
  ],
  "recurringStrengths": [
    { "topic": "Name of topic (e.g. Trainer Mastery, Hands-on Application)", "summary": "Detailed summary with direct feedback context", "sentimentRatio": "e.g. 95% Positive" }
  ],
  "criticalWeaknesses": [
    { "topic": "Name of pain point (e.g. Venue Internet Bandwidth, Tent Shade, Audio Echo)", "summary": "Detailed observation of repeated complaints", "severity": "Low|Medium|High" }
  ],
  "aiActionableRecommendations": [
    {
      "category": "Logistics & Facilities|Curriculum & Content|Trainer Capability|Community Partnership",
      "recommendation": "Clear, specific actionable step for SLSU-Hinunangan",
      "expectedImpact": "Anticipated improvement in future extension delivery",
      "responsibleUnit": "FCSIT / General Services Office / Extension Coordinator / LGU Liaison",
      "priority": "High|Medium|Low"
    }
  ],
  "evidenceQuotes": [
    { "quote": "Direct excerpt from feedback", "theme": "Facilities|Trainer|Logistics" }
  ],
  "policyNotice": "Note stating this report is AI-assisted decision support for the University Extension Council pursuant to CHED and SLSU quality assurance guidelines."
}
Return only valid JSON.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const responseText = response.text || '';
    try {
      const parsed = JSON.parse(responseText);
      res.json({
        source: 'gemini-3.8-flash',
        report: parsed
      });
      return;
    } catch (parseErr) {
      console.error('Gemini returned an invalid executive report:', parseErr);
      res.status(502).json({ error: 'AI returned an invalid executive report.' });
      return;
    }
  } catch (apiError) {
    console.error('Gemini executive report request failed:', apiError);
    res.status(502).json({ error: 'AI could not generate the executive report.' });
    return;
  }
});

// 9. AI Quick Insights & Natural Language Query Endpoint
app.post('/api/ai/quick-insights', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    res.status(400).json({ error: 'Question parameter is required.' });
    return;
  }
  if (!ai) {
    res.status(503).json({ error: 'AI insights are unavailable because GEMINI_API_KEY is not configured.' });
    return;
  }

  const prompt = `
You are the AI Data Analytics Assistant for SLSU-Hinunangan Extension Services Evaluation System.
A university administrator asked: "${question}"

Here is the current evaluation dataset:
Total activities: ${activities.length}
Total evaluations: ${evaluations.length}
Evaluations summary:
${JSON.stringify(evaluations.map(e => ({
  activityId: e.activityId,
  category: e.participantCategory,
  rating: e.meanRating,
  strengths: e.comments.strengths,
  improvements: e.comments.improvements,
  suggestions: e.comments.suggestions
})), null, 2)}

Provide a concise, direct, evidence-based answer (2-4 paragraphs) citing real participant feedback and providing 2 actionable bullet points for SLSU extension faculty.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { temperature: 0.2 }
    });
    res.json({ answer: response.text });
    return;
  } catch (err) {
    console.error('Gemini quick insights error:', err);
    res.status(502).json({ error: 'AI could not answer this question.' });
    return;
  }
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabasePublishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    });
    if (!authResponse.ok) return res.status(401).json({ error: 'Invalid email or password.' });

    const authData = await authResponse.json() as { access_token?: string; user?: { id?: string } };
    const user = users.find(account => account.id === authData.user?.id);
    if (!user) return res.status(403).json({ error: 'Your Supabase account does not have an application profile yet.' });
    if (user.status !== 'active') return res.status(403).json({ error: 'This account has been deactivated.' });
    if (!authData.access_token) throw new Error('Supabase authentication response did not include an access token.');

    user.lastLogin = new Date().toISOString();
    return res.json({ token: authData.access_token, user });
  } catch (error) {
    console.error('Supabase sign-in failed:', error);
    return res.status(502).json({ error: 'The authentication service is unavailable.' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'A valid sign-in session is required.' });

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabasePublishableKey, Authorization: `Bearer ${token}` }
    });
    if (!authResponse.ok) return res.status(401).json({ error: 'Your sign-in session has expired.' });

    const authUser = await authResponse.json() as { id?: string };
    const user = users.find(account => account.id === authUser.id);
    if (!user || user.status !== 'active') return res.status(403).json({ error: 'No active application profile is available for this account.' });
    return res.json({ user });
  } catch (error) {
    console.error('Supabase session validation failed:', error);
    return res.status(502).json({ error: 'The authentication service is unavailable.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    try {
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: supabasePublishableKey, Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Supabase sign-out failed:', error);
      return res.status(502).json({ error: 'The authentication service is unavailable.' });
    }
  }
  return res.json({ success: true });
});

// ==========================================
// USER ACCOUNTS & RBAC MANAGEMENT
// ==========================================
app.get('/api/users', (_req, res) => {
  res.json(users);
});

app.patch('/api/users/:id/role', (req, res) => {
  const { id } = req.params;
  const { role, status, department, title } = req.body;
  const targetUser = users.find(u => u.id === id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User account not found' });
  }

  if (role) targetUser.role = role;
  if (status) targetUser.status = status;
  if (department) targetUser.department = department;
  if (title) targetUser.title = title;

  // Log in audit log
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'USER_ROLE_MODIFIED',
    resourceId: id,
    reason: `Updated user ${targetUser.email} to role: ${targetUser.role}, status: ${targetUser.status}`
  });

  res.json(targetUser);
});

app.post('/api/users', async (req, res) => {
  const { name, email, role, department, title } = req.body;
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Name and email are required fields.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'A user account with this email already exists.' });
  }

  let invitedUser: { id?: string };
  try {
    const inviteResponse = await fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: normalizedEmail, data: { name: name.trim() } })
    });
    if (!inviteResponse.ok) {
      const errorText = await inviteResponse.text();
      console.error(`Supabase invitation failed (${inviteResponse.status}): ${errorText}`);
      return res.status(502).json({ error: 'Supabase could not send the account invitation.' });
    }
    const inviteData = await inviteResponse.json() as { id?: string; user?: { id?: string } };
    invitedUser = { id: inviteData.id || inviteData.user?.id };
  } catch (error) {
    console.error('Supabase invitation request failed:', error);
    return res.status(502).json({ error: 'The authentication service is unavailable.' });
  }
  if (!invitedUser.id) return res.status(502).json({ error: 'Supabase invitation did not return a user ID.' });

  const newUser: ServerUser = {
    id: invitedUser.id,
    name: name.trim(),
    email: normalizedEmail,
    role: role || 'participant',
    department: department || 'SLSU Hinunangan',
    title: title || 'Staff Member',
    status: 'active',
    lastLogin: new Date().toISOString()
  };

  users.push(newUser);
  auditLogs.unshift({
    id: `log-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'USER_CREATED',
    resourceId: newUser.id,
    reason: `Created user account for ${newUser.name} (${newUser.role})`
  });
  res.status(201).json(newUser);
});

// ==========================================
// TRAINER PERFORMANCE METRICS ENDPOINT
// ==========================================
app.get('/api/trainer/metrics', (req, res) => {
  const { trainerName } = req.query;
  const queryName = typeof trainerName === 'string' ? trainerName.toLowerCase() : '';

  // Find activities matching this trainer or speaker
  const trainerActivities = activities.filter(a => {
    if (!queryName) return true;
    return a.trainerOrSpeaker.toLowerCase().includes(queryName) ||
      a.leadCoordinator.toLowerCase().includes(queryName);
  });

  const actIds = trainerActivities.map(a => a.id);
  const trainerEvals = evaluations.filter(e => actIds.includes(e.activityId));

  // Extract trainer mastery ratings (specificRatings.trainerMastery or speakerEngagement)
  const masteryScores: number[] = [];
  const materialsScores: number[] = [];
  const applicationScores: number[] = [];

  trainerEvals.forEach(e => {
    if (e.specificRatings?.trainerMastery) masteryScores.push(e.specificRatings.trainerMastery);
    if (e.specificRatings?.speakerEngagement) masteryScores.push(e.specificRatings.speakerEngagement);
    if (e.specificRatings?.learningMaterials) materialsScores.push(e.specificRatings.learningMaterials);
    if (e.specificRatings?.practicalApplication) applicationScores.push(e.specificRatings.practicalApplication);
  });

  const avgMastery = masteryScores.length > 0
    ? Number((masteryScores.reduce((a, b) => a + b, 0) / masteryScores.length).toFixed(2))
    : 0;

  const avgMaterials = materialsScores.length > 0
    ? Number((materialsScores.reduce((a, b) => a + b, 0) / materialsScores.length).toFixed(2))
    : 0;

  const avgApplication = applicationScores.length > 0
    ? Number((applicationScores.reduce((a, b) => a + b, 0) / applicationScores.length).toFixed(2))
    : 0;

  const comments = trainerEvals.map(e => ({
    activityId: e.activityId,
    activityTitle: activities.find(a => a.id === e.activityId)?.title || 'Activity',
    date: e.submittedAt,
    rating: e.meanRating,
    strengths: e.comments.strengths,
    improvements: e.comments.improvements,
    suggestions: e.comments.suggestions,
    sentiment: e.sentiment.overall
  }));

  res.json({
    trainerName: trainerName || 'All Faculty Resource Speakers',
    totalSessionsConducted: trainerActivities.length,
    totalEvaluationsReceived: trainerEvals.length,
    averageMasteryScore: avgMastery,
    averageMaterialsScore: avgMaterials,
    averageApplicationScore: avgApplication,
    sessions: trainerActivities,
    feedbackComments: comments
  });
});

// ==========================================
// PARTICIPANT PERSONAL EVALUATIONS ENDPOINT
// ==========================================
app.get('/api/participant/evaluations', (req, res) => {
  const account = res.locals.user as ServerUser;
  const requestedEmail = typeof req.query.email === 'string' ? req.query.email : account.email;
  const email = account.role === 'admin' ? requestedEmail : account.email;
  const participantEvals = evaluations.filter(
    e => e.participantEmail.toLowerCase() === email.toLowerCase().trim()
  );

  const enhanced = participantEvals.map(e => {
    const act = activities.find(a => a.id === e.activityId);
    return {
      ...e,
      activity: act
    };
  });

  res.json(enhanced);
});

// ==========================================
// SYSTEM SETTINGS & BENCHMARKS ENDPOINTS
// ==========================================
app.get('/api/settings', (_req, res) => {
  res.json(systemSettings);
});

app.patch('/api/settings', (req, res) => {
  systemSettings = { ...systemSettings, ...req.body };
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Super Admin',
    action: 'SYSTEM_SETTINGS_UPDATED',
    resourceId: 'system_settings',
    reason: 'Updated institutional accreditation benchmarks and sync configuration.'
  });
  res.json(systemSettings);
});

// ==========================================
// EVALUATION FORM BUILDER DATA & ENDPOINTS
// ==========================================
let evaluationForms: any[] = [];

// Forms endpoints
const completedEvaluationImports = new Map<string, { form: any; activity: ServerActivity }>();
const completedFormImports = new Map<string, any>();

app.post('/api/imports/form', (req, res) => {
  const { requestId, title, description, instructions, sections, originalFileName } = req.body || {};
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100) return res.status(400).json({ error: 'A valid import request ID is required.' });
  const priorForm = completedFormImports.get(requestId);
  if (priorForm) return res.json({ form: priorForm, replayed: true });
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) return res.status(400).json({ error: 'A form title between 1 and 200 characters is required.' });
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 100) return res.status(400).json({ error: 'The form needs between 1 and 100 sections.' });

  const questionCount = sections.reduce((count: number, section: any) => count + (Array.isArray(section?.questions) ? section.questions.length : 0), 0);
  const supportedTypes = ['short_text', 'paragraph', 'single_choice', 'multiple_choice', 'dropdown', 'linear_scale', 'rating_scale', 'star_rating', 'likert_scale', 'multiple_choice_grid', 'checkbox_grid', 'date', 'time', 'number', 'yes_no', 'rubric_table', 'section_title', 'instructions', 'long_text', 'email'];
  const validSections = sections.every((section: any) => typeof section?.title === 'string' && section.title.trim() && Array.isArray(section.questions));
  const validQuestions = sections.every((section: any) => section.questions.every((question: any) =>
    typeof question?.label === 'string' && question.label.trim() && supportedTypes.includes(question.type) && typeof question.required === 'boolean' &&
    (!['single_choice', 'multiple_choice', 'dropdown', 'rubric_table'].includes(question.type) || (Array.isArray(question.options) && question.options.length >= 2 && question.options.every((option: unknown) => typeof option === 'string' && option.trim()))) &&
    (question.type !== 'rubric_table' || (Array.isArray(question.criteria) && question.criteria.length > 0)) &&
    (!['rating_scale', 'star_rating', 'likert_scale', 'rubric_table'].includes(question.type) || (Number.isInteger(question.scaleMin) && Number.isInteger(question.scaleMax) && question.scaleMax > question.scaleMin && question.scaleMax - question.scaleMin <= 9))
  ));
  if (!validSections || !validQuestions || questionCount < 1 || questionCount > 300) return res.status(400).json({ error: 'The form contains invalid sections or questions. Check labels, field types, options, rating ranges, and the 300-question limit.' });

  const now = new Date().toISOString();
  const form = {
    id: `form-${randomUUID()}`,
    title: title.trim(),
    description: typeof description === 'string' ? description.slice(0, 3000) : '',
    instructions: typeof instructions === 'string' ? instructions.slice(0, 3000) : '',
    status: 'draft',
    version: 1,
    targetActivityType: 'all',
    sections,
    originalFileName: typeof originalFileName === 'string' ? originalFileName.slice(0, 255) : undefined,
    createdAt: now,
    updatedAt: now,
  };
  evaluationForms.unshift(form);
  completedFormImports.set(requestId, form);
  if (completedFormImports.size > 5000) completedFormImports.delete(completedFormImports.keys().next().value!);
  auditLogs.unshift({ id: `log-${randomUUID()}`, timestamp: now, adminName: 'Administrator', action: 'FORM_IMPORTED', resourceId: form.id, reason: `Imported draft form "${form.title}" with ${questionCount} questions.` });
  return res.status(201).json({ form });
});

app.post('/api/imports/evaluation', (req, res) => {
  const { requestId, title, formTitle, description, instructions, activityType, sections } = req.body || {};
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100) {
    return res.status(400).json({ error: 'A valid import request ID is required.' });
  }
  const priorResult = completedEvaluationImports.get(requestId);
  if (priorResult) return res.json({ ...priorResult, replayed: true });
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200 || (formTitle !== undefined && (typeof formTitle !== 'string' || !formTitle.trim() || formTitle.trim().length > 200))) {
    return res.status(400).json({ error: 'A title between 1 and 200 characters is required.' });
  }
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 100) {
    return res.status(400).json({ error: 'The evaluation needs between 1 and 100 sections.' });
  }
  const questionCount = sections.reduce((count: number, section: any) => count + (Array.isArray(section?.questions) ? section.questions.length : 0), 0);
  const supportedTypes = ['short_text', 'paragraph', 'single_choice', 'multiple_choice', 'dropdown', 'linear_scale', 'rating_scale', 'star_rating', 'likert_scale', 'multiple_choice_grid', 'checkbox_grid', 'date', 'time', 'number', 'yes_no', 'rubric_table', 'section_title', 'instructions', 'long_text', 'email'];
  const supportedActivityTypes = ['training', 'livelihood', 'seminar', 'outreach', 'community_service'];
  const validSections = sections.every((section: any) => typeof section?.title === 'string' && section.title.trim() && Array.isArray(section.questions));
  const validQuestions = sections.every((section: any) => section.questions.every((question: any) =>
    typeof question?.label === 'string' && question.label.trim() && supportedTypes.includes(question.type) && typeof question.required === 'boolean' &&
    (!['single_choice', 'multiple_choice', 'dropdown', 'rubric_table'].includes(question.type) || (Array.isArray(question.options) && question.options.length >= 2 && question.options.every((option: unknown) => typeof option === 'string' && option.trim()))) &&
    (question.type !== 'rubric_table' || (Array.isArray(question.criteria) && question.criteria.length > 0)) &&
    (!['rating_scale', 'star_rating', 'likert_scale', 'rubric_table'].includes(question.type) || (Number.isInteger(question.scaleMin) && Number.isInteger(question.scaleMax) && question.scaleMax > question.scaleMin && question.scaleMax - question.scaleMin <= 9)) &&
    (question.type !== 'likert_scale' || (Array.isArray(question.scaleLabels) && question.scaleLabels.length === question.scaleMax - question.scaleMin + 1)) &&
    (question.type !== 'rubric_table' || question.options.length === question.scaleMax - question.scaleMin + 1) &&
    (question.type !== 'instructions' || !question.required)
  ));
  if (!validSections || !validQuestions || (activityType !== undefined && !supportedActivityTypes.includes(activityType)) || questionCount < 1 || questionCount > 300) {
    return res.status(400).json({ error: 'The form contains an invalid section or question. Check labels, field types, required flags, and the 300-question limit.' });
  }

  const now = new Date().toISOString();
  const formId = `form-${randomUUID()}`;
  const form = {
    id: formId,
    title: typeof formTitle === 'string' ? formTitle.trim() : title.trim(),
    description: typeof description === 'string' ? description.slice(0, 3000) : '',
    instructions: typeof instructions === 'string' ? instructions.slice(0, 3000) : '',
    status: 'draft',
    version: 1,
    targetActivityType: 'all',
    sections,
    createdAt: now,
    updatedAt: now
  };
  const activity: ServerActivity = {
    id: `act-${randomUUID()}`,
    title: title.trim(),
    activityType: supportedActivityTypes.includes(activityType) ? activityType : 'training',
    description: typeof description === 'string' ? description.slice(0, 3000) : '',
    instructions: typeof instructions === 'string' ? instructions.slice(0, 3000) : '',
    date: now.slice(0, 10),
    venue: 'To be confirmed',
    targetBeneficiaries: 'To be confirmed',
    organizingDepartment: 'To be confirmed',
    leadCoordinator: 'To be assigned',
    trainerOrSpeaker: 'To be assigned',
    status: 'draft',
    totalTargetParticipants: 30,
    assignedFormId: formId,
    createdAt: now
  };

  evaluationForms.unshift(form);
  activities.unshift(activity);
  const result = { form, activity };
  completedEvaluationImports.set(requestId, result);
  if (completedEvaluationImports.size > 5000) completedEvaluationImports.delete(completedEvaluationImports.keys().next().value!);
  auditLogs.unshift({
    id: `log-${randomUUID()}`,
    timestamp: now,
    adminName: 'Administrator',
    action: 'EVALUATION_IMPORTED',
    resourceId: activity.id,
    reason: `Imported draft evaluation activity "${activity.title}" with ${questionCount} questions.`
  });
  return res.status(201).json(result);
});

app.get('/api/forms', (_req, res) => {
  const account = res.locals.user as ServerUser;
  res.json(account.role === 'admin' ? evaluationForms : evaluationForms.filter(form => form.status === 'published'));
});

const validateFormDefinition = (form: any): string | null => {
  const validStatuses = ['draft', 'published', 'archived'];
  const validActivityTypes = ['all', 'training', 'livelihood', 'seminar', 'outreach', 'community_service'];
  const validQuestionTypes = ['short_text', 'paragraph', 'single_choice', 'multiple_choice', 'dropdown', 'linear_scale', 'rating_scale', 'star_rating', 'likert_scale', 'multiple_choice_grid', 'checkbox_grid', 'date', 'time', 'number', 'yes_no', 'rubric_table', 'section_title', 'instructions', 'long_text', 'email'];
  if (typeof form.title !== 'string' || !form.title.trim() || form.title.trim().length > 200) return 'A form title between 1 and 200 characters is required.';
  if (!validStatuses.includes(form.status)) return 'Choose a valid form status.';
  if (form.targetActivityType && !validActivityTypes.includes(form.targetActivityType)) return 'Choose a valid target activity type.';
  if (typeof form.description === 'string' && form.description.length > 3000) return 'Form description cannot exceed 3000 characters.';
  if (typeof form.instructions === 'string' && form.instructions.length > 3000) return 'Form instructions cannot exceed 3000 characters.';
  if (!Array.isArray(form.sections) || form.sections.length > 100) return 'A form can contain at most 100 sections.';
  let questionCount = 0;
  const questionIds = new Set<string>();
  for (const section of form.sections) {
    if (typeof section?.title !== 'string' || !section.title.trim() || section.title.length > 200 || !Array.isArray(section.questions)) return 'Every section needs a title and a question list.';
    for (const question of section.questions) {
      questionCount += 1;
      if (typeof question?.id !== 'string' || !question.id || questionIds.has(question.id)) return 'Question IDs must be present and unique within a form.';
      questionIds.add(question.id);
      if (typeof question.label !== 'string' || !question.label.trim() || question.label.length > 1000 || !validQuestionTypes.includes(question.type) || typeof question.required !== 'boolean') return 'A question has an invalid label, field type, or required setting.';
      if (question.description && (typeof question.description !== 'string' || question.description.length > 2000)) return 'Question help text cannot exceed 2000 characters.';
      if (['single_choice', 'multiple_choice', 'dropdown', 'rubric_table'].includes(question.type)) {
        if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 100 || question.options.some((option: unknown) => typeof option !== 'string' || !option.trim() || option.length > 300)) return `"${question.label}" needs between 2 and 100 valid answer options.`;
      }
      if (question.type === 'rubric_table' && (!Array.isArray(question.criteria) || question.criteria.length < 1 || question.criteria.length > 100 || question.criteria.some((criterion: unknown) => typeof criterion !== 'string' || !criterion.trim()))) return `"${question.label}" needs at least one rubric criterion.`;
      if (question.type === 'multiple_choice' && ((question.minSelections !== undefined && (!Number.isInteger(question.minSelections) || question.minSelections < 0)) || (question.maxSelections !== undefined && (!Number.isInteger(question.maxSelections) || question.maxSelections < 1)) || (question.minSelections !== undefined && question.maxSelections !== undefined && question.minSelections > question.maxSelections) || (question.maxSelections !== undefined && question.maxSelections > (question.options || []).length))) return `"${question.label}" has invalid selection limits.`;
      if (['rating_scale', 'star_rating', 'likert_scale', 'rubric_table'].includes(question.type)) {
        const minimum = question.scaleMin ?? 1;
        const maximum = question.scaleMax ?? 5;
        if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum <= minimum || maximum - minimum > 9) return `"${question.label}" needs a valid rating range with 2 to 10 values.`;
      }
      if (question.type === 'likert_scale' && (!Array.isArray(question.scaleLabels) || question.scaleLabels.length !== (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1 || question.scaleLabels.some((label: unknown) => typeof label !== 'string' || !label.trim()))) return `"${question.label}" needs a label for every Likert rating.`;
      if (question.type === 'rubric_table' && question.options.length !== (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1) return `"${question.label}" needs a label for every rubric score.`;
      if (question.weight !== undefined && (!Number.isFinite(question.weight) || question.weight < 0 || question.weight > 100)) return `"${question.label}" has an invalid weight.`;
      if (question.type === 'instructions' && question.required) return 'Instruction-only fields cannot be required responses.';
    }
  }
  if (questionCount > 300) return 'A form cannot contain more than 300 questions.';
  if (form.status === 'published' && questionCount === 0) return 'Add at least one question before publishing a form.';
  return null;
};

app.post('/api/forms', (req, res) => {
  const payload = { ...req.body, status: req.body.status || 'draft', sections: req.body.sections || [] };
  const validationError = validateFormDefinition(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  if (payload.activityId && !activities.some(activity => activity.id === payload.activityId)) return res.status(404).json({ error: 'Associated activity not found.' });

  const now = new Date().toISOString();
  const newForm = {
    id: `form-${randomUUID()}`,
    title: payload.title.trim(),
    description: payload.description || '',
    instructions: payload.instructions || '',
    status: payload.status,
    version: 1,
    targetActivityType: payload.targetActivityType || 'all',
    activityId: payload.activityId || '',
    targetRespondent: typeof payload.targetRespondent === 'string' ? payload.targetRespondent.slice(0, 200) : '',
    purpose: typeof payload.purpose === 'string' ? payload.purpose.slice(0, 1000) : '',
    originalFileName: typeof payload.originalFileName === 'string' ? payload.originalFileName.slice(0, 255) : undefined,
    sections: payload.sections,
    createdAt: now,
    updatedAt: now
  };
  evaluationForms.unshift(newForm);
  if (newForm.activityId) activities.find(activity => activity.id === newForm.activityId)!.assignedFormId = newForm.id;
  auditLogs.unshift({
    id: `log-${randomUUID()}`,
    timestamp: now,
    adminName: 'Administrator',
    action: 'FORM_CREATED',
    resourceId: newForm.id,
    reason: `Created new evaluation form "${newForm.title}"`
  });
  res.status(201).json(newForm);
});

app.put('/api/forms/:id', (req, res) => {
  const idx = evaluationForms.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  const existingForm = evaluationForms[idx];
  const payload = req.body || {};
  const updatedForm = {
    ...existingForm,
    title: payload.title ?? existingForm.title,
    description: payload.description ?? existingForm.description,
    instructions: payload.instructions ?? existingForm.instructions,
    status: payload.status ?? existingForm.status,
    targetActivityType: payload.targetActivityType ?? existingForm.targetActivityType,
    activityId: payload.activityId ?? existingForm.activityId,
    targetRespondent: payload.targetRespondent ?? existingForm.targetRespondent,
    purpose: payload.purpose ?? existingForm.purpose,
    sections: payload.sections ?? existingForm.sections,
  };
  const validationError = validateFormDefinition(updatedForm);
  if (validationError) return res.status(400).json({ error: validationError });
  if (updatedForm.activityId && !activities.some(activity => activity.id === updatedForm.activityId)) return res.status(404).json({ error: 'Associated activity not found.' });
  if (existingForm.activityId && existingForm.activityId !== updatedForm.activityId) {
    const previousActivity = activities.find(activity => activity.id === existingForm.activityId);
    if (previousActivity && previousActivity.assignedFormId === existingForm.id) previousActivity.assignedFormId = undefined;
  }
  if (updatedForm.activityId) activities.find(activity => activity.id === updatedForm.activityId)!.assignedFormId = existingForm.id;
  evaluationForms[idx] = { ...updatedForm, updatedAt: new Date().toISOString(), version: (existingForm.version || 1) + 1 };
  auditLogs.unshift({
    id: `log-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'FORM_UPDATED',
    resourceId: req.params.id,
    reason: `Modified form structure & question rubric for "${evaluationForms[idx].title}"`
  });
  res.json(evaluationForms[idx]);
});

app.delete('/api/forms/:id', (req, res) => {
  const idx = evaluationForms.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  const deleted = evaluationForms.splice(idx, 1)[0];
  activities.forEach(activity => {
    if (activity.assignedFormId === deleted.id) activity.assignedFormId = undefined;
  });
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'FORM_DELETED',
    resourceId: req.params.id,
    reason: `Removed evaluation form "${deleted.title}"`
  });
  res.json({ success: true });
});

app.post('/api/forms/:id/duplicate', (req, res) => {
  const orig = evaluationForms.find(f => f.id === req.params.id);
  if (!orig) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  const cloned = {
    ...orig,
    id: `form-${Date.now()}`,
    title: `${orig.title} (Copy)`,
    status: 'draft',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  evaluationForms.unshift(cloned);
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'FORM_DUPLICATED',
    resourceId: cloned.id,
    reason: `Cloned template from "${orig.title}"`
  });
  res.status(201).json(cloned);
});

// ==========================================
// SURVEY MANAGEMENT DATA & ENDPOINTS
// ==========================================
let surveys: any[] = [];

let surveyResponses: any[] = [];

// Survey endpoints
app.get('/api/surveys', (_req, res) => {
  const account = res.locals.user as ServerUser;
  const visibleSurveys = account.role === 'admin' ? surveys : surveys.filter(survey => survey.status === 'published');
  const enhanced = visibleSurveys.map(s => {
    const respCount = surveyResponses.filter(r => r.surveyId === s.id).length;
    return { ...s, responsesCount: respCount };
  });
  res.json(enhanced);
});

app.post('/api/surveys', (req, res) => {
  const newSurvey = {
    id: `survey-${Date.now()}`,
    title: req.body.title || 'Untitled Stakeholder Survey',
    description: req.body.description || '',
    instructions: req.body.instructions || '',
    status: req.body.status || 'draft',
    isAnonymous: req.body.isAnonymous !== undefined ? req.body.isAnonymous : true,
    targetAudience: req.body.targetAudience || 'Community Beneficiaries',
    startDate: req.body.startDate || new Date().toISOString().split('T')[0],
    endDate: req.body.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    questions: req.body.questions || [],
    createdAt: new Date().toISOString()
  };
  surveys.unshift(newSurvey);
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'SURVEY_CREATED',
    resourceId: newSurvey.id,
    reason: `Registered stakeholder survey "${newSurvey.title}"`
  });
  res.status(201).json(newSurvey);
});

app.put('/api/surveys/:id', (req, res) => {
  const idx = surveys.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }
  surveys[idx] = { ...surveys[idx], ...req.body };
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'SURVEY_UPDATED',
    resourceId: req.params.id,
    reason: `Updated survey configuration for "${surveys[idx].title}"`
  });
  res.json(surveys[idx]);
});

app.delete('/api/surveys/:id', (req, res) => {
  const idx = surveys.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }
  const deleted = surveys.splice(idx, 1)[0];
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'SURVEY_DELETED',
    resourceId: req.params.id,
    reason: `Archived/deleted survey "${deleted.title}"`
  });
  res.json({ success: true });
});

app.get('/api/surveys/:id/responses', (req, res) => {
  const list = surveyResponses.filter(r => r.surveyId === req.params.id);
  res.json(list);
});

app.post('/api/surveys/:id/responses', (req, res) => {
  const survey = surveys.find(s => s.id === req.params.id);
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }
  const account = res.locals.user as ServerUser;
  if (account.role !== 'admin' && survey.status !== 'published') {
    return res.status(409).json({ error: 'This survey is not accepting responses.' });
  }
  const newResp = {
    id: `sr-${Date.now()}`,
    surveyId: req.params.id,
    isAnonymous: survey.isAnonymous,
    respondentName: survey.isAnonymous ? undefined : account.name,
    respondentEmail: survey.isAnonymous ? undefined : account.email,
    answers: req.body.answers || {},
    submittedAt: new Date().toISOString()
  };
  surveyResponses.unshift(newResp);
  res.status(201).json(newResp);
});

// ==========================================
// WEBSITE THEME & APPEARANCE CUSTOMIZATION
// ==========================================
const DEFAULT_THEME = {
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
  typography: {
    baseFontSize: 1.0,
    pageTitleSize: 1.5,
    sectionHeadingSize: 1.125,
    bodyTextSize: 0.875,
    labelSize: 0.75,
    buttonTextSize: 0.75,
    tableTextSize: 0.75,
    navTextSize: 0.875,
    metricNumberSize: 1.875,
    smallTextSize: 0.6875,
    pageTitleColor: '#0f172a',
    sectionHeadingColor: '#1e293b',
    bodyTextColor: '#334155',
    mutedTextColor: '#64748b',
    labelTextColor: '#475569'
  }
};

let currentTheme = { ...DEFAULT_THEME };

const isValidColor = (val: any) => typeof val === 'string' && (/^#([0-9a-fA-F]{3,8})$/.test(val) || /^rgb/.test(val));

app.get('/api/theme', (_req, res) => {
  res.json(currentTheme);
});

app.post('/api/theme', (req, res) => {
  // Validate typography bounds and font colors if provided
  if (req.body.typography) {
    const typo = req.body.typography;
    const validatedTypo = {
      baseFontSize: Math.max(0.75, Math.min(1.35, Number(typo.baseFontSize) || 1.0)),
      pageTitleSize: Math.max(1.15, Math.min(2.5, Number(typo.pageTitleSize) || 1.5)),
      sectionHeadingSize: Math.max(0.9, Math.min(1.8, Number(typo.sectionHeadingSize) || 1.125)),
      bodyTextSize: Math.max(0.75, Math.min(1.25, Number(typo.bodyTextSize) || 0.875)),
      labelSize: Math.max(0.65, Math.min(1.0, Number(typo.labelSize) || 0.75)),
      buttonTextSize: Math.max(0.65, Math.min(1.1, Number(typo.buttonTextSize) || 0.75)),
      tableTextSize: Math.max(0.65, Math.min(1.0, Number(typo.tableTextSize) || 0.75)),
      navTextSize: Math.max(0.75, Math.min(1.25, Number(typo.navTextSize) || 0.875)),
      metricNumberSize: Math.max(1.4, Math.min(2.6, Number(typo.metricNumberSize) || 1.875)),
      smallTextSize: Math.max(0.6, Math.min(0.9, Number(typo.smallTextSize) || 0.6875)),
      pageTitleColor: isValidColor(typo.pageTitleColor) ? typo.pageTitleColor : (currentTheme.typography?.pageTitleColor || '#0f172a'),
      sectionHeadingColor: isValidColor(typo.sectionHeadingColor) ? typo.sectionHeadingColor : (currentTheme.typography?.sectionHeadingColor || '#1e293b'),
      bodyTextColor: isValidColor(typo.bodyTextColor) ? typo.bodyTextColor : (currentTheme.typography?.bodyTextColor || '#334155'),
      mutedTextColor: isValidColor(typo.mutedTextColor) ? typo.mutedTextColor : (currentTheme.typography?.mutedTextColor || '#64748b'),
      labelTextColor: isValidColor(typo.labelTextColor) ? typo.labelTextColor : (currentTheme.typography?.labelTextColor || '#475569')
    };
    req.body.typography = validatedTypo;
  }

  // Validate root font color fields if provided
  if (req.body.fontColorTitle && !isValidColor(req.body.fontColorTitle)) delete req.body.fontColorTitle;
  if (req.body.fontColorHeading && !isValidColor(req.body.fontColorHeading)) delete req.body.fontColorHeading;
  if (req.body.fontColorBody && !isValidColor(req.body.fontColorBody)) delete req.body.fontColorBody;
  if (req.body.fontColorMuted && !isValidColor(req.body.fontColorMuted)) delete req.body.fontColorMuted;
  if (req.body.fontColorLabel && !isValidColor(req.body.fontColorLabel)) delete req.body.fontColorLabel;

  currentTheme = { 
    ...currentTheme, 
    ...req.body,
    typography: req.body.typography || currentTheme.typography 
  };

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: req.body.typography ? 'TYPOGRAPHY_AND_THEME_SAVED' : 'THEME_CUSTOMIZATION_SAVED',
    resourceId: 'website_theme',
    reason: `Applied customized brand typography & theme settings (Base: ${currentTheme.typography?.baseFontSize || 1}rem)`
  });

  res.json(currentTheme);
});

app.post('/api/theme/reset', (req, res) => {
  currentTheme = { ...DEFAULT_THEME };
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'THEME_RESET_DEFAULT',
    resourceId: 'website_theme',
    reason: 'Restored default SLSU institutional brand palette & typography standards'
  });
  res.json(currentTheme);
});

// ==========================================
// ADMIN COMPREHENSIVE SYSTEM METRICS ENDPOINT
// ==========================================
app.get('/api/admin/metrics', (_req, res) => {
  const totalEvaluations = evaluations.length;
  const ratedEvaluations = evaluations.filter(evaluation => evaluation.meanRating > 0);
  const overallSatisfactionMean = ratedEvaluations.length > 0
    ? Number((ratedEvaluations.reduce((total, evaluation) => total + evaluation.meanRating, 0) / ratedEvaluations.length).toFixed(2))
    : 0;

  const totalTargetParticipants = activities.reduce((a, b) => a + (b.totalTargetParticipants || 0), 0);
  const turnoutCompletionRate = totalTargetParticipants > 0
    ? Math.min(100, Math.round((totalEvaluations / totalTargetParticipants) * 100))
    : 85;

  const metrics = {
    totalUsers: users.length,
    adminUsers: users.filter(u => u.role === 'admin').length,
    participantUsers: users.filter(u => u.role === 'participant').length,
    totalActivities: activities.length,
    activeActivities: activities.filter(a => a.status === 'active').length,
    completedActivities: activities.filter(a => a.status === 'completed').length,
    upcomingActivities: activities.filter(a => a.status === 'upcoming').length,
    draftActivities: activities.filter(a => a.status === 'draft').length,
    totalSurveys: surveys.length,
    publishedSurveys: surveys.filter(s => s.status === 'published').length,
    totalSurveyResponses: surveyResponses.length,
    totalEvaluations,
    overallSatisfactionMean,
    turnoutCompletionRate,
    totalAuditEvents: auditLogs.length,
    recentActivityFeed: auditLogs.slice(0, 10).map(l => ({
      id: l.id,
      action: l.action,
      target: l.resourceId,
      actor: l.adminName,
      timestamp: l.timestamp
    }))
  };

  res.json(metrics);
});

// ==========================================
// ADDITIONAL ACTIVITY CRUD MANAGEMENT
// ==========================================
app.put('/api/activities/:id', (req, res) => {
  const idx = activities.findIndex(a => a.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Activity not found' });
    return;
  }
  activities[idx] = { ...activities[idx], ...req.body };
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'ACTIVITY_UPDATED',
    resourceId: req.params.id,
    reason: `Updated details for activity "${activities[idx].title}"`
  });
  res.json(activities[idx]);
});

app.delete('/api/activities/:id', (req, res) => {
  const idx = activities.findIndex(a => a.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Activity not found' });
    return;
  }
  const deleted = activities.splice(idx, 1)[0];
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'ACTIVITY_ARCHIVED',
    resourceId: req.params.id,
    reason: `Archived activity "${deleted.title}"`
  });
  res.json({ success: true });
});

app.post('/api/activities/:id/duplicate', (req, res) => {
  const orig = activities.find(a => a.id === req.params.id);
  if (!orig) {
    res.status(404).json({ error: 'Activity not found' });
    return;
  }
  const cloned = {
    ...orig,
    id: `act-${Date.now()}`,
    title: `${orig.title} (Cohort Copy)`,
    status: 'draft',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  activities.unshift(cloned as any);
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'ACTIVITY_DUPLICATED',
    resourceId: cloned.id,
    reason: `Duplicated activity template from "${orig.title}"`
  });
  res.status(201).json(cloned);
});

// ==========================================
// USER ACCOUNTS & RECOVERY ENDPOINTS
// ==========================================
app.put('/api/users/:id', (req, res) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  users[idx] = { ...users[idx], ...req.body };
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'USER_ROLE_STATUS_UPDATED',
    resourceId: req.params.id,
    reason: `Updated permissions/status for ${users[idx].name}`
  });
  res.json(users[idx]);
});

app.post('/api/users/:id/reset', async (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  try {
    const resetResponse = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: supabasePublishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email })
    });
    if (!resetResponse.ok) {
      const errorText = await resetResponse.text();
      console.error(`Supabase password reset failed (${resetResponse.status}): ${errorText}`);
      return res.status(502).json({ error: 'Supabase could not send the password reset email.' });
    }
  } catch (error) {
    console.error('Supabase password reset request failed:', error);
    return res.status(502).json({ error: 'The authentication service is unavailable.' });
  }

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    adminName: 'Administrator',
    action: 'USER_SECURITY_CREDENTIAL_RESET',
    resourceId: req.params.id,
    reason: `Issued temporary credential reset token for ${user.email}`
  });
  res.json({ success: true, message: `Password reset email sent to ${user.email}` });
});

type PersistedServerState = {
  users: ServerUser[];
  systemSettings: typeof systemSettings;
  activities: ServerActivity[];
  evaluations: ServerEvaluation[];
  auditLogs: AuditLog[];
  evaluationForms: any[];
  surveys: any[];
  surveyResponses: any[];
  currentTheme: typeof currentTheme;
};

function getServerState(): PersistedServerState {
  return {
    users: withPosition(users),
    systemSettings,
    activities: withPosition(activities),
    evaluations: withPosition(evaluations),
    auditLogs: withPosition(auditLogs),
    evaluationForms: withPosition(evaluationForms),
    surveys: withPosition(surveys),
    surveyResponses: withPosition(surveyResponses),
    currentTheme
  };
}

function withPosition<T extends object>(records: T[]) {
  return records.map((record, position) => ({ ...record, __position: position }));
}

function restoreArray<T>(target: T[], saved: unknown, name: string) {
  if (!Array.isArray(saved)) {
    throw new Error(`Supabase application state is missing the "${name}" array.`);
  }
  const records = saved.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`Supabase returned an invalid record in "${name}".`);
    }
    const { __position: _position, ...value } = record as Record<string, unknown>;
    return value as T;
  });
  target.splice(0, target.length, ...records);
}

function restoreServerState(saved: unknown) {
  if (!saved || typeof saved !== 'object') {
    throw new Error('Supabase returned an invalid application state document.');
  }

  const state = saved as PersistedServerState;
  restoreArray(users, state.users, 'users');
  restoreArray(activities, state.activities, 'activities');
  restoreArray(evaluations, state.evaluations, 'evaluations');
  restoreArray(auditLogs, state.auditLogs, 'auditLogs');
  restoreArray(evaluationForms, state.evaluationForms, 'evaluationForms');
  restoreArray(surveys, state.surveys, 'surveys');
  restoreArray(surveyResponses, state.surveyResponses, 'surveyResponses');

  if (state.systemSettings && typeof state.systemSettings === 'object') systemSettings = state.systemSettings;
  if (state.currentTheme && typeof state.currentTheme === 'object') currentTheme = state.currentTheme;
}

async function supabaseStateRequest(path: string, init?: RequestInit) {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Supabase service credentials are not configured.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${message}`);
  }
  return response;
}

async function saveServerState() {
  await supabaseStateRequest('rpc/save_app_snapshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_snapshot: getServerState() })
  });
}

async function hydrateServerState() {
  const response = await supabaseStateRequest('rpc/load_app_snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  restoreServerState(await response.json());
  await saveServerState();
  console.log('Loaded application data from normalized Supabase tables.');
}

// Vite Middleware Integration for SPA Full-Stack Dev Server
async function startServer() {
  await hydrateServerState();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SLSU-Hinunangan Extension Evaluation System running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
