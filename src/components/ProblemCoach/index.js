import React from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import faLightbulb from '@fortawesome/fontawesome-free-solid/faLightbulb';
import faCheck from '@fortawesome/fontawesome-free-solid/faCheck';
import faExclamationTriangle from '@fortawesome/fontawesome-free-solid/faExclamationTriangle';
import { actions } from 'reducers';
import { classes, createUserFile } from 'common/util';
import { BaseComponent, Button } from 'components';
import styles from './ProblemCoach.module.scss';

const LEETCODE_URL = /^https?:\/\/(www\.)?leetcode\.(com|cn)\/problems\//i;
const DRAFT_KEY = 'problem-coach-draft';
const EXPECTED_SECONDS = 180;

const STAGES = [
  { at: 0, label: 'Reading the problem ...' },
  { at: 25, label: 'Working out what it really asks ...' },
  { at: 60, label: 'Classifying the technique ...' },
  { at: 100, label: 'Writing your hints ...' },
  { at: 140, label: 'Building the visualization ...' },
  { at: 200, label: 'Almost there — polishing ...' },
];

const EXAMPLES = [
  { name: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/' },
  { name: 'Valid Parentheses', url: 'https://leetcode.com/problems/valid-parentheses/' },
  { name: 'Buy & Sell Stock', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' },
  { name: 'Binary Search', url: 'https://leetcode.com/problems/binary-search/' },
];

class ProblemCoach extends BaseComponent {
  constructor(props) {
    super(props);

    let draft = '';
    try {
      draft = window.localStorage.getItem(DRAFT_KEY) || '';
    } catch (e) { /* storage unavailable */ }

    this.state = {
      input: draft,
      loading: false,
      elapsed: 0,
      error: null,
    };

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.timer) window.clearInterval(this.timer);
  }

  handleKeyDown(e) {
    if (e.key === 'Escape' && !this.state.loading) this.props.onClose();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.handleAnalyze();
  }

  handleChangeInput(value) {
    this.setState({ input: value, error: null });
    try {
      window.localStorage.setItem(DRAFT_KEY, value);
    } catch (e) { /* storage unavailable */ }
  }

  detectInput() {
    const input = this.state.input.trim();
    if (!input) return { ready: false, label: 'Paste a problem statement or a LeetCode link to get started.' };
    if (LEETCODE_URL.test(input)) return { ready: true, label: 'LeetCode link detected — the problem will be fetched automatically.' };
    if (input.length < 40) return { ready: false, label: 'That looks too short — paste the whole problem statement, examples included.' };
    return { ready: true, label: `Problem text detected (${input.length.toLocaleString()} characters).` };
  }

  handleAnalyze() {
    const input = this.state.input.trim();
    if (!input || this.state.loading || !this.detectInput().ready) return;
    const { saved } = this.props.current;
    if (!saved && !window.confirm('The coach will replace your current workspace. Discard unsaved changes?')) return;

    const body = LEETCODE_URL.test(input) ? { url: input } : { problem: input };
    this.setState({ loading: true, elapsed: 0, error: null });
    this.timer = window.setInterval(() => this.setState(state => ({ elapsed: state.elapsed + 1 })), 1000);

    // Relative URL rides the dev-server proxy (setupProxy.js) to the local coach server.
    // The global axios interceptor in src/apis already unwraps response.data.
    axios.post('/coach/analyze', body, { timeout: 600000 })
      .then(result => {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch (e) { /* storage unavailable */ }
        this.loadResult(result);
        this.props.onClose();
      })
      .catch(error => {
        const message = (error.response && error.response.data && error.response.data.message) || error.message;
        this.setState({ error: message });
      })
      .finally(() => {
        window.clearInterval(this.timer);
        this.timer = undefined;
        this.setState({ loading: false });
      });
  }

  loadResult(result) {
    const { classification } = result;
    const problemMd = [
      `# ${result.title}`,
      '',
      '> **How to use this workspace** — the tabs above are ordered like a coaching session:',
      '> problem → hints (open one at a time!) → walkthrough → visualization → solution.',
      '> Try the problem yourself between steps. Struggling first is how the learning sticks.',
      '',
      result.summary,
      '',
      '## Which class of problem is this?',
      '',
      `**Category:** ${classification.category}`,
      '',
      `**Techniques:** ${classification.techniques.join(', ')}`,
      '',
      classification.whyThisClass,
      '',
      `**Complexity target:** ${classification.complexityTarget}`,
      '',
      '---',
      '',
      '_Ready? Give the problem an honest attempt, then open `2-HINT-1.md`._',
    ].join('\n');
    const gate = n => [
      `> **Hint ${n} of 3** — read it, then close this tab and try again.`,
      `> ${n < 3 ? `Only open \`${n + 2}-HINT-${n + 1}.md\` after another real attempt.` : 'This is the last hint before the walkthrough — you are closer than you think.'}`,
      '',
      '',
    ].join('\n');
    const vizBanner = '// >>> Press "Play" in the top bar to watch the algorithm animate step by step. <<<\n\n';

    const files = [
      createUserFile('1-PROBLEM.md', problemMd),
      createUserFile('2-HINT-1.md', gate(1) + result.hints[0]),
      createUserFile('3-HINT-2.md', gate(2) + result.hints[1]),
      createUserFile('4-HINT-3.md', gate(3) + result.hints[2]),
      createUserFile('5-WALKTHROUGH.md', `# Walkthrough\n\n${result.walkthrough}`),
      createUserFile('6-visualization.js', vizBanner + result.visualizationJs),
      createUserFile('7-SOLUTION.js', result.solutionJs),
    ];
    // gistId 'new' makes the Header treat this like a fresh scratch paper (Save works).
    this.props.setScratchPaper({ login: undefined, gistId: 'new', title: result.title, files });
    // setScratchPaper clears editingFile — open the explanation first, not the solution.
    this.props.setEditingFile(files[0]);
  }

  render() {
    const { onClose } = this.props;
    const { input, loading, elapsed, error } = this.state;
    const detection = this.detectInput();
    const stage = STAGES.filter(s => elapsed >= s.at).pop() || STAGES[0];
    const progress = Math.min(95, Math.round((elapsed / EXPECTED_SECONDS) * 100));
    const minutes = Math.floor(elapsed / 60);
    const seconds = String(elapsed % 60).padStart(2, '0');

    return (
      <div className={styles.overlay} onClick={loading ? undefined : onClose}>
        <div className={styles.panel} onClick={e => e.stopPropagation()}>
          <div className={styles.header}>
            <div className={styles.header_icon}>
              <FontAwesomeIcon icon={faLightbulb}/>
            </div>
            <div className={styles.header_text}>
              <h2 className={styles.title}>Problem Coach</h2>
              <p className={styles.subtitle}>
                Paste any problem — get a plain-language explanation, the algorithm family,
                escalating hints, and a step-by-step visualization.
              </p>
            </div>
          </div>

          {
            !loading &&
            <React.Fragment>
              <div className={styles.examples}>
                <span className={styles.examples_label}>New here? Try one:</span>
                {
                  EXAMPLES.map(example => (
                    <div key={example.name} className={styles.chip}
                         onClick={() => this.handleChangeInput(example.url)}>{example.name}</div>
                  ))
                }
              </div>
              <textarea className={styles.input} value={input} autoFocus
                        placeholder={'https://leetcode.com/problems/two-sum/\n\n... or paste the full problem statement here (works for Codeforces, CodeChef, anything)'}
                        onChange={e => this.handleChangeInput(e.target.value)}/>
              <div className={classes(styles.detection, detection.ready && styles.detection_ready)}>
                {detection.ready && <FontAwesomeIcon className={styles.detection_icon} icon={faCheck}/>}
                {detection.label}
              </div>
            </React.Fragment>
          }

          {
            loading &&
            <div className={styles.progress_box}>
              <div className={styles.progress_track}>
                <div className={styles.progress_fill} style={{ transform: `scaleX(${progress / 100})` }}/>
              </div>
              <div className={styles.status}>{stage.label}</div>
              <div className={styles.elapsed}>
                {minutes}:{seconds} elapsed — a full lesson usually takes 2–4 minutes.
                Perfect moment to re-read the problem and form your own guess.
              </div>
            </div>
          }

          {
            error &&
            <div className={styles.error}>
              <FontAwesomeIcon className={styles.error_icon} icon={faExclamationTriangle}/>
              {error}
            </div>
          }

          <div className={styles.actions}>
            <div className={styles.kbd_hint}>
              <span className={styles.kbd}>Ctrl</span>+<span className={styles.kbd}>Enter</span> to analyze
              &nbsp;·&nbsp; <span className={styles.kbd}>Esc</span> to close
            </div>
            <Button icon={faLightbulb} primary className={styles.action} inProgress={loading}
                    disabled={loading || !detection.ready}
                    onClick={() => this.handleAnalyze()}>{loading ? 'Coaching' : 'Analyze'}</Button>
            <Button primary className={styles.action} disabled={loading} onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }
}

export default connect(({ current }) => ({ current }), actions)(
  ProblemCoach,
);
