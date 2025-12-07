'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  name: string;
  position: number;
  score?: number;
}

function SortableItem({ id, name, position, score }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex items-center justify-between
        bg-spotify-gray border-2 border-spotify-gray
        rounded-lg p-4 sm:p-4 mb-2
        cursor-grab active:cursor-grabbing
        hover:border-spotify-green
        active:border-spotify-green
        active:bg-spotify-green/10
        touch-none
        transition-all
        min-h-[60px] sm:min-h-[auto]
        ${isDragging ? 'opacity-50 scale-105 shadow-2xl z-50' : ''}
      `}
    >
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
        {/* Drag Handle Visual Indicator */}
        <div className="flex flex-col gap-1 opacity-50 flex-shrink-0">
          <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
          <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
          <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
        </div>

        <span className="text-lg sm:text-2xl font-bold text-spotify-light-gray w-8 sm:w-12 text-right flex-shrink-0">
          {position}
        </span>
        <span className="text-sm sm:text-lg font-medium text-white truncate">{name}</span>
      </div>
      {score !== undefined && (
        <span className="text-xs sm:text-sm text-spotify-light-gray font-mono flex-shrink-0 ml-2">
          {score} pts
        </span>
      )}
    </div>
  );
}

export default SortableItem;
