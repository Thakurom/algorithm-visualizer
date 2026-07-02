// Fetches a problem statement from LeetCode's public GraphQL API.
// Any failure maps to a typed error telling the user to paste the text instead —
// pasting is the universal fallback for every judge site.

async function fetchLeetCodeProblem(url) {
  const m = /leetcode\.(?:com|cn)\/problems\/([^/?#]+)/i.exec(url);
  if (!m) {
    throw withCode(new Error('Not a LeetCode problem URL'), 'BAD_URL', 400);
  }
  const titleSlug = m[1];

  let resp;
  try {
    resp = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': `https://leetcode.com/problems/${titleSlug}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        query: `query q($titleSlug: String!) { question(titleSlug: $titleSlug) {
          title content difficulty topicTags { name } exampleTestcases } }`,
        variables: { titleSlug },
      }),
    });
  } catch (e) {
    throw withCode(new Error(`Could not reach LeetCode (${e.message}) — paste the problem text instead`), 'LEETCODE_FETCH_FAILED', 502);
  }
  if (!resp.ok) {
    throw withCode(new Error(`LeetCode responded ${resp.status} — paste the problem text instead`), 'LEETCODE_FETCH_FAILED', 502);
  }

  const data = await resp.json();
  const q = data && data.data && data.data.question;
  if (!q || !q.content) {
    throw withCode(new Error('Problem not found (premium-only problems cannot be fetched) — paste the text instead'), 'LEETCODE_NOT_FOUND', 404);
  }

  return [
    `Title: ${q.title} (difficulty: ${q.difficulty})`,
    `LeetCode topic tags (do not reveal directly to the learner; use them to verify your classification): ${q.topicTags.map(t => t.name).join(', ')}`,
    stripHtml(q.content),
    q.exampleTestcases ? `Raw example testcases:\n${q.exampleTestcases}` : '',
  ].filter(Boolean).join('\n\n');
}

function stripHtml(html) {
  return html
    .replace(/<(pre|p|div|li|br|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function withCode(err, code, status) {
  err.code = code;
  err.status = status;
  return err;
}

module.exports = { fetchLeetCodeProblem };
