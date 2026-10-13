import React from 'react';
import { Activity, EvaluationForm, EvaluationSubmission, WebsiteTheme } from '../types';

export type EvaluationPrintMode = 'blank' | 'summary' | 'completed';

interface EvaluationPrintDocumentProps {
  mode: EvaluationPrintMode;
  activity?: Activity;
  form?: EvaluationForm;
  evaluation?: EvaluationSubmission;
  theme: WebsiteTheme;
  institutionName: string;
  showRespondent?: boolean;
}

const responseForQuestion = (question: { id: string; label: string }, evaluation?: EvaluationSubmission): unknown => {
  if (!evaluation) return undefined;
  const directAnswer = evaluation.customAnswers?.[question.id]
    ?? evaluation.specificRatings?.[question.id]
    ?? (evaluation.coreRatings as Record<string, unknown> | undefined)?.[question.id]
    ?? evaluation.customAnswers?.[question.label];
  if (directAnswer !== undefined) return directAnswer;
  const questionText = `${question.id} ${question.label}`.toLowerCase();
  const legacyKeys: Record<string, string[]> = {
    satisfaction: ['satisfaction'],
    objectives: ['objectives'],
    relevance: ['relevance'],
    facilities: ['facilities'],
    timeManagement: ['timemanagement', 'time management', 'pacing'],
    organization: ['organization', 'organisation'],
  };
  const coreRatings = evaluation.coreRatings as Record<string, unknown> | undefined;
  for (const [key, matches] of Object.entries(legacyKeys)) {
    if (matches.some(match => questionText.includes(match)) && coreRatings?.[key] !== undefined) return coreRatings[key];
  }
  return undefined;
};

const answerText = (answer: unknown): string => Array.isArray(answer) ? answer.join(', ') : answer == null ? '' : String(answer);

const PrintQuestion: React.FC<{ question: EvaluationForm['sections'][number]['questions'][number]; index: number; answer?: unknown }> = ({ question, index, answer }) => {
  const savedAnswer = answerText(answer);
  return (
    <article className="evaluation-print-question">
      <p className="evaluation-print-question-label"><strong>{index}. {question.label}</strong>{question.required && <span> *</span>}</p>
      {question.description && <p className="evaluation-print-muted">{question.description}</p>}
      {savedAnswer ? <p className="evaluation-print-answer">Response: {savedAnswer}</p> : (
        <div className="evaluation-print-response">
          {question.type === 'rating_scale' || question.type === 'star_rating' ? (
            <div className="evaluation-print-scale"><span>{question.scaleMinLabel || 'Low'}</span><strong>{Array.from({ length: Math.min(10, Math.max(2, (question.scaleMax || 5) - (question.scaleMin || 1) + 1)) }, (_, value) => `(${(question.scaleMin || 1) + value})`).join('   ')}</strong><span>{question.scaleMaxLabel || 'High'}</span></div>
          ) : question.type === 'dropdown' ? (
            <p className="evaluation-print-dropdown">Select one: ____________________ <span>Options: {(question.options || []).join(' / ')}</span></p>
          ) : ['single_choice', 'multiple_choice'].includes(question.type) ? (
            <ul className="evaluation-print-options">{(question.options || []).map((option, optionIndex) => <li key={optionIndex}><span className={`evaluation-print-box${question.type === 'single_choice' ? ' evaluation-print-radio' : ''}`} />{option}</li>)}</ul>
          ) : question.type === 'long_text' ? <div className="evaluation-print-lines" /> : <div className="evaluation-print-line" />}
        </div>
      )}
    </article>
  );
};

export const EvaluationPrintDocument: React.FC<EvaluationPrintDocumentProps> = ({ mode, activity, form, evaluation, theme, institutionName, showRespondent = false }) => {
  const printForm = evaluation?.formSnapshot || form;
  const activityTitle = activity?.title || form?.title || 'Evaluation Form';
  return (
    <div className="evaluation-print-document" aria-hidden="true">
      <header className="evaluation-print-header">
        {theme.sidebarLogoUrl && <img src={theme.sidebarLogoUrl} alt="" className="evaluation-print-logo" />}
        <p className="evaluation-print-organization">{institutionName || theme.siteName}</p>
        <h1>{activityTitle}</h1>
        {printForm?.title && <h2>{printForm.title}</h2>}
        {mode === 'summary' ? <p>Evaluation Activity Summary</p> : <p>{printForm?.instructions || activity?.instructions || printForm?.description || activity?.description}</p>}
      </header>

      {mode === 'summary' && activity && (
        <section className="evaluation-print-meta">
          <p><strong>Activity type:</strong> {activity.activityType.replace('_', ' ')}</p>
          <p><strong>Status:</strong> {activity.status}</p>
          <p><strong>Date:</strong> {activity.date}</p>
          <p><strong>Venue:</strong> {activity.venue}</p>
          <p><strong>Coordinator:</strong> {activity.leadCoordinator}</p>
          <p><strong>Target participants:</strong> {activity.totalTargetParticipants}</p>
          {activity.evaluatedParticipants !== undefined && <p><strong>Completed evaluations:</strong> {activity.evaluatedParticipants}</p>}
          {activity.averageRating !== undefined && activity.averageRating > 0 && <p><strong>Average rating:</strong> {activity.averageRating.toFixed(2)}</p>}
          {activity.description && <p><strong>Description:</strong> {activity.description}</p>}
        </section>
      )}

      {mode === 'completed' && evaluation && showRespondent && (
        <section className="evaluation-print-meta">
          <p><strong>Respondent:</strong> {evaluation.participantName}</p>
          <p><strong>Email:</strong> {evaluation.participantEmail}</p>
          {evaluation.participantPhone && <p><strong>Phone:</strong> {evaluation.participantPhone}</p>}
          <p><strong>Submitted:</strong> {new Date(evaluation.submittedAt).toLocaleString()}</p>
          <p><strong>Control number:</strong> {evaluation.controlNumber}</p>
        </section>
      )}

      {mode !== 'summary' && printForm?.sections?.map((section, sectionIndex) => (
        <section key={section.id || sectionIndex} className="evaluation-print-section">
          <h2>{section.title}</h2>
          {section.description && <p className="evaluation-print-muted">{section.description}</p>}
          {section.questions?.map((question, questionIndex) => <PrintQuestion key={question.id || questionIndex} question={question} index={questionIndex + 1} answer={responseForQuestion(question, evaluation)} />)}
        </section>
      ))}

      {mode === 'completed' && evaluation && (
        <section className="evaluation-print-section">
          <h2>Evaluation Summary</h2>
          <p><strong>Mean rating:</strong> {evaluation.meanRating}</p>
          <p><strong>Overall satisfaction:</strong> {evaluation.coreRatings?.satisfaction ?? 'Not recorded'}</p>
          <p><strong>Strengths:</strong> {evaluation.comments?.strengths || 'No response recorded'}</p>
          <p><strong>Areas to improve:</strong> {evaluation.comments?.improvements || 'No response recorded'}</p>
          <p><strong>Suggestions:</strong> {evaluation.comments?.suggestions || 'No response recorded'}</p>
        </section>
      )}

      {mode === 'blank' && <footer className="evaluation-print-signature"><span>Respondent signature: ______________________________</span><span>Date: __________________</span></footer>}
      <footer className="evaluation-print-footer"><span>{theme.siteName}</span><span>{mode === 'completed' ? 'Confidential evaluation record' : 'Evaluation form'}</span></footer>
    </div>
  );
};

export const startEvaluationPrint = (paper: 'A4' | 'Letter' = 'A4') => {
  document.body.dataset.evaluationPaper = paper;
  document.body.classList.add('printing-evaluation');
  const cleanup = () => {
    document.body.classList.remove('printing-evaluation');
    delete document.body.dataset.evaluationPaper;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
};