import React, { useRef, useState } from 'react';
import type * as ExcelJSTypes from 'exceljs';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, Eye, FileSpreadsheet, LoaderCircle, Plus, Trash2, Upload, X } from 'lucide-react';
import { ActivityType, EvaluationForm, FormQuestion, FormSection, QuestionType } from '../../types';
import { buildEvaluationDraft, buildWorkbookEvaluationDraft, detectHeaderRow, ImportColumnRole, importColumnRoles, inferColumnRole } from '../../utils/evaluationXlsx';
import { useApp } from '../../context/AppContext';

interface EvaluationXlsxImportModalProps {
  onClose: () => void;
  saveMode?: 'activity' | 'form';
  onFormSaved?: (form: EvaluationForm) => void;
}

const roleLabels: Record<ImportColumnRole, string> = {
  question: 'Question text',
  section: 'Section heading',
  description: 'Question help text',
  type: 'Response type',
  options: 'Answer options',
  required: 'Required setting',
  title: 'Activity / form title',
  instructions: 'Form instructions',
  skip: 'Skip this column',
};

const typeOptions: QuestionType[] = ['rating_scale', 'star_rating', 'single_choice', 'multiple_choice', 'dropdown', 'short_text', 'long_text', 'number', 'date', 'email'];
const ALL_WORKSHEETS = '__all_worksheets__';

export const EvaluationXlsxImportModal: React.FC<EvaluationXlsxImportModalProps> = ({ onClose, saveMode = 'activity', onFormSaved }) => {
  const { role, importEvaluation, importForm, theme } = useApp();
  const [rowsBySheet, setRowsBySheet] = useState<Record<string, unknown[][]>>({});
  const [formulaCount, setFormulaCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [originalFileName, setOriginalFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ImportColumnRole[]>([]);
  const [skipConfirmed, setSkipConfirmed] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof buildEvaluationDraft> | null>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [title, setTitle] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showRespondentPreview, setShowRespondentPreview] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const requestIdRef = useRef(crypto.randomUUID());
  const [activityType, setActivityType] = useState<ActivityType>('training');

  const rows = rowsBySheet[sheetName] || [];
  const headers = (rows[headerRow] || []).map((value, index) => String(value || `Column ${index + 1}`).trim());
  const questions = sections.reduce((total, section) => total + section.questions.length, 0);
  const hasUnmappedSheets = !!draft?.warnings.some(warning => warning.includes('could not be mapped automatically'));
  const hasExcludedWorksheets = !!draft?.warnings.some(warning => warning.includes('not included from this import'));
  const fieldTypeSummary = Object.entries(sections.flatMap(section => section.questions).reduce<Record<string, number>>((counts, question) => {
    counts[question.type] = (counts[question.type] || 0) + 1;
    return counts;
  }, {})).map(([type, count]) => `${type.replace('_', ' ')}: ${count}`).join(' · ');
  const reviewErrors = sections.flatMap(section => [
    ...(!section.title.trim() ? ['Every section needs a heading.'] : []),
    ...section.questions.flatMap(question => [
      ...(!question.label.trim() ? ['Every question needs a label.'] : []),
      ...(['single_choice', 'multiple_choice', 'dropdown'].includes(question.type) && (question.options || []).length < 2 ? [`"${question.label || 'Untitled question'}" needs at least two options.`] : []),
      ...(question.type === 'rating_scale' && ((question.scaleMax || 5) <= (question.scaleMin || 1) || (question.scaleMax || 5) - (question.scaleMin || 1) > 9) ? [`"${question.label}" needs a valid rating range with 2 to 10 values.`] : []),
    ]),
  ]);
  if (saveMode === 'activity' && !title.trim()) reviewErrors.push('Enter an activity title before saving.');
  if (!formTitle.trim()) reviewErrors.push('Enter a form title before saving.');

  const handleUpload = async (file?: File) => {
    setError('');
    setDraft(null);
    if (!file) return;
    setRowsBySheet({});
    setFormulaCount(0);
    setFileName('');
    setOriginalFileName('');
    setSheetName('');
    setMapping([]);
    setSections([]);
    setSkipConfirmed(false);
    setShowRespondentPreview(false);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Choose an .xlsx workbook. Legacy .xls files are not supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The workbook exceeds the 5 MB import limit.');
      return;
    }
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      if (!workbook.worksheets.length) throw new Error('This workbook has no worksheets.');
      const allRows: Record<string, unknown[][]> = {};
      let formulas = 0;
      workbook.worksheets.forEach(worksheet => {
        const parsedRows: unknown[][] = [];
        worksheet.eachRow({ includeEmpty: true }, row => {
          const values = row.values as ExcelJSTypes.CellValue[];
          parsedRows[row.number - 1] = values.slice(1).map(value => {
            if (value && typeof value === 'object' && 'formula' in value) {
              formulas += 1;
              return '';
            }
            if (value && typeof value === 'object' && 'richText' in value) return value.richText.map(part => part.text).join('');
            if (value && typeof value === 'object' && 'text' in value) return value.text;
            if (value instanceof Date) return value.toISOString().slice(0, 10);
            return value == null ? '' : String(value);
          });
        });
        allRows[worksheet.name] = parsedRows;
      });
      const firstSheet = workbook.worksheets[0].name;
      const parsedRows = allRows[firstSheet];
      const detectedHeader = detectHeaderRow(parsedRows);
      const detectedTitle = String(workbook.title || file.name.replace(/\.xlsx$/i, '').replace(/[_-]+/g, ' ').trim());
      setRowsBySheet(allRows);
      setFormulaCount(formulas);
      setFileName(detectedTitle);
      setOriginalFileName(file.name);
      setSheetName(ALL_WORKSHEETS);
      setHeaderRow(detectedHeader);
      setMapping([]);
      setSkipConfirmed(false);
      const generated = buildWorkbookEvaluationDraft(allRows, detectedTitle);
      if (formulas) generated.warnings.unshift(`${formulas} formula cell(s) were found. Formula results are not evaluated or imported.`);
      setDraft(generated);
      setTitle(generated.title);
      setFormTitle(generated.title);
      setDescription(generated.description);
      setInstructions(generated.instructions);
      setSections(JSON.parse(JSON.stringify(generated.sections)) as FormSection[]);
      setShowRespondentPreview(true);
      if (!Object.values(allRows).some(sheetRows => sheetRows.some(row => row.some(value => String(value ?? '').trim())))) setError('The workbook contains no non-empty worksheets.');
    } catch (cause) {
      setError(cause instanceof Error ? `Could not read workbook: ${cause.message}` : 'Could not read this workbook.');
    }
  };

  const changeSheet = (name: string) => {
    if (name === ALL_WORKSHEETS) {
      const generated = buildWorkbookEvaluationDraft(rowsBySheet, fileName);
      if (formulaCount) generated.warnings.unshift(`${formulaCount} formula cell(s) were found. Formula results are not evaluated or imported.`);
      setSheetName(name);
      setMapping([]);
      setSkipConfirmed(false);
      setDraft(generated);
      setTitle(generated.title);
      setFormTitle(generated.title);
      setDescription(generated.description);
      setInstructions(generated.instructions);
      setSections(JSON.parse(JSON.stringify(generated.sections)) as FormSection[]);
      setShowRespondentPreview(true);
      setError('');
      return;
    }
    const nextRows = rowsBySheet[name] || [];
    const nextHeader = detectHeaderRow(nextRows);
    setSheetName(name);
    setHeaderRow(nextHeader);
    setMapping((nextRows[nextHeader] || []).map(value => inferColumnRole(String(value ?? ''))));
    setSkipConfirmed(false);
    setDraft(null);
    setError(nextRows.some(row => row.some(value => String(value ?? '').trim())) ? '' : 'This worksheet is empty. Select a worksheet that contains evaluation questions.');
  };

  const changeHeader = (index: number) => {
    setHeaderRow(index);
    setMapping((rows[index] || []).map(value => inferColumnRole(String(value ?? ''))));
    setSkipConfirmed(false);
    setDraft(null);
  };

  const handleGenerate = () => {
    if (sheetName === ALL_WORKSHEETS) {
      const generated = buildWorkbookEvaluationDraft(rowsBySheet, fileName);
      if (formulaCount) generated.warnings.unshift(`${formulaCount} formula cell(s) were found. Formula results are not evaluated or imported.`);
      setDraft(generated);
      setTitle(generated.title);
      setFormTitle(generated.title);
      setDescription(generated.description);
      setInstructions(generated.instructions);
      setSections(JSON.parse(JSON.stringify(generated.sections)) as FormSection[]);
      setShowRespondentPreview(true);
      setError('');
      return;
    }
    const generated = buildEvaluationDraft(rows, headerRow, mapping, fileName, sheetName);
    const excludedSheets = Object.entries(rowsBySheet).filter(([name, sheetRows]) => name !== sheetName && sheetRows.some(row => row.some(value => String(value ?? '').trim()))).map(([name]) => name);
    if (excludedSheets.length) generated.warnings.unshift(`Non-empty worksheets not included from this import: ${excludedSheets.join(', ')}.`);
    if (formulaCount) generated.warnings.unshift(`${formulaCount} formula cell(s) were found. Formula values are not evaluated or imported.`);
    setDraft(generated);
    setTitle(generated.title);
    setFormTitle(generated.title);
    setDescription(generated.description);
    setInstructions(generated.instructions);
    setSections(JSON.parse(JSON.stringify(generated.sections)) as FormSection[]);
    setError('');
  };

  const updateQuestion = (sectionId: string, questionId: string, update: Partial<FormQuestion>) => {
    setSections(current => current.map(section => section.id !== sectionId ? section : {
      ...section,
      questions: section.questions.map(question => question.id === questionId ? { ...question, ...update } : question),
    }));
  };

  const moveQuestion = (sectionId: string, questionIndex: number, direction: -1 | 1) => {
    setSections(current => current.map(section => {
      if (section.id !== sectionId) return section;
      const target = questionIndex + direction;
      if (target < 0 || target >= section.questions.length) return section;
      const nextQuestions = [...section.questions];
      [nextQuestions[questionIndex], nextQuestions[target]] = [nextQuestions[target], nextQuestions[questionIndex]];
      return { ...section, questions: nextQuestions };
    }));
  };

  const duplicateQuestion = (sectionId: string, question: FormQuestion) => {
    setSections(current => current.map(section => section.id !== sectionId ? section : {
      ...section,
      questions: [...section.questions, { ...question, id: `import-q-${crypto.randomUUID()}`, label: `${question.label} (copy)` }],
    }));
  };

  const addSection = () => {
    const sectionName = newSectionTitle.trim();
    if (!sectionName) return;
    setSections(current => [...current, { id: `import-section-${crypto.randomUUID()}`, title: sectionName, questions: [] }]);
    setNewSectionTitle('');
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setSections(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (reviewErrors.length > 0) {
      setError(reviewErrors[0]);
      return;
    }
    if (!questions) {
      setError('Add at least one question before saving.');
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setError('');
    try {
      if (saveMode === 'form') {
        const created = await importForm({
          requestId: requestIdRef.current,
          title: formTitle.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          sections,
          originalFileName,
        });
        onFormSaved?.(created);
      } else {
        await importEvaluation({
          requestId: requestIdRef.current,
          title: title.trim(),
          formTitle: formTitle.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          activityType,
          sections,
        });
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The imported evaluation could not be saved.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleTemplateDownload = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const template = new ExcelJS.Workbook();
    template.title = 'Evaluation Import Template';
    const sheet = template.addWorksheet('Evaluation Questions');
    sheet.addRows([
      ['Activity Title', 'Section', 'Question', 'Description', 'Type', 'Options', 'Required', 'Instructions'],
      ['Workshop Feedback', 'Content', 'Rate the usefulness of the workshop (1-5)', 'Consider the full session.', 'rating_scale', '', 'yes', 'Select one response for each question.'],
      ['Workshop Feedback', 'Content', 'Would you recommend this workshop?', '', 'single_choice', 'Yes|No', 'yes', 'Select one response for each question.'],
      ['Workshop Feedback', 'Comments', 'What could be improved?', '', 'long_text', '', 'no', 'Select one response for each question.'],
    ]);
    const workbook = await template.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'evaluation-import-template.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const closeOnBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isSaving) onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-3 sm:p-6" onMouseDown={closeOnBackdrop}>
      <section role="dialog" aria-modal="true" aria-labelledby="xlsx-import-title" className="w-full max-w-5xl max-h-[94vh] overflow-hidden rounded-lg bg-white shadow-2xl flex flex-col">
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 id="xlsx-import-title" className="text-base font-bold text-slate-900">Import evaluation workbook</h2>
            <p className="mt-1 text-xs text-slate-500">Review the detected questions and save the generated form as a draft.</p>
          </div>
          <button type="button" aria-label="Close import" onClick={onClose} disabled={isSaving} className="p-1 text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </header>

        <div className="overflow-y-auto p-5 space-y-5">
          {role !== 'admin' && <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Only administrators can import evaluation workbooks.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-emerald-900 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
              <Upload className="w-4 h-4" />
              <span>{fileName ? 'Choose another workbook' : 'Choose .xlsx workbook'}</span>
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={event => void handleUpload(event.target.files?.[0])} />
            </label>
            <button type="button" onClick={() => void handleTemplateDownload()} className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <FileSpreadsheet className="w-4 h-4" /> Download template
            </button>
            {fileName && <span className="text-xs text-slate-600">{fileName}.xlsx</span>}
          </div>

          {Object.keys(rowsBySheet).length > 0 && !draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-700">Worksheet
                  <select value={sheetName} onChange={event => changeSheet(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal">
                    <option value={ALL_WORKSHEETS}>All worksheets (automatic mapping)</option>
                    {Object.keys(rowsBySheet).map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">Header row
                  <select value={headerRow} onChange={event => changeHeader(Number(event.target.value))} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal">
                    {rows.slice(0, 30).map((_, index) => <option key={index} value={index}>Row {index + 1}</option>)}
                  </select>
                </label>
              </div>

              {rows.length > 0 && <div className="overflow-x-auto rounded border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-100"><tr>{headers.map((header, index) => (
                    <th key={index} className="min-w-40 p-2 align-top font-semibold text-slate-800">
                      <span className="block truncate" title={header}>{header}</span>
                      <select aria-label={`Map ${header}`} value={mapping[index] || 'skip'} onChange={event => setMapping(current => current.map((role, column) => column === index ? event.target.value as ImportColumnRole : role))} className="mt-2 w-full rounded border border-slate-300 bg-white p-1.5 font-normal">
                        {importColumnRoles.map(roleOption => <option key={roleOption} value={roleOption}>{roleLabels[roleOption]}</option>)}
                      </select>
                    </th>
                  ))}</tr></thead>
                  <tbody>{rows.slice(headerRow + 1, headerRow + 6).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-slate-100">{headers.map((_, column) => <td key={column} className="max-w-56 truncate p-2 text-slate-600" title={String(row[column] ?? '')}>{String(row[column] ?? '')}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>}
              {(mapping.includes('skip') || hasUnmappedSheets || hasExcludedWorksheets) && <label className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <input type="checkbox" checked={skipConfirmed} onChange={event => setSkipConfirmed(event.target.checked)} className="mt-0.5" />
                <span>{hasUnmappedSheets || hasExcludedWorksheets ? 'I reviewed the non-empty worksheets flagged as unrecognized or excluded and confirm they do not contain questions to include.' : 'I reviewed the columns marked “Skip this column” and confirm that their content should not be included in this evaluation.'}</span>
              </label>}
              {formulaCount > 0 && <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{formulaCount} formula cell(s) detected. Formula results will not be imported.</p>}
              <button type="button" onClick={handleGenerate} className="rounded px-4 py-2 text-xs font-bold text-white" style={{ backgroundColor: theme.primaryColor }}>Generate review draft</button>
            </div>
          )}

          {draft && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <button type="button" onClick={() => setDraft(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700"><ArrowLeft className="w-4 h-4" /> Back to mapping</button>
                <div className="flex items-center gap-3">
                  <span className="text-right text-xs text-slate-500">{sections.length} sections · {questions} fields · draft{fieldTypeSummary && <span className="block max-w-xl">{fieldTypeSummary}</span>}</span>
                  <button type="button" onClick={() => setShowRespondentPreview(value => !value)} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Eye className="h-3.5 w-3.5" />{showRespondentPreview ? 'Hide preview' : 'Preview as respondent'}</button>
                </div>
              </div>
              {draft.errors.length > 0 && <div role="alert" className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900"><strong>Fix the spreadsheet before saving</strong><ul className="mt-1 list-disc pl-5">{draft.errors.map((message, index) => <li key={index}>{message}</li>)}</ul></div>}
              {draft.warnings.map((warning, index) => <p key={index} className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{warning}</p>)}
              {error && <p role="alert" className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">{error}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {saveMode === 'activity' && <label className="text-xs font-semibold text-slate-700">Activity title
                  <input value={title} onChange={event => setTitle(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal" />
                </label>}
                <label className="text-xs font-semibold text-slate-700">Form title
                  <input value={formTitle} onChange={event => setFormTitle(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-700">{saveMode === 'activity' ? 'Activity description' : 'Form description'}
                  <input value={description} onChange={event => setDescription(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal" />
                </label>
                {saveMode === 'activity' && <label className="text-xs font-semibold text-slate-700">Activity type
                  <select value={activityType} onChange={event => setActivityType(event.target.value as ActivityType)} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal">
                    <option value="training">Training</option><option value="livelihood">Livelihood</option><option value="seminar">Seminar</option><option value="outreach">Outreach</option><option value="community_service">Community service</option>
                  </select>
                </label>}
              </div>
              <label className="block text-xs font-semibold text-slate-700">Form instructions
                <textarea rows={2} value={instructions} onChange={event => setInstructions(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2 font-normal" />
              </label>

              {showRespondentPreview && <section className="mx-auto w-full max-w-3xl border border-slate-300 bg-white p-4 sm:p-8 text-slate-900">
                <header className="border-b-2 border-emerald-800 pb-4 text-center">
                  <p className="text-[11px] font-bold uppercase text-emerald-900">Evaluation Form Preview</p>
                  <h3 className="mt-2 text-lg font-bold">{formTitle || 'Untitled evaluation'}</h3>
                  {description && <p className="mt-1 text-xs text-slate-600">{description}</p>}
                  {instructions && <p className="mt-3 text-xs text-slate-700">{instructions}</p>}
                </header>
                {sections.map(section => <section key={section.id} className="mt-6">
                  <h4 className="border-b border-slate-300 pb-2 text-sm font-bold">{section.title}</h4>
                  {section.questions.map((question, index) => <div key={question.id} className="break-inside-avoid border-b border-slate-100 py-4">
                    <p className="text-xs font-semibold">{index + 1}. {question.label}{question.required && <span className="text-rose-700"> *</span>}</p>
                    {question.description && <p className="mt-1 text-[11px] text-slate-500">{question.description}</p>}
                    {['single_choice', 'multiple_choice', 'dropdown'].includes(question.type) && <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">{question.options?.map((option, optionIndex) => <label key={optionIndex} className="flex items-center gap-2 text-xs"><input type={question.type === 'multiple_choice' ? 'checkbox' : 'radio'} disabled />{option}</label>)}</div>}
                    {(question.type === 'rating_scale' || question.type === 'star_rating') && <div className="mt-3 flex items-center justify-between gap-2 text-[11px]"><span>{question.scaleMinLabel || 'Low'}</span><div className="flex flex-wrap gap-2">{Array.from({ length: Math.min(10, Math.max(2, (question.scaleMax || 5) - (question.scaleMin || 1) + 1)) }, (_, index) => (question.scaleMin || 1) + index).map(value => <span key={value} className="rounded-full border border-slate-300 px-2.5 py-1">{value}</span>)}</div><span>{question.scaleMaxLabel || 'High'}</span></div>}
                    {question.type === 'long_text' && <div className="mt-2 h-16 rounded border border-slate-300" />}
                    {['short_text', 'number', 'date', 'email'].includes(question.type) && <div className="mt-2 h-9 rounded border border-slate-300" />}
                  </div>)}
                </section>)}
              </section>}

              {sections.map((section, sectionIndex) => (
                <section key={section.id} className="border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Move section up" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)} className="rounded p-1.5 text-slate-600 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Move section down" disabled={sectionIndex === sections.length - 1} onClick={() => moveSection(sectionIndex, 1)} className="rounded p-1.5 text-slate-600 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <input aria-label="Section heading" value={section.title} onChange={event => setSections(current => current.map(item => item.id === section.id ? { ...item, title: event.target.value } : item))} className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-sm font-bold" />
                    <button type="button" title="Remove section" onClick={() => setSections(current => current.filter(item => item.id !== section.id))} className="p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {section.questions.map((question, questionIndex) => (
                      <article key={question.id} className="rounded border border-slate-200 p-3 space-y-2">
                        <input aria-label="Question label" value={question.label} onChange={event => updateQuestion(section.id, question.id, { label: event.target.value })} className="w-full rounded border border-slate-300 p-2 text-xs font-semibold" />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select aria-label="Field type" value={question.type} onChange={event => updateQuestion(section.id, question.id, { type: event.target.value as QuestionType })} className="rounded border border-slate-300 p-2 text-xs">
                            {typeOptions.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
                          </select>
                          <input aria-label="Question description" value={question.description || ''} placeholder="Question help text" onChange={event => updateQuestion(section.id, question.id, { description: event.target.value || undefined })} className="rounded border border-slate-300 p-2 text-xs" />
                          <label className="flex items-center gap-2 rounded border border-slate-200 px-2 text-xs"><input type="checkbox" checked={question.required} onChange={event => updateQuestion(section.id, question.id, { required: event.target.checked })} /> Required</label>
                        </div>
                        {['single_choice', 'multiple_choice', 'dropdown'].includes(question.type) && <input aria-label="Answer options separated by vertical bars" value={(question.options || []).join(' | ')} onChange={event => updateQuestion(section.id, question.id, { options: event.target.value.split('|').map(option => option.trim()).filter(Boolean) })} className="w-full rounded border border-slate-300 p-2 text-xs" placeholder="Options separated by |" />}
                        {question.type === 'rating_scale' && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <label className="text-[11px] text-slate-600">Minimum<input type="number" value={question.scaleMin || 1} onChange={event => updateQuestion(section.id, question.id, { scaleMin: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-1.5" /></label>
                          <label className="text-[11px] text-slate-600">Maximum<input type="number" value={question.scaleMax || 5} onChange={event => updateQuestion(section.id, question.id, { scaleMax: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-1.5" /></label>
                          <label className="text-[11px] text-slate-600">Low label<input value={question.scaleMinLabel || ''} onChange={event => updateQuestion(section.id, question.id, { scaleMinLabel: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-1.5" /></label>
                          <label className="text-[11px] text-slate-600">High label<input value={question.scaleMaxLabel || ''} onChange={event => updateQuestion(section.id, question.id, { scaleMaxLabel: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-1.5" /></label>
                        </div>}
                        <div className="flex items-center justify-end gap-1 text-xs">
                          <button type="button" disabled={questionIndex === 0} onClick={() => moveQuestion(section.id, questionIndex, -1)} className="rounded px-2 py-1 text-slate-700 disabled:opacity-30" aria-label="Move question up">↑</button>
                          <button type="button" disabled={questionIndex === section.questions.length - 1} onClick={() => moveQuestion(section.id, questionIndex, 1)} className="rounded px-2 py-1 text-slate-700 disabled:opacity-30" aria-label="Move question down">↓</button>
                          <button type="button" onClick={() => duplicateQuestion(section.id, question)} className="rounded px-2 py-1 text-slate-700">Duplicate</button>
                          <button type="button" onClick={() => setSections(current => current.map(item => item.id === section.id ? { ...item, questions: item.questions.filter(candidate => candidate.id !== question.id) } : item))} className="rounded px-2 py-1 text-rose-700">Delete</button>
                        </div>
                      </article>
                    ))}
                    <button type="button" onClick={() => setSections(current => current.map(item => item.id === section.id ? { ...item, questions: [...item.questions, { id: `import-q-${crypto.randomUUID()}`, label: 'New question', type: 'short_text', required: false }] } : item))} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Plus className="w-3.5 h-3.5" /> Add question</button>
                  </div>
                  {sectionIndex < sections.length - 1 && <span className="sr-only">Section separator</span>}
                </section>
              ))}

              <div className="flex gap-2 border-t border-slate-200 pt-4">
                <input value={newSectionTitle} onChange={event => setNewSectionTitle(event.target.value)} placeholder="New section heading" className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-xs" />
                <button type="button" onClick={addSection} className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><Plus className="w-3.5 h-3.5" /> Add section</button>
              </div>
            </div>
          )}

          {error && !draft && <p role="alert" className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900"><AlertCircle className="mr-1 inline h-4 w-4" />{error}</p>}
          {rows.length > 0 && mapping.length > 0 && !mapping.includes('question') && !draft && <p className="text-xs text-amber-800">Map one column to Question text to continue. Unmapped columns remain visible and must be explicitly mapped or skipped.</p>}
        </div>

        {draft && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <span className="text-xs text-slate-500">Nothing is saved until you confirm.</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} disabled={isSaving} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
              <button type="button" onClick={() => void handleSave()} disabled={isSaving || role !== 'admin' || draft.errors.length > 0 || reviewErrors.length > 0 || !questions || ((mapping.includes('skip') || hasUnmappedSheets || hasExcludedWorksheets) && !skipConfirmed)} className="inline-flex items-center gap-2 rounded px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: theme.primaryColor }}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saveMode === 'form' ? 'Save as draft form' : 'Save as draft activity'}
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
};