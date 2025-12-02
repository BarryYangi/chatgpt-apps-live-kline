import type { NextRequest } from "next/server";
import { WebSocket } from "ws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERVALS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

const STOCK_API_BASE = process.env.STOCK_API_BASE!;

// 代理股票 API 的 SSE 流
async function proxyStockSSE(symbol: string, interval: string, limit: number): Promise<Response> {
  const url = `${STOCK_API_BASE}/api/kline?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "text/event-stream",
      },
    });

    if (!response.ok) {
      return new Response(`Stock API error: ${response.status}`, { status: response.status });
    }

    if (!response.body) {
      return new Response("No response body", { status: 500 });
    }

    // 直接流式传输股票 API 的响应
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(`Failed to connect to stock API: ${String(err)}`, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();
  const interval = (searchParams.get("interval") || "1m").toString();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 400), 50), 1000);
  const market = (searchParams.get("market") || "futures") as string;

  if (!symbol) {
    return new Response("Missing symbol", { status: 400 });
  }
  if (!INTERVALS.has(interval)) {
    return new Response("Invalid interval", { status: 400 });
  }

  // 检测是否是股票市场 (非 spot/futures)
  const isStock = market.toLowerCase() !== "spot" && market.toLowerCase() !== "futures";

  // 如果是股票市场,直接代理股票 API 的 SSE 流
  if (isStock) {
    return proxyStockSSE(symbol, interval, limit);
  }

  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // SSE prelude + retry
      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      // Seed history via REST then open appropriate websocket by market
      try {
        let restUrl: string;
        let wsUrl: string;
        const lowerSymbol = symbol.toLowerCase();
        
        const params = new URLSearchParams({
          symbol,
          interval,
          limit: limit.toString(),
        });

        if (market === "spot") {
          restUrl = `https://api.binance.com/api/v3/klines?${params}`;
          wsUrl = `wss://stream.binance.com:9443/ws/${lowerSymbol}@kline_${interval}`;
        } else {
          // USDT-M futures
          restUrl = `https://fapi.binance.com/fapi/v1/klines?${params}`;
          wsUrl = `wss://fstream.binance.com/ws/${lowerSymbol}@kline_${interval}`;
        }

        // Fetch initial history
        const response = await fetch(restUrl);
        if (!response.ok) {
          throw new Error(`Binance API error: ${response.status}`);
        }
        
        const candles = await response.json();
        const data = (candles || []).map((c: any) => ({
          timestamp: Number(c[0]),
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4]),
          volume: Number(c[5]),
        }));
        
        controller.enqueue(
          encoder.encode(
            `event: init\n` + `data: ${JSON.stringify({ symbol, interval, market, data })}\n\n`
          )
        );

        // Open WebSocket for real-time updates
        ws = new WebSocket(wsUrl);
        
        ws.on('message', (data: Buffer) => {
          if (closed) return;
          try {
            const msg = JSON.parse(data.toString());
            const ticks = msg.k;
            const kl = {
              timestamp: Number(ticks.t),
              open: Number(ticks.o),
              high: Number(ticks.h),
              low: Number(ticks.l),
              close: Number(ticks.c),
              volume: Number(ticks.v),
              isFinal: Boolean(ticks.x),
            };
            controller.enqueue(
              encoder.encode(`event: kline\n` + `data: ${JSON.stringify(kl)}\n\n`)
            );
          } catch (err) {
            // Ignore parse errors
          }
        });

        ws.on('error', (err: Error) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(
              `event: error\n` + `data: ${JSON.stringify({ message: String(err) })}\n\n`
            )
          );
        });

      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `event: error\n` + `data: ${JSON.stringify({ message: String(err) })}\n\n`
          )
        );
      }

      // Heartbeat keepalive
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ping\n` + `data: {}\n\n`));
        } catch {}
      }, 25_000);

      // Cleanup when canceled
      (stream as any)._cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          if (ws) {
            ws.close();
            ws = null;
          }
        } catch {}
      };
    },
    cancel() {
      try {
        (stream as any)._cleanup?.();
      } catch {}
    },
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  // @ts-ignore - Not all runtimes expose this, best-effort cleanup
  (response as any).socket?.on("close", () => {
    try {
      (stream as any)._cleanup?.();
    } catch {}
  });

  return response;
}
