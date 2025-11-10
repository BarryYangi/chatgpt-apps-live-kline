"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import clsx from "clsx/lite";

type Props = {
	value: number;
	diff: number;
};

export default function PriceWithDiff({ value, diff }: Props) {
	return (
		<NumberFlowGroup>
			<div
				className="flex items-center gap-4 font-semibold"
			>
				<NumberFlow
					value={value}
					locales="en-US"
					format={{ style: "currency", currency: "USD" }}
					className="text-2xl"
				/>
				<NumberFlow
					value={diff}
					locales="en-US"
					format={{
						style: "percent",
						maximumFractionDigits: 3,
						signDisplay: "always",
					}}
					className={clsx(
						"text-lgs transition-colors duration-300",
						diff < 0 ? "text-red-500" : "text-emerald-500"
					)}
				/>
			</div>
		</NumberFlowGroup>
	);
}

