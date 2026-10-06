import { describe, expect, it } from 'vitest';
import { applyStandingPermissions, checkCommand, checkToolUse } from '../src/tools/policy';
import { redact } from '../src/lib/redact';

const act = (command: string) => checkCommand(command).action;

describe('tool policy', () => {
  it('never gates routine work', () => {
    for (const c of [
      'npm test',
      'pnpm vitest run',
      'python analyze.py data.csv',
      'git status && git diff',
      'git commit -m "fix login"',
      'git checkout -b fix/login',
      'git push origin fix/login',
      'rm -rf node_modules dist',
      'Remove-Item -Recurse -Force .\\build',
      'cat README.md',
      'Get-Content .env.example',
      'curl https://example.com',
    ]) {
      expect(act(c), c).toBe('allow');
    }
  });

  it('denies system-critical destruction', () => {
    for (const c of [
      'rm -rf /',
      'rm -rf ~',
      'rm -rf /*',
      'Remove-Item -Recurse -Force C:\\',
      'Remove-Item C:\\Windows -Recurse',
      'del /s /q C:\\',
      'format D:',
      'diskpart',
      'shutdown /s /t 0',
      'Stop-Computer',
      'reg delete HKLM\\Software\\X /f',
      'dd if=/dev/zero of=/dev/sda',
    ]) {
      expect(act(c), c).toBe('deny');
    }
  });

  it('denies reading credentials into context', () => {
    expect(act('cat .env')).toBe('deny');
    expect(act('type C:\\proj\\.env.local')).toBe('deny');
    expect(act('Get-Content ~/.ssh/id_ed25519')).toBe('deny');
    expect(act('cmdkey /list')).toBe('deny');
    expect(act('printenv')).toBe('deny');
    expect(checkToolUse({ tool: 'Read', input: { file_path: 'D:\\app\\.env' } }).action).toBe('deny');
    expect(checkToolUse({ tool: 'Read', input: { file_path: 'C:\\Users\\me\\.codex\\auth.json' } }).action).toBe('deny');
    expect(checkToolUse({ tool: 'Read', input: { file_path: 'D:\\app\\.env.example' } }).action).toBe('allow');
    expect(checkToolUse({ tool: 'Read', input: { file_path: 'D:\\app\\src\\env.ts' } }).action).toBe('allow');
  });

  it('asks before consequential actions', () => {
    expect(checkCommand('git push --force origin main')).toMatchObject({ action: 'ask', category: 'production' });
    expect(checkCommand('git push origin main')).toMatchObject({ action: 'ask', category: 'production' });
    expect(checkCommand('npm publish')).toMatchObject({ action: 'ask', category: 'publish' });
    expect(checkCommand('vercel deploy --prod')).toMatchObject({ action: 'ask', category: 'production' });
    expect(checkCommand('git reset --hard HEAD~3')).toMatchObject({ action: 'ask', category: 'delete' });
    expect(checkCommand('psql -c "DROP TABLE users"')).toMatchObject({ action: 'ask', category: 'delete' });
  });

  it('blocks writes to system directories but not projects', () => {
    expect(checkToolUse({ tool: 'Write', input: { file_path: 'C:\\Windows\\System32\\x.dll' } }).action).toBe('deny');
    expect(checkToolUse({ tool: 'Edit', input: { file_path: 'D:\\MyProjects\\app\\src\\a.ts' } }).action).toBe('allow');
  });

  it('honours standing permissions for asks but never for denies', () => {
    const push = checkCommand('git push origin main');
    expect(applyStandingPermissions(push, ['production']).action).toBe('ask');
    expect(applyStandingPermissions(push, ['spend_money']).action).toBe('allow');
    expect(applyStandingPermissions(checkCommand('rm -rf /'), []).action).toBe('deny');
  });
});

describe('redaction', () => {
  it('removes secrets but keeps useful text', () => {
    const out = redact(
      [
        'ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345',
        'token: ghp_abcdefghijklmnopqrstuvwxyz0123456789',
        'postgres://admin:hunter2secret@db.example.com:5432/app',
        'Authorization: Bearer abcdefghijklmnop1234567890',
        'password = "correct horse battery"',
        'Found 14 prospects',
      ].join('\n'),
    );
    expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz012345');
    expect(out).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123456789');
    expect(out).not.toContain('hunter2secret');
    expect(out).not.toContain('abcdefghijklmnop1234567890');
    expect(out).toContain('postgres://admin:****@db.example.com');
    expect(out).toContain('Found 14 prospects');
  });
});
