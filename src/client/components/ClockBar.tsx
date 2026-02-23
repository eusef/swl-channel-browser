import { useState, useEffect } from 'react';
import { ConnectionStatus } from '../hooks/useWebSocket';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface ClockBarProps {
  connectionStatus: ConnectionStatus;
}

export default function ClockBar({ connectionStatus }: ClockBarProps) {
  const [time, setTime] = useState({ utc: '', local: '' });
  const isOnline = useOnlineStatus();

  useEffect(() => {
    function update() {
      const now = new Date();
      const utc = now.toISOString().substring(11, 16);
      const local = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTime({ utc, local });
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = {
    connected: 'bg-green-500',
    disconnected: 'bg-red-500',
    connecting: 'bg-yellow-500',
  }[connectionStatus];

  const statusText = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
  }[connectionStatus];

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between min-h-[48px]">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-100 truncate">SWL Browser</h1>
        {!isOnline && (
          <span className="bg-amber-600 text-amber-100 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded shrink-0">
            Offline
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-4 text-sm shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-slate-400 text-xs">{statusText}</span>
        </div>
        <div className="text-slate-300 font-mono text-xs sm:text-sm">
          <span>UTC {time.utc}</span>
          <span className="text-slate-500 mx-1 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">{time.local}</span>
        </div>
      </div>
    </header>
  );
}
