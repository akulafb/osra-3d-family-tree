// src/types/graph.ts

export interface FamilyNode {
  id: string;  // UUID from Supabase
  name: string;
  birthDate?: string;
  birthPlace?: string;
  familyCluster?: string;
}

export interface FamilyLink {
  source: string;  // UUID
  target: string;  // UUID
  type: 'parent' | 'marriage';
}

export interface FamilyGraph {
  nodes: FamilyNode[];
  links: FamilyLink[];
}