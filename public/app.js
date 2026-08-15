const $ = (id) => document.getElementById(id);

const PAGE_SIZE = 10;
let nextEntryAt = null;
let allEntries = [];
let shownCount = 0;

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderLatest(d) {
  $('latest').innerHTML = `
    <div class="dream-meta">
      <span>ENTRY #${d.entry}</span>
      <span class="form-tag">${d.formLabel}</span>
      <span>${fmtDate(d.createdAt)}</span>
    </div>
    <h3 class="dream-title">${escapeHtml(d.title)}</h3>
    <pre class="dream-body">${escapeHtml(d.body)}</pre>`;
}

function archiveItemHtml(d) {
  return `
    <div class="archive-item" id="entry-${d.id}">
      <button class="archive-head" data-id="${d.id}" aria-expanded="false">
        <span class="a-push">#${d.entry}</span>
        <span class="a-title">${escapeHtml(d.title)}</span>
        <span class="a-form">${d.formLabel}</span>
        <span class="a-date">${fmtDate(d.createdAt)}</span>
      </button>
      <pre class="archive-body" hidden>${escapeHtml(d.body)}</pre>
    </div>`;
}

function renderArchivePage() {
  // Newest first, skipping the latest entry (shown in its own panel).
  const list = [...allEntries].reverse().slice(1);
  const page = list.slice(shownCount, shownCount + PAGE_SIZE);
  $('archive').insertAdjacentHTML('beforeend', page.map(archiveItemHtml).join(''));
  shownCount += page.length;
  $('load-more').hidden = shownCount >= list.length;
}

async function load() {
  try {
    const bust = '?t=' + Date.now();
    const [stateRes, entriesRes] = await Promise.all([
      fetch('data/state.json' + bust),
      fetch('data/entries.json' + bust),
    ]);
    const state = await stateRes.json();
    const entries = await entriesRes.json();

    $('entry').textContent = '#' + state.entry;
    $('model').textContent = state.model ? state.model.toUpperCase() : 'NOT CONNECTED';
    $('memory').textContent = state.memory;
    $('question').textContent = state.openQuestion;

    nextEntryAt = state.lastEntryAt
      ? new Date(state.lastEntryAt).getTime() + state.intervalMinutes * 60 * 1000
      : null;

    const changed = entries.length !== allEntries.length;
    allEntries = entries;
    if (changed || shownCount === 0) {
      if (entries.length > 0) renderLatest(entries[entries.length - 1]);
      $('archive').innerHTML = '';
      shownCount = 0;
      renderArchivePage();
      $('archive-count').textContent = `(${entries.length} entries on record)`;
    }
  } catch {
    $('model').textContent = 'UNREACHABLE';
  }
}

function tickCountdown() {
  const el = $('countdown');
  if (!nextEntryAt) { el.textContent = '--:--'; return; }
  const ms = nextEntryAt - Date.now();
  if (ms <= 0) { el.textContent = 'DUE'; return; }
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

$('archive').addEventListener('click', (e) => {
  const head = e.target.closest('.archive-head');
  if (!head) return;
  const body = head.parentElement.querySelector('.archive-body');
  const open = body.hidden;
  body.hidden = !open;
  head.setAttribute('aria-expanded', String(open));
});

$('load-more').addEventListener('click', renderArchivePage);

(async function init() {
  await load();
  setInterval(tickCountdown, 1000);
  setInterval(load, 60 * 1000);
})();
