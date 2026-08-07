/**
 * release-notes.ts
 *
 * Release notes generator: auto-generate from git commits.
 */

import { execSync } from 'child_process';

export interface ReleaseNote {
  version: string;
  date: string;
  commits: string[];
  summary: string;
}

export interface ReleaseNotesOptions {
  version?: string;
  fromTag?: string;
  toTag?: string;
  limit?: number;
}

export function generateReleaseNotes(options: ReleaseNotesOptions = {}): ReleaseNote {
  const version = options.version || '0.1.0';
  const fromTag = options.fromTag || 'HEAD~10';
  const toTag = options.toTag || 'HEAD';
  const limit = options.limit || 20;

  let commits: string[] = [];
  try {
    const output = execSync(`git log ${fromTag}..${toTag} --oneline -n ${limit}`, {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    commits = output.split('\n').filter(line => line.length > 0);
  } catch {
    commits = ['Initial release'];
  }

  const summary = commits.length > 0
    ? `Release ${version} includes ${commits.length} commits.`
    : 'Initial release with foundational features.';

  return {
    version,
    date: new Date().toISOString(),
    commits,
    summary,
  };
}

export function getLatestReleaseNotes(count = 5): ReleaseNote[] {
  const releases: ReleaseNote[] = [];
  for (let i = 0; i < count; i++) {
    const notes = generateReleaseNotes({ limit: 10 });
    releases.push(notes);
  }
  return releases;
}
