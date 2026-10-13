import { FormQuestion, FormSection, QuestionType } from '../types';

export type ImportColumnRole = 'question' | 'section' | 'description' | 'type' | 'options' | 'required' | 'title' | 'instructions' | 'skip';

export interface ImportedEvaluationDraft {
  title: string;
  description: string;
  instructions: string;
  sections: FormSection[];
  errors: string[];
  warnings: string[];
}

const FIELD_ROLES: ImportColumnRole[] = ['question', 'section', 'description', 'type', 'options', 'required', 'title', 'instructions', 'skip'];

export const inferColumnRole = (header: string): ImportColumnRole => {
  const value = header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/^(question|question text|prompt|item|evaluation question|statement|label)$/.test(value) || value.includes('question')) return 'question';
  if (/^(section|category|dimension|group|heading)$/.test(value) || value.includes('section')) return 'section';
  if (/^(description|help text|hint|sub question|details)$/.test(value) || value.includes('instruction for respondent')) return 'description';
  if (/^(type|field type|response type|answer type|input type)$/.test(value)) return 'type';
  if (/^(options|choices|answers|response options|answer options)$/.test(value) || value.includes('choice')) return 'options';
  if (/^(required|mandatory|is required)$/.test(value)) return 'required';
  if (/^(title|activity title|evaluation title|form title|survey title)$/.test(value)) return 'title';
  if (/^(instructions|form instructions|evaluation instructions)$/.test(value)) return 'instructions';
  return 'skip';
};

export const detectHeaderRow = (rows: unknown[][]): number => {
  let bestIndex = 0;
  let bestScore = 0;
  rows.slice(0, 30).forEach((row, index) => {
    const score = row.reduce<number>((total, value) => total + (inferColumnRole(String(value ?? '')) !== 'skip' ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
};

const parseRequired = (value: string): boolean | undefined => {
  if (!value.trim()) return undefined;
  if (/^(yes|y|true|required|1|mandatory)$/i.test(value.trim())) return true;
  if (/^(no|n|false|optional|0)$/i.test(value.trim())) return false;
  return undefined;
};

const normalizeType = (value: string): QuestionType | null => {
  const type = value.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
  const aliases: Record<string, QuestionType> = {
    rating: 'rating_scale', likert: 'rating_scale', likert_scale: 'rating_scale', rating_scale: 'rating_scale', scale: 'rating_scale',
    radio: 'single_choice', radio_button: 'single_choice', single: 'single_choice', single_choice: 'single_choice',
    checkbox: 'multiple_choice', checkboxes: 'multiple_choice', multiple: 'multiple_choice', multiple_choice: 'multiple_choice',
    dropdown: 'dropdown', select: 'dropdown', short_text: 'short_text', text: 'short_text', input: 'short_text',
    long_text: 'long_text', textarea: 'long_text', paragraph: 'long_text', number: 'number', numeric: 'number',
    date: 'date', email: 'email',
  };
  return aliases[type] || null;
};

const inferQuestionType = (question: string, options: string[], explicitType: string): { type: QuestionType; min?: number; max?: number; minLabel?: string; maxLabel?: string } => {
  const explicit = normalizeType(explicitType);
  if (explicit) return { type: explicit };
  const text = question.toLowerCase();
  const joinedOptions = options.join(' ').toLowerCase();
  if (/\b(select|check) all that apply\b|\bmultiple selections?\b/.test(text)) return { type: 'multiple_choice' };
  const range = text.match(/\b(\d+)\s*(?:-|to|through)\s*(\d+)\b/);
  if (range) return { type: 'rating_scale', min: Number(range[1]), max: Number(range[2]) };
  if (/(strongly disagree|disagree).*(agree|strongly agree)/.test(joinedOptions)) {
    return { type: 'rating_scale', min: 1, max: options.length || 5, minLabel: options[0], maxLabel: options[options.length - 1] };
  }
  if (options.length === 2 && options.some(option => /^yes$/i.test(option)) && options.some(option => /^no$/i.test(option))) return { type: 'single_choice' };
  if (options.length > 1) return { type: 'single_choice' };
  if (/\b(email|e-mail)\b/.test(text)) return { type: 'email' };
  if (/\b(date|when did|when was)\b/.test(text)) return { type: 'date' };
  if (/\b(number|how many|amount|score|age|quantity)\b/.test(text)) return { type: 'number' };
  if (/\b(explain|describe|comment|suggest|why|additional feedback|elaborate)\b/.test(text)) return { type: 'long_text' };
  if (/\byes\s*\/\s*no\b/.test(text)) return { type: 'single_choice' };
  return { type: 'short_text' };
};

export const buildEvaluationDraft = (
  rows: unknown[][],
  headerRow: number,
  mapping: ImportColumnRole[],
  fileTitle: string,
  sheetName: string,
): ImportedEvaluationDraft => {
  const headers = (rows[headerRow] || []).map((value, index) => String(value || `Column ${index + 1}`).trim());
  const errors: string[] = [];
  const warnings: string[] = [];
  const roleIndexes = (role: ImportColumnRole) => mapping.flatMap((mapped, index) => mapped === role ? [index] : []);
  FIELD_ROLES.filter(role => role !== 'skip').forEach(role => {
    if (roleIndexes(role).length > 1) errors.push(`Map only one column to ${roleLabelsForError[role]}.`);
  });
  const questionIndex = roleIndexes('question')[0];
  if (questionIndex === undefined) errors.push('Map one column to Question before generating the form.');
  const valueAt = (row: unknown[], role: ImportColumnRole): string => {
    const index = roleIndexes(role)[0];
    return index === undefined ? '' : String(row[index] ?? '').trim();
  };
  const firstValue = (role: ImportColumnRole) => {
    for (const row of rows.slice(0, headerRow)) {
      const value = valueAt(row, role);
      if (value) return value;
    }
    for (const row of rows.slice(headerRow + 1)) {
      const value = valueAt(row, role);
      if (value) return value;
    }
    return '';
  };

  const title = firstValue('title') || fileTitle || sheetName;
  const instruction = firstValue('instructions');
  const sectionMap = new Map<string, FormQuestion[]>();
  const seenQuestions = new Set<string>();
  let questionCount = 0;

  rows.slice(headerRow + 1).forEach((row, rowIndex) => {
    if (!row.some(value => String(value ?? '').trim())) return;
    const question = questionIndex === undefined ? '' : String(row[questionIndex] ?? '').trim();
    const sourceRow = headerRow + rowIndex + 2;
    if (!question) {
      const section = valueAt(row, 'section');
      const otherValues = row.some((value, index) => {
        const role = mapping[index];
        return String(value ?? '').trim() && index !== roleIndexes('section')[0] && role !== 'title' && role !== 'instructions';
      });
      if (section && !otherValues) {
        if (!sectionMap.has(section)) sectionMap.set(section, []);
        return;
      }
      errors.push(`Row ${sourceRow} contains data but has no question text.`);
      return;
    }
    const section = valueAt(row, 'section') || 'Evaluation Questions';
    const normalizedQuestion = `${section.toLowerCase()}::${question.toLowerCase().replace(/\s+/g, ' ')}`;
    if (seenQuestions.has(normalizedQuestion)) {
      errors.push(`Row ${sourceRow} duplicates the question "${question}".`);
      return;
    }
    seenQuestions.add(normalizedQuestion);

    let options = valueAt(row, 'options').split(/[|;\n]/).map(option => option.trim()).filter(Boolean);
    const explicitType = valueAt(row, 'type');
    const inferred = inferQuestionType(question, options, explicitType);
    if (!options.length && inferred.type === 'single_choice' && /\byes\s*\/\s*no\b/i.test(question)) options = ['Yes', 'No'];
    if (explicitType && !normalizeType(explicitType)) {
      errors.push(`Row ${sourceRow} uses unsupported response type "${explicitType}".`);
      return;
    }
    const requiredValue = valueAt(row, 'required');
    const required = parseRequired(requiredValue);
    if (requiredValue && required === undefined) {
      errors.push(`Row ${sourceRow} has unsupported required value "${requiredValue}". Use yes/no or true/false.`);
      return;
    }
    if (['single_choice', 'multiple_choice', 'dropdown'].includes(inferred.type) && options.length < 2) {
      errors.push(`Row ${sourceRow} needs at least two answer options for ${inferred.type.replace('_', ' ')}.`);
      return;
    }

    const questionData: FormQuestion = {
      id: `import-q-${questionCount++}`,
      label: question,
      description: valueAt(row, 'description') || undefined,
      type: inferred.type,
      required: required ?? true,
      options: ['single_choice', 'multiple_choice', 'dropdown'].includes(inferred.type) ? options : undefined,
      scaleMin: inferred.type === 'rating_scale' ? inferred.min || 1 : undefined,
      scaleMax: inferred.type === 'rating_scale' ? inferred.max || 5 : undefined,
      scaleMinLabel: inferred.minLabel,
      scaleMaxLabel: inferred.maxLabel,
    };
    sectionMap.set(section, [...(sectionMap.get(section) || []), questionData]);
  });

  const sections = [...sectionMap.entries()].map(([sectionTitle, questions], index): FormSection => ({
    id: `import-section-${index + 1}`,
    title: sectionTitle,
    questions,
  }));
  if (sections.length === 0 && errors.length === 0) errors.push('No evaluation questions were found below the selected header row.');
  if (!roleIndexes('title').length) warnings.push(`No title column mapped. A draft title was generated from "${title}".`);
  if (mapping.some(role => role === 'skip')) {
    const skipped = headers.filter((_, index) => mapping[index] === 'skip');
    if (skipped.length) warnings.push(`Skipped columns: ${skipped.join(', ')}.`);
  }
  return {
    title,
    description: `Imported evaluation form from ${sheetName}.`,
    instructions: instruction || 'Please answer each question. Required questions are marked.',
    sections,
    errors,
    warnings,
  };
};

export const importColumnRoles = FIELD_ROLES;

const roleLabelsForError: Record<Exclude<ImportColumnRole, 'skip'>, string> = {
  question: 'Question text',
  section: 'Section heading',
  description: 'Question help text',
  type: 'Response type',
  options: 'Answer options',
  required: 'Required setting',
  title: 'Activity / form title',
  instructions: 'Form instructions',
};