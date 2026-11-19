import { SurveyQuestion } from '../types';

export interface SystemTestingSurveyTemplate {
  title: string;
  description: string;
  instructions: string;
  targetAudience: string;
  isAnonymous: boolean;
  questions: SurveyQuestion[];
}

export const createSystemTestingSurveyTemplate = (): SystemTestingSurveyTemplate => ({
  title: 'Capstone System Usability and Seminar Evaluation',
  description: 'Evaluate the system used for seminar attendance and public evaluation submissions. This survey checks usability, reliability, accessibility, and overall participant experience.',
  instructions: 'Answer based on the tasks you personally performed. Use the 1 to 5 scale where 1 means Strongly Disagree / Poor and 5 means Strongly Agree / Excellent.',
  targetAudience: 'Capstone participants, seminar attendees, testers, and evaluators',
  isAnonymous: true,
  questions: [
    {
      id: `testing-role-${Date.now()}-1`,
      title: 'What best describes your role during this test?',
      type: 'single_choice',
      required: true,
      options: ['Seminar participant', 'System administrator / organizer', 'Capstone tester', 'Developer or evaluator']
    },
    {
      id: `testing-ease-${Date.now()}-2`,
      title: 'The system is easy to use.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-navigation-${Date.now()}-3`,
      title: 'The menus and navigation are clear and easy to find.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-interface-${Date.now()}-4`,
      title: 'The interface is clear, readable, and visually organized.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-seminar-${Date.now()}-5`,
      title: 'Seminar or activity information is easy to locate.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-form-${Date.now()}-6`,
      title: 'The evaluation form questions are understandable and relevant.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-link-${Date.now()}-7`,
      title: 'The public link opens the correct evaluation form.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-mobile-${Date.now()}-8`,
      title: 'The system works properly on a mobile phone or tablet.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-submit-${Date.now()}-9`,
      title: 'Submitting an evaluation is reliable and confirmation is clear.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-privacy-${Date.now()}-10`,
      title: 'The system clearly communicates privacy and data handling.',
      type: 'rating_scale',
      required: true
    },
    {
      id: `testing-issue-${Date.now()}-11`,
      title: 'Did you encounter an error, missing feature, or usability issue?',
      type: 'single_choice',
      required: true,
      options: ['Yes', 'No']
    },
    {
      id: `testing-description-${Date.now()}-12`,
      title: 'Describe the issue or the exact steps needed to reproduce it.',
      type: 'text',
      required: false
    },
    {
      id: `testing-improvement-${Date.now()}-13`,
      title: 'What improvement should be prioritized for the system?',
      type: 'text',
      required: false
    },
    {
      id: `testing-overall-${Date.now()}-14`,
      title: 'Overall, how satisfied are you with the system?',
      type: 'rating_scale',
      required: true
    }
  ]
});
