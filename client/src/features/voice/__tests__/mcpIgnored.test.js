import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('.mcp.json gitignore', () => {
  it('.gitignore contains .mcp.json entry', () => {
    const gitignore = readFileSync(resolve(__dirname, '../../../../../.gitignore'), 'utf-8');
    expect(gitignore).toContain('.mcp.json');
  });

  it('.gitignore contains .claude/ entry', () => {
    const gitignore = readFileSync(resolve(__dirname, '../../../../../.gitignore'), 'utf-8');
    expect(gitignore).toContain('.claude/');
  });
});
