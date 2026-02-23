import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppConfig } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '../../../data/config.json');

function getDefaults(): AppConfig {
  return {
    sdrconnect_host: process.env.SDRCONNECT_HOST || '127.0.0.1',
    sdrconnect_port: parseInt(process.env.SDRCONNECT_PORT || '5454', 10),
    default_demod: 'AM',
    default_bandwidth: 7500,
    time_format: 'utc',
    theme: 'dark',
    auto_play_audio: false,
    nrspst_ip: '',
    signal_check_dwell_seconds: 2,
  };
}

export function loadConfig(): AppConfig {
  const defaults = getDefaults();
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

function saveConfig(config: AppConfig) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(loadConfig());
});

router.put('/', (req: Request, res: Response) => {
  const current = loadConfig();
  const updated = { ...current, ...req.body };
  saveConfig(updated);
  res.json(updated);
});

export default router;
