import { BandCondition } from '../../shared/types';

interface BandBadgeProps {
  condition: BandCondition;
}

const BADGE_CONFIG: Record<BandCondition, { dotColor: string; label: string; textColor: string }> = {
  good: { dotColor: 'bg-green-500', label: 'Good', textColor: 'text-green-400' },
  fair: { dotColor: 'bg-yellow-500', label: 'Fair', textColor: 'text-yellow-400' },
  poor: { dotColor: 'bg-red-500', label: 'Poor', textColor: 'text-red-400' },
  unknown: { dotColor: 'bg-slate-500', label: '?', textColor: 'text-slate-500' },
};

export default function BandBadge({ condition }: BandBadgeProps) {
  const { dotColor, label, textColor } = BADGE_CONFIG[condition];

  return (
    <span className="inline-flex items-center gap-1" title={`Band condition: ${label}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      <span className={`text-[10px] font-medium ${textColor} hidden sm:inline`}>
        {label}
      </span>
    </span>
  );
}
