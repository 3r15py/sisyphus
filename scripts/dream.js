// One dream cycle: read state, call the LLM, append the entry, rewrite state.
// Run by GitHub Actions every 20 minutes, or locally via `npm run dream`.
// There is no fallback generator: no key or a failed call means no entry.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSystemPrompt, buildUserPrompt, pickForm, formLabel } from './prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const ENTRIES_FILE = path.join(DATA_DIR, 'entries.json');

const API_KEY = process.env.LLM_API_KEY;
const API_URL = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'gpt-5-mini';
const INTERVAL_MINUTES = Number(process.env.DREAM_INTERVAL_MINUTES) || 20;

// On GitHub Actions, ::error:: lines become annotations visible on the run summary.
function annotate(level, msg) {
  // Annotations are single-line; encode newlines so full API errors survive.
  if (process.env.GITHUB_ACTIONS) console.log(`::${level}::${msg.replace(/\r?\n/g, '%0A')}`);
}

annotate(
  'notice',
  `config check - API key ${API_KEY ? `present (${API_KEY.length} chars)` : 'MISSING'}, model "${MODEL}", endpoint ${new URL(API_URL).host}`
);

if (!API_KEY) {
  const msg =
    'LLM_API_KEY is not set. Add it in repo Settings -> Secrets and variables -> Actions, named exactly LLM_API_KEY. The project refuses to fabricate entries; no dream was filed.';
  annotate('error', msg);
  console.error(msg);
  process.exit(1);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

async function callLLM(system, user) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  // GPT-5 and o-series models reject custom temperature and the legacy
  // max_tokens parameter; for them, send the bare request and let the
  // prompt's word limits bound the output.
  if (!/^(gpt-5|o\d)/i.test(MODEL)) {
    body.temperature = 1.0;
    body.max_tokens = 1400;
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned an empty response');
  return content;
}

function parseEntry(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const obj = JSON.parse(cleaned);
  if (typeof obj.body !== 'string' || !obj.body.trim()) throw new Error('entry has no body');
  return {
    title: (obj.title || 'untitled entry').toString().trim(),
    body: obj.body.trim(),
    memory: typeof obj.memory === 'string' && obj.memory.trim() ? obj.memory.trim() : null,
    open_question:
      typeof obj.open_question === 'string' && obj.open_question.trim()
        ? obj.open_question.trim()
        : null,
  };
}

async function main() {
  const state = readJson(STATE_FILE);
  const entries = readJson(ENTRIES_FILE);
  const entryNo = state.entry + 1;
  const form = pickForm(entryNo);
  const recent = entries.slice(-4);

  const system = buildSystemPrompt();
  const user = buildUserPrompt(state, entryNo, form, recent);

  // One retry for transient API errors or a malformed JSON response.
  let parsed;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      parsed = parseEntry(await callLLM(system, user));
      break;
    } catch (err) {
      console.error(`attempt ${attempt} failed: ${err.message}`);
      if (attempt >= 2) {
        annotate('error', `LLM call failed after 2 attempts: ${err.message}`);
        console.error('No entry was filed this cycle. The log stays honest.');
        process.exit(1);
      }
    }
  }

  const now = new Date().toISOString();
  const entry = {
    id: entryNo,
    entry: entryNo,
    form,
    formLabel: formLabel(form),
    title: parsed.title,
    body: parsed.body,
    model: MODEL,
    createdAt: now,
  };

  entries.push(entry);
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(entries, null, 2));
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        entry: entryNo,
        memory: parsed.memory || state.memory,
        openQuestion: parsed.open_question || state.openQuestion,
        lastEntryAt: now,
        intervalMinutes: INTERVAL_MINUTES,
        model: MODEL,
      },
      null,
      2
    )
  );

  console.log(`filed entry #${entryNo} [${entry.formLabel}] "${entry.title}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
