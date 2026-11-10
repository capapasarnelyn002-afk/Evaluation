import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, CheckCircle2, ExternalLink, LoaderCircle, Send } from 'lucide-react';
import { FormQuestion, WebsiteTheme } from '../types';
import { UniversityLogo } from './UniversityLogo';

interface PublicActivity {
  title: string;
  description: string;
  date: string;
  venue: string;
}

interface PublicForm {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  expiresAt?: string;
  sections: Array<{ id: string; title: string; description?: string; questions: FormQuestion[] }>;
}

interface PublicFormListing {
  id: string;
  title: string;
  activityTitle: string;
  activityDate: string;
  venue: string;
}

interface PublicFormResponse {
  form: PublicForm;
  activity: PublicActivity;
}

const publicApi = (path: string, init?: RequestInit) => fetch(path, {
  ...init,
  headers: { 'Content-Type': 'application/json', ...init?.headers },
  cache: 'no-store'
});

const emptyAnswer = (value: unknown) =>
  value === undefined || value === null || value === '' ||
  (Array.isArray(value) && value.length === 0);

const RatingChoices: React.FC<{
  question: FormQuestion;
  value: unknown;
  name: string;
  onChange: (value: number | string) => void;
}> = ({ question, value, name, onChange }) => {
  const min = question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;
  const labels = question.type === 'likert_scale' ? question.scaleLabels : undefined;
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.label}>
      {Array.from({ length: max - min + 1 }, (_, index) => {
        const score = min + index;
        const label = labels?.[index] || String(score);
        const selected = String(value ?? '') === String(score);
        return (
          <label key={score} className={`min-h-11 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${selected ? 'border-[var(--brand-primary)] bg-[var(--sidebar-active-bg)] text-[var(--brand-accent)]' : 'border-[var(--sidebar-border)] bg-white text-slate-700 hover:bg-slate-50'}`}>
            <input className="sr-only" type="radio" name={name} value={score} required={question.required} checked={selected} onChange={() => onChange(score)} />
            <span className="font-semibold">{label}</span>
          </label>
        );
      })}
    </div>
  );
};

const QuestionField: React.FC<{
  question: FormQuestion;
  number: number;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ question, number, value, onChange }) => {
  const options = question.options || [];
  const rows = question.criteria || [];
  const name = `question-${question.id}`;
  if (question.type === 'instructions' || question.type === 'section_title') {
    return <p className="rounded-lg bg-[var(--sidebar-active-bg)] p-3 text-sm text-slate-700">{question.description || question.label}</p>;
  }

  const choiceOptions = question.type === 'yes_no' ? ['Yes', 'No'] : options;
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold text-[var(--brand-accent)]">
        {number}. {question.label}{question.required && <span className="text-rose-600"> *</span>}
      </legend>
      {question.description && <p className="text-sm text-slate-600">{question.description}</p>}

      {['rating_scale', 'star_rating', 'likert_scale', 'linear_scale'].includes(question.type) && (
        <RatingChoices question={question} value={value} name={name} onChange={next => onChange(next)} />
      )}

      {['single_choice', 'yes_no'].includes(question.type) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {choiceOptions.map(option => (
            <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${value === option ? 'border-[var(--brand-primary)] bg-[var(--sidebar-active-bg)]' : 'border-[var(--sidebar-border)]'}`}>
              <input type="radio" name={name} value={option} required={question.required} checked={value === option} onChange={() => onChange(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'dropdown' && (
        <select className="w-full rounded-lg border border-[var(--sidebar-border)] bg-white px-3 py-3 text-sm" required={question.required} value={String(value ?? '')} onChange={event => onChange(event.target.value)}>
          <option value="">Select an answer</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      )}

      {question.type === 'multiple_choice' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map(option => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${selected ? 'border-[var(--brand-primary)] bg-[var(--sidebar-active-bg)]' : 'border-[var(--sidebar-border)]'}`}>
                <input type="checkbox" checked={selected} onChange={event => onChange(event.target.checked ? [...(Array.isArray(value) ? value : []), option] : (Array.isArray(value) ? value.filter(item => item !== option) : []))} />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      )}

      {['short_text', 'paragraph', 'long_text', 'email', 'date', 'time', 'number'].includes(question.type) && (
        question.type === 'paragraph' || question.type === 'long_text'
          ? <textarea rows={4} maxLength={10000} required={question.required} value={String(value ?? '')} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-[var(--sidebar-border)] px-3 py-3 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-blue-100" />
          : <input
              type={question.type === 'short_text' ? 'text' : question.type}
              maxLength={question.type === 'short_text' || question.type === 'email' ? 10000 : undefined}
              required={question.required}
              value={String(value ?? '')}
              onChange={event => onChange(question.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)}
              className="w-full rounded-lg border border-[var(--sidebar-border)] px-3 py-3 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
      )}

      {['rubric_table', 'multiple_choice_grid', 'checkbox_grid'].includes(question.type) && (
        <div className="space-y-3">
          {rows.map(row => {
            const rowValue = value && typeof value === 'object' ? (value as Record<string, unknown>)[row] : undefined;
            return (
              <div key={row} className="rounded-lg border border-[var(--sidebar-border)] p-3">
                <p className="mb-2 text-sm font-medium text-slate-800">{row}</p>
                <div className="flex flex-wrap gap-2">
                  {question.type === 'rubric_table'
                    ? Array.from({ length: (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1 }, (_, index) => {
                        const score = (question.scaleMin ?? 1) + index;
                        const label = options[index] || String(score);
                        return <label key={score} className="flex min-h-11 cursor-pointer items-center gap-2 rounded border border-[var(--sidebar-border)] px-3 py-2 text-sm">
                          <input type="radio" name={`${name}-${row}`} required={question.required} checked={Number(rowValue) === score} onChange={() => onChange({ ...(value as object || {}), [row]: score })} />
                          {label}
                        </label>;
                      })
                    : options.map(option => {
                        const selected = question.type === 'multiple_choice_grid'
                          ? rowValue === option
                          : Array.isArray(rowValue) && rowValue.includes(option);
                        return <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 rounded border border-[var(--sidebar-border)] px-3 py-2 text-sm">
                          <input
                            type={question.type === 'multiple_choice_grid' ? 'radio' : 'checkbox'}
                            name={`${name}-${row}`}
                            required={question.required && question.type === 'multiple_choice_grid'}
                            checked={selected}
                            onChange={event => {
                              if (question.type === 'multiple_choice_grid') onChange({ ...(value as object || {}), [row]: option });
                              else {
                                const selectedOptions = Array.isArray(rowValue) ? rowValue as string[] : [];
                                onChange({ ...(value as object || {}), [row]: event.target.checked ? [...selectedOptions, option] : selectedOptions.filter(item => item !== option) });
                              }
                            }}
                          />
                          {option}
                        </label>;
                      })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
};

export const PublicEvaluationView: React.FC<{ formId?: string; theme: WebsiteTheme }> = ({ formId, theme }) => {
  const [bundle, setBundle] = useState<PublicFormResponse | null>(null);
  const [forms, setForms] = useState<PublicFormListing[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [comments, setComments] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    if (formId) {
      const tokenStorageKey = `slsu_public_submission_${formId}`;
      const storedToken = window.sessionStorage.getItem(tokenStorageKey);
      const token = storedToken && /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(storedToken)
        ? storedToken
        : crypto.randomUUID();
      idempotencyKey.current = token;
      window.sessionStorage.setItem(tokenStorageKey, token);
    }
    setIsLoading(true);
    setError('');
    const path = formId ? `/api/public/forms/${encodeURIComponent(formId)}` : '/api/public/forms';
    publicApi(path, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The evaluation could not be loaded.');
        if (formId) {
          setBundle(data as PublicFormResponse);
          setForms([]);
        } else {
          setForms(data as PublicFormListing[]);
          setBundle(null);
        }
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The evaluation could not be loaded.');
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [formId]);

  const goBack = () => {
    if (submitted) {
      setSubmitted(false);
      return;
    }
    if (formId) window.location.assign('/evaluate');
    else if (window.history.length > 1) window.history.back();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bundle || !consentAccepted) return;
    const requiredQuestion = bundle.form.sections.flatMap(section => section.questions).find(question => {
      if (!question.required || ['instructions', 'section_title'].includes(question.type)) return false;
      const value = answers[question.id];
      if (emptyAnswer(value)) return true;
      if (question.type === 'multiple_choice') return !Array.isArray(value) || value.length < (question.minSelections || 1);
      if (question.type === 'rubric_table' || question.type === 'multiple_choice_grid' || question.type === 'checkbox_grid') {
        if (!value || typeof value !== 'object') return true;
        return (question.criteria || []).some(row => emptyAnswer((value as Record<string, unknown>)[row]));
      }
      return false;
    });
    if (requiredQuestion) {
      setError(`Please complete the required response for "${requiredQuestion.label}".`);
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const response = await publicApi(`/api/public/forms/${encodeURIComponent(bundle.form.id)}/submissions`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({ answers, comments, consentAccepted })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The evaluation could not be submitted.');
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The evaluation could not be submitted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-[100dvh] px-3 py-6 text-slate-800 sm:px-6 sm:py-10"
      style={{ backgroundColor: theme.pageBgColor }}
    >
      <div className="mx-auto max-w-3xl">
        <header
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-4 shadow-sm sm:px-6"
          style={{
            backgroundColor: theme.headerBackgroundColor || theme.headerBgColor,
            color: theme.headerTextColor,
            borderColor: theme.headerBorderColor,
            fontFamily: theme.headerFontFamily,
            fontSize: theme.headerFontSize
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <UniversityLogo alt="Southern Leyte State University" className="h-12 w-14 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-wide" style={{ color: theme.primaryColor }}>
                {theme.headerTitle || theme.siteName}
              </p>
              <p className="truncate text-sm font-semibold" style={{ color: theme.headerTextColor }}>
                {theme.headerSubtitle || theme.siteTagline}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold"
            style={{ borderColor: theme.sidebarBorderColor, color: theme.accentColor }}
          >
            <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">{submitted ? 'Back to evaluation' : formId ? 'All evaluations' : 'Back'}</span>
          </button>
        </header>

        {isLoading ? (
          <section className="rounded-xl border border-[var(--sidebar-border)] bg-white p-8 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--brand-primary)]" /><p className="mt-3 text-sm text-slate-600">Loading evaluation…</p></section>
        ) : error && !bundle ? (
          <section className="rounded-xl border border-rose-200 bg-white p-6 text-center">
            <p role="alert" className="text-sm text-rose-700">{error}</p>
            <a href="/evaluate" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white">View available evaluations <ExternalLink className="h-4 w-4" /></a>
          </section>
        ) : !formId ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-[var(--sidebar-border)] bg-white p-5 shadow-sm sm:p-6">
              <h1 className="text-xl font-bold text-[var(--brand-accent)]">Public Activity Evaluations</h1>
              <p className="mt-2 text-sm text-slate-600">Select an active extension activity to provide feedback. No account is needed.</p>
            </div>
            {forms.length === 0 ? <p className="rounded-xl border border-[var(--sidebar-border)] bg-white p-6 text-center text-sm text-slate-600">There are no active public evaluations right now.</p> : forms.map(form => (
              <a key={form.id} href={`/evaluate/${encodeURIComponent(form.id)}`} className="block rounded-xl border border-[var(--sidebar-border)] bg-white p-5 shadow-sm transition hover:border-[var(--brand-primary)] hover:bg-[var(--sidebar-active-bg)]">
                <h2 className="font-bold text-[var(--brand-accent)]">{form.activityTitle}</h2>
                <p className="mt-1 text-sm text-slate-700">{form.title}</p>
                <p className="mt-2 text-xs text-slate-500">{form.activityDate} · {form.venue}</p>
              </a>
            ))}
          </section>
        ) : bundle && submitted ? (
          <section className="rounded-xl border border-[var(--sidebar-border)] bg-white p-8 text-center shadow-sm sm:p-12">
            <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--brand-secondary)]" />
            <h1 className="mt-4 text-2xl font-bold text-[var(--brand-accent)]">Thank you for your feedback</h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">Your evaluation for {bundle.activity.title} has been saved. Your responses help improve SLSU extension services.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={goBack} className="min-h-11 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--brand-accent)]">Return to evaluation</button>
              <a href="/evaluate" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--sidebar-border)] px-5 text-sm font-semibold text-[var(--brand-accent)] hover:bg-[var(--sidebar-active-bg)]">Other active evaluations</a>
            </div>
          </section>
        ) : bundle ? (
          <form onSubmit={event => void handleSubmit(event)} className="space-y-4">
            <section className="rounded-xl border border-[var(--sidebar-border)] bg-white p-5 shadow-sm sm:p-7">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-secondary)]">Extension Activity Evaluation</p>
              <h1 className="mt-2 text-2xl font-bold text-[var(--brand-accent)]">{bundle.activity.title}</h1>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{bundle.activity.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                <span>{bundle.activity.date}</span><span>{bundle.activity.venue}</span>
              </div>
              <div className="mt-6 border-t border-[var(--sidebar-border)] pt-5">
                <h2 className="text-lg font-bold text-[var(--brand-accent)]">{bundle.form.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{bundle.form.description}</p>
                {bundle.form.instructions && <p className="mt-3 rounded-lg bg-[var(--sidebar-active-bg)] p-3 text-sm text-slate-700">{bundle.form.instructions}</p>}
              </div>
            </section>
            {bundle.form.sections.map((section, sectionIndex) => (
              <section key={section.id} className="space-y-5 rounded-xl border border-[var(--sidebar-border)] bg-white p-5 shadow-sm sm:p-7">
                <div><h2 className="font-bold text-[var(--brand-accent)]">{section.title || `Section ${sectionIndex + 1}`}</h2>{section.description && <p className="mt-1 text-sm text-slate-600">{section.description}</p>}</div>
                {section.questions.map((question, questionIndex) => (
                  <QuestionField key={question.id} question={question} number={questionIndex + 1} value={answers[question.id]} onChange={value => setAnswers(current => ({ ...current, [question.id]: value }))} />
                ))}
              </section>
            ))}
            <section className="space-y-4 rounded-xl border border-[var(--sidebar-border)] bg-white p-5 shadow-sm sm:p-7">
              <label className="block text-sm font-semibold text-[var(--brand-accent)]">Comments and suggestions <span className="font-normal text-slate-500">(optional)</span>
                <textarea value={comments} onChange={event => setComments(event.target.value)} maxLength={5000} rows={4} className="mt-2 w-full rounded-lg border border-[var(--sidebar-border)] px-3 py-3 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Share any additional feedback…" />
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" required checked={consentAccepted} onChange={event => setConsentAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--brand-primary)]" />
                <span>I agree that my anonymous responses may be used for evaluation, reporting, and improvement of this extension activity.</span>
              </label>
              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
              <button type="submit" disabled={isSubmitting || !consentAccepted} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-bold text-white hover:bg-[var(--brand-accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSubmitting ? 'Submitting…' : 'Submit evaluation'}
              </button>
            </section>
          </form>
        ) : null}
        {theme.footerEnabled !== false && (
          <footer
            className="mt-6 rounded-xl border-t px-4 py-5 text-center"
            style={{
              backgroundColor: theme.footerBackgroundColor,
              color: theme.footerTextColor,
              borderColor: theme.footerBorderColor,
              fontFamily: theme.footerFontFamily,
              fontSize: theme.footerFontSize,
              padding: theme.footerPadding
            }}
          >
            <UniversityLogo alt="" className="mx-auto mb-2 h-10 w-12" />
            <p className="font-semibold">{theme.footerTitle || theme.siteName}</p>
            <p>{theme.footerSubtitle || theme.siteTagline}</p>
          </footer>
        )}
      </div>
    </main>
  );
};

export async function makeEvaluationQrDataUrl(publicUrl: string) {
  return QRCode.toDataURL(publicUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
    color: { dark: '#003366', light: '#FFFFFF' }
  });
}
