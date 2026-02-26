import { describe, it, expect } from 'vitest';
import { getSuiteName } from '../playwright.js';
import type { Suite, TestCase } from '@playwright/test/reporter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSuite(
  title: string,
  type: Suite['type'],
  parent?: Suite,
): Suite {
  return { title, type, parent } as Suite;
}

function makeTest(parent?: Suite): TestCase {
  return { parent } as TestCase;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSuiteName', () => {
  it('returns undefined when test has no parent', () => {
    const test = makeTest(undefined);
    expect(getSuiteName(test)).toBeUndefined();
  });

  it('returns undefined when the only parent is a non-describe node (file)', () => {
    const fileNode = makeSuite('auth.spec.ts', 'file');
    const test = makeTest(fileNode);
    expect(getSuiteName(test)).toBeUndefined();
  });

  it('returns undefined when parent is a project node', () => {
    const projectNode = makeSuite('chromium', 'project');
    const fileNode = makeSuite('auth.spec.ts', 'file', projectNode);
    const test = makeTest(fileNode);
    expect(getSuiteName(test)).toBeUndefined();
  });

  it('returns the describe title for a single describe block', () => {
    const fileNode = makeSuite('auth.spec.ts', 'file');
    const describeNode = makeSuite('Auth', 'describe', fileNode);
    const test = makeTest(describeNode);
    expect(getSuiteName(test)).toBe('Auth');
  });

  it('returns nested describe titles joined with " > "', () => {
    const fileNode = makeSuite('auth.spec.ts', 'file');
    const outer = makeSuite('Auth', 'describe', fileNode);
    const inner = makeSuite('Login', 'describe', outer);
    const test = makeTest(inner);
    expect(getSuiteName(test)).toBe('Auth > Login');
  });

  it('skips describe nodes with an empty title', () => {
    const fileNode = makeSuite('auth.spec.ts', 'file');
    const emptyDescribe = makeSuite('', 'describe', fileNode);
    const namedDescribe = makeSuite('Suite', 'describe', emptyDescribe);
    const test = makeTest(namedDescribe);
    expect(getSuiteName(test)).toBe('Suite');
  });

  it('handles three levels of nesting', () => {
    const fileNode = makeSuite('', 'file');
    const a = makeSuite('A', 'describe', fileNode);
    const b = makeSuite('B', 'describe', a);
    const c = makeSuite('C', 'describe', b);
    const test = makeTest(c);
    expect(getSuiteName(test)).toBe('A > B > C');
  });

  it('includes only describe nodes, ignoring root and file nodes in between', () => {
    const rootNode = makeSuite('', 'root');
    const projectNode = makeSuite('chromium', 'project', rootNode);
    const fileNode = makeSuite('auth.spec.ts', 'file', projectNode);
    const describeNode = makeSuite('Auth', 'describe', fileNode);
    const test = makeTest(describeNode);
    expect(getSuiteName(test)).toBe('Auth');
  });
});
