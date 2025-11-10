import type { NextRequest } from "next/server";
import Binance from "node-binance-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const symbol = (searchParams.get("symbol") || "").toUpperCase();
	const market = ((searchParams.get("market") || "futures") as string).toLowerCase();

	if (!symbol) {
		return new Response("Missing symbol", { status: 400 });
	}

	try {
		const binance = new (Binance as any)();

		if (market === "spot") {
			const stats = await new Promise<any>((resolve, reject) => {
				(binance as any).prevDay(symbol, (error: any, ticker: any) => {
					if (error) reject(error);
					else resolve(ticker);
				});
			});
			return Response.json({
				price: Number(stats.lastPrice || stats.curDayClose || 0),
				priceChangePercent: Number(stats.priceChangePercent || 0) / 100,
			});
		} else {
			// USDT-M futures
			const ticker = await (binance as any).futuresDaily(symbol);
			return Response.json({
				price: Number(ticker.lastPrice || 0),
				priceChangePercent: Number(ticker.priceChangePercent || 0) / 100,
			});
		}
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

