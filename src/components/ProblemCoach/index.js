import React from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import faLightbulb from '@fortawesome/fontawesome-free-solid/faLightbulb';
import { actions } from 'reducers';
import { createUserFile } from 'common/util';
import { BaseComponent, Button } from 'components';
import styles from './ProblemCoach.module.scss';

const LEETCODE_URL = /^https?:\/\/(www\.)?leetcode\.(com|cn)\/problems\//i;

const STATUS_MESSAGES = [
  'Reading the problem ...',
  'Working out what it really asks ...',
  'Classifying the technique ...',
  'Writing your hints ...',
  'Building the visualization ...',
  'Almost there ...',
];

class ProblemCoach extends BaseComponent {
  constructor(props) {
    super(props);

    this.state = {
      input: '',
      loading: false,
      elapsed: 0,
      error: null,
    };
  }

  componentWillUnmount() {
    if (this.timer) window.clearInterval(this.timer);
  }

  handleAnalyze() {
    const input = this.state.input.trim();
    if (!input) return;
    const { saved } = this.props.current;
    if (!saved && !window.confirm('The coach will replace your current workspace. Discard unsaved changes?')) return;

    const body = LEETCODE_URL.test(input) ? { url: input } : { problem: input };
    this.setState({ loading: true, elapsed: 0, error: null });
    this.timer = window.setInterval(() => this.setState(state => ({ elapsed: state.elapsed + 1 })), 1000);

    // Relative URL rides the dev-server proxy (setupProxy.js) to the local coach server.
    // The global axios interceptor in src/apis already unwraps response.data.
    axios.post('/coach/analyze', body, { timeout: 600000 })
      .then(result => {
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
      '_Open the tabs above in order. Try the problem yourself after each hint before opening the next one._',
    ].join('\n');
    const gate = n => `> Hint ${n} of 3 — give the problem a real try before opening the next tab.\n\n`;

    const files = [
      createUserFile('1-PROBLEM.md', problemMd),
      createUserFile('2-HINT-1.md', gate(1) + result.hints[0]),
      createUserFile('3-HINT-2.md', gate(2) + result.hints[1]),
      createUserFile('4-HINT-3.md', gate(3) + result.hints[2]),
      createUserFile('5-WALKTHROUGH.md', `# Walkthrough\n\n${result.walkthrough}`),
      createUserFile('6-visualization.js', result.visualizationJs),
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
    const status = STATUS_MESSAGES[Math.min(Math.floor(elapsed / 20), STATUS_MESSAGES.length - 1)];

    return (
      <div className={styles.overlay} onClick={loading ? undefined : onClose}>
        <div className={styles.panel} onClick={e => e.stopPropagation()}>
          <h2 className={styles.title}>Problem Coach</h2>
          <p className={styles.description}>
            Paste a problem statement from LeetCode, Codeforces, or CodeChef — or just a LeetCode problem URL.
            You will get a plain-language explanation, the algorithm family it belongs to, three escalating
            hints, a step-by-step visualization, and (only when you are ready) the solution.
          </p>
          <textarea className={styles.input} value={input} disabled={loading}
                    placeholder={'https://leetcode.com/problems/two-sum/\n\n... or paste the full problem statement here'}
                    onChange={e => this.setState({ input: e.target.value })}/>
          {
            error &&
            <div className={styles.error}>{error}</div>
          }
          {
            loading &&
            <div className={styles.status}>{status} {elapsed}s (typically 1–3 minutes)</div>
          }
          <div className={styles.actions}>
            <Button icon={faLightbulb} primary className={styles.action} inProgress={loading}
                    disabled={loading || !input.trim()}
                    onClick={() => this.handleAnalyze()}>{loading ? 'Analyzing' : 'Analyze'}</Button>
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
