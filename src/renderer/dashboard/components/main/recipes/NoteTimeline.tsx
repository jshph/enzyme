import React, { useMemo } from 'react';

interface TimelineItem {
  date: Date;
  type: 'tag' | 'link';
  name: string;
}

interface NoteTimelineProps {
  timelineData: TimelineItem[];
}

const NoteTimeline: React.FC<NoteTimelineProps> = ({ timelineData }) => {
  // Calculate date ranges for the last 3 months
  const dateRanges = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 3 }, (_, i) => {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      return {
        label: date.toLocaleString('default', { month: 'short' }),
        start: new Date(date.getFullYear(), date.getMonth(), 1),
        end: new Date(date.getFullYear(), date.getMonth() + 1, 0)
      };
    }).reverse();
    return months;
  }, []);

  // Group timeline items by entity
  const groupedItems = useMemo(() => {
    const groups = new Map<string, TimelineItem[]>();
    timelineData.forEach(item => {
      const key = `${item.type}-${item.name}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    });
    return groups;
  }, [timelineData]);

  if (timelineData.length === 0) {
    return null;
  }

  const timelineWidth = 'calc(100% - 4rem)';
  const dotSize = 6;

  return (
    <div className="mt-6 space-y-2">
      <div className="relative h-20 pl-8">
        {/* Timeline dots */}
        <div 
          className="absolute left-8 right-4 h-12 top-0"
          style={{ width: timelineWidth }}
        >
          {/* Timeline base line */}
          <div className="absolute w-full h-px bg-primary/20 top-1/2 transform -translate-y-1/2" />
          
          {timelineData.map((item, idx) => {
            // Calculate position based on date
            const itemDate = item.date.getTime();
            const timelineStart = dateRanges[0].start.getTime();
            const timelineEnd = dateRanges[dateRanges.length - 1].end.getTime();
            const position = ((itemDate - timelineStart) / (timelineEnd - timelineStart)) * 100;

            // Get count for this entity
            const groupKey = `${item.type}-${item.name}`;
            const entityCount = groupedItems.get(groupKey)?.length || 0;

            return (
              <div
                key={`${item.name}-${idx}`}
                className={`absolute w-${dotSize} h-${dotSize} rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer
                  ${item.type === 'tag' ? 'bg-brand/60' : 'bg-primary/60'}
                  hover:ring-2 hover:ring-brand/30 hover:ring-offset-1`}
                style={{
                  left: `${Math.max(0, Math.min(100, position))}%`,
                  top: '50%',
                  width: dotSize,
                  height: dotSize
                }}
                title={`${item.name} (${entityCount} notes)\n${item.date.toLocaleDateString()}`}
              />
            );
          })}
        </div>

        {/* Month labels - now below the timeline */}
        <div className="absolute left-8 right-4 bottom-8 flex justify-between">
          {dateRanges.map((month, idx) => (
            <div 
              key={month.label}
              className="flex flex-col items-center"
              style={{ 
                position: 'absolute',
                left: `${(idx * 100) / 3}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <span className="text-xs text-primary/30">{month.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NoteTimeline; 