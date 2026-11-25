
const FEED_URL = 'https://remotive.com/api/remote-jobs';
const FEED_TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAIL_MS = 60 * 1000;
const MAX_RESULTS = 50;

const SIGNALS = [
  'disability', 'disabilities', 'disabled', 'reasonable accommodation',
  'accommodations', 'accessible', 'accessibility', 'inclusive', 'inclusion',
  'equal opportunity', 'neurodiverse', 'assistive', 'diversity'
];

const TYPE_MAP = {
  full_time: 'FULLTIME', part_time: 'PARTTIME',
  contract: 'CONTRACTOR', freelance: 'CONTRACTOR', internship: 'INTERN'
};

class JobsApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const stripHtml = (html = '') =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const findSignals = (text) => {
  const lower = text.toLowerCase();
  return SIGNALS.filter((s) => lower.includes(s));
};

function normalise(j) {
  const text = stripHtml(j.description);
  const tags = Array.isArray(j.tags) ? j.tags : [];
  const location = j.candidate_required_location || 'Worldwide';
  return {
    id: String(j.id),
    title: j.title,
    employer: j.company_name,
    location,
    employmentTypes: TYPE_MAP[j.job_type] ? [TYPE_MAP[j.job_type]] : [],
    remote: true,
    postedAt: j.publication_date,
    applyUrl: j.url,
    snippet: text.slice(0, 220),
    signals: findSignals(`${j.title} ${text}`),
    haystack: `${j.title} ${j.company_name} ${j.category} ${tags.join(' ')}`.toLowerCase()
  };
}

class JobFeed {
  constructor() {
    this.jobs = [];
    this.expiresAt = 0;
    this.pending = null;
    this.isStale = false;
  }

  async load() {
    if (this.jobs.length && Date.now() < this.expiresAt) return { jobs: this.jobs, stale: this.isStale };
    if (!this.pending) this.pending = this.download().finally(() => { this.pending = null; });
    try {
      await this.pending;
      this.isStale = false;
      return { jobs: this.jobs, stale: false };
    } catch (err) {
      if (this.jobs.length) {            // keep serving the old list if the feed is down
        this.expiresAt = Date.now() + RETRY_AFTER_FAIL_MS;
        this.isStale = true;
        return { jobs: this.jobs, stale: true };
      }
      throw err;
    }
  }

  async download() {
    let res;
    try {
      res = await fetch(FEED_URL, { signal: AbortSignal.timeout(15000) });
    } catch (err) {
      const timeout = err.name === 'TimeoutError';
      throw new JobsApiError(timeout ? 504 : 502,
        timeout ? 'The job service took too long to answer.' : 'Could not reach the job service.');
    }
    if (res.status === 429) throw new JobsApiError(429, 'The job service is limiting requests. Try again later.');
    if (!res.ok) throw new JobsApiError(502, `Job service error (${res.status}).`);

    const body = await res.json().catch(() => null);
    if (!Array.isArray(body?.jobs)) throw new JobsApiError(502, 'Unexpected response from the job service.');

    this.jobs = body.jobs.map(normalise);
    this.expiresAt = Date.now() + FEED_TTL_MS;
  }
}

// Every word typed must appear in the title, employer, category or tags.
function filterJobs(jobs, { query, region }) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const where = region.toLowerCase();
  return jobs
    .filter((j) => (!where || j.location.toLowerCase().includes(where)) && words.every((w) => j.haystack.includes(w)))
    .sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0))
    .slice(0, MAX_RESULTS)
    .map(({ haystack, ...publicFields }) => publicFields);
}

module.exports = { JobFeed, JobsApiError, filterJobs };
