// src/types/graph.ts

export interface FamilyNode {
  id: string;  // UUID from Supabase
  name: string;
  birthDate?: string;
  birthPlace?: string;
  familyCluster?: string;
  isClaimed?: boolean;
}

export interface FamilyLink {
  source: string;  // UUID
  target: string;  // UUID
  type: 'parent' | 'marriage' | 'divorce';
}

export interface FamilyGraph {
  nodes: FamilyNode[];
  links: FamilyLink[];
}

// 2D View Types
export interface Node2D extends FamilyNode {
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
}

export interface Link2D {
  source: Node2D;
  target: Node2D;
  type: 'parent' | 'marriage' | 'divorce';
  path: string;
}

export type LayoutType = 'tree' | 'cluster' | 'radial';

export interface ViewState {
  mode: '3D' | '2D';
  layout: LayoutType;
  zoom: { x: number; y: number; k: number };
  selectedNodeId: string | null;
}

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  levelGap: number;
  siblingGap: number;
  marriageGap: number;
}