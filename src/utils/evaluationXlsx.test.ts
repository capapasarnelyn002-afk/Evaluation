import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvaluationDraft, buildLayoutEvaluationDraft, buildWorkbookEvaluationDraft, detectHeaderRow, inferColumnRole } from './evaluationXlsx';

const headers = ['Activity Title', 'Section', 'Question', 'Description', 'Type', 'Options', 'Required'];
const mapping = headers.map(inferColumnRole);

test('detects a header row and infers rating, yes/no, multi-select, and long text fields', () => {
  const rows = [
    ['Workshop Feedback'],
    headers,
    ['Workshop Feedback', 'Content', 'Rate the content (1-5)', '', 'rating_scale', '', 'yes'],
    ['Workshop Feedback', 'Content', 'Would you recommend this workshop?', '', '', '', 'yes'],
    ['Workshop Feedback', 'Content', 'Select all that apply', '', '', 'More demos|Better venue', 'no'],
    ['Workshop Feedback', 'Comments', 'What should be improved?', '', '', '', 'no'],
  ];
  const headerRow = detectHeaderRow(rows);
  const draft = buildEvaluationDraft(rows, headerRow, mapping, 'fallback title', 'Feedback');
  const questions = draft.sections.flatMap(section => section.questions);

  assert.equal(headerRow, 1);
  assert.equal(draft.title, 'Workshop Feedback');
  assert.deepEqual(questions.map(question => question.type), ['rating_scale', 'single_choice', 'multiple_choice', 'long_text']);
  assert.deepEqual(questions[1].options, ['Yes', 'No']);
  assert.equal(draft.errors.length, 0);
});

test('reports duplicate questions, unsupported field types, and invalid required values', () => {
  const rows = [
    headers,
    ['Form', 'Section', 'Duplicate question', '', 'short_text', '', 'yes'],
    ['Form', 'Section', 'Duplicate question', '', 'short_text', '', 'yes'],
    ['Form', 'Section', 'Unsupported question', '', 'script', '', 'yes'],
    ['Form', 'Section', 'Bad required value', '', 'short_text', '', 'sometimes'],
  ];
  const draft = buildEvaluationDraft(rows, 0, mapping, 'fallback', 'Feedback');

  assert.equal(draft.errors.length, 3);
  assert.match(draft.errors[0], /duplicates the question/);
  assert.match(draft.errors[1], /unsupported response type/);
  assert.match(draft.errors[2], /unsupported required value/);
});

test('combines supported worksheets in workbook order and flags unrecognized content', () => {
  const worksheets = {
    First: [headers, ['Form', 'Overview', 'First question', '', 'short_text', '', 'yes']],
    Second: [headers, ['Form', 'Ratings', 'Rate quality (1-5)', '', 'rating_scale', '', 'yes']],
    Notes: [['This sheet has content but no recognized question header']],
  };
  const draft = buildWorkbookEvaluationDraft(worksheets, 'workbook-title');

  assert.deepEqual(draft.sections.map(section => section.title), ['First - Overview', 'Second - Ratings']);
  assert.deepEqual(draft.sections.flatMap(section => section.questions.map(question => question.label)), ['First question', 'Rate quality (1-5)']);
  assert.ok(draft.warnings.some(warning => warning.includes('Notes')));
});

test('uses the filename title when there is no title column', () => {
  const rows = [
    ['Section', 'Prompt'],
    ['General', 'How useful was the session?'],
  ];
  const detectedMapping = rows[0].map(inferColumnRole);
  const draft = buildEvaluationDraft(rows, 0, detectedMapping, 'training feedback', 'Sheet1');

  assert.equal(draft.title, 'training feedback');
  assert.equal(draft.sections[0].questions[0].label, 'How useful was the session?');
  assert.equal(draft.sections[0].questions[0].type, 'short_text');
});

test('recognizes labeled blank-answer fields and flags layout guesses for review', () => {
  const rows = [
    ['Participant Details'],
    ['Name:', ''],
    ['Office:', ''],
    ['Would you recommend the service?', ''],
    ['What should be improved?', ''],
  ];
  const draft = buildLayoutEvaluationDraft(rows, 'fallback title', 'Registration');
  const questions = draft.sections.flatMap(section => section.questions);

  assert.equal(draft.title, 'Participant Details');
  assert.deepEqual(questions.map(question => question.type), ['short_text', 'short_text', 'single_choice', 'long_text']);
  assert.deepEqual(questions[2].options, ['Yes', 'No']);
  assert.ok(draft.warnings.some(warning => warning.includes('review its field type')));
});

test('converts numeric rubric matrix rows into rating scales and rejects empty sheets', () => {
  const rubric = buildWorkbookEvaluationDraft({
    Rubric: [
      ['Workshop Evaluation'],
      ['Criteria', '1', '2', '3', '4', '5'],
      ['Speaker clarity', '', '', '', '', ''],
      ['Venue suitability', '', '', '', '', ''],
    ],
  }, 'workbook title');
  const empty = buildWorkbookEvaluationDraft({ Empty: [['', ''], ['', '']] }, 'empty workbook');

  assert.deepEqual(rubric.sections[0].questions.map(question => [question.label, question.type, question.scaleMin, question.scaleMax]), [
    ['Speaker clarity', 'rating_scale', 1, 5],
    ['Venue suitability', 'rating_scale', 1, 5],
  ]);
  assert.ok(empty.errors.some(error => error.includes('non-empty worksheets')));
});