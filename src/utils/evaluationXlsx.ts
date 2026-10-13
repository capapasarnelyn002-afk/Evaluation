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
  if (/^(question|question text|prompt|item|evaluation question|statement|label)$/.test(value)) return 'question';
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
  if (/\b(explain|describe|comment|suggest|why|additional feedback|elaborate|improv\w*|strengths|weaknesses)\b/.test(text)) return { type: 'long_text' };
  if (/\byes\s*\/\s*no\b/.test(text) || /^(would|should|do|does|did|is|are|was|were|can|could|have|has)\b/.test(text)) return { type: 'single_choice' };
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
    if (!options.length && inferred.type === 'single_choice' && (/\byes\s*\/\s*no\b/i.test(question) || /^(would|should|do|does|did|is|are|was|were|can|could|have|has)\b/i.test(question))) options = ['Yes', 'No'];
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

export const buildLayoutEvaluationDraft = (rows: unknown[][], fileTitle: string, sheetName: string): ImportedEvaluationDraft => {
  const sections = new Map<string, FormQuestion[]>();
  const errors: string[] = [];
  const warnings: string[] = [];
  const namedFields = /^(name|office|organization|organisation|position|location|department|date|email|phone|contact number|age|remarks|comments|suggestions|feedback)(\s*[:.]?)$/i;
  const firstNonEmptyRow = rows.find(row => row.some(value => String(value ?? '').trim())) || [];
  const firstNonEmptyValue = String(firstNonEmptyRow.find(value => String(value ?? '').trim()) || '').trim();
  const title = firstNonEmptyRow.filter(value => String(value ?? '').trim()).length === 1 && !namedFields.test(firstNonEmptyValue) && !/[?]$/.test(firstNonEmptyValue)
    ? firstNonEmptyValue
    : fileTitle || sheetName;
  let instructions = '';
  let activeSection = 'General Questions';
  let questionId = 0;
  let matrixOptions: string[] | null = null;

  const pushQuestion = (label: string, options: string[] = [], inferredType?: QuestionType) => {
    const question = label.trim();
    if (!question) return;
    const inferred = inferQuestionType(question, options, '');
    let type = inferredType || inferred.type;
    let finalOptions = options;
    if (!finalOptions.length && type === 'single_choice' && /^(would|should|do|does|did|is|are|was|were|can|could|have|has)\b/i.test(question)) finalOptions = ['Yes', 'No'];
    if (['single_choice', 'multiple_choice', 'dropdown'].includes(type) && finalOptions.length < 2) {
      errors.push(`"${question}" looks like a choice question, but at least two answer options could not be identified.`);
      return;
    }
    const questionData: FormQuestion = {
      id: `layout-q-${questionId++}`,
      label: question,
      type,
      required: false,
      options: ['single_choice', 'multiple_choice', 'dropdown'].includes(type) ? finalOptions : undefined,
      scaleMin: type === 'rating_scale' ? inferred.min || 1 : undefined,
      scaleMax: type === 'rating_scale' ? inferred.max || 5 : undefined,
      scaleMinLabel: inferred.minLabel,
      scaleMaxLabel: inferred.maxLabel,
    };
    sections.set(activeSection, [...(sections.get(activeSection) || []), questionData]);
    warnings.push(`"${question}" was inferred from a worksheet layout without a question header; review its field type and required setting.`);
  };

  rows.forEach((row, index) => {
    const values = row.map(value => String(value ?? '').trim());
    const present = values.filter(Boolean);
    if (!present.length) return;
    if (/^instructions?\s*:/i.test(present[0])) {
      instructions = present[0].replace(/^instructions?\s*:\s*/i, '');
      return;
    }

    if (present.length > 1 && /^(criteria|criterion|dimension|evaluation item|factor)$/i.test(present[0]) && present.slice(1).every(value => /^(\d+|poor|fair|good|excellent|strongly disagree|disagree|neutral|agree|strongly agree|unsatisfactory|satisfactory|outstanding)$/i.test(value))) {
      matrixOptions = present.slice(1);
      activeSection = 'Rating Rubric';
      if (!sections.has(activeSection)) sections.set(activeSection, []);
      return;
    }

    if (matrixOptions && present.length === 1 && !/[?.]$/.test(present[0]) && !namedFields.test(present[0])) {
      const numericOptions = matrixOptions.every(value => /^\d+$/.test(value));
      if (numericOptions) {
        const minimum = Number(matrixOptions[0]);
        const maximum = Number(matrixOptions[matrixOptions.length - 1]);
        if (maximum > minimum && maximum - minimum < 10) {
          const q: FormQuestion = { id: `layout-q-${questionId++}`, label: present[0], type: 'rating_scale', required: false, scaleMin: minimum, scaleMax: maximum };
          sections.set(activeSection, [...(sections.get(activeSection) || []), q]);
          warnings.push(`"${present[0]}" was interpreted as a row in a rating rubric. Review the scale before publishing.`);
          return;
        }
      }
      pushQuestion(present[0], matrixOptions, 'single_choice');
      return;
    }

    if (present.length === 1) {
      const value = present[0];
      if (/^(section|part)\b/i.test(value) || /^(?:[IVX]+|\d+)[.)\s:-]+\S/.test(value)) {
        activeSection = value;
        if (!sections.has(activeSection)) sections.set(activeSection, []);
        return;
      }
      if (namedFields.test(value) || /[?]$/.test(value) || /^\d+[.)]\s*\S/.test(value)) {
        pushQuestion(value.replace(/\s*[:.]$/, ''));
        return;
      }
      if (index === 0 && value === title) return;
      warnings.push(`Worksheet row ${index + 1} contains text that was not confidently classified as a title, section, instruction, or question.`);
      return;
    }

    const [label, ...choices] = present;
    if (/[?]$/.test(label) || /^\d+[.)]\s*\S/.test(label) || namedFields.test(label)) {
      const choiceOptions = choices.filter(value => !/^(required|optional)$/i.test(value));
      const multiple = /\b(select|check) all that apply\b|\bmultiple selections?\b/i.test(label);
      pushQuestion(label, choiceOptions, choiceOptions.length > 1 ? (multiple ? 'multiple_choice' : 'single_choice') : undefined);
    } else {
      warnings.push(`Worksheet row ${index + 1} contains multiple cells that were not confidently classified as a question and its options.`);
    }
  });

  const builtSections = [...sections.entries()].map(([sectionTitle, questions], index): FormSection => ({ id: `layout-section-${index + 1}`, title: sectionTitle, questions }));
  if (!builtSections.some(section => section.questions.length)) errors.push('No confidently recognizable question labels or rubric rows were found. Use manual column mapping for this worksheet.');
  return {
    title,
    description: `Imported evaluation form from ${sheetName}.`,
    instructions: instructions || 'Please answer each question. Required fields have not been inferred from this layout and should be reviewed.',
    sections: builtSections,
    errors,
    warnings,
  };
};

export const buildWorkbookEvaluationDraft = (worksheets: Record<string, unknown[][]>, fileTitle: string): ImportedEvaluationDraft => {
  const sections: FormSection[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const drafts: ImportedEvaluationDraft[] = [];
  const unmappedSheets: string[] = [];

  Object.entries(worksheets).forEach(([sheetName, rows], sheetIndex) => {
    if (!rows.some(row => row.some(value => String(value ?? '').trim()))) return;
    const headerRow = detectHeaderRow(rows);
    const mapping = (rows[headerRow] || []).map(value => inferColumnRole(String(value ?? '')));
    const hasQuestionColumn = mapping.includes('question');
    const draft = hasQuestionColumn
      ? buildEvaluationDraft(rows, headerRow, mapping, fileTitle, sheetName)
      : buildLayoutEvaluationDraft(rows, fileTitle, sheetName);
    if (!draft.sections.length) {
      if (hasQuestionColumn) errors.push(...draft.errors.map(message => `${sheetName}: ${message}`));
      unmappedSheets.push(sheetName);
      return;
    }
    drafts.push(draft);
    errors.push(...draft.errors.map(message => `${sheetName}: ${message}`));
    warnings.push(...draft.warnings.filter(message => !message.startsWith('No title column mapped')));
    draft.sections.forEach((section, sectionIndex) => sections.push({
      ...section,
      id: `import-sheet-${sheetIndex}-section-${sectionIndex}`,
      title: `${sheetName} - ${section.title}`,
      questions: section.questions.map(question => ({ ...question, id: `import-sheet-${sheetIndex}-${question.id}` })),
    }));
  });

  if (unmappedSheets.length) warnings.push(`These non-empty worksheets could not be mapped automatically: ${unmappedSheets.join(', ')}. Review them individually or confirm they do not contain form content.`);
  if (!sections.length && !unmappedSheets.length) errors.push('The workbook contains no non-empty worksheets.');
  if (!sections.length && unmappedSheets.length) errors.push('No worksheet had recognizable question columns. Choose a worksheet and map its columns manually.');

  return {
    title: drafts.find(draft => draft.title)?.title || fileTitle,
    description: drafts.find(draft => draft.description)?.description || '',
    instructions: drafts.find(draft => draft.instructions)?.instructions || 'Please answer each question. Required questions are marked.',
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