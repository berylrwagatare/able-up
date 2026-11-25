(() => {
  const el = (id) => document.getElementById(id);
  const state = { jobs: [] };
  const prefs = { size: 100, contrast: false };

  // ---- display preferences (saved per browser) ----
  function applyPrefs() {
    document.documentElement.style.setProperty('--size', prefs.size + '%');
    document.body.classList.toggle('hc', prefs.contrast);
    el('contrast').setAttribute('aria-pressed', String(prefs.contrast));
    try { localStorage.setItem('ableup-prefs', JSON.stringify(prefs)); } catch (_) { /* storage may be blocked */ }
  }
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('ableup-prefs') || '{}')); } catch (_) {}
  el('smaller').onclick = () => { prefs.size = Math.max(80, prefs.size - 10); applyPrefs(); };
  el('larger').onclick = () => { prefs.size = Math.min(160, prefs.size + 10); applyPrefs(); };
  el('contrast').onclick = () => { prefs.contrast = !prefs.contrast; applyPrefs(); };
  applyPrefs();

  // ---- helpers ----
  function say(message, isError = false) {
    const s = el('status');
    s.textContent = message;
    s.classList.toggle('error', isError);
  }
  function make(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // ---- search ----
  el('searchForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const params = new URLSearchParams({
      q: el('q').value.trim(),
      region: el('region').value
    });
    el('go').disabled = true;
    el('results').replaceChildren();
    say('Searching…');
    try {
      const res = await fetch('/api/jobs?' + params);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      state.jobs = data.jobs;
      el('filters').hidden = false;
      draw();
      if (data.stale) say(el('status').textContent + ' (Saved results shown; live update failed.)');
    } catch (err) {
      state.jobs = [];
      el('filters').hidden = true;
      say(err.message || 'Network problem. Check your connection.', true);
    } finally {
      el('go').disabled = false;
    }
  });

  // ---- filter / sort / render ----
  function draw() {
    const word = el('word').value.toLowerCase();
    const type = el('type').value;
    const onlyInclusive = el('inclusiveOnly').checked;
    const sorters = {
      newest: (a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0),
      title: (a, b) => (a.title || '').localeCompare(b.title || ''),
      employer: (a, b) => (a.employer || '').localeCompare(b.employer || ''),
      inclusive: (a, b) => b.signals.length - a.signals.length
    };
    const shown = state.jobs
      .filter((j) => !word || `${j.title} ${j.employer}`.toLowerCase().includes(word))
      .filter((j) => !type || j.employmentTypes.includes(type))
      .filter((j) => !onlyInclusive || j.signals.length > 0)
      .sort(sorters[el('sort').value]);

    say(shown.length ? `${shown.length} job${shown.length === 1 ? '' : 's'} found.` : 'No jobs match your search or filters.');
    el('results').replaceChildren(...shown.map(card));
  }

  function card(job) {
    const li = make('li', 'card');
    li.append(make('h2', '', job.title || 'Untitled role'));
    li.append(make('p', '', `${job.employer || 'Unknown employer'} · ${job.location || 'Location not listed'}`));

    const chips = make('p');
    job.employmentTypes.forEach((t) => chips.append(make('span', 'chip', t.toLowerCase())));
    if (job.remote) chips.append(make('span', 'chip', 'remote'));
    if (job.postedAt) chips.append(make('span', 'chip', 'posted ' + new Date(job.postedAt).toLocaleDateString()));
    li.append(chips);

    if (job.signals.length) {
      const sig = make('p');
      sig.append(make('strong', '', 'Inclusion signals: '));
      job.signals.slice(0, 4).forEach((s) => sig.append(make('span', 'chip good', s)));
      li.append(sig);
    }
    if (job.snippet) li.append(make('p', '', job.snippet + '…'));

    if (/^https?:\/\//.test(job.applyUrl || '')) {
      const a = make('a', 'apply', 'Apply for ' + (job.title || 'this job'));
      a.href = job.applyUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.append(a);
    }
    return li;
  }

  ['word', 'type', 'sort', 'inclusiveOnly'].forEach((id) => el(id).addEventListener('input', draw));
})();
