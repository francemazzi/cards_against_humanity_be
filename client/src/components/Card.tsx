import clsx from 'clsx';
import type { BlackCard, WhiteCard } from '../types';

interface CardProps {
  card?: WhiteCard | BlackCard;
  isBlack?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  card, 
  isBlack = false, 
  isSelected = false, 
  onClick, 
  className,
  disabled = false,
  hidden = false
}) => {
  if (hidden) {
     return (
      <div 
        className={clsx(
          "relative w-40 h-56 rounded-xl shadow-md p-4 flex flex-col justify-between select-none transition-transform",
          "bg-gray-800 border-2 border-gray-700",
          className
        )}
      >
        <div className="text-white font-bold text-xl opacity-20 rotate-45 self-center mt-20">
          CAH
        </div>
      </div>
     );
  }

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={clsx(
        "relative w-40 h-56 rounded-xl shadow-md p-4 flex flex-col justify-between select-none transition-all duration-200",
        isBlack ? "bg-black text-white" : "bg-white text-black border border-gray-200",
        isSelected && "ring-4 ring-yellow-400 -translate-y-4 scale-105 z-10",
        !disabled && onClick && "cursor-pointer hover:-translate-y-2 hover:shadow-xl",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="font-cah font-bold text-lg leading-tight break-words">
        {card?.text}
      </div>
      
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
        {isBlack && (
            <span className="bg-white text-black rounded-full w-4 h-4 flex items-center justify-center">
             {(card as BlackCard).pick || 1}
            </span>
        )}
        <span>Cards Against Humanity</span>
      </div>
    </div>
  );
};

