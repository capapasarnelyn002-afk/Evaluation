import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EvaluationForm, FormSection, FormQuestion, QuestionType } from '../../types';
import { EvaluationPrintDocument, startEvaluationPrint } from '../EvaluationPrintDocument';
import { EvaluationXlsxImportModal } from './EvaluationXlsxImportModal';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Eye, 
  Save, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  Layers, 
  HelpCircle, 
  Star, 
  List, 
  Type, 
  X,
  FileText,
  Sliders,
  Sparkles
  ,Printer,
  FileUp
} from 'lucide-react';

export const EvaluationFormBuilder: React.FC = () => {
  const { forms, activities, createForm, updateForm, deleteForm, duplicateForm, theme, systemSettings, role, isLoading } = useApp();

  const [activeFormId, setActiveFormId] = useState<string>(forms[0]?.id || '');
  const [editingForm, setEditingForm] = useState<EvaluationForm | null>(null);
  const [isCreatingNewForm, setIsCreatingNewForm] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formSaveError, setFormSaveError] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [printForm, setPrintForm] = useState<EvaluationForm | null>(null);
  const [printPaper, setPrintPaper] = useState<'A4' | 'Letter'>('A4');

  useEffect(() => {
    if (!printForm) return;
    const clearPrint = () => setPrintForm(null);
    window.addEventListener('afterprint', clearPrint, { once: true });
    const timer = window.setTimeout(() => startEvaluationPrint(printPaper), 100);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', clearPrint);
    };
  }, [printForm, printPaper]);

  // Question editing modal state
  const [showQuestionModal, setShowQuestionModal] = useState<boolean>(false);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);

  // Question form fields
  const [qLabel, setQLabel] = useState('');
  const [qCriterionName, setQCriterionName] = useState('');
  const [qDescription, setQDescription] = useState('');
  const [qType, setQType] = useState<QuestionType>('rating_scale');
  const [qRequired, setQRequired] = useState(true);
  const [qOptionsText, setQOptionsText] = useState('Option 1\nOption 2\nOption 3');
  const [qCriteriaText, setQCriteriaText] = useState('Criterion 1\nCriterion 2');
  const [qScaleLabelsText, setQScaleLabelsText] = useState('Strongly Disagree\nDisagree\nNeutral\nAgree\nStrongly Agree');
  const [qMinimumSelections, setQMinimumSelections] = useState('');
  const [qMaximumSelections, setQMaximumSelections] = useState('');
  const [qScaleMin, setQScaleMin] = useState(1);
  const [qScaleMax, setQScaleMax] = useState(5);
  const [qScaleMinLabel, setQScaleMinLabel] = useState('Strongly Disagree');
  const [qScaleMaxLabel, setQScaleMaxLabel] = useState('Strongly Agree');
  const [qWeight, setQWeight] = useState(20);

  // Section title editing
  const [newSectionTitle, setNewSectionTitle] = useState('');

  // Selected or active form
  const currentForm = editingForm || forms.find(f => f.id === activeFormId) || forms[0];

  useEffect(() => {
    if (!editingForm && !activeFormId && forms.length > 0) setActiveFormId(forms[0].id);
  }, [activeFormId, editingForm, forms]);

  const handleStartEditForm = (form: EvaluationForm) => {
    setEditingForm(JSON.parse(JSON.stringify(form)));
    setIsCreatingNewForm(false);
    setFormSaveError('');
  };

  const handleCreateNewForm = () => {
    const now = new Date().toISOString();
    const newForm: EvaluationForm = {
      id: `draft-${crypto.randomUUID()}`,
      title: 'New Evaluation Rubric Form',
      description: 'Custom evaluation questionnaire for Southern Leyte State University extension programs.',
      instructions: 'Please answer all questions objectively.',
      status: 'draft',
      version: 1,
      targetActivityType: 'all',
      activityId: '',
      targetRespondent: '',
      purpose: '',
      sections: [],
      createdAt: now,
      updatedAt: now,
    };
    setActiveFormId(newForm.id);
    setEditingForm(newForm);
    setIsCreatingNewForm(true);
    setFormSaveError('');
  };

  const handleSaveForm = async (publish = false) => {
    if (!editingForm) return;
    const formToSave = publish ? { ...editingForm, status: 'published' as const } : editingForm;
    if (!formToSave.title.trim()) {
      setFormSaveError('Enter a form title before saving.');
      return;
    }
    if (formToSave.status === 'published' && !formToSave.sections.some(section => section.questions.length > 0)) {
      setFormSaveError('Add at least one question before publishing this form.');
      return;
    }

    setIsSavingForm(true);
    setFormSaveError('');
    try {
      const savedForm = isCreatingNewForm
        ? await createForm({ ...formToSave, id: undefined })
        : await updateForm(formToSave.id, formToSave);
      setActiveFormId(savedForm.id);
      setEditingForm(null);
      setIsCreatingNewForm(false);
    } catch (cause) {
      setFormSaveError(cause instanceof Error ? cause.message : 'The form could not be saved. Your edits are still open.');
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingForm(null);
    setIsCreatingNewForm(false);
    setFormSaveError('');
    setActiveFormId(forms[0]?.id || '');
  };

  const handleAddSection = () => {
    if (!editingForm) return;
    const newSec: FormSection = {
      id: `sec-${Date.now()}`,
      title: newSectionTitle.trim() || `Section ${editingForm.sections.length + 1}`,
      questions: []
    };
    setEditingForm({
      ...editingForm,
      sections: [...editingForm.sections, newSec]
    });
    setNewSectionTitle('');
  };

  const handleDeleteSection = (secId: string) => {
    if (!editingForm) return;
    setEditingForm({
      ...editingForm,
      sections: editingForm.sections.filter(s => s.id !== secId)
    });
  };

  const openAddQuestion = (secId: string) => {
    setTargetSectionId(secId);
    setEditingQuestion(null);
    setQLabel('');
    setQCriterionName('');
    setQDescription('');
    setQType('rating_scale');
    setQRequired(true);
    setQOptionsText('Option 1\nOption 2\nOption 3');
    setQCriteriaText('Criterion 1\nCriterion 2');
    setQScaleLabelsText('Strongly Disagree\nDisagree\nNeutral\nAgree\nStrongly Agree');
    setQMinimumSelections('');
    setQMaximumSelections('');
    setQScaleMin(1);
    setQScaleMax(5);
    setQScaleMinLabel('Strongly Disagree');
    setQScaleMaxLabel('Strongly Agree');
    setQWeight(20);
    setShowQuestionModal(true);
  };

  const openEditQuestion = (secId: string, q: FormQuestion) => {
    setTargetSectionId(secId);
    setEditingQuestion(q);
    setQLabel(q.label);
    setQCriterionName(q.criterionName || '');
    setQDescription(q.description || '');
    setQType(q.type);
    setQRequired(q.required);
    setQOptionsText((q.options || []).join('\n'));
    setQCriteriaText((q.criteria || []).join('\n'));
    setQScaleLabelsText((q.scaleLabels || []).join('\n'));
    setQMinimumSelections(q.minSelections === undefined ? '' : String(q.minSelections));
    setQMaximumSelections(q.maxSelections === undefined ? '' : String(q.maxSelections));
    setQScaleMin(q.scaleMin || 1);
    setQScaleMax(q.scaleMax || 5);
    setQScaleMinLabel(q.scaleMinLabel || 'Strongly Disagree');
    setQScaleMaxLabel(q.scaleMaxLabel || 'Strongly Agree');
    setQWeight(q.weight || 20);
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm || !qLabel.trim()) return;

    const options = ['single_choice', 'multiple_choice', 'dropdown', 'rubric_table'].includes(qType)
      ? qOptionsText.split('\n').map(o => o.trim()).filter(Boolean)
      : qType === 'yes_no' ? ['Yes', 'No'] : undefined;
    const criteria = qType === 'rubric_table' ? qCriteriaText.split('\n').map(item => item.trim()).filter(Boolean) : undefined;
    const scaleLabels = qType === 'likert_scale' ? qScaleLabelsText.split('\n').map(item => item.trim()).filter(Boolean) : undefined;

    const qData: FormQuestion = {
      id: editingQuestion ? editingQuestion.id : `q-${Date.now()}`,
      criterionName: qCriterionName.trim() || undefined,
      label: qLabel.trim(),
      description: qDescription.trim() || undefined,
      type: qType,
      required: qType === 'instructions' ? false : qRequired,
      options,
      criteria,
      scaleLabels,
      minSelections: qType === 'multiple_choice' && qMinimumSelections !== '' ? Number(qMinimumSelections) : undefined,
      maxSelections: qType === 'multiple_choice' && qMaximumSelections !== '' ? Number(qMaximumSelections) : undefined,
      scaleMin: ['rating_scale', 'star_rating', 'likert_scale', 'rubric_table'].includes(qType) ? qScaleMin : undefined,
      scaleMax: ['rating_scale', 'star_rating', 'likert_scale', 'rubric_table'].includes(qType) ? qScaleMax : undefined,
      scaleMinLabel: ['rating_scale', 'likert_scale'].includes(qType) ? qScaleMinLabel : undefined,
      scaleMaxLabel: ['rating_scale', 'likert_scale'].includes(qType) ? qScaleMaxLabel : undefined,
      weight: qWeight
    };

    const updatedSections = editingForm.sections.map(sec => {
      if (sec.id !== targetSectionId) return sec;
      if (editingQuestion) {
        return {
          ...sec,
          questions: sec.questions.map(q => q.id === editingQuestion.id ? qData : q)
        };
      } else {
        return {
          ...sec,
          questions: [...sec.questions, qData]
        };
      }
    });

    setEditingForm({ ...editingForm, sections: updatedSections });
    setShowQuestionModal(false);
  };

  const handleDeleteQuestion = (secId: string, qId: string) => {
    if (!editingForm) return;
    const updated = editingForm.sections.map(sec => {
      if (sec.id !== secId) return sec;
      return {
        ...sec,
        questions: sec.questions.filter(q => q.id !== qId)
      };
    });
    setEditingForm({ ...editingForm, sections: updated });
  };

  const handleMoveQuestion = (secId: string, index: number, direction: 'up' | 'down') => {
    if (!editingForm) return;
    const updated = editingForm.sections.map(sec => {
      if (sec.id !== secId) return sec;
      const qs = [...sec.questions];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= qs.length) return sec;
      const temp = qs[index];
      qs[index] = qs[targetIdx];
      qs[targetIdx] = temp;
      return { ...sec, questions: qs };
    });
    setEditingForm({ ...editingForm, sections: updated });
  };

  const handleDuplicateQuestion = (secId: string, question: FormQuestion) => {
    if (!editingForm) return;
    const updatedSections = editingForm.sections.map(section => {
      if (section.id !== secId) return section;
      const questionIndex = section.questions.findIndex(item => item.id === question.id);
      const duplicate = { ...question, id: `q-${crypto.randomUUID()}`, label: `${question.label} (Copy)` };
      const questions = [...section.questions];
      questions.splice(questionIndex + 1, 0, duplicate);
      return { ...section, questions };
    });
    setEditingForm({ ...editingForm, sections: updatedSections });
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!editingForm) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= editingForm.sections.length) return;
    const sections = [...editingForm.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    setEditingForm({ ...editingForm, sections });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Form Selector & Creation Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-800" />
            <span>Evaluation Form Builder & Rubric Customizer</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Design dynamic Likert rubrics, weighted criteria, and question sections without modifying source code.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === 'admin' && <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Import Excel (.xlsx)</span>
          </button>}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            disabled={!currentForm}
            className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            <span>Live Preview</span>
          </button>

          {currentForm && <>
            <select aria-label="Print paper size" value={printPaper} onChange={event => setPrintPaper(event.target.value as 'A4' | 'Letter')} className="rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700">
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
            <button type="button" onClick={() => setPrintForm(currentForm)} title="Print blank evaluation form" className="p-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50" aria-label="Print Evaluation Form">
              <Printer className="h-4 w-4" />
            </button>
          </>}

          <button
            onClick={handleCreateNewForm}
            className="px-4 py-2 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <Plus className="w-4 h-4" />
            <span>Create New Form</span>
          </button>
        </div>
      </div>

      {!currentForm && (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <Layers className="mx-auto h-10 w-10 text-emerald-800" />
          <h3 className="mt-3 text-base font-bold text-slate-900">{isLoading ? 'Loading evaluation forms' : 'No evaluation forms yet'}</h3>
          <p className="mx-auto mt-1 max-w-lg text-xs text-slate-600">
            {isLoading ? 'The form list is loading from the server.' : 'Create your first form or import an Excel questionnaire to start building a respondent-ready evaluation.'}
          </p>
          {!isLoading && role === 'admin' && <button
            type="button"
            onClick={handleCreateNewForm}
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white"
            style={{ backgroundColor: theme.primaryColor }}
          ><Plus className="h-4 w-4" /> Create First Form</button>}
        </section>
      )}

      {/* Forms Tabs Roster */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-b border-slate-200">
        {forms.map(f => {
          const isSelected = f.id === (editingForm ? editingForm.id : activeFormId);
          return (
            <button
              key={f.id}
              onClick={() => {
                setActiveFormId(f.id);
                if (editingForm && editingForm.id !== f.id) {
                  setEditingForm(null);
                }
              }}
              className={`px-4 py-2.5 rounded-t-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-white text-slate-900 border-t-2 border-x border-slate-200 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
              style={isSelected ? { borderTopColor: theme.accentColor } : {}}
            >
              <span>{f.title}</span>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                f.status === 'published' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
              }`}>
                {f.status}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Form Editor Container */}
      {currentForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          
          {/* Form Header Information */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex-1 space-y-3">
              {editingForm ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingForm.title}
                    onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })}
                    className="w-full font-bold text-lg text-slate-900 border border-slate-300 rounded-lg p-2"
                  />
                  <textarea
                    rows={2}
                    value={editingForm.description}
                    onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                    placeholder="Form description..."
                    className="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2"
                  />
                  <textarea
                    rows={2}
                    value={editingForm.instructions || ''}
                    onChange={(e) => setEditingForm({ ...editingForm, instructions: e.target.value })}
                    placeholder="Instructions for respondents..."
                    className="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <label className="text-[11px] font-semibold text-slate-600">Respondent group
                      <input value={editingForm.targetRespondent || ''} onChange={event => setEditingForm({ ...editingForm, targetRespondent: event.target.value })} placeholder="e.g. Activity participants" className="mt-1 w-full rounded border border-slate-300 p-2 font-normal" />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">Evaluation purpose
                      <input value={editingForm.purpose || ''} onChange={event => setEditingForm({ ...editingForm, purpose: event.target.value })} placeholder="What this form evaluates" className="mt-1 w-full rounded border border-slate-300 p-2 font-normal" />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">Associated activity
                      <select value={editingForm.activityId || ''} onChange={event => setEditingForm({ ...editingForm, activityId: event.target.value })} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 font-normal">
                        <option value="">Not assigned to one activity</option>
                        {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Status:</span>
                      <select
                        value={editingForm.status}
                        onChange={(e) => setEditingForm({ ...editingForm, status: e.target.value as any })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published (Available for Participants)</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Target Type:</span>
                      <select
                        value={editingForm.targetActivityType || 'all'}
                        onChange={(e) => setEditingForm({ ...editingForm, targetActivityType: e.target.value as any })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="all">Universal / All Activities</option>
                        <option value="training">Training</option>
                        <option value="livelihood">Livelihood</option>
                        <option value="seminar">Seminar</option>
                        <option value="outreach">Outreach</option>
                        <option value="community_service">Community Service</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{currentForm.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">{currentForm.description}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-3">
                    <span>Version: <strong>v{currentForm.version}</strong></span>
                    <span>·</span>
                    <span>Status: <strong className="uppercase text-emerald-800">{currentForm.status}</strong></span>
                    <span>·</span>
                    <span>Total Sections: <strong>{currentForm.sections.length}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {editingForm ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSavingForm}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveForm()}
                    disabled={isSavingForm}
                    className="px-4 py-2 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingForm ? 'Saving...' : isCreatingNewForm ? 'Save Draft' : editingForm.status === 'published' ? 'Save Published Form' : 'Save Form Changes'}</span>
                  </button>
                  {editingForm.status === 'draft' && <button
                    type="button"
                    onClick={() => void handleSaveForm(true)}
                    disabled={isSavingForm}
                    className="px-4 py-2 rounded-lg border border-emerald-800 bg-emerald-50 text-emerald-900 font-bold text-xs disabled:opacity-50"
                  >Publish</button>}
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleStartEditForm(currentForm)}
                    className="px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Form Rubric</span>
                  </button>
                  <button
                    onClick={() => duplicateForm(currentForm.id)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Duplicate Form"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {forms.length > 1 && (
                    <button
                      onClick={() => deleteForm(currentForm.id)}
                      className="p-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                      title="Delete Form"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Form Sections & Questions List */}
          <div className="space-y-6">
            {editingForm && formSaveError && <p role="alert" className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">{formSaveError}</p>}
            {(editingForm ? editingForm.sections : currentForm.sections).length === 0 && (
              <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <h4 className="text-sm font-semibold text-slate-800">This form has no sections yet</h4>
                <p className="mt-1 text-xs text-slate-500">Add a section below, then add questions and evaluation criteria.</p>
              </div>
            )}
            {(editingForm ? editingForm.sections : currentForm.sections).map((sec, secIdx) => (
              <div key={sec.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                {/* Section Header */}
                <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">{sec.title}</h4>
                    {sec.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{sec.description}</p>
                    )}
                  </div>

                  {editingForm && (
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={secIdx === 0} onClick={() => handleMoveSection(secIdx, 'up')} className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-30" title="Move section up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={secIdx === editingForm.sections.length - 1} onClick={() => handleMoveSection(secIdx, 'down')} className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-30" title="Move section down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button
                        onClick={() => openAddQuestion(sec.id)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Add Question</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSection(sec.id)}
                        className="p-1.5 rounded text-rose-600 hover:bg-rose-100/60"
                        title="Delete Section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Questions under Section */}
                <div className="p-4 space-y-3">
                  {sec.questions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2 text-center">
                      No questions configured in this section yet. Click "Add Question" above.
                    </p>
                  ) : (
                    sec.questions.map((q, qIdx) => (
                      <div 
                        key={q.id} 
                        className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{qIdx + 1}. {q.label}</span>
                            {q.required && (
                              <span className="text-[10px] text-rose-600 font-bold">*Required</span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase font-semibold">
                              {q.type.replace('_', ' ')}
                            </span>
                          </div>
                          {q.criterionName && <p className="text-[11px] font-semibold text-emerald-900">Criterion: {q.criterionName}</p>}
                          {q.description && (
                            <p className="text-[11px] text-slate-500">{q.description}</p>
                          )}
                          {q.options && q.options.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {q.options.map((opt, i) => (
                                <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {editingForm && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              disabled={qIdx === 0}
                              onClick={() => handleMoveQuestion(sec.id, qIdx, 'up')}
                              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={qIdx === sec.questions.length - 1}
                              onClick={() => handleMoveQuestion(sec.id, qIdx, 'down')}
                              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditQuestion(sec.id, q)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
                              title="Edit Question"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => handleDuplicateQuestion(sec.id, q)} className="p-1 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" title="Duplicate Question"><Copy className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => handleDeleteQuestion(sec.id, q.id)}
                              className="p-1 rounded hover:bg-rose-50 text-rose-600 cursor-pointer"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}

            {/* Add Section Field when editing */}
            {editingForm && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300">
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="Enter title for new question section (e.g., III. Speaker Effectiveness & Interaction)..."
                  className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs shrink-0 cursor-pointer"
                >
                  Add Section
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal: Question Editor */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                {editingQuestion ? 'Edit Question Configuration' : 'Add New Evaluation Question'}
              </h3>
              <button onClick={() => setShowQuestionModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Criterion Name (optional):</label>
                <input
                  type="text"
                  value={qCriterionName}
                  onChange={(e) => setQCriterionName(e.target.value)}
                  placeholder="e.g. Quality of service delivery"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Question Prompt / Statement:</label>
                <input
                  type="text"
                  required
                  value={qLabel}
                  onChange={(e) => setQLabel(e.target.value)}
                  placeholder="e.g. Rate the clarity of the resource speaker's presentation..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Sub-instructions:</label>
                <input
                  type="text"
                  value={qDescription}
                  onChange={(e) => setQDescription(e.target.value)}
                  placeholder="e.g. Consider voice projection, pacing, and visual aids."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Response Type:</label>
                  <select
                    value={qType}
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      setQType(nextType);
                      if (nextType === 'instructions') setQRequired(false);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                  >
                    <option value="rating_scale">Rating Scale (1-5 Likert)</option>
                    <option value="star_rating">Star Rating (1-5 Stars)</option>
                    <option value="single_choice">Single Choice (Radio Buttons)</option>
                    <option value="multiple_choice">Multiple Choice (Checkboxes)</option>
                    <option value="dropdown">Dropdown Select</option>
                    <option value="short_text">Short Text Response</option>
                    <option value="long_text">Paragraph Textarea</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="yes_no">Yes / No</option>
                    <option value="likert_scale">Likert Scale</option>
                    <option value="rubric_table">Rubric Table</option>
                    <option value="instructions">Instructions / Description</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scoring Weight (%):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={qWeight}
                    onChange={(e) => setQWeight(parseInt(e.target.value, 10))}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {['single_choice', 'multiple_choice', 'dropdown', 'rubric_table'].includes(qType) && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {qType === 'rubric_table' ? 'Rating levels (one per line):' : 'Choice Options (one per line):'}
                  </label>
                  <textarea
                    rows={3}
                    value={qOptionsText}
                    onChange={(e) => setQOptionsText(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              )}

              {qType === 'rubric_table' && <div>
                <label className="block font-semibold text-slate-700 mb-1">Rubric criteria (one row per line):</label>
                <textarea rows={3} value={qCriteriaText} onChange={event => setQCriteriaText(event.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs" />
              </div>}

              {qType === 'likert_scale' && <div>
                <label className="block font-semibold text-slate-700 mb-1">Likert labels (one per line, lowest to highest):</label>
                <textarea rows={3} value={qScaleLabelsText} onChange={event => setQScaleLabelsText(event.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs" />
              </div>}

              {qType === 'multiple_choice' && <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold text-slate-600">Minimum selections<input type="number" min="0" value={qMinimumSelections} onChange={event => setQMinimumSelections(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
                <label className="text-[11px] font-semibold text-slate-600">Maximum selections<input type="number" min="1" value={qMaximumSelections} onChange={event => setQMaximumSelections(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
              </div>}

              {['rating_scale', 'star_rating', 'likert_scale', 'rubric_table'].includes(qType) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Low Label (1):</label>
                    <input
                      type="text"
                      value={qScaleMinLabel}
                      onChange={(e) => setQScaleMinLabel(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">High Label (5):</label>
                    <input
                      type="text"
                      value={qScaleMaxLabel}
                      onChange={(e) => setQScaleMaxLabel(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>
              )}

                  <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="reqCheck"
                  checked={qType === 'instructions' ? false : qRequired}
                  disabled={qType === 'instructions'}
                  onChange={(e) => setQRequired(e.target.checked)}
                  className="rounded text-emerald-800"
                />
                <label htmlFor="reqCheck" className="font-semibold text-slate-800">
                  Mark question as required (evaluators cannot submit without answering)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-white font-bold"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Live Form Preview */}
      {showPreviewModal && currentForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  Live Participant Preview
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">{currentForm.title}</h3>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {currentForm.instructions || currentForm.description}
            </p>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {currentForm.sections.map((sec, i) => (
                <div key={sec.id} className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wider">
                    {sec.title}
                  </h4>
                  <div className="space-y-4">
                    {sec.questions.map((q, idx) => (
                      <div key={q.id} className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2 text-xs">
                        <div className="flex items-baseline justify-between">
                          <span className="font-bold text-slate-800">
                            {idx + 1}. {q.label} {q.required && <strong className="text-rose-500">*</strong>}
                          </span>
                        </div>
                        {q.description && (
                          <p className="text-[11px] text-slate-500">{q.description}</p>
                        )}
                        {q.criterionName && <p className="text-[11px] font-semibold text-emerald-900">Criterion: {q.criterionName}</p>}

                        {(q.type === 'rating_scale' || q.type === 'star_rating' || q.type === 'likert_scale') && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-[10px] text-slate-400">{q.scaleMinLabel || 'Low'}</span>
                            <div className="flex gap-2">
                              {Array.from({ length: Math.min(10, Math.max(2, (q.scaleMax || 5) - (q.scaleMin || 1) + 1)) }, (_, index) => (q.scaleMin || 1) + index).map(v => (
                                <button key={v} type="button" className="w-8 h-8 rounded-full border border-slate-300 font-bold hover:bg-emerald-50">
                                  {q.type === 'likert_scale' ? q.scaleLabels?.[v - (q.scaleMin || 1)] || v : v}
                                </button>
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-400">{q.scaleMaxLabel || 'High'}</span>
                          </div>
                        )}

                        {(q.type === 'single_choice' || q.type === 'yes_no') && (
                          <div className="space-y-1.5 pt-1">
                            {(q.type === 'yes_no' ? ['Yes', 'No'] : q.options || []).map((opt, oIdx) => (
                              <label key={oIdx} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name={q.id} className="text-emerald-800" />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {q.type === 'multiple_choice' && q.options && (
                          <div className="space-y-1.5 pt-1">
                            {q.options.map((opt, oIdx) => (
                              <label key={oIdx} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="text-emerald-800 rounded" />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {q.type === 'rubric_table' && <div className="overflow-x-auto"><table className="min-w-full border-collapse text-[11px]"><thead><tr><th className="border p-2 text-left">Criterion</th>{q.options?.map(option => <th key={option} className="border p-2">{option}</th>)}</tr></thead><tbody>{q.criteria?.map(criterion => <tr key={criterion}><th className="border p-2 text-left">{criterion}</th>{q.options?.map(option => <td key={option} className="border p-2 text-center"><input type="radio" name={`${q.id}-${criterion}`} disabled aria-label={`${criterion}: ${option}`} /></td>)}</tr>)}</tbody></table></div>}

                        {q.type === 'yes_no' && <div className="flex gap-4"><label className="flex items-center gap-2"><input type="radio" name={q.id} disabled />Yes</label><label className="flex items-center gap-2"><input type="radio" name={q.id} disabled />No</label></div>}

                        {q.type === 'likert_scale' && <div className="flex flex-wrap gap-3">{(q.scaleLabels || []).map((label, scaleIndex) => <label key={label} className="flex items-center gap-1.5"><input type="radio" name={q.id} disabled />{label}</label>)}</div>}

                        {q.type === 'instructions' && <p className="rounded bg-emerald-50 p-3 text-xs text-slate-700">{q.description || q.label}</p>}

                        {q.type === 'dropdown' && q.options && <select aria-label={q.label} className="w-full border border-slate-300 rounded p-2 text-xs"><option>Select an answer</option>{q.options.map((option, optionIndex) => <option key={optionIndex}>{option}</option>)}</select>}

                        {q.type === 'rubric_table' && <div className="overflow-x-auto"><table className="min-w-full border-collapse text-[11px]"><thead><tr><th className="border p-2 text-left">Criterion</th>{q.options?.map(option => <th key={option} className="border p-2">{option}</th>)}</tr></thead><tbody>{q.criteria?.map(criterion => <tr key={criterion}><th className="border p-2 text-left">{criterion}</th>{q.options?.map(option => <td key={option} className="border p-2 text-center"><input type="radio" name={`${q.id}-${criterion}`} disabled aria-label={`${criterion}: ${option}`} /></td>)}</tr>)}</tbody></table></div>}

                        {q.type === 'instructions' && <p className="rounded bg-emerald-50 p-3 text-xs text-slate-700">{q.description || q.label}</p>}

                        {q.type === 'short_text' && (
                          <input type="text" placeholder="Type answer here..." className="w-full border border-slate-300 rounded p-2 text-xs" />
                        )}

                        {q.type === 'long_text' && (
                          <textarea rows={2} placeholder="Write comments here..." className="w-full border border-slate-300 rounded p-2 text-xs" />
                        )}

                        {['number', 'date', 'email'].includes(q.type) && <input type={q.type} aria-label={q.label} placeholder={q.type === 'number' ? 'Enter a number' : undefined} className="w-full border border-slate-300 rounded p-2 text-xs" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 rounded-lg text-white font-bold text-xs"
                style={{ backgroundColor: theme.primaryColor }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {printForm && <EvaluationPrintDocument mode="blank" form={printForm} theme={theme} institutionName={systemSettings.institutionName} />}
      {showImportModal && <EvaluationXlsxImportModal
        saveMode="form"
        onClose={() => setShowImportModal(false)}
        onFormSaved={form => {
          setActiveFormId(form.id);
          setEditingForm(JSON.parse(JSON.stringify(form)));
        }}
      />}

    </div>
  );
};
