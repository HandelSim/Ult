export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'intake' | 'research' | 'mockup' | 'decomposing' | 'executing' | 'complete' | 'failed';
  created_at: string;
  session_id?: string;
  folders?: Folder[];
  tech_stack?: { libraries?: Library[] };
  smith?: { mode?: string; hammer_session_id?: string; total_cost_usd?: number };
}

export interface Folder {
  path: string;
  description: string;
  status: 'pending' | 'decomposing' | 'approved' | 'executing' | 'complete' | 'failed';
  stakeholder_notes?: { question: string; answer: string; summary: string }[];
  libraries?: string[];
  contracts?: { provides: string[]; consumes: string[] };
  visual_spec?: { mockup_path?: string; workflows?: Workflow[] };
  files?: { path: string; description: string }[];
  cost_usd?: number;
  execution_time_s?: number;
}

export interface Workflow {
  given: string;
  when: string;
  then: string[];
}

export interface Library {
  name: string;
  purpose: string;
  install?: string;
}
