// Unified `vp config` command — hooks setup + agent instruction updates.
//
// Hooks: interactive mode prompts on first run; non-interactive installs by default.
// Agent instructions: silently updates existing files with Vite+ markers.
// Never creates new agent files. Same behavior for prepare and manual runs.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import mri from 'mri';

import { vitePlusHeader } from '../../binding/index.js';
import { updateExistingAgentInstructions } from '../utils/agent.js';
import { renderCliDoc } from '../utils/help.js';
import { defaultInteractive, promptGitHooks } from '../utils/prompts.js';
import { log } from '../utils/terminal.js';
import { install } from './hooks.js';

async function main() {
  const args = mri(process.argv.slice(3), {
    boolean: ['help', 'hooks-only'],
    string: ['hooks-dir'],
    alias: { h: 'help' },
  });

  if (args.help) {
    const helpMessage = renderCliDoc({
      usage: 'vp config [OPTIONS]',
      summary: 'Configure Vite+ for the current project (hooks + agent integration).',
      documentationUrl: 'https://viteplus.dev/guide/commit-hooks',
      sections: [
        {
          title: 'Options',
          rows: [
            {
              label: '--hooks-dir <path>',
              description: 'Custom hooks directory (default: .vite-hooks)',
            },
            { label: '-h, --help', description: 'Show this help message' },
          ],
        },
        {
          title: 'Environment',
          rows: [{ label: 'VITE_GIT_HOOKS=0', description: 'Skip hook installation' }],
        },
      ],
    });
    log(vitePlusHeader() + '\n');
    log(helpMessage);
    return;
  }

  const dir = args['hooks-dir'] as string | undefined;
  const hooksOnly = args['hooks-only'] as boolean;
  const interactive = defaultInteractive();
  const root = process.cwd();

  // --- Step 1: Hooks setup ---
  const hooksDir = dir ?? '.vite-hooks';
  const isFirstHooksRun = !existsSync(join(root, hooksDir, '_', 'pre-commit'));

  let shouldSetupHooks = true;
  if (interactive && isFirstHooksRun && !dir) {
    // --hooks-dir implies agreement; only prompt when using default dir on first run
    shouldSetupHooks = await promptGitHooks({ interactive });
  }

  if (shouldSetupHooks) {
    const { message, isError } = install(dir);
    if (message) {
      log(message);
      if (isError) {
        process.exit(1);
      }
    }
  }

  // --- Step 2: Update agent instructions if Vite+ header exists and is outdated ---
  if (!hooksOnly) {
    updateExistingAgentInstructions(root);
  }
}

void main();
