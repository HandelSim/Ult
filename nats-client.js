#!/usr/bin/env node
/**
 * Kingdom Forge — NATS client helper
 * Usage: node nats-client.js publish <subject> <json>
 *        node nats-client.js subscribe <subject>
 */
const { connect, StringCodec, JSONCodec } = require('nats');

// Strip embedded credentials from NATS_URL if present — the nats library
// doesn't reliably parse nats://user:pass@host:port format, use explicit params.
function parseNatsUrl(raw) {
  try {
    const u = new URL(raw);
    return {
      server: `nats://${u.hostname}:${u.port || 4222}`,
      user: u.username || undefined,
      pass: u.password || undefined,
    };
  } catch { return { server: raw }; }
}

const { server: NATS_SERVER, user: URL_USER, pass: URL_PASS } = parseNatsUrl(
  process.env.NATS_URL || 'nats://localhost:4222'
);
const NATS_USER = process.env.NATS_USER || URL_USER || 'kingdom';
const NATS_PASS = process.env.NATS_PASSWORD || URL_PASS || '';

const jc = JSONCodec();
const sc = StringCodec();

const [,, cmd, subject, ...rest] = process.argv;

async function main() {
  const nc = await connect({ servers: NATS_SERVER, user: NATS_USER, pass: NATS_PASS });

  if (cmd === 'pub' || cmd === 'publish') {
    const data = rest.join(' ');
    let payload;
    try { payload = JSON.parse(data); } catch { payload = { text: data }; }
    nc.publish(subject, jc.encode(payload));
    await nc.flush();
    await nc.close();
    console.log(`Published to ${subject}`);
  } else if (cmd === 'sub' || cmd === 'subscribe') {
    console.log(`Subscribing to ${subject}...`);
    const sub = nc.subscribe(subject);
    for await (const msg of sub) {
      try {
        console.log(`[${msg.subject}]`, JSON.stringify(jc.decode(msg.data), null, 2));
      } catch {
        console.log(`[${msg.subject}]`, sc.decode(msg.data));
      }
    }
  } else {
    console.error('Usage: node nats-client.js pub|sub <subject> [json]');
    process.exit(1);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
