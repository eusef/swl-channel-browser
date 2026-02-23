import { useEffect } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, onDismiss, duration]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div
        className="bg-slate-700 border border-slate-600 text-slate-200 text-sm px-4 py-2.5 rounded-lg shadow-lg max-w-[90vw] text-center"
        onClick={onDismiss}
      >
        {message}
      </div>
    </div>
  );
}
