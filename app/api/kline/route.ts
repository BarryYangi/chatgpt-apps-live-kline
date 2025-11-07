import type { NextRequest } from "next/server";
import Binance from "node-binance-api";

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();
  const interval = (searchParams.get("interval") || "1m").toString();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 400), 50), 1000);
  const market = ((searchParams.get("market") || "futures") as string).toLowerCase();

  if (!symbol) {
    return new Response("Missing symbol", { status: 400 });
  }
  if (!INTERVALS.has(interval)) {
    return new Response("Invalid interval", { status: 400 });
  }

  const encoder = new TextEncoder();
  let wsEndpoint: string | null = null;
  let closed = false;

  const binance = new (Binance as any)();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // SSE prelude + retry
      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      // Seed history via REST then open appropriate websocket by market
      try {
        if (market === "spot") {
          (binance as any).candlesticks(
            symbol,
            interval,
            (error: any, ticks: any[]) => {
              if (error) {
                controller.enqueue(
                  encoder.encode(
                    `event: error\n` + `data: ${JSON.stringify({ message: String(error) })}\n\n`
                  )
                );
                return;
              }
              const data = (ticks || []).map((t) => ({
                timestamp: Number(t[0]),
                open: Number(t[1]),
                high: Number(t[2]),
                low: Number(t[3]),
                close: Number(t[4]),
                volume: Number(t[5]),
              }));
              controller.enqueue(
                encoder.encode(
                  `event: init\n` + `data: ${JSON.stringify({ symbol, interval, market, data })}\n\n`
                )
              );
              wsEndpoint = (binance as any).websockets.candlesticks(
                symbol,
                interval,
                (candlesticks: any) => {
                  if (closed) return;
                  const ticks = candlesticks.k;
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
                }
              );
            },
            { limit }
          );
        } else {
          // USDT-M futures
          const candles = await (binance as any).futuresCandlesticks(symbol, interval, { limit });
          const data = (candles || []).map((c: any) => ({
            timestamp: Number(c.openTime),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume),
          }));
          controller.enqueue(
            encoder.encode(
              `event: init\n` + `data: ${JSON.stringify({ symbol, interval, market, data })}\n\n`
            )
          );
          wsEndpoint = (binance as any).websockets.futuresCandlesticks(
            symbol,
            interval,
            (candlesticks: any) => {
              if (closed) return;
              const ticks = candlesticks.k;
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
            }
          );
        }
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
          if (wsEndpoint != null) {
            (binance as any).websockets.terminate(wsEndpoint);
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
