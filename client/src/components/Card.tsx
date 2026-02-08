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
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-28 h-40 xs:w-32 xs:h-44 p-2 xs:p-3',
  md: 'w-32 h-44 xs:w-36 xs:h-52 sm:w-40 sm:h-56 p-3 sm:p-4',
  lg: 'w-40 h-56 xs:w-48 xs:h-64 md:w-64 md:h-80 p-4 md:p-6',
};

const textSizeClasses = {
  sm: 'text-sm xs:text-base leading-tight',
  md: 'text-base xs:text-lg leading-tight',
  lg: 'text-lg xs:text-xl md:text-2xl leading-tight',
};

const labelSizeClasses = {
  sm: 'text-[10px] xs:text-xs',
  md: 'text-xs',
  lg: 'text-xs md:text-sm',
};

export const Card: React.FC<CardProps> = ({
  card,
  isBlack = false,
  isSelected = false,
  onClick,
  className,
  disabled = false,
  hidden = false,
  size = 'md'
}) => {
  if (hidden) {
     return (
      <div
        className={clsx(
          "relative rounded-xl shadow-md flex flex-col justify-between select-none transition-transform",
          "bg-gray-800 border-2 border-gray-700",
          sizeClasses[size],
          className
        )}
      >
        <div className="text-white font-bold text-xl opacity-20 rotate-45 self-center mt-12 xs:mt-16 sm:mt-20">
          CAH
        </div>
      </div>
     );
  }

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={clsx(
        "relative rounded-xl shadow-md flex flex-col justify-between select-none transition-all duration-200",
        sizeClasses[size],
        isBlack ? "bg-black text-white" : "bg-white text-black border border-gray-200",
        isSelected && "ring-4 ring-yellow-400 -translate-y-3 xs:-translate-y-4 scale-105 z-10",
        !disabled && onClick && "cursor-pointer hover:-translate-y-2 hover:shadow-xl active:scale-95",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className={clsx("font-cah font-bold break-words", textSizeClasses[size])}>
        {card?.text}
      </div>

      <div className={clsx(
        "flex items-center gap-1 xs:gap-2 font-bold uppercase tracking-wider opacity-80",
        labelSizeClasses[size]
      )}>
        {isBlack && (
            <span className="bg-white text-black rounded-full w-4 h-4 xs:w-5 xs:h-5 flex items-center justify-center text-[10px] xs:text-xs">
             {(card as BlackCard).pick || 1}
            </span>
        )}
        <span className="truncate">Cards Against Humanity</span>
      </div>
    </div>
  );
};
