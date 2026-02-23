interface SignalMeterProps {
  power: number | null;
  snr: number | null;
}

export default function SignalMeter({ power, snr }: SignalMeterProps) {
  if (power === null && snr === null) {
    return <span className="text-slate-500 text-xs">No signal</span>;
  }

  const getColor = (dbm: number) => {
    if (dbm > -50) return 'bg-green-500';
    if (dbm > -80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Normalize power to 0-100 for bar width (-120 dBm = 0%, -20 dBm = 100%)
  const barWidth = power !== null ? Math.max(0, Math.min(100, ((power + 120) / 100) * 100)) : 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${power !== null ? getColor(power) : 'bg-slate-600'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="text-slate-400 font-mono whitespace-nowrap">
        {power !== null ? `${power.toFixed(0)} dBm` : '--'}
        {snr !== null ? ` | SNR ${snr.toFixed(0)} dB` : ''}
      </span>
    </div>
  );
}
