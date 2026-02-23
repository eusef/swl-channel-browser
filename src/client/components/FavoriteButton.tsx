interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

export default function FavoriteButton({ isFavorite, onToggle }: FavoriteButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // Don't trigger row/card tune
        onToggle(e);
      }}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-lg transition-colors shrink-0"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorite ? (
        <span className="text-yellow-400">&#9733;</span>
      ) : (
        <span className="text-slate-600 hover:text-yellow-400">&#9734;</span>
      )}
    </button>
  );
}
