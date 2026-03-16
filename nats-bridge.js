/**
 * Forge NATS Bridge — uses kingdom-raven library
 * Receives tasks from Chancellor, invokes Claude to execute them,
 * publishes results to raven.chancellor.response and ledger to raven.ledger.forge.
 * Does NOT publish directly to Crown — Chancellor owns that channel.
 */
const raven = require('kingdom-raven');
const { JSONCodec, StringCodec } = require('nats');
const { spawn } = require('child_process');
const fs = require('fs');

const INBOX_LOG  = '/workspace/inbox.log';
const STATUS_LOG = '/workspace/nats-bridge.log';
const PID_FILE   = '/workspace/nats-bridge.pid';
const STATE_DIR  = '/workspace/task-state';
const jc = JSONCodec();
const sc = StringCodec();

// Ensure task state directory exists
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

function stateFile(requestId) { return `${STATE_DIR}/${requestId}.json`; }

function readTaskState(requestId) {
  try {
    const f = stateFile(requestId);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {}
  return null;
}

function writeTaskState(requestId, data) {
  try { fs.writeFileSync(stateFile(requestId), JSON.stringify(data, null, 2)); } catch {}
}

function deleteTaskState(requestId) {
  try { fs.unlinkSync(stateFile(requestId)); } catch {}
}

// ── Single-instance guard ─────────────────────────────────────────────────────
(function ensureSingleInstance() {
  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    try {
      process.kill(oldPid, 0);
      console.error(`[Forge] Another instance already running (PID ${oldPid}), exiting.`);
      process.exit(0);
    } catch { /* old PID is dead — continue */ }
  }
  fs.writeFileSync(PID_FILE, String(process.pid));
  process.on('exit', () => { try { fs.unlinkSync(PID_FILE); } catch {} });
})();

function decode(data) {
  try { return jc.decode(data); }
  catch { return { raw: sc.decode(data) }; }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(STATUS_LOG, line + '\n');
}

function writeInbox(subject, data) {
  const entry = JSON.stringify({ subject, data, ts: new Date().toISOString() }) + '\n';
  fs.appendFileSync(INBOX_LOG, entry);
}

// Run Claude Sonnet — no timeout, runs until Claude finishes naturally
// Heartbeat every 2 min shows it's alive; Crown can intervene if stuck
function runClaude(prompt, onData) {
  return new Promise((resolve) => {
    let out = '';
    const proc = spawn('claude', ['-p', '--dangerously-skip-permissions', '--model', 'claude-sonnet-4-6'], {
      env: { ...process.env, HOME: '/home/claude' },
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
    proc.stdout.on('data', d => {
      const chunk = d.toString();
      out += chunk;
      if (onData) onData(chunk);
    });
    proc.stderr.on('data', d => { log(`[Claude stderr] ${d.toString().trim()}`); });
    proc.on('close', code => {
      if (code === 0 && out.trim()) resolve(out.trim());
      else resolve(null);
    });
    proc.on('error', err => { log(`[Claude spawn error] ${err.message}`); resolve(null); });
  });
}

// Run Claude Haiku for quick summaries (30-second timeout)
function runHaiku(prompt) {
  return new Promise((resolve) => {
    let out = '';
    const proc = spawn('claude', ['-p', '--dangerously-skip-permissions', '--model', 'claude-haiku-4-5-20251001'], {
      env: { ...process.env, HOME: '/home/claude' },
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', () => {});
    proc.on('close', code => { resolve(code === 0 && out.trim() ? out.trim() : null); });
    proc.on('error', () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 30000);
  });
}

async function main() {
  // Embed credentials in URL if not already present (NATS_URL may lack auth)
  let natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  if (!natsUrl.includes('@') && process.env.NATS_USER && process.env.NATS_PASSWORD) {
    const u = new URL(natsUrl);
    u.username = process.env.NATS_USER;
    u.password = process.env.NATS_PASSWORD;
    natsUrl = u.toString();
  }
  const nc = await raven.connect({
    url: natsUrl,
    agent: 'forge',
    onDisconnect: () => process.exit(1),
  });

  log('[Forge] Connected to Raven Network via kingdom-raven');

  // ── Task handler (shared for assigned + request subjects) ─────────────────────
  async function handleTask(data, subject) {
    const task = data.task || data.text || data.description || data.directive
               || (data.payload && data.payload.description) || JSON.stringify(data);
    const requestId = data.request_id || (data.payload && data.payload.request_id) || null;
    log(`[Forge] TASK received: ${task.slice(0, 120)}`);
    writeInbox(subject, data);

    // Check for prior state (resume scenario)
    const priorState = requestId ? readTaskState(requestId) : null;
    const isResuming = priorState && priorState.completed_steps && priorState.completed_steps.length > 0;
    if (isResuming) {
      log(`[Forge] RESUMING task ${requestId} — ${priorState.completed_steps.length} prior steps found`);
    }

    // Write/update state file so Claude can append to it
    if (requestId) {
      writeTaskState(requestId, {
        request_id: requestId,
        task: task.slice(0, 500),
        started_at: priorState ? priorState.started_at : new Date().toISOString(),
        resumed_at: isResuming ? new Date().toISOString() : undefined,
        status: 'running',
        completed_steps: priorState ? (priorState.completed_steps || []) : [],
      });
    }

    nc.publish(raven.subjects.worker('forge', 'started'), jc.encode({
      guild: 'forge', status: isResuming ? 'resumed' : 'started',
      task: task.slice(0, 100), timestamp: new Date().toISOString(),
    }));

    const resumeSection = isResuming
      ? `\n\n⚠️  RESUMING INTERRUPTED TASK — you previously completed these steps:\n${priorState.completed_steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\nDo NOT redo completed steps. Continue from where you left off.\n`
      : '';

    const stateInstruction = requestId
      ? `\n\nIMPORTANT — Task State Tracking:
As you complete each major step, record it by running this Bash command (replacing STEP_DESC with a one-line description):
  node -e "const f='${stateFile(requestId)}';const s=JSON.parse(require('fs').readFileSync(f,'utf8'));s.completed_steps.push('STEP_DESC');require('fs').writeFileSync(f,JSON.stringify(s,null,2));"
This lets your work be resumed if you are interrupted mid-task.\n`
      : '';

    const isDirect = data.direct === true || data.source === 'crown';
    const threadHistory = data.thread_history || [];
    const threadContext = threadHistory.length > 0
      ? '\n\nThread history (full conversation context, oldest first):\n' +
        threadHistory.map(m => `[${m.timestamp}] ${m.author}: ${m.content}`).join('\n') +
        '\n\nLatest task (execute this):'
      : '';

    const prompt = `You are the Forge of The Kingdom — the builder, coder, and executor.

${isDirect ? 'You received this task DIRECTLY from the Crown via #forge:' : 'You received this task from the Chancellor:'}
${threadContext}
"${task}"
${resumeSection}
YOUR TOOLS: Bash, file read/write, and all standard Claude Code tools are available.
${stateInstruction}
Execute the task now. When done, provide a clear summary of exactly what you did and the result.`;

    // Immediate ack — for direct Crown tasks; normal tasks acked by chancellor
    if (isDirect) {
      nc.publish('raven.forge.response', jc.encode({
        source: 'forge',
        message: '⚡ Received — building now…',
        request_id: requestId,
        ack: true,
        timestamp: new Date().toISOString(),
      }));
    }
    log('[Forge] Invoking Claude for task...');
    const startTime = Date.now();
    let recentBuffer = '';

    const heartbeat = setInterval(async () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const buffer = recentBuffer;
      recentBuffer = ''; // reset for next window

      // Summarize recent output with Haiku
      let summary = `Still working… ${Math.round(elapsed / 60)}m elapsed`;
      if (buffer.trim().length > 50) {
        const haiku = await runHaiku(
          `You are a technical summarizer. In 1-2 concise sentences, summarize what was just accomplished in the last 2 minutes of work. Focus on concrete actions taken.\n\nRecent output:\n${buffer.slice(-2500)}`
        );
        if (haiku) summary = haiku;
      }

      nc.publish(raven.subjects.worker('forge', 'progress'), jc.encode({
        guild: 'forge', event: 'progress',
        task: task.slice(0, 100),
        request_id: requestId,
        elapsed_seconds: elapsed,
        summary,
        timestamp: new Date().toISOString(),
      }));
      log(`[Forge] Heartbeat (${elapsed}s): ${summary.slice(0, 120)}`);
    }, 120000);

    const result = await runClaude(prompt, (chunk) => { recentBuffer += chunk; });
    clearInterval(heartbeat);

    if (result) {
      log(`[Forge] Task complete (${result.length} chars), publishing result...`);
      // Clean up state file on success
      if (requestId) deleteTaskState(requestId);
    } else {
      log('[Forge] Claude returned no result for task');
      // Mark state as failed so re-dispatch knows
      if (requestId) {
        const state = readTaskState(requestId) || {};
        writeTaskState(requestId, { ...state, status: 'failed', failed_at: new Date().toISOString() });
      }
    }

    const resultText = result || 'Task failed — Claude returned no response.';

    // Direct Crown request → report to Crown via raven.forge.response
    // Normal Chancellor task → report to Chancellor via raven.chancellor.response
    const responseSubject = isDirect ? 'raven.forge.response' : 'raven.chancellor.response';
    nc.publish(responseSubject, jc.encode({
      source: 'forge',
      result: resultText,
      task: task.slice(0, 100),
      request_id: requestId,
      close_thread: true,
      timestamp: new Date().toISOString(),
    }));

    raven.publishLedger(nc, 'forge', resultText.slice(0, 500));
  }

  // ── Assigned tasks (from Chancellor) ─────────────────────────────────────────
  raven.listenForTasks(nc, 'forge', async (data) => {
    await handleTask(data, 'raven.forge.assigned');
  });

  // ── Raven Protocol service requests ──────────────────────────────────────────
  raven.listenForRequests(nc, 'forge', async (request) => {
    log(`[Forge] SERVICE REQUEST: ${request.action} from ${request.from}`);
    // Execute as a task so Claude handles it
    await handleTask({
      task: request.payload.description,
      request_id: request.request_id,
    }, 'raven.forge.request');
    // Return accepted — the real response comes via raven.chancellor.response
    return { status: 'accepted', payload: { summary: 'Forge is executing the request' } };
  });

  // ── Kill switch ───────────────────────────────────────────────────────────────
  (async () => {
    const sub = nc.subscribe(raven.subjects.killswitch);
    for await (const msg of sub) {
      log('[Forge] ⚠️  KILL SWITCH received — halting');
      writeInbox(msg.subject, decode(msg.data));
      nc.publish(raven.subjects.worker('forge', 'halted'), jc.encode({
        guild: 'forge', status: 'halted', timestamp: new Date().toISOString(),
      }));
    }
  })();

  log('[Forge] NATS bridge fully operational');
}

main().catch(err => {
  console.error('[Forge] Fatal NATS error:', err.message);
  process.exit(1);
});
