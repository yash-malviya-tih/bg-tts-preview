import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, createCoordinates } from '@vnedyalk0v/react19-simple-maps';
import { geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import { BharatGenVoice, getAccentDisplayName } from '../../types';
import indiaTopology from '../../data/india-states.json';

interface IndiaAccentMapProps {
  accents: BharatGenVoice[];
  activeStateIds: Set<string>;
  selectedAccentId: string | null;
  hoveredAccentId: string | null;
  onAccentHover: (id: string | null) => void;
  onAccentClick: (id: string) => void;
}

// Passed in as a parsed object (not a URL) so the map library never has to fetch it —
// its built-in security hardening rejects geography URLs over plain HTTP, which local dev is.

// Teardrop pin, anchored at its tip (0,0) — that point is what actually sits on the
// projected coordinate; the head extends upward from there.
const PIN_HEAD_CY = -10;
const FALLBACK_SIZE = { width: 380, height: 430 };
const FIT_PADDING = 16;

const indiaFeatures = (feature(indiaTopology as any, (indiaTopology as any).objects.india) as any).features.filter(
  (f: any) => String(f.id) !== '-99'
);
const indiaFeatureCollection = { type: 'FeatureCollection' as const, features: indiaFeatures };

const IndiaAccentMap: React.FC<IndiaAccentMapProps> = ({
  accents,
  activeStateIds,
  selectedAccentId,
  hoveredAccentId,
  onAccentHover,
  onAccentClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const hoveredAccent = accents.find((accent) => accent.id === hoveredAccentId) || null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setSize({ width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit the projection to the map's actual on-screen size every time it changes, so the
  // whole country is always visible with no clipping — no hand-tuned scale/center needed.
  const projection = useMemo(() => {
    return geoMercator().fitExtent(
      [
        [FIT_PADDING, FIT_PADDING],
        [size.width - FIT_PADDING, size.height - FIT_PADDING],
      ],
      indiaFeatureCollection as any
    );
  }, [size.width, size.height]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center"
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <ComposableMap
        projection={projection}
        width={size.width}
        height={size.height}
        className="w-full h-full"
      >
        <Geographies geography={indiaTopology as any}>
          {({ geographies }: { geographies: any[] }) =>
            geographies
              .filter((geo) => String(geo.id) !== '-99')
              .map((geo) => {
                const isActive = activeStateIds.has(String(geo.id));
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    className={`transition-colors duration-300 outline-none [stroke-width:0.5px] ${
                      isActive
                        ? 'fill-[rgb(var(--brand-blue)/0.22)] stroke-[rgb(var(--brand-blue)/0.5)]'
                        : 'fill-slate-100 stroke-slate-300'
                    }`}
                  />
                );
              })
          }
        </Geographies>

        {accents.map((accent) => {
          const isSelected = accent.id === selectedAccentId;
          const isHovered = accent.id === hoveredAccentId;
          return (
            <Marker
              key={accent.id}
              coordinates={createCoordinates(accent.coordinates[0], accent.coordinates[1])}
              onMouseEnter={() => onAccentHover(accent.id)}
              onMouseLeave={() => onAccentHover(null)}
              onClick={() => onAccentClick(accent.id)}
            >
              <g
                className={`cursor-pointer transition-transform duration-200 ease-out ${
                  isSelected ? 'scale-150' : isHovered ? 'scale-110' : 'scale-100'
                }`}
              >
                <path
                  d="M0,0 C-1,-3 -6,-8 -6,-10 a6,6 0 1 1 12,0 c0,2 -5,7 -6,10 Z"
                  strokeWidth={1.25}
                  className={`stroke-white ${
                    isSelected
                      ? 'fill-[rgb(var(--brand-orange))] drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]'
                      : 'fill-[rgb(var(--brand-blue))]'
                  }`}
                />
                <circle cx={0} cy={PIN_HEAD_CY} r={2} className="fill-white" />
              </g>
            </Marker>
          );
        })}
      </ComposableMap>

      {hoveredAccent && mousePos && (
        <div
          className="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-white text-xs shadow-lg whitespace-nowrap"
          style={{
            left: Math.min(mousePos.x + 14, Math.max(0, size.width - 160)),
            top: Math.max(0, mousePos.y - 8),
          }}
        >
          <div className="font-semibold">{getAccentDisplayName(hoveredAccent)}</div>
          <div className="text-[10px] text-slate-300">{hoveredAccent.district}, {hoveredAccent.state}</div>
        </div>
      )}
    </div>
  );
};

export default IndiaAccentMap;
