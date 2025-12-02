import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOCK_API_BASE = process.env.STOCK_API_BASE!;

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const symbol = (searchParams.get("symbol") || "").toUpperCase();
	const market = (searchParams.get("market") || "futures") as string;

	if (!symbol) {
		return new Response("Missing symbol", { status: 400 });
	}

	// 检测是否是股票市场
	const isStock = market.toLowerCase() !== "spot" && market.toLowerCase() !== "futures";

	// 股票市场使用实时报价接口
	if (isStock) {
		try {
			const url = `${STOCK_API_BASE}/api/quote?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`;
			const response = await fetch(url, {
				headers: {
					"X-APP-NAME": "apps_mcp",
				},
			});

			if (!response.ok) {
				throw new Error(`Stock quote API error: ${response.status}`);
			}

			const quote = await response.json();

			return Response.json({
				price: Number(quote.price || 0),
				priceChangePercent: Number(quote.changePercent || 0) / 100,
			});
		} catch (err) {
			return new Response(JSON.stringify({ error: String(err) }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	try {
		let url: string;
		
		if (market.toLowerCase() === "spot") {
			url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
		} else {
			// USDT-M futures
			url = `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`;
		}

		const response = await fetch(url);
		
		if (!response.ok) {
			throw new Error(`Binance API error: ${response.status}`);
		}
		
		const ticker = await response.json();
		
		return Response.json({
			price: Number(ticker.lastPrice || 0),
			priceChangePercent: Number(ticker.priceChangePercent || 0) / 100,
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

