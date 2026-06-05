export type SessionType = 'lessons_learned' | 'vision_setting';

export interface StageConfig {
  n: number;
  label: string;
}

export interface SessionConfig {
  /** Singular noun for a submitted item, e.g. "Cause" or "Idea" */
  itemNoun: string;
  /** Labels for the two cause-type radio options */
  causeTypes: [string, string];
  /** DB values for the two cause types */
  causeTypeValues: [string, string];
  /** Stage 3 heading */
  stage3Label: string;
  /** Ordered stage array — length 5 for LL, 4 for VS */
  stages: StageConfig[];
  /** How action owners are recorded */
  ownerMode: 'radio' | 'multiselect';
  /** Vision Setting only — ordered owner tag options */
  ownerOptions?: string[];
  /** Whether Stage 5 (residual risk) exists */
  hasResidualRisk: boolean;
  /** Human-readable display name */
  displayName: string;
}

const LESSONS_LEARNED: SessionConfig = {
  displayName: 'Lessons Learned',
  itemNoun: 'Cause',
  causeTypes: ['Lesson Learned', 'New Project Approach'],
  causeTypeValues: ['lesson_learned', 'new_project_approach'],
  stage3Label: 'Risk Rating',
  stages: [
    { n: 1, label: 'Cause Entry' },
    { n: 2, label: 'Alignment' },
    { n: 3, label: 'Risk Rating' },
    { n: 4, label: 'Actions' },
    { n: 5, label: 'Residual Risk' },
  ],
  ownerMode: 'radio',
  hasResidualRisk: true,
};

const VISION_SETTING: SessionConfig = {
  displayName: 'Vision Setting',
  itemNoun: 'Idea',
  causeTypes: ['Idea', 'Demo Topic'],
  causeTypeValues: ['lesson_learned', 'new_project_approach'], // reuse DB values (same underlying column)
  stage3Label: 'Priority Rating',
  stages: [
    { n: 1, label: 'Idea Entry' },
    { n: 2, label: 'Alignment' },
    { n: 3, label: 'Priority Rating' },
    { n: 4, label: 'Actions' },
  ],
  ownerMode: 'multiselect',
  ownerOptions: ['PRJ', 'Vertical', 'XD', 'SAC', 'Product'],
  hasResidualRisk: false,
};

export function getSessionConfig(type?: SessionType | string | null): SessionConfig {
  return type === 'vision_setting' ? VISION_SETTING : LESSONS_LEARNED;
}
