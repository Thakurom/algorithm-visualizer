const { spawn } = require('child_process');

// Runs the Claude Code CLI in non-interactive mode and returns the model's text.
// The prompt goes through STDIN — never argv — which sidesteps Windows quoting
// hazards and command-line length limits.
function runClaude(prompt, { timeoutMs = 360000 } = {}) {
  return new Promise((resolve, reject) => {
    // shell: true is required on Windows to resolve the claude.cmd npm shim
    // (plain spawn throws EINVAL on .cmd files since Node 18.20/20.12/22).
    // Safe here because argv is fixed flags only.
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', 'sonnet'], {
      shell: true,
      windowsHide: true,
      cwd: __dirname, // don't inherit an arbitrary CWD's CLAUDE.md context
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // child.pid is the cmd.exe wrapper; /T kills the whole process tree
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: true, windowsHide: true });
    }, timeoutMs);

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => {
      clearTimeout(timer);
      err.code = 'CLAUDE_SPAWN_FAILED';
      err.status = 500;
      err.message = `Could not start the claude CLI (${err.message}) — is it installed and on PATH?`;
      reject(err);
    });
    child.on('close', exitCode => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(withCode(new Error(`Claude timed out after ${timeoutMs / 1000}s`), 'CLAUDE_TIMEOUT', 504));
      }
      if (exitCode !== 0) {
        return reject(withCode(new Error(`claude exited ${exitCode}: ${stderr.slice(0, 500)}`), 'CLAUDE_FAILED', 502));
      }
      try {
        const envelope = JSON.parse(stdout); // --output-format json envelope
        if (envelope.is_error) throw new Error(envelope.result);
        resolve(envelope.result);
      } catch (e) {
        reject(withCode(new Error(`Could not parse claude CLI output: ${e.message}`), 'CLAUDE_BAD_ENVELOPE', 502));
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function withCode(err, code, status) {
  err.code = code;
  err.status = status;
  return err;
}

module.exports = { runClaude };
