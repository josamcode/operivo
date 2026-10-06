import { execa } from 'execa';
import fs from 'fs-extra';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { config } from '../config';
import { log } from '../log';
import { redact } from '../lib/redact';

/**
 * Python is a first-class agent tool, not a second product runtime.
 * Opervio keeps one isolated venv with the analysis/document libraries agents reach for.
 */
export const PY_PACKAGES = ['pandas', 'numpy', 'openpyxl', 'matplotlib', 'pillow', 'python-docx', 'python-pptx', 'pymupdf'];
const IMPORTS: Record<string, string> = {
  pandas: 'pandas',
  numpy: 'numpy',
  openpyxl: 'openpyxl',
  matplotlib: 'matplotlib',
  pillow: 'PIL',
  'python-docx': 'docx',
  'python-pptx': 'pptx',
  pymupdf: 'fitz',
};

export const venvPython = () =>
  process.platform === 'win32' ? join(config.paths.pythonVenv, 'Scripts', 'python.exe') : join(config.paths.pythonVenv, 'bin', 'python');

let installing: Promise<void> | null = null;
let lastError: string | null = null;

export async function pythonStatus() {
  const py = venvPython();
  const venv = await fs.pathExists(py);
  const sysPython = await execa(process.platform === 'win32' ? 'python' : 'python3', ['--version'], { reject: false, windowsHide: true, timeout: 15000 });
  const version = sysPython.exitCode === 0 ? String(sysPython.stdout || sysPython.stderr).trim().replace(/^Python\s*/, '') : null;
  let packages: string[] = [];
  if (venv) {
    const probe = Object.entries(IMPORTS)
      .map(([pkg, mod]) => `\ntry:\n    import ${mod}; ok.append('${pkg}')\nexcept Exception: pass`)
      .join('');
    const res = await execa(py, ['-c', `ok=[]${probe}\nprint(','.join(ok))`], { reject: false, windowsHide: true, timeout: 60000 });
    packages = res.exitCode === 0 ? String(res.stdout).trim().split(',').filter(Boolean) : [];
  }
  return { available: Boolean(version), version, venv, packages, installing: Boolean(installing), error: lastError };
}

/** Creates the venv and installs packages (uv when available — much faster — otherwise venv + pip). */
export function ensurePython(): Promise<void> {
  if (installing) return installing;
  installing = (async () => {
    lastError = null;
    try {
      const py = venvPython();
      const hasUv = (await execa('uv', ['--version'], { reject: false, windowsHide: true })).exitCode === 0;
      if (!(await fs.pathExists(py))) {
        await fs.ensureDir(join(config.paths.pythonVenv, '..'));
        if (hasUv) await execa('uv', ['venv', config.paths.pythonVenv], { windowsHide: true, timeout: 180000 });
        else await execa(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'venv', config.paths.pythonVenv], { windowsHide: true, timeout: 180000 });
      }
      if (hasUv) await execa('uv', ['pip', 'install', '--python', py, ...PY_PACKAGES], { windowsHide: true, timeout: 900000 });
      else await execa(py, ['-m', 'pip', 'install', ...PY_PACKAGES], { windowsHide: true, timeout: 900000 });
      log.info('python runtime ready');
    } catch (err) {
      lastError = (err as Error).message.slice(0, 400);
      log.warn({ err: lastError }, 'python runtime setup failed');
    } finally {
      installing = null;
    }
  })();
  return installing;
}

export async function runPython(code: string, cwd: string, timeoutSec = 120) {
  const py = (await fs.pathExists(venvPython())) ? venvPython() : process.platform === 'win32' ? 'python' : 'python3';
  const dir = join(cwd, '.opervio');
  await fs.ensureDir(dir);
  const file = join(dir, `snippet-${nanoid(6)}.py`);
  await fs.writeFile(file, code);
  const res = await execa(py, [file], {
    cwd,
    reject: false,
    windowsHide: true,
    timeout: Math.min(timeoutSec, 900) * 1000,
    env: { PYTHONIOENCODING: 'utf-8', MPLBACKEND: 'Agg' },
    all: true,
  });
  const output = redact(String(res.all ?? '')).slice(-12000);
  return { exitCode: res.exitCode ?? -1, output, timedOut: res.timedOut };
}
