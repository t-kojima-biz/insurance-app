'use client';

import React, { useRef, useState, useEffect } from 'react';

interface ChartContainerProps {
  height: number;
  children: (width: number, height: number) => React.ReactNode;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ height, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w } = entry.contentRect;
      if (w > 0) setSize({ w, h: height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [height]);

  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {size && size.w > 0 ? children(size.w, size.h) : null}
    </div>
  );
};

export default ChartContainer;
