import { describe, it, expect } from 'vitest';
import type { FamilyGraph, FamilyLink } from '../types/graph';
import {
  validateProposedLink,
  validateOrphanNodeName,
  isAncestorOf,
  MSG_SELF,
  MSG_DUPLICATE,
  MSG_PARTNERS_CANT_BE_PARENT_CHILD,
  MSG_PARENT_CHILD_CANT_BE_PARTNERS,
  MSG_PARTNERS_NOT_IN_LINE,
  MSG_PARENT_CYCLE,
  MSG_SIBLINGS_CANT_BE_PARENT_CHILD,
  MSG_CHILD_ALREADY_HAS_MOTHER,
  MSG_CHILD_ALREADY_HAS_FATHER,
  MSG_PARENT_ROLE_ONLY_ON_PARENT,
  MSG_ORPHAN_NAME,
} from './adminGraphValidation';

function G(nodes: string[], links: FamilyLink[]): FamilyGraph {
  return {
    nodes: nodes.map((id) => ({ id, firstName: id })),
    links,
  };
}

describe('validateOrphanNodeName', () => {
  it('rejects empty', () => {
    expect(validateOrphanNodeName('').ok).toBe(false);
    expect(validateOrphanNodeName('   ').ok).toBe(false);
    const r = validateOrphanNodeName('');
    if (!r.ok) expect(r.message).toBe(MSG_ORPHAN_NAME);
  });
  it('accepts non-empty', () => {
    expect(validateOrphanNodeName('Ada').ok).toBe(true);
  });
});

describe('isAncestorOf', () => {
  it('detects grandparent', () => {
    const links: FamilyLink[] = [
      { source: 'gp', target: 'p', type: 'parent' },
      { source: 'p', target: 'c', type: 'parent' },
    ];
    expect(isAncestorOf('gp', 'c', links)).toBe(true);
    expect(isAncestorOf('c', 'gp', links)).toBe(false);
  });
});

describe('validateProposedLink', () => {
  it('blocks self-link', () => {
    const r = validateProposedLink(G(['a'], []), {
      source: 'a',
      target: 'a',
      type: 'marriage',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_SELF);
  });

  it('blocks duplicate any type', () => {
    const links: FamilyLink[] = [{ source: 'a', target: 'b', type: 'marriage' }];
    const r = validateProposedLink(G(['a', 'b'], links), {
      source: 'b',
      target: 'a',
      type: 'divorce',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_DUPLICATE);
  });

  it('blocks parent between spouses', () => {
    const links: FamilyLink[] = [{ source: 'a', target: 'b', type: 'marriage' }];
    const r = validateProposedLink(G(['a', 'b'], links), {
      source: 'a',
      target: 'b',
      type: 'parent',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_PARTNERS_CANT_BE_PARENT_CHILD);
  });

  it('blocks partners between parent and child', () => {
    const links: FamilyLink[] = [{ source: 'p', target: 'c', type: 'parent' }];
    const r = validateProposedLink(G(['p', 'c'], links), {
      source: 'p',
      target: 'c',
      type: 'marriage',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_PARENT_CHILD_CANT_BE_PARTNERS);
  });

  it('blocks partners on lineage', () => {
    const links: FamilyLink[] = [
      { source: 'gp', target: 'p', type: 'parent' },
      { source: 'p', target: 'c', type: 'parent' },
    ];
    const r = validateProposedLink(G(['gp', 'p', 'c'], links), {
      source: 'gp',
      target: 'c',
      type: 'marriage',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_PARTNERS_NOT_IN_LINE);
  });

  it('blocks parent cycle', () => {
    const links: FamilyLink[] = [
      { source: 'gp', target: 'p', type: 'parent' },
      { source: 'p', target: 'c', type: 'parent' },
    ];
    const r = validateProposedLink(G(['gp', 'p', 'c'], links), {
      source: 'c',
      target: 'gp',
      type: 'parent',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_PARENT_CYCLE);
  });

  it('blocks parent between siblings', () => {
    const links: FamilyLink[] = [
      { source: 'par', target: 'a', type: 'parent' },
      { source: 'par', target: 'b', type: 'parent' },
    ];
    const r = validateProposedLink(G(['par', 'a', 'b'], links), {
      source: 'a',
      target: 'b',
      type: 'parent',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_SIBLINGS_CANT_BE_PARENT_CHILD);
  });

  it('blocks second mother', () => {
    const links: FamilyLink[] = [
      { source: 'm1', target: 'c', type: 'parent', parentRole: 'mother' },
    ];
    const r = validateProposedLink(G(['m1', 'm2', 'c'], links), {
      source: 'm2',
      target: 'c',
      type: 'parent',
      parentRole: 'mother',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_CHILD_ALREADY_HAS_MOTHER);
  });

  it('blocks second father', () => {
    const links: FamilyLink[] = [
      { source: 'f1', target: 'c', type: 'parent', parentRole: 'father' },
    ];
    const r = validateProposedLink(G(['f1', 'f2', 'c'], links), {
      source: 'f2',
      target: 'c',
      type: 'parent',
      parentRole: 'father',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_CHILD_ALREADY_HAS_FATHER);
  });

  it('blocks parent role on marriage', () => {
    const r = validateProposedLink(G(['a', 'b'], []), {
      source: 'a',
      target: 'b',
      type: 'marriage',
      parentRole: 'mother',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_PARENT_ROLE_ONLY_ON_PARENT);
  });

  it('allows valid parent edge', () => {
    const r = validateProposedLink(G(['p', 'c'], []), {
      source: 'p',
      target: 'c',
      type: 'parent',
      parentRole: 'father',
    });
    expect(r.ok).toBe(true);
  });

  it('excludeLink allows replacing same edge', () => {
    const links: FamilyLink[] = [
      { source: 'p', target: 'c', type: 'parent', parentRole: 'father' },
    ];
    const r = validateProposedLink(
      G(['p', 'c'], links),
      {
        source: 'p',
        target: 'c',
        type: 'parent',
        parentRole: 'mother',
      },
      {
        excludeLink: {
          source: 'p',
          target: 'c',
          type: 'parent',
          parentRole: 'father',
        },
      }
    );
    expect(r.ok).toBe(true);
  });
});
