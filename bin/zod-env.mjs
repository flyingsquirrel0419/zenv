#!/usr/bin/env node

import process from 'node:process';

import { runCli } from '../dist/cli.js';

const code = await runCli();

if (code !== 0) {
  process.exit(code);
}
