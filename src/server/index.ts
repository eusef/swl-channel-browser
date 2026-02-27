import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket as WS } from 'ws';
import scheduleRouter, { getFiltersRouter } from './routes/schedule.js';
import configRouter, { loadConfig } from './routes/config.js';
import favoritesRouter from './routes/favorites.js';
import listsRouter from './routes/lists.js';
import logRouter from './routes/log.js';
import propagationRouter from './routes/propagation.js';
import { parseEibiCsv } from './services/eibi-parser.js';
import { fetchEibiCsv, getCachedCsv } from './services/eibi-fetcher.js';
import { loadBroadcasts } from './services/schedule-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/schedule', scheduleRouter);
app.use('/api/filters', getFiltersRouter());
app.use('/api/config', configRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/lists', listsRouter);
app.use('/api/log', logRouter);
app.use('/api/propagation', propagationRouter);

// Serve static files in production
const clientDist = path.resolve(__dirname, '../client');

// Service worker must not be cached by the browser
app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(clientDist, 'sw.js'));
});

app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Client build not found. If running npm run dev, open http://localhost:5173 instead. For production, run npm run build first, then npm start.' });
  }
});

async function bootstrap() {
  // Try loading schedule data
  const url = process.env.EIBI_CSV_URL || 'http://www.eibispace.de/dx/sked-b25.csv';
  const maxAge = (parseInt(process.env.EIBI_REFRESH_HOURS || '168', 10)) * 60 * 60 * 1000;

  // First try local research CSV if available
  const researchCsvPath = path.resolve(__dirname, '../../../research/sked-b25.csv');
  let csv: string | null = null;

  try {
    if (fs.existsSync(researchCsvPath)) {
      csv = fs.readFileSync(researchCsvPath, 'utf-8');
      console.log(`Loaded EiBi CSV from research directory`);
    }
  } catch {
    // ignore
  }

  if (!csv) {
    // Try cached
    csv = getCachedCsv();
    if (csv) {
      console.log('Loaded EiBi CSV from cache');
    }
  }

  if (!csv) {
    // Try fetching
    try {
      csv = await fetchEibiCsv(url, maxAge);
    } catch (err) {
      console.error('Failed to fetch EiBi CSV:', err);
      console.log('Starting with empty schedule. Use POST /api/schedule/refresh to load data.');
    }
  }

  if (csv) {
    const broadcasts = parseEibiCsv(csv);
    loadBroadcasts(broadcasts);
  }

  // Create HTTP server and attach WebSocket proxy
  const server = http.createServer(app);

  // WebSocket proxy: /ws/sdr → SDRconnect
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws/sdr') {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs) => {
    // Read SDRconnect host/port from config each time (supports live config changes)
    const config = loadConfig();
    const sdrHost = config.sdrconnect_host;
    const sdrPort = config.sdrconnect_port;
    const sdrUrl = `ws://${sdrHost}:${sdrPort}/`;
    console.log(`[WS Proxy] Client connected, proxying to ${sdrUrl}`);

    const sdrWs = new WS(sdrUrl);

    sdrWs.on('open', () => {
      console.log('[WS Proxy] Connected to SDRconnect');

      // Forward client → SDRconnect
      clientWs.on('message', (data, isBinary) => {
        if (sdrWs.readyState === WS.OPEN) {
          sdrWs.send(data, { binary: isBinary });
        }
      });

      // Forward SDRconnect → client
      sdrWs.on('message', (data, isBinary) => {
        if (clientWs.readyState === WS.OPEN) {
          clientWs.send(data as Buffer, { binary: isBinary });
        }
      });
    });

    sdrWs.on('close', () => {
      console.log('[WS Proxy] SDRconnect closed');
      clientWs.close();
    });

    sdrWs.on('error', (err) => {
      console.error('[WS Proxy] SDRconnect error:', err.message);
      clientWs.close();
    });

    clientWs.on('close', () => {
      sdrWs.close();
    });

    clientWs.on('error', () => {
      sdrWs.close();
    });
  });

  server.listen(PORT, () => {
    const config = loadConfig();
    console.log(`SWL Channel Browser backend running on http://localhost:${PORT}`);
    console.log(`WebSocket proxy: /ws/sdr → ws://${config.sdrconnect_host}:${config.sdrconnect_port}/`);
  });
}

bootstrap().catch(console.error);
