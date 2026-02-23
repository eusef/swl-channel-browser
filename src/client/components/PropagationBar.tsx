import { useState } from 'react';
import { PropagationData } from '../../shared/types';

interface PropagationBarProps {
  propagation: PropagationData | null;
  loading: boolean;
}

interface PropInfo {
  label: string;
  short: string;
  detail: string;
  color: string;
}

function kpInfo(kp: number): PropInfo {
  if (kp <= 2)
    return {
      label: 'Quiet',
      short: 'Stable',
      detail: 'Quiet geomagnetic field — stable, good for listening',
      color: 'text-green-400',
    };
  if (kp <= 4)
    return {
      label: 'Unsettled',
      short: 'Some fading',
      detail: 'Unsettled conditions — some signal fading possible',
      color: 'text-yellow-400',
    };
  if (kp <= 5)
    return {
      label: 'Storm',
      short: 'Disrupted',
      detail: 'Geomagnetic storm — significant signal disruption',
      color: 'text-orange-400',
    };
  return {
    label: 'Severe',
    short: 'Major disruption',
    detail: 'Severe storm — major disruption, lower bands may still work',
    color: 'text-red-400',
  };
}

function sfiInfo(sfi: number): PropInfo {
  if (sfi >= 150)
    return {
      label: 'Excellent',
      short: 'All bands active',
      detail: 'Excellent solar activity — all HF bands well-supported',
      color: 'text-green-400',
    };
  if (sfi >= 100)
    return {
      label: 'Good',
      short: 'Most bands usable',
      detail: 'Good solar activity — most shortwave bands usable',
      color: 'text-emerald-400',
    };
  if (sfi >= 70)
    return {
      label: 'Fair',
      short: 'Best below 15 MHz',
      detail: 'Fair solar activity — lower bands work best, higher bands may be weak',
      color: 'text-yellow-400',
    };
  return {
    label: 'Poor',
    short: 'Lower bands only',
    detail: 'Poor solar activity — only lower frequency bands are reliable',
    color: 'text-red-400',
  };
}

export default function PropagationBar({ propagation, loading }: PropagationBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading || !propagation) {
    return null;
  }

  const { kp_index, solar_flux } = propagation;
  const kp = kpInfo(kp_index);
  const sfi = sfiInfo(solar_flux);

  return (
    <div
      className="bg-slate-800/60 border-b border-slate-700/50 px-4 cursor-pointer select-none transition-all duration-200"
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Collapsed: single compact row */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs py-1">
        <span className="text-slate-400">
          SFI:{' '}
          <span className="text-slate-200 font-medium">{solar_flux}</span>
          <span className={`ml-1 ${sfi.color}`}>{sfi.label}</span>
          <span className="text-slate-500 mx-1 hidden sm:inline">·</span>
          <span className="text-slate-500 hidden sm:inline">{sfi.short}</span>
        </span>

        <span className="text-slate-600">|</span>

        <span className="text-slate-400">
          Kp:{' '}
          <span className={`font-medium ${kp.color}`}>{kp_index}</span>
          <span className={`ml-1 ${kp.color}`}>{kp.label}</span>
          <span className="text-slate-500 mx-1 hidden sm:inline">·</span>
          <span className="text-slate-500 hidden sm:inline">{kp.short}</span>
        </span>

        <span className="text-slate-600 text-[10px] ml-1">
          {expanded ? '▴' : '▾'}
        </span>
      </div>

      {/* Expanded: full interpretation */}
      {expanded && (
        <div className="pb-2 pt-0.5 text-xs space-y-1 text-center">
          <p className="text-slate-400">
            <span className={`font-medium ${sfi.color}`}>SFI {solar_flux}</span>
            <span className="text-slate-500"> — {sfi.detail}</span>
          </p>
          <p className="text-slate-400">
            <span className={`font-medium ${kp.color}`}>Kp {kp_index}</span>
            <span className="text-slate-500"> — {kp.detail}</span>
          </p>
          <p className="text-slate-600 text-[10px] pt-1">
            Source:{' '}
            <a
              href="https://www.swpc.noaa.gov/communities/radio-communications"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              NOAA Space Weather Prediction Center
            </a>
            {propagation.updated_at && (
              <span>
                {' · Updated '}
                {new Date(propagation.updated_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
