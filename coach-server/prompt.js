// The quality of the whole Problem Coach lives in this prompt.

const TRACER_CHEATSHEET = `
=== VISUALIZATION ENVIRONMENT ===
The visualization runs inside Algorithm Visualizer. The ONLY module available is 'algorithm-visualizer':

  const { Array1DTracer, Array2DTracer, ChartTracer, GraphTracer, LogTracer, Tracer, Layout, VerticalLayout, HorizontalLayout } = require('algorithm-visualizer');

API:
- new Array1DTracer('title')  .set(array) .patch(i, value) .depatch(i) .select(i) .select(i, j) .deselect(i) .deselect(i, j) .chart(chartTracer)
- new Array2DTracer('title')  .set(array2d) .patch(y, x, value) .depatch(y, x) .select(y, x) .selectRow(y, x1, x2) .selectCol(x, y1, y2) .deselect(y, x) .deselectRow(y, x1, x2) .deselectCol(x, y1, y2)
- new GraphTracer('title')    .set(adjacencyMatrix) .directed(bool) .weighted(bool) .addNode(id) .addEdge(u, v, weight) .visit(v, from) .leave(v, from) .select(v) .deselect(v) .log(logTracer)
- new ChartTracer('title')    (bind to data with array1DTracer.chart(chartTracer))
- new LogTracer('title')      .println(message)
- Layout.setRoot(new VerticalLayout([tracerA, tracerB, ...]))  // MANDATORY, exactly once, right after creating tracers
- Tracer.delay()              // captures one animation frame. MANDATORY after each step you want animated.

STRICT RULES for visualizationJs:
1. Only require('algorithm-visualizer'). No other require/import, no fs, no fetch, no DOM, no console.log (use a LogTracer instead).
2. Call Layout.setRoot(...) exactly once, immediately after constructing the tracers.
3. Call Tracer.delay() after each meaningful mutation (inside loops), or nothing animates.
4. Hardcode a SMALL example input (8-12 array elements or <= 8 graph nodes), ideally the problem's own example, so the animation stays readable.
5. Top-level synchronous code only: no async/await, no setTimeout, no Promises. Plain ES6 that runs inside a web worker.
6. Use a LogTracer to narrate every step in plain language (e.g. "comparing a[2]=5 with target-x=4").
7. The animation should teach the CORE algorithm insight, not every implementation detail.`;

const FEW_SHOT_VIZ = `
=== EXAMPLE OF VALID visualizationJs (for a linear scan tracking a running best) ===
const { Array1DTracer, ChartTracer, LogTracer, Layout, Tracer, VerticalLayout } = require('algorithm-visualizer');
const arr = new Array1DTracer('Prices');
const chart = new ChartTracer('Prices Chart');
const logger = new LogTracer('Steps');
Layout.setRoot(new VerticalLayout([arr, chart, logger]));
const D = [7, 1, 5, 3, 6, 4];
arr.set(D);
arr.chart(chart);
Tracer.delay();
let minI = 0;
let best = 0;
for (let i = 1; i < D.length; i++) {
  arr.select(i);
  logger.println('day ' + i + ': price ' + D[i] + ', cheapest so far ' + D[minI]);
  Tracer.delay();
  if (D[i] - D[minI] > best) {
    best = D[i] - D[minI];
    logger.println('new best profit: ' + best);
  }
  if (D[i] < D[minI]) {
    arr.deselect(minI);
    minI = i;
  }
  arr.deselect(i);
  Tracer.delay();
}
logger.println('answer: ' + best);`;

const OUTPUT_CONTRACT = `
=== OUTPUT FORMAT ===
Respond with ONLY a single JSON object — no markdown fences, no text before or after it. Schema:
{
  "title": string,                       // short problem title
  "summary": string,                     // markdown: what the problem REALLY asks in plain language; restate the examples concretely; call out the input/output shapes and the constraints that matter
  "classification": {
    "category": string,                  // e.g. "Hash Table / Lookup", "Two Pointers", "Dynamic Programming"
    "techniques": [string],              // specific techniques, e.g. ["complement lookup", "single pass"]
    "whyThisClass": string,              // markdown: the observable SIGNALS in the statement that point to this class — teach pattern recognition
    "complexityTarget": string           // e.g. "O(n) time, O(n) space — n <= 1e5 rules out O(n^2)"
  },
  "hints": [string, string, string],     // markdown, ESCALATING and NON-SPOILING:
                                         //  hint 1: reframe the problem / point at the key observation; do NOT name the technique
                                         //  hint 2: name the technique and why it applies; NO algorithm steps yet
                                         //  hint 3: outline the algorithm in words (near-pseudocode); still NO code
  "walkthrough": string,                 // markdown: step-by-step trace of the algorithm on the problem's example input (list or table)
  "visualizationJs": string,             // JavaScript following the STRICT RULES, animating the core algorithm on the example input
  "solutionJs": string                   // plain well-commented JavaScript solution (LeetCode-style function) with complexity analysis in comments. NOT tracer code — do not require anything.
}`;

function buildPrompt(problemText) {
  return [
    'You are a patient DSA coach. Your learner is a Java backend developer who is NEW to data structures and algorithms. He wants to LEARN to solve problems himself, not to be handed answers. Analyze the following competitive-programming problem.',
    '=== PROBLEM ===',
    problemText,
    '=== END PROBLEM ===',
    TRACER_CHEATSHEET,
    FEW_SHOT_VIZ,
    OUTPUT_CONTRACT,
    'Remember: output ONLY the raw JSON object.',
  ].join('\n\n');
}

module.exports = { buildPrompt };
