export type RequirementStatus = 'pass' | 'fail' | 'na' | null;

export interface AsvsRequirement {
  id: string;
  area: string;
  asvsLevel: number;
  cwe: string;
  nist: string;
  verificationRequirement: string;
  valid?: boolean;
  status?: RequirementStatus;
  comment?: string;
  evidence?: string;
  toolUsed?: string;
}

export interface AsvsCategory {
  key: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  requirements: AsvsRequirement[];
  count: number;
}

export interface CategoryStats {
  total: number;
  level1: number;
  level2: number;
  level3: number;
  passed: number;
  failed: number;
  na: number;
  notTested: number;
}

export interface AiRequest {
  requirementId: string;
  requirement: string;
  context?: string;
}
