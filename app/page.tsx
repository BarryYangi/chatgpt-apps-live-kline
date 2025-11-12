"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
  useTheme,
} from "./hooks";
import PriceWithDiff from "./components/PriceWithDiff";
import Skeleton from "./components/Skeleton";
import { Expand, Pin } from "lucide-react";

type ToolOutput = {
  // Live kline tool payload
  symbol?: string;
  interval?: string;
  market?: "spot" | "futures";
  chartType?: "candle_solid" | "candle_stroke" | "candle_up_stroke" | "candle_down_stroke" | "ohlc" | "area";
  timezone?: string;
  indicators?: Array<{ name: string; params?: number[]; pane?: "main" | "sub" }>;
  overlays?: Array<{
    name:
      | "horizontalRayLine"
      | "horizontalSegment"
      | "horizontalStraightLine"
      | "verticalRayLine"
      | "verticalSegment"
      | "verticalStraightLine"
      | "rayLine"
      | "segment"
      | "straightLine"
      | "priceLine"
      | "priceChannelLine"
      | "parallelStraightLine"
      | "fibonacciLine"
      | "simpleAnnotation"
      | "simpleTag";
    points: Array<{ timestamp?: number; value?: number }>;
    extendData?: any;
    styles?: Record<string, any>;
    paneId?: string;
    id?: string;
    groupId?: string;
    lock?: boolean;
    visible?: boolean;
    zLevel?: number;
    mode?: 'normal' | 'weak_magnet' | 'strong_magnet';
    modeSensitivity?: number;
  }>;
};

export default function Home() {
  const toolOutput = useWidgetProps<ToolOutput>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();
  const theme = useTheme();

  const symbol = toolOutput?.symbol ? toolOutput.symbol.toUpperCase() : "";
  const interval = toolOutput?.interval ?? "1m";
  const market = toolOutput?.market ?? "futures";
  const chartType = toolOutput?.chartType ?? "candle_solid";
  const timezone = toolOutput?.timezone;
  const indicators = toolOutput?.indicators ?? [];
  const overlays = toolOutput?.overlays ?? [];
  
  const hasToolData = !!toolOutput;

  const [ready, setReady] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const tickerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const baseUrl = useMemo(
    () => (typeof window !== "undefined" ? window.innerBaseUrl : ""),
    []
  );

  const chartHeight = useMemo(() => {
    if (displayMode !== "fullscreen" && displayMode !== "pip") return 420;
    if (typeof maxHeight === "number") return Math.max(200, Math.floor(maxHeight * 0.75));
    return "75vh";
  }, [displayMode, maxHeight]);

  useEffect(() => {
    if (!ready || !chartRef.current) return;
    chartRef.current.resize?.();
  }, [ready, chartHeight]);

  useEffect(() => {
    if (!ready || !chartContainerRef.current) return;
    if (typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver(() => chartRef.current?.resize?.());
    resizeObserver.observe(chartContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!hasToolData) return;
    let disposed = false;
    (async () => {
      if (!chartContainerRef.current) return;
      const { init, dispose } = (await import("klinecharts")) as any;
      if (disposed) return;
      // Dispose previous chart if any
      if (chartRef.current) {
        try {
          dispose(chartRef.current);
        } catch {}
        chartRef.current = null;
      }
      chartRef.current = init(chartContainerRef.current, {
        styles: { 
          candle: { 
            priceMark: { show: true },
            type: chartType as any
          } 
        },
      });
      if (timezone && chartRef.current) {
        chartRef.current.setTimezone(timezone);
      }
      setReady(true);

      return () => {
        try {
          if (chartRef.current) dispose(chartRef.current);
        } catch {}
        chartRef.current = null;
      };
    })();
    return () => {
      disposed = true;
    };
  }, [chartType, timezone, hasToolData]);

  useEffect(() => {
    if (!ready || !chartRef.current || !hasToolData) return;
    chartRef.current.setStyles(theme || 'dark');
  }, [theme, ready, hasToolData]);
  
  // Update chart type when it changes
  useEffect(() => {
    if (!ready || !chartRef.current || !hasToolData) return;
    chartRef.current.setStyles({
      candle: {
        type: chartType as any
      }
    });
  }, [chartType, ready, hasToolData]);

  // Update timezone when it changes
  useEffect(() => {
    if (!ready || !chartRef.current || !hasToolData) return;
    if (timezone) {
      chartRef.current.setTimezone(timezone);
    }
  }, [timezone, ready, hasToolData]);

  // Update indicators when they change
  useEffect(() => {
    if (!ready || !chartRef.current || !hasToolData) return;
    
    // Remove all existing indicators first
    try {
      const allIndicators = chartRef.current.getIndicators();
      if (Array.isArray(allIndicators)) {
        allIndicators.forEach((ind: any) => {
          try {
            if (ind && ind.id) {
              chartRef.current.removeIndicator(ind.id);
            }
          } catch {}
        });
      }
    } catch {}
    
    // Add new indicators with parameters
    if (indicators.length > 0) {
      indicators.forEach((indicator) => {
        try {
          const isMainPane = indicator.pane !== "sub";
          // First parameter: indicator config object with name and calcParams
          const indicatorConfig: any = {
            name: indicator.name,
          };
          if (indicator.params && Array.isArray(indicator.params) && indicator.params.length > 0) {
            indicatorConfig.calcParams = indicator.params;
          }
          
          // Second parameter: whether to replace existing (false = add new)
          // Third parameter: pane options - use fixed pane id to prevent duplicate panes
          const paneOptions = isMainPane 
            ? { id: 'candle_pane' } 
            : { id: `indicator_${indicator.name}_pane` };
          
          chartRef.current.createIndicator(indicatorConfig, true, paneOptions);
        } catch (err) {
          // Silently fail if indicator is invalid
          console.warn('Failed to create indicator:', indicator.name, err);
        }
      });
    }
  }, [indicators, ready, hasToolData]);

  // Helper to apply overlays after data is loaded
  const applyOverlays = () => {
    if (!chartRef.current) return;
    try {
      // Clear existing overlays to avoid duplicates
      chartRef.current.removeOverlay();
    } catch {}

    if (!overlays || overlays.length === 0) return;

    const dl: any[] = (() => {
      try { return chartRef.current.getDataList?.() || []; } catch { return []; }
    })();
    const last = dl[dl.length - 1];
    const prev = dl[dl.length - 2];
    const lastTs: number | undefined = last ? Number(last.timestamp) : undefined;

    overlays.forEach((ov) => {
      try {
        const pts = Array.isArray(ov.points) ? ov.points.slice() : [];

        const ensureTwoDataPoints = () => {
          const a = prev || dl[dl.length - 2];
          const b = last || dl[dl.length - 1];
          return [a, b].filter(Boolean);
        };

        let normalizedPoints: Array<{ timestamp?: number; value?: number }> = [];

        switch (ov.name) {
          case 'priceLine': {
            const v = pts[0]?.value ?? last?.close;
            if (v == null) return;
            normalizedPoints = [{ value: v, timestamp: pts[0]?.timestamp ?? lastTs }];
            break;
          }
          case 'simpleTag': {
            const v = pts[0]?.value ?? last?.close;
            if (v == null) return;
            if (ov.extendData == null) ov.extendData = '';
            normalizedPoints = [{ value: v, timestamp: pts[0]?.timestamp ?? lastTs }];
            break;
          }
          case 'simpleAnnotation': {
            const p0 = pts[0];
            const t = p0?.timestamp ?? lastTs;
            const v = p0?.value ?? last?.close;
            if (t == null || v == null) return;
            if (ov.extendData == null) ov.extendData = '';
            normalizedPoints = [{ timestamp: t, value: v }];
            break;
          }
          case 'horizontalStraightLine': {
            const v = pts[0]?.value ?? last?.close;
            if (v == null) return;
            normalizedPoints = [{ value: v, timestamp: pts[0]?.timestamp ?? lastTs }];
            break;
          }
          case 'horizontalRayLine': {
            const v = (pts[0]?.value ?? last?.close);
            const t = pts[0]?.timestamp ?? lastTs;
            if (v == null || t == null) return;
            normalizedPoints = [{ timestamp: t, value: v }];
            break;
          }
          case 'horizontalSegment': {
            const baseV = pts[0]?.value ?? last?.close;
            if (baseV == null) return;
            const dp = ensureTwoDataPoints();
            const t1 = pts[0]?.timestamp ?? Number(dp[0]?.timestamp ?? lastTs);
            const t2 = pts[1]?.timestamp ?? Number(dp[1]?.timestamp ?? lastTs);
            normalizedPoints = [
              { timestamp: t1, value: baseV },
              { timestamp: t2, value: pts[1]?.value ?? baseV },
            ];
            break;
          }
          case 'verticalStraightLine': {
            const t = pts[0]?.timestamp ?? lastTs;
            if (t == null) return;
            normalizedPoints = [{ timestamp: t, value: pts[0]?.value ?? last?.close }];
            break;
          }
          case 'verticalRayLine': {
            const t = pts[0]?.timestamp ?? lastTs;
            if (t == null) return;
            normalizedPoints = [{ timestamp: t, value: pts[0]?.value ?? last?.close }];
            break;
          }
          case 'verticalSegment': {
            const t = pts[0]?.timestamp ?? pts[1]?.timestamp ?? lastTs;
            let v1 = pts[0]?.value;
            let v2 = pts[1]?.value;
            if (v1 == null || v2 == null) {
              const hi = last?.high;
              const lo = last?.low;
              v1 = v1 ?? hi;
              v2 = v2 ?? lo;
            }
            if (t == null || v1 == null || v2 == null) return;
            normalizedPoints = [
              { timestamp: t, value: v1 },
              { timestamp: t, value: v2 },
            ];
            break;
          }
          case 'rayLine':
          case 'segment':
          case 'straightLine': {
            const dp = ensureTwoDataPoints();
            const p1 = {
              timestamp: pts[0]?.timestamp ?? Number(dp[0]?.timestamp ?? lastTs),
              value: pts[0]?.value ?? (prev?.close ?? last?.close),
            };
            const p2 = {
              timestamp: pts[1]?.timestamp ?? Number(dp[1]?.timestamp ?? lastTs),
              value: pts[1]?.value ?? last?.close,
            };
            if (p1.timestamp == null || p1.value == null || p2.timestamp == null || p2.value == null) return;
            normalizedPoints = [p1, p2];
            break;
          }
          case 'parallelStraightLine':
          case 'priceChannelLine': {
            const dp = ensureTwoDataPoints();
            const p1 = {
              timestamp: pts[0]?.timestamp ?? Number(dp[0]?.timestamp ?? lastTs),
              value: pts[0]?.value ?? (prev?.close ?? last?.close),
            };
            const p2 = {
              timestamp: pts[1]?.timestamp ?? Number(dp[1]?.timestamp ?? lastTs),
              value: pts[1]?.value ?? last?.close,
            };
            let p3v = pts[2]?.value;
            if (p3v == null) {
              const dy = Math.abs((p2.value ?? 0) - (p1.value ?? 0)) || (last?.close ? last.close * 0.005 : 1);
              p3v = (p2.value ?? 0) + dy;
            }
            const p3 = {
              timestamp: pts[2]?.timestamp ?? p2.timestamp,
              value: p3v,
            };
            if (p1.timestamp == null || p2.timestamp == null || p3.timestamp == null || p1.value == null || p2.value == null || p3.value == null) return;
            normalizedPoints = [p1, p2, p3];
            break;
          }
          case 'fibonacciLine': {
            const dp = ensureTwoDataPoints();
            const p1 = {
              timestamp: pts[0]?.timestamp ?? Number(dp[0]?.timestamp ?? lastTs),
              value: pts[0]?.value ?? (prev?.close ?? last?.close),
            };
            const p2 = {
              timestamp: pts[1]?.timestamp ?? Number(dp[1]?.timestamp ?? lastTs),
              value: pts[1]?.value ?? last?.close,
            };
            if (p1.timestamp == null || p1.value == null || p2.timestamp == null || p2.value == null) return;
            normalizedPoints = [p1, p2];
            break;
          }
          default: {
            normalizedPoints = pts.map((p) => ({ timestamp: p.timestamp ?? lastTs, value: p.value ?? last?.close }));
            break;
          }
        }

        const overlayValue: any = {
          name: ov.name,
          id: ov.id,
          groupId: ov.groupId,
          lock: ov.lock,
          visible: ov.visible,
          zLevel: ov.zLevel,
          mode: ov.mode,
          modeSensitivity: ov.modeSensitivity,
          points: normalizedPoints,
          extendData: ov.extendData,
          styles: ov.styles,
        };

        chartRef.current.createOverlay(overlayValue, ov.paneId || 'candle_pane');
      } catch (err) {
        // Skip problematic overlay silently
        // console.warn('Failed to create overlay', ov, err)
      }
    });
  };

  useEffect(() => {
    // Reconnect stream when symbol or interval changes
    if (!ready || !chartRef.current || !hasToolData) return;
    // Close any existing stream
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }
    if (!symbol) return;

    const url = `${baseUrl}/api/kline?symbol=${encodeURIComponent(
      symbol
    )}&interval=${encodeURIComponent(interval)}&market=${encodeURIComponent(
      market
    )}&limit=400`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    let seeded = false;
    setDataReady(false);

    es.addEventListener("init", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        const data = payload?.data || [];
        if (Array.isArray(data) && data.length > 0) {
          if (chartRef.current) {
            chartRef.current.applyNewData(data, true);
            seeded = true;
            setDataReady(true);

            // Setup loadMore after initial data is loaded
            if (chartRef.current && typeof chartRef.current.loadMore === "function") {
              chartRef.current.loadMore((timestamp: number) => {
                // Fetch historical data
                const historyUrl = `${baseUrl}/api/kline/history?symbol=${encodeURIComponent(
                  symbol
                )}&interval=${encodeURIComponent(interval)}&market=${encodeURIComponent(
                  market
                )}&limit=100&endTime=${timestamp}`;
                
                fetch(historyUrl)
                  .then((res) => res.json())
                  .then((result) => {
                    if (chartRef.current && result?.data && Array.isArray(result.data)) {
                      chartRef.current.applyMoreData(result.data, true);
                    }
                  })
                  .catch(() => {
                    // Silently fail
                  });
              });
            }
          } else {
            // Chart not ready yet, but data arrived, mark as ready
            // Data will be applied when chart is ready
            setDataReady(true);
          }
        }
      } catch {}
    });

    es.addEventListener("kline", (e: MessageEvent) => {
      try {
        const k = JSON.parse(e.data);
        if (!k || !seeded) return;
        const closePrice = Number(k.close);
        setCurrentPrice(closePrice);
        if (chartRef.current) {
          chartRef.current.updateData({
            timestamp: Number(k.timestamp),
            open: Number(k.open),
            high: Number(k.high),
            low: Number(k.low),
            close: closePrice,
            volume: Number(k.volume),
          });
        }
      } catch {}
    });

    es.addEventListener("error", () => {
      // Let EventSource auto-retry with backoff; no-op here
    });

    return () => {
      try {
        es.close();
      } catch {}
      eventSourceRef.current = null;
    };
  }, [symbol, interval, market, ready, baseUrl, hasToolData]);

  // Apply overlays once chart and data are ready, or when overlays prop changes
  useEffect(() => {
    if (!ready || !dataReady || !hasToolData) return;
    applyOverlays();
  }, [ready, dataReady, hasToolData, overlays]);

  // Fetch 24hr ticker data
  useEffect(() => {
    if (!symbol || !hasToolData) return;

    const fetchTicker = async () => {
      try {
        const url = `${baseUrl}/api/ticker/24hr?symbol=${encodeURIComponent(
          symbol
        )}&market=${encodeURIComponent(market)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.price) setCurrentPrice(data.price);
          if (data.priceChangePercent !== undefined)
            setPriceChange24h(data.priceChangePercent);
        }
      } catch {}
    };

    fetchTicker();
    tickerIntervalRef.current = setInterval(fetchTicker, 5000);

    return () => {
      if (tickerIntervalRef.current) {
        clearInterval(tickerIntervalRef.current);
        tickerIntervalRef.current = null;
      }
    };
  }, [symbol, market, baseUrl, hasToolData]);

  if (!hasToolData) {
    return (
      <div
        className="font-sans grid items-center justify-items-center p-4"
        style={{
          maxHeight,
          height: displayMode === "fullscreen" ? maxHeight : undefined,
        }}
      >
        <main className="flex flex-col row-start-2 items-center sm:items-start w-full">
          <div className="w-full mb-3">
            <div className="flex-row">
              <Skeleton width="90px" height="20px" className="mb-2" />
              <Skeleton width="180px" height="32px" />
            </div>
          </div>
          <div className="w-full rounded-lg overflow-hidden" style={{ height: chartHeight }}>
            <Skeleton width="100%" height="100%" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="font-sans grid items-center justify-items-center p-4"
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
      }}
    >
      <div className="fixed top-4 right-4 z-50 flex gap-2 items-center">
      {displayMode !== "pip" && (
        <button
          aria-label="Enter pip"
          className="rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-lg ring-1 ring-slate-900/10 dark:ring-white/10 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          onClick={() => requestDisplayMode("pip")}
        >
          <Pin className="w-5 h-5" />
        </button>
        )}
        {displayMode !== "fullscreen" && (
          <button
            aria-label="Enter fullscreen"
            className="rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-lg ring-1 ring-slate-900/10 dark:ring-white/10 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            onClick={() => requestDisplayMode("fullscreen")}
          >
            <Expand className="w-5 h-5" />
          </button>
        )}
      </div>
      <main className="flex flex-col row-start-2 items-center sm:items-start w-full">

        <div className="w-full mb-3">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            {symbol}
          </span>
          <PriceWithDiff value={currentPrice || 0} diff={priceChange24h || 0} />
        </div>

        <div className="w-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden relative" style={{ height: chartHeight, width: `calc(100vw - 32px)` }}>
          <div ref={chartContainerRef} className="w-full h-full" />
          {!dataReady && (
            <div className="absolute inset-0 z-10">
              <Skeleton width="100%" height="100%" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
