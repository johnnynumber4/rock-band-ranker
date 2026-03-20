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
      className={`
        flex items-center justify-between
        bg-spotify-gray border-2 border-spotify-gray
        rounded-lg p-3 sm:p-4 mb-1 sm:mb-2
        hover:border-spotify-green
        active:border-spotify-green
        active:bg-spotify-green/10
        transition-all
        select-none
        ${isDragging ? 'opacity-50 scale-105 shadow-2xl z-50' : ''}
      `}
    >
      {/* Drag handle - only this area triggers drag on touch */}
      <div
        className="flex items-center gap-2 sm:gap-3 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 p-1"
        {...attributes}
        {...listeners}
      >
        <div className="flex flex-col gap-0.5 opacity-50">
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
            <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
          </div>
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
            <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
          </div>
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
            <div className="w-1 h-1 bg-spotify-light-gray rounded-full"></div>
          </div>
        </div>

        <span className="text-base sm:text-2xl font-bold text-spotify-light-gray w-7 sm:w-12 text-right">
          {position}
        </span>
      </div>

      <div className="flex items-center flex-1 min-w-0 ml-2 sm:ml-3">
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
