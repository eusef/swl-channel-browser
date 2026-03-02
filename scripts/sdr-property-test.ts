#!/usr/bin/env npx tsx
/**
 * SDRconnect WebSocket Property Test Script
 *
 * Connects to a running SDRconnect instance (GUI or headless) and tests every
 * known property for readability and writability. Produces a report showing
 * which properties work, which are read-only, and which are unresponsive.
 *
 * Usage:
 *   npx tsx scripts/sdr-property-test.ts [ws://host:port]
 *
 * Defaults to ws://localhost:3000/ws/sdr (the app's WebSocket proxy) since
 * SDRconnect's native WebSocket server rejects direct Node.js ws connections.
 * The dev server must be running (npm run dev) for the default to work.
 *
 * To test against a remote headless instance through the proxy:
 *   npx tsx scripts/sdr-property-test.ts ws://pi-host:3000/ws/sdr
 *
 * The report is printed to stdout and saved as sdr-property-report.json in the
 * project root for use in feature requests.
 */

import WebSocket from 'ws';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WS_URL = process.argv[2] || 'ws://localhost:3000/ws/sdr';
const GET_TIMEOUT_MS = 3000;   // max wait for a get_property_response
const SET_VERIFY_MS = 2000;    // wait after set before re-reading
const CONNECT_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Property catalog: every property we know about from the API docs, binary
// strings extraction, and runtime observation.
// ---------------------------------------------------------------------------

interface PropertyDef {
  name: string;
  /** Expected value type for display */
  type: 'number' | 'boolean' | 'string' | 'hz';
  /** Candidate write value (null = skip write test entirely) */
  testWrite: string | null;
  /**
   * Blind write value: used when the property is not readable.
   * We send this value and then try get_property to see if we get a response.
   * null = don't attempt blind write.
   */
  blindWrite: string | null;
  /** Category for the report */
  category: string;
}

const PROPERTIES: PropertyDef[] = [
  // ---- Tuning / core ----
  { name: 'device_vfo_frequency',     type: 'hz',      testWrite: null,    blindWrite: null,    category: 'Tuning' },
  { name: 'device_center_frequency',  type: 'hz',      testWrite: null,    blindWrite: null,    category: 'Tuning' },
  { name: 'device_sample_rate',       type: 'hz',      testWrite: null,    blindWrite: null,    category: 'Tuning' },
  { name: 'iq_sample_rate',           type: 'hz',      testWrite: null,    blindWrite: null,    category: 'Tuning' },
  { name: 'demodulator',              type: 'string',   testWrite: null,    blindWrite: null,    category: 'Tuning' },
  { name: 'filter_bandwidth',         type: 'hz',      testWrite: null,    blindWrite: null,    category: 'Tuning' },
  { name: 'antenna_select',           type: 'string',   testWrite: 'CURRENT', blindWrite: 'Hi-Z', category: 'Tuning' },
  { name: 'started',                  type: 'boolean',  testWrite: null,    blindWrite: null,    category: 'Tuning' },

  // ---- Gain / AGC (Issue #13 targets) ----
  { name: 'lna_state',                type: 'number',  testWrite: 'CURRENT+1', blindWrite: null, category: 'Gain' },
  { name: 'lna_state_min',            type: 'number',  testWrite: null,         blindWrite: null, category: 'Gain' },
  { name: 'lna_state_max',            type: 'number',  testWrite: null,         blindWrite: null, category: 'Gain' },
  { name: 'agc_enable',               type: 'boolean', testWrite: 'TOGGLE',     blindWrite: null, category: 'Gain' },
  { name: 'agc_threshold',            type: 'number',  testWrite: 'CURRENT+1',  blindWrite: null, category: 'Gain' },
  { name: 'device_if_gain_reduction', type: 'number',  testWrite: 'CURRENT+1',  blindWrite: '30', category: 'Gain' },
  { name: 'overload',                 type: 'boolean', testWrite: null,          blindWrite: null, category: 'Gain' },

  // ---- Audio ----
  { name: 'audio_volume_percent',     type: 'number',  testWrite: 'CURRENT',    blindWrite: null, category: 'Audio' },
  { name: 'audio_mute',               type: 'boolean', testWrite: 'TOGGLE',     blindWrite: null, category: 'Audio' },
  { name: 'audio_filter',             type: 'boolean', testWrite: 'TOGGLE',     blindWrite: null, category: 'Audio' },
  { name: 'audio_limiters',           type: 'boolean', testWrite: 'TOGGLE',     blindWrite: null, category: 'Audio' },

  // ---- Noise / Squelch ----
  { name: 'squelch_enable',           type: 'boolean', testWrite: 'TOGGLE',      blindWrite: null, category: 'Squelch/NR' },
  { name: 'squelch_threshold',        type: 'number',  testWrite: 'CURRENT',     blindWrite: null, category: 'Squelch/NR' },
  { name: 'noise_reduction_enable',   type: 'boolean', testWrite: 'TOGGLE',      blindWrite: null, category: 'Squelch/NR' },
  { name: 'noise_reduction_strength', type: 'number',  testWrite: 'CURRENT',     blindWrite: null, category: 'Squelch/NR' },

  // ---- Spectrum display ----
  { name: 'spectrum_ref_level',       type: 'number',  testWrite: 'CURRENT',     blindWrite: null, category: 'Spectrum' },
  { name: 'spectrum_base',            type: 'number',  testWrite: 'CURRENT',     blindWrite: null, category: 'Spectrum' },

  // ---- FM / RDS ----
  { name: 'wfm_stereo',              type: 'boolean',  testWrite: null,          blindWrite: null, category: 'FM/RDS' },
  { name: 'wfm_stereo_enable',       type: 'boolean',  testWrite: 'TOGGLE',      blindWrite: null, category: 'FM/RDS' },
  { name: 'rds_enable',              type: 'boolean',  testWrite: 'TOGGLE',      blindWrite: null, category: 'FM/RDS' },
  { name: 'rds_ps',                  type: 'string',   testWrite: null,          blindWrite: null, category: 'FM/RDS' },
  { name: 'rds_pi',                  type: 'string',   testWrite: null,          blindWrite: null, category: 'FM/RDS' },
  { name: 'rds_pty',                 type: 'string',   testWrite: null,          blindWrite: null, category: 'FM/RDS' },

  // ---- Bandwidth limits ----
  { name: 'demod_max_bandwidth',      type: 'hz',      testWrite: null,          blindWrite: null, category: 'Bandwidth' },
  { name: 'am_lowcut_frequency',      type: 'hz',      testWrite: 'CURRENT',     blindWrite: null, category: 'Bandwidth' },
  { name: 'ssb_lowcut_frequency',     type: 'hz',      testWrite: 'CURRENT',     blindWrite: null, category: 'Bandwidth' },
  { name: 'nfm_lowcut_frequency',     type: 'hz',      testWrite: 'CURRENT',     blindWrite: null, category: 'Bandwidth' },
  { name: 'nfm_deemphasis_enable',    type: 'boolean', testWrite: 'TOGGLE',      blindWrite: null, category: 'Bandwidth' },

  // ---- Signal (read-only metrics) ----
  { name: 'signal_power',             type: 'number',  testWrite: null,          blindWrite: null, category: 'Signal' },
  { name: 'signal_snr',               type: 'number',  testWrite: null,          blindWrite: null, category: 'Signal' },
  { name: 'can_control',              type: 'boolean', testWrite: null,          blindWrite: null, category: 'Signal' },

  // ---- Device capabilities (from binary strings) ----
  { name: 'can_set_center_frequency',   type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'can_set_sample_rate',         type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'supports_zero_if_mode',       type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'can_set_display_fft_size',    type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'can_set_display_fft_rate',    type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'supports_multiple_vrx',       type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'supports_hdr',               type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'supports_diversity',          type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'supports_full_iq',           type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'have_exclusive_control',      type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'device_max_sample_rate',      type: 'hz',     testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'device_max_center_frequency', type: 'hz',     testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'has_multiple_antennas',       type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'has_bias_t',                 type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'has_rf_notch',               type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'has_dab_notch',              type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },
  { name: 'has_ref_clk_output',         type: 'boolean', testWrite: null, blindWrite: null, category: 'Capabilities' },

  // ---- Hardware settings (from binary strings) ----
  { name: 'device_ppm_correction',       type: 'number',  testWrite: null, blindWrite: '0',     category: 'Hardware' },
  { name: 'device_if_agc_attack',        type: 'number',  testWrite: null, blindWrite: null,    category: 'Hardware' },
  { name: 'device_if_agc_decay',         type: 'number',  testWrite: null, blindWrite: null,    category: 'Hardware' },
  { name: 'device_if_agc_decay_delay',   type: 'number',  testWrite: null, blindWrite: null,    category: 'Hardware' },
  { name: 'device_if_agc_decay_threshold', type: 'number', testWrite: null, blindWrite: null,   category: 'Hardware' },
  { name: 'device_rf_notch_enabled',     type: 'boolean', testWrite: 'TOGGLE', blindWrite: 'true',  category: 'Hardware' },
  { name: 'device_dab_notch_enabled',    type: 'boolean', testWrite: 'TOGGLE', blindWrite: 'true',  category: 'Hardware' },
  { name: 'device_bias_t_enabled',       type: 'boolean', testWrite: 'TOGGLE', blindWrite: 'false', category: 'Hardware' },
  { name: 'device_hdr_mode_enabled',     type: 'boolean', testWrite: 'TOGGLE', blindWrite: 'false', category: 'Hardware' },
  { name: 'device_low_if_enabled',       type: 'boolean', testWrite: null,     blindWrite: null,    category: 'Hardware' },
  { name: 'device_set_point_max',        type: 'number',  testWrite: null,     blindWrite: null,    category: 'Hardware' },

  // ---- FFT display settings ----
  { name: 'display_fft_rate_min',        type: 'number', testWrite: null, blindWrite: null, category: 'FFT' },
  { name: 'display_fft_rate_max',        type: 'number', testWrite: null, blindWrite: null, category: 'FFT' },
  { name: 'display_fft_rate_default',    type: 'number', testWrite: null, blindWrite: null, category: 'FFT' },
];

// ---------------------------------------------------------------------------
// Test result types
// ---------------------------------------------------------------------------

interface PropertyResult {
  property: string;
  category: string;
  readable: boolean;
  readValue: string | null;
  writable: boolean | null;  // null = not tested
  writeTestValue: string | null;
  writeReadback: string | null;
  /** For unreadable properties: did a blind write + readback produce a response? */
  blindWriteValue: string | null;
  blindWriteResponse: string | null;
  error: string | null;
}

interface TestReport {
  timestamp: string;
  wsUrl: string;
  connectTime: number;
  propertiesReceived: string[];
  results: PropertyResult[];
  summary: {
    total: number;
    readable: number;
    notReadable: number;
    writeTested: number;
    writable: number;
    readOnly: number;
    blindWriteTested: number;
    blindWriteResponded: number;
    noResponse: number;
  };
}

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Connection timeout after ${CONNECT_TIMEOUT_MS}ms`));
    }, CONNECT_TIMEOUT_MS);

    const ws = new WebSocket(url, { perMessageDeflate: false });

    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function getProperty(
  ws: WebSocket,
  property: string,
  timeoutMs = GET_TIMEOUT_MS,
): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(null);
    }, timeoutMs);

    function handler(data: WebSocket.Data) {
      try {
        const msg = JSON.parse(String(data));
        if (
          (msg.event_type === 'get_property_response' || msg.event_type === 'property_changed') &&
          msg.property === property
        ) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(msg.value ?? null);
        }
      } catch { /* ignore non-JSON */ }
    }

    ws.on('message', handler);
    ws.send(JSON.stringify({ event_type: 'get_property', property }));
  });
}

/** Listen for any response (property_changed or get_property_response) for a
 *  given property without sending a get_property request. Used to detect if
 *  a set_property triggers an echo. */
function waitForPropertyEcho(
  ws: WebSocket,
  property: string,
  timeoutMs = GET_TIMEOUT_MS,
): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(null);
    }, timeoutMs);

    function handler(data: WebSocket.Data) {
      try {
        const msg = JSON.parse(String(data));
        if (
          (msg.event_type === 'get_property_response' || msg.event_type === 'property_changed') &&
          msg.property === property
        ) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(msg.value ?? null);
        }
      } catch { /* ignore non-JSON */ }
    }

    ws.on('message', handler);
  });
}

function setProperty(ws: WebSocket, property: string, value: string): void {
  ws.send(JSON.stringify({ event_type: 'set_property', property, value }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Compute test write value based on the directive and current value
// ---------------------------------------------------------------------------

function computeWriteValue(directive: string, currentValue: string | null): string | null {
  if (currentValue === null) return null;

  switch (directive) {
    case 'TOGGLE': {
      const isTruthy = currentValue === 'true' || currentValue === '1';
      return isTruthy ? 'false' : 'true';
    }
    case 'CURRENT':
      return currentValue;
    case 'CURRENT+1': {
      const num = parseInt(currentValue);
      if (isNaN(num)) return null;
      return String(num + 1);
    }
    default:
      return directive;
  }
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------

async function run() {
  const startTime = Date.now();

  console.log('='.repeat(70));
  console.log('  SDRconnect WebSocket Property Test');
  console.log('='.repeat(70));
  console.log(`Target:    ${WS_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log();

  // Connect
  console.log('Connecting...');
  let ws: WebSocket;
  try {
    ws = await connectWs(WS_URL);
  } catch (err) {
    console.error(`FAILED to connect: ${err}`);
    process.exit(1);
  }
  const connectTime = Date.now() - startTime;
  console.log(`Connected in ${connectTime}ms`);
  console.log();

  // Collect any spontaneous property_changed messages for 2s to capture
  // the initial property dump SDRconnect sends on connect.
  const receivedProps = new Map<string, string>();
  const collector = (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(String(data));
      if (
        (msg.event_type === 'property_changed' || msg.event_type === 'get_property_response') &&
        msg.property
      ) {
        receivedProps.set(msg.property, msg.value ?? '');
      }
    } catch { /* ignore */ }
  };
  ws.on('message', collector);
  console.log('Waiting 2s for initial property dump...');
  await sleep(2000);
  ws.removeListener('message', collector);

  if (receivedProps.size > 0) {
    console.log(`Received ${receivedProps.size} properties spontaneously:`);
    for (const [k, v] of [...receivedProps.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${k} = ${v}`);
    }
  } else {
    console.log('No spontaneous properties received (may need device selection).');
  }
  console.log();

  // Test each property
  const results: PropertyResult[] = [];
  const total = PROPERTIES.length;

  for (let i = 0; i < PROPERTIES.length; i++) {
    const def = PROPERTIES[i];
    const progress = `[${i + 1}/${total}]`;
    process.stdout.write(`${progress} Testing ${def.name}...`);

    const result: PropertyResult = {
      property: def.name,
      category: def.category,
      readable: false,
      readValue: null,
      writable: null,
      writeTestValue: null,
      writeReadback: null,
      blindWriteValue: null,
      blindWriteResponse: null,
      error: null,
    };

    // Phase 1: Read
    try {
      // Use spontaneously received value if available, otherwise query
      let value = receivedProps.get(def.name) ?? null;
      if (value === null) {
        value = await getProperty(ws, def.name);
      }

      if (value !== null) {
        result.readable = true;
        result.readValue = value;
      }
    } catch (err) {
      result.error = `Read error: ${err}`;
    }

    // Phase 2: Write test (for readable properties with testWrite)
    if (def.testWrite !== null && result.readable && result.readValue !== null) {
      const writeVal = computeWriteValue(def.testWrite, result.readValue);
      if (writeVal !== null) {
        result.writeTestValue = writeVal;
        try {
          setProperty(ws, def.name, writeVal);
          await sleep(SET_VERIFY_MS);
          const readback = await getProperty(ws, def.name);

          if (readback !== null) {
            result.writeReadback = readback;
            // Any response means the property is writable (server may adjust values)
            result.writable = true;

            // Restore original value if we changed it
            if (writeVal !== result.readValue) {
              setProperty(ws, def.name, result.readValue);
              await sleep(500);
            }
          } else {
            result.writable = false;
            result.writeReadback = null;
          }
        } catch (err) {
          result.error = `Write error: ${err}`;
          result.writable = false;
        }
      }
    }

    // Phase 3: Blind write (for unreadable properties with blindWrite)
    // Send a set_property, then try get_property to see if it wakes up
    if (!result.readable && def.blindWrite !== null) {
      result.blindWriteValue = def.blindWrite;
      try {
        // Send the blind write, then listen for any echo
        const echoPromise = waitForPropertyEcho(ws, def.name, GET_TIMEOUT_MS);
        setProperty(ws, def.name, def.blindWrite);

        // Check if the set triggered a property_changed echo
        const echo = await echoPromise;
        if (echo !== null) {
          result.blindWriteResponse = echo;
        } else {
          // No echo from set_property. Try an explicit get_property.
          await sleep(500);
          const readback = await getProperty(ws, def.name);
          if (readback !== null) {
            result.blindWriteResponse = readback;
          }
        }
      } catch (err) {
        result.error = `Blind write error: ${err}`;
      }
    }

    // Status line
    const readStatus = result.readable ? `R=${result.readValue}` : 'NO READ';
    let writeStatus = '';
    if (result.writable === true) writeStatus = ' | WRITABLE';
    else if (result.writable === false) writeStatus = ' | NOT WRITABLE';
    else if (def.testWrite === null && def.blindWrite === null) writeStatus = ' | (skip write)';

    let blindStatus = '';
    if (result.blindWriteValue !== null) {
      blindStatus = result.blindWriteResponse !== null
        ? ` | BLIND WRITE: sent=${result.blindWriteValue}, got=${result.blindWriteResponse}`
        : ` | BLIND WRITE: sent=${result.blindWriteValue}, no response`;
    }

    console.log(` ${readStatus}${writeStatus}${blindStatus}`);

    results.push(result);
  }

  // Close connection
  ws.close();

  // Build summary
  const summary = {
    total: results.length,
    readable: results.filter(r => r.readable).length,
    notReadable: results.filter(r => !r.readable).length,
    writeTested: results.filter(r => r.writable !== null).length,
    writable: results.filter(r => r.writable === true).length,
    readOnly: results.filter(r => r.writable === false).length,
    blindWriteTested: results.filter(r => r.blindWriteValue !== null).length,
    blindWriteResponded: results.filter(r => r.blindWriteResponse !== null).length,
    noResponse: results.filter(r => !r.readable && r.blindWriteResponse === null).length,
  };

  // Print report
  console.log();
  console.log('='.repeat(70));
  console.log('  RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log(`Total properties tested:   ${summary.total}`);
  console.log(`Readable:                  ${summary.readable}`);
  console.log(`Not readable:              ${summary.notReadable}`);
  console.log(`Write tested:              ${summary.writeTested}`);
  console.log(`Writable (confirmed):      ${summary.writable}`);
  console.log(`Not writable (confirmed):  ${summary.readOnly}`);
  console.log(`Blind write tested:        ${summary.blindWriteTested}`);
  console.log(`Blind write got response:  ${summary.blindWriteResponded}`);
  console.log();

  // Group by category
  const categories = new Map<string, PropertyResult[]>();
  for (const r of results) {
    if (!categories.has(r.category)) categories.set(r.category, []);
    categories.get(r.category)!.push(r);
  }

  for (const [cat, props] of categories) {
    console.log(`--- ${cat} ---`);
    for (const r of props) {
      const icon = r.readable
        ? (r.writable === true ? 'RW' : r.writable === false ? 'R ' : 'R ')
        : (r.blindWriteResponse !== null ? 'BW' : '  ');
      const val = r.readValue !== null ? ` = ${r.readValue}` : '';
      let notes = '';
      if (r.writable === true) notes = ' [WRITABLE]';
      else if (r.writable === false) notes = ' [NOT WRITABLE]';
      if (r.blindWriteResponse !== null) notes += ` [BLIND: sent=${r.blindWriteValue}, got=${r.blindWriteResponse}]`;
      else if (r.blindWriteValue !== null) notes += ' [BLIND: no response]';
      console.log(`  [${icon}] ${r.property}${val}${notes}`);
    }
    console.log();
  }

  // Feature request candidates
  const featureRequests = results.filter(r =>
    (r.writable === false) ||
    (!r.readable && r.blindWriteValue !== null && r.blindWriteResponse === null)
  );
  if (featureRequests.length > 0) {
    console.log('='.repeat(70));
    console.log('  FEATURE REQUEST CANDIDATES');
    console.log('  (Properties that should be writable/readable but are not)');
    console.log('='.repeat(70));
    console.log();
    for (const r of featureRequests) {
      console.log(`  - ${r.property}`);
      if (r.readValue !== null) console.log(`    Read value: ${r.readValue}`);
      if (r.writeTestValue !== null) {
        console.log(`    Attempted write: ${r.writeTestValue}`);
        console.log(`    Readback: ${r.writeReadback ?? 'no response'}`);
      }
      if (r.blindWriteValue !== null) {
        console.log(`    Blind write: ${r.blindWriteValue}`);
        console.log(`    Response: ${r.blindWriteResponse ?? 'no response'}`);
      }
      console.log();
    }
  }

  // Blind write discoveries
  const blindDiscoveries = results.filter(r => r.blindWriteResponse !== null);
  if (blindDiscoveries.length > 0) {
    console.log('='.repeat(70));
    console.log('  BLIND WRITE DISCOVERIES');
    console.log('  (Previously unreadable properties that responded after a write)');
    console.log('='.repeat(70));
    console.log();
    for (const r of blindDiscoveries) {
      console.log(`  - ${r.property}: sent=${r.blindWriteValue}, got=${r.blindWriteResponse}`);
    }
    console.log();
  }

  // Working writable properties
  const writableProps = results.filter(r => r.writable === true);
  if (writableProps.length > 0) {
    console.log('='.repeat(70));
    console.log('  CONFIRMED WRITABLE (safe to implement in UI)');
    console.log('='.repeat(70));
    console.log();
    for (const r of writableProps) {
      console.log(`  - ${r.property} (current: ${r.readValue})`);
    }
    console.log();
  }

  // Save JSON report
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    wsUrl: WS_URL,
    connectTime,
    propertiesReceived: [...receivedProps.keys()].sort(),
    results,
    summary,
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const reportPath = resolve(__dirname, '..', 'sdr-property-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Full report saved to: ${reportPath}`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
