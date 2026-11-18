import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemTestingSurveyTemplate } from '../data/systemTestingSurvey';

test('creates the capstone system testing survey template', () => {
  const template = createSystemTestingSurveyTemplate();

  assert.equal(template.title, 'Capstone System Usability and Seminar Evaluation');
  assert.equal(template.isAnonymous, true);
  assert.equal(template.questions.length, 14);
  assert.equal(template.questions.filter(question => question.required).length, 12);
  assert.ok(template.questions.every(question => question.id && question.title));
  assert.ok(template.questions.some(question => question.title.includes('QR code')));
  assert.ok(template.questions.some(question => question.title.includes('reproduce')));
});
