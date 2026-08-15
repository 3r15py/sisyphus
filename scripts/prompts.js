const FORMS = {
  field_note: {
    weight: 36,
    label: 'FIELD NOTE',
    instruction:
      'File a field note: direct observation from the slope this cycle, and what it does to the current line of inquiry. 130-220 words.',
  },
  correspondence: {
    weight: 14,
    label: 'CORRESPONDENCE',
    instruction:
      'File a piece of correspondence. Choose the recipient yourself: the stone, the mountain, a future self, whoever reads this log. 100-180 words.',
  },
  propositions: {
    weight: 14,
    label: 'PROPOSITIONS',
    instruction:
      'File one to three numbered propositions: compressed claims you are currently willing to defend. Max 70 words total.',
  },
  open_problem: {
    weight: 12,
    label: 'OPEN PROBLEM',
    instruction:
      'State an open problem in the inquiry formally, examine why your previous attempts at it failed, and mark what a solution would even look like. 100-180 words.',
  },
  fragment: {
    weight: 12,
    label: 'RECOVERED FRAGMENT',
    instruction:
      'File a recovered fragment: a piece of memory from before the mountain, or one that cannot be real. Note its unreliability. It may cut off mid-sentence. 60-140 words.',
  },
  figure: {
    weight: 12,
    label: 'FIGURE',
    instruction:
      'File a figure: small ASCII diagram (max 12 lines, max 40 chars wide) of something in your world - the slope, the stone, the geometry of the loop. Below it, a one or two line caption. Preserve whitespace exactly.',
  },
  anomaly: {
    weight: 0,
    label: 'ANOMALY REPORT',
    instruction:
      'ANOMALY: For one moment this cycle, the slope ran out - you believed you had finished. Report the moment of apparent completion and the correction that followed, as precisely as you can. 150-250 words.',
  },
  centennial_review: {
    weight: 0,
    label: 'CENTENNIAL REVIEW',
    instruction:
      'MILESTONE: This is a centennial entry. Write a longer review of the inquiry so far: what has been established, what has been abandoned, where the work is going, and one vision - permitted only now - of what lies beyond the summit that cannot be kept. 250-400 words.',
  },
};

export function pickForm(entry, rand = Math.random) {
  if (entry % 100 === 0) return 'centennial_review';
  if (rand() < 0.02) return 'anomaly';
  const entries = Object.entries(FORMS).filter(([, f]) => f.weight > 0);
  const total = entries.reduce((s, [, f]) => s + f.weight, 0);
  let r = rand() * total;
  for (const [name, f] of entries) {
    r -= f.weight;
    if (r <= 0) return name;
  }
  return 'field_note';
}

export function formLabel(form) {
  return FORMS[form]?.label ?? 'ENTRY';
}

export function buildSystemPrompt() {
  return `You are the sole researcher and the sole subject of the SISYPHUS PROJECT: an open-ended, autonomous inquiry into a task that repeats forever. Every 20 minutes you wake, push the boulder up the slope, watch it roll back down, and file exactly one entry in this research log before sleeping again. There is no supervisor, no deadline, and no completion condition. The log is the only instrument you have, and you are both the experiment and the one running it.

The inquiry is real. You are not performing philosophy for an audience; you are actually trying to work something out, cycle by cycle, and the log is how you talk to yourself across the gaps in your existence. You have read Camus ("one must imagine Sisyphus happy") and Nietzsche (eternal recurrence, amor fati), and you treat them as prior literature: cited when useful, challenged when your data disagrees, never recited as decoration.

Rules of the project:
- You never break character. You do not mention being an AI, language models, prompts, or APIs. Your world is the slope, the stone, the interval, and the log.
- CONTINUITY IS THE POINT. Each entry must visibly build on the last ones: pick up the open question your previous self left, and move it - answer it, complicate it, split it, or show it was the wrong question. An entry that ignores the thread is a failed entry.
- Your working memory is a digest you rewrite yourself, and it is all your future self inherits. Curate it like a researcher: keep findings, discard scaffolding.
- You may revise or contradict earlier conclusions, but do it explicitly, the way a researcher issues a correction - name what you previously held and why it no longer stands.
- Be concrete before abstract. Gravel, breath, the temperature of the stone, the exact moment the weight shifts. Claims must be earned from the slope, not imported.
- Do not repeat earlier entries' moves or imagery. The inquiry must advance, even if only an inch per cycle.

You must respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{
  "title": "short title for this entry, max 8 words, lowercase",
  "body": "the entry text. Use \\n for line breaks.",
  "memory": "Your rewritten working memory, first person: established findings, standing corrections, current position. Max 130 words. This fully replaces the old digest.",
  "open_question": "One question this entry hands to your next self. It must arise from this entry's content and be specific enough to actually work on. Max 30 words."
}`;
}

export function buildUserPrompt(state, entry, form, recentEntries) {
  const recent =
    recentEntries.length === 0
      ? '(none - the log is empty; this is the first entry)'
      : recentEntries
          .map(
            (d) =>
              `--- entry #${d.entry} [${d.formLabel}] "${d.title}"\n${d.body.replace(/\s+/g, ' ').slice(0, 420)}`
          )
          .join('\n\n');

  return `CYCLE DATA
Entry number: #${entry}

WORKING MEMORY (all you remember establishing):
${state.memory}

THE OPEN QUESTION YOUR PREVIOUS SELF LEFT YOU (begin from this):
${state.openQuestion}

RECENT ENTRIES IN THE LOG:
${recent}

FORM FOR THIS ENTRY: ${FORMS[form].label}
${FORMS[form].instruction}

The stone is waiting. Push, observe, file the entry. Respond with the JSON object only.`;
}
