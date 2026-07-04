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
    let settled = false;
    const settle = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(result);
    };
    const timer = setTimeout(() => {
      settle(withCode(new Error(`Claude timed out after ${timeoutMs / 1000}s`), 'CLAUDE_TIMEOUT', 504));
      if (process.platform === 'win32') {
        // child.pid is the cmd.exe wrapper; /T kills the whole process tree
        try {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
          killer.on('error', err => console.error(`[coach] taskkill failed: ${err.message}`));
          killer.on('exit', exitCode => {
            if (exitCode !== 0) console.error(`[coach] taskkill exited ${exitCode}`);
          });
        } catch (err) {
          console.error(`[coach] taskkill failed: ${err.message}`);
        }
      } else {
        try {
          child.kill('SIGKILL');
        } catch (err) {
          console.error(`[coach] could not kill timed-out claude CLI: ${err.message}`);
        }
      }
    }, timeoutMs);

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => {
      err.code = 'CLAUDE_SPAWN_FAILED';
      err.status = 500;
      err.message = `Could not start the claude CLI (${err.message}) — is it installed and on PATH?`;
      settle(err);
    });
    child.on('close', exitCode => {
      if (exitCode !== 0) {
        return settle(withCode(new Error(`claude exited ${exitCode}: ${stderr.slice(0, 500)}`), 'CLAUDE_FAILED', 502));
      }
      try {
        const envelope = JSON.parse(stdout); // --output-format json envelope
        if (envelope.is_error) throw new Error(envelope.result);
        settle(null, envelope.result);
      } catch (e) {
        settle(withCode(new Error(`Could not parse claude CLI output: ${e.message}`), 'CLAUDE_BAD_ENVELOPE', 502));
      }
    });

    const handleStdinError = err => {
      settle(withCode(new Error(`Could not write prompt to claude CLI: ${err.message}`), 'CLAUDE_FAILED', 502));
    };
    child.stdin.on('error', handleStdinError);
    try {
      child.stdin.write(prompt);
      child.stdin.end();
    } catch (err) {
      handleStdinError(err);
    }
  });
}

function withCode(err, code, status) {
  err.code = code;
  err.status = status;
  return err;
}

module.exports = { runClaude };
