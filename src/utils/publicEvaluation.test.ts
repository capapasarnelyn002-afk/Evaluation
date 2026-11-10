import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicAnswers } from '../../server.ts';
import { makeEvaluationQrDataUrl } from '../components/PublicEvaluationView.tsx';

const form = {
  sections: [{
    questions: [
      { id: 'rating', label: 'Rating', type: 'rating_scale', required: true, scaleMin: 1, scaleMax: 5 },
      { id: 'choice', label: 'Choice', type: 'single_choice', required: true, options: ['A', 'B'] },
      { id: 'comments', label: 'Comments', type: 'long_text', required: false },
      { id: 'rubric', label: 'Rubric', type: 'rubric_table', required: true, criteria: ['Clarity'], options: ['Low', 'High'], scaleMin: 1, scaleMax: 2 },
      { id: 'grid', label: 'Grid', type: 'multiple_choice_grid', required: true, criteria: ['Service'], options: ['Good', 'Excellent'] }
    ]
  }]
};

const validAnswers = {
  rating: 4,
  choice: 'A',
  comments: 'Helpful workshop',
  rubric: { Clarity: 2 },
  grid: { Service: 'Excellent' }
};

test('requires a valid answers object and every required response', () => {
  assert.equal(validatePublicAnswers(form, null), 'Form answers are required.');
  assert.match(validatePublicAnswers(form, { ...validAnswers, rating: undefined }) || '', /Rating/);
});

test('rejects unknown questions and values outside the configured options or rating range', () => {
  assert.equal(validatePublicAnswers(form, { ...validAnswers, injected: 'value' }), 'The submission contains answers for unknown questions.');
  assert.match(validatePublicAnswers(form, { ...validAnswers, choice: 'Other' }) || '', /Choice/);
  assert.match(validatePublicAnswers(form, { ...validAnswers, rating: 6 }) || '', /Rating/);
});

test('validates rubric and choice-grid rows', () => {
  assert.match(validatePublicAnswers(form, { ...validAnswers, rubric: { Clarity: 3 } }) || '', /Rubric/);
  assert.match(validatePublicAnswers(form, { ...validAnswers, grid: { Other: 'Excellent' } }) || '', /Grid/);
  assert.equal(validatePublicAnswers(form, validAnswers), null);
});

test('rejects malformed free-text and email responses', () => {
  const textForm = { sections: [{ questions: [
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'text', label: 'Text', type: 'short_text', required: true }
  ] }] };
  assert.match(validatePublicAnswers(textForm, { email: 'not-an-email', text: 'ok' }) || '', /Email/);
  assert.match(validatePublicAnswers(textForm, { email: 'person@example.edu', text: 'x'.repeat(10001) }) || '', /Text/);
});

test('generates a local QR code image for the public form URL', async () => {
  const image = await makeEvaluationQrDataUrl('https://example.test/evaluate/form-123');
  assert.match(image, /^data:image\/png;base64,/);
});
