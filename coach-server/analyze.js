const { buildPrompt } = require('./prompt');
const { runClaude } = require('./claude');

const REQUIRED_KEYS = ['title', 'summary', 'classification', 'hints', 'walkthrough', 'visualizationJs', 'solutionJs'];

function parseAndValidate(text) {
  // Tolerate fences and stray prose around the JSON object.
  const raw = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object found');
  const obj = JSON.parse(raw.slice(start, end + 1));

  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) throw new Error(`missing key "${key}"`);
  }
  if (!Array.isArray(obj.hints) || obj.hints.length !== 3) throw new Error('hints must be an array of exactly 3 strings');
  const viz = obj.visualizationJs;
  if (!viz.includes("require('algorithm-visualizer')") || !viz.includes('Layout.setRoot') || !viz.includes('Tracer.delay()')) {
    throw new Error('visualizationJs violates the tracer contract (require/Layout.setRoot/Tracer.delay)');
  }
  return obj;
}

async function analyzeProblem(problemText) {
  const prompt = buildPrompt(problemText);
  try {
    return parseAndValidate(await runClaude(prompt));
  } catch (firstErr) {
    if (firstErr.code) throw firstErr; // spawn/timeout/CLI errors: retrying blindly won't help
    console.warn('[coach] first response invalid, retrying once:', firstErr.message);
    const retryPrompt = prompt + '\n\nYour previous answer was invalid (' + firstErr.message +
      '). Output ONLY the raw JSON object exactly matching the schema. No fences, no commentary.';
    return parseAndValidate(await runClaude(retryPrompt)); // a second failure propagates as 502
  }
}

module.exports = { analyzeProblem };
