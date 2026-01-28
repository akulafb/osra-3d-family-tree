// src/types/graph.ts

export interface FamilyNode {
  id: number;
  name: string;
  birthDate?: string;
  birthPlace?: string;
  familyCluster?: string;
}

export interface FamilyLink {
  source: number;
  target: number;
  type: 'parent' | 'marriage';
}

export interface FamilyGraph {
  nodes: FamilyNode[];
  links: FamilyLink[];
}