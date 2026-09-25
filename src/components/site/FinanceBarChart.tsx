import { barFraction, formatShortPaise, niceScaleMax } from "@/lib/charts";
import { formatPaise } from "@/lib/money";

/**
 * A bar drawn on the server, in the page's own HTML.
 *
 * §5 pairs every chart with the table that carries the same figures, and asks
 * for that table to be the fallback when JavaScript is off. A server-rendered
 * bar needs no fallback because it *is* the HTML: the picture and the numbers
 * arrive in the same response, and a public page does not spend half its
 * JavaScript budget on a chart library to draw two rectangles.
 */

export type ChartBar = {
  label: string;
  paise: number;
  /** Which side of the ledger the figure belongs to, and so which colour it is. */
  tone: "income" | "expense";
};

const VIEW_WIDTH = 640;
const LABEL_WIDTH = 132;
const VALUE_WIDTH = 92;
const ROW_HEIGHT = 34;
const BAR_HEIGHT = 18;

function barColor(tone: ChartBar["tone"]): string {
  return tone === "income" ? "var(--color-green-700)" : "var(--color-red-700)";
}

export function FinanceBarChart({
  title,
  yearLabel,
  bars,
  withShare = false,
}: {
  title: string;
  yearLabel: string;
  bars: readonly ChartBar[];
  /** Each head's share of its own side, which is what a breakdown is read for. */
  withShare?: boolean;
}) {
  const scaleMax = niceScaleMax(bars.map((bar) => bar.paise));
  const barWidth = VIEW_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const totalPaise = bars.reduce((sum, bar) => sum + bar.paise, 0);
  const height = bars.length * ROW_HEIGHT + 4;

  if (bars.length === 0) {
    return (
      <figure className="m-0">
        <figcaption className="text-sm font-medium text-ink-muted">
          {title} &mdash; financial year {yearLabel}
        </figcaption>
        <p className="mt-3 rounded-[12px] border border-dashed border-line bg-paper-alt p-5 text-sm text-ink-muted">
          Nothing has been entered under any of these heads yet.
        </p>
      </figure>
    );
  }

  return (
    <figure className="m-0">
      <figcaption className="text-sm font-medium text-ink-muted">
        {title} &mdash; financial year {yearLabel}
      </figcaption>

      <svg
        role="img"
        aria-label={`${title} for the financial year ${yearLabel}`}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        className="mt-3 h-auto w-full"
      >
        <line
          x1={LABEL_WIDTH}
          y1={2}
          x2={LABEL_WIDTH}
          y2={height - 2}
          stroke="var(--color-line)"
          strokeWidth={1}
        />
        {bars.map((bar, index) => {
          const top = index * ROW_HEIGHT + 2;
          const width = barFraction(bar.paise, scaleMax) * barWidth;
          return (
            <g key={bar.label}>
              <text
                x={0}
                y={top + BAR_HEIGHT / 2}
                dominantBaseline="central"
                fontSize={13}
                fill="var(--color-ink)"
              >
                {bar.label}
              </text>
              <rect
                x={LABEL_WIDTH}
                y={top}
                width={width}
                height={BAR_HEIGHT}
                rx={2}
                fill={barColor(bar.tone)}
              />
              <text
                x={VIEW_WIDTH}
                y={top + BAR_HEIGHT / 2}
                dominantBaseline="central"
                textAnchor="end"
                fontSize={13}
                fill="var(--color-ink)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatShortPaise(bar.paise)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* §5: the figures always appear again as figures, in the order the bars are drawn. */}
      <table className="mt-4 w-full border-collapse text-sm">
        <caption className="sr-only">{`${title} for the financial year ${yearLabel}, as a table`}</caption>
        <thead>
          <tr className="border-b-2 border-green-900 text-left">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Head
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">
              Amount
            </th>
            {withShare ? (
              <th scope="col" className="py-2 text-right font-semibold">
                Share
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.label} className="border-b border-line">
              <th scope="row" className="py-2 pr-4 text-left font-normal">
                {bar.label}
              </th>
              <td className="py-2 pr-4 text-right tabular-nums">{formatPaise(bar.paise)}</td>
              {withShare ? (
                <td className="py-2 text-right tabular-nums">
                  {totalPaise === 0 ? "—" : `${Math.round((bar.paise / totalPaise) * 100)}%`}
                </td>
              ) : null}
            </tr>
          ))}
          <tr className="border-b-2 border-green-900">
            <th scope="row" className="py-2.5 pr-4 text-left font-semibold">
              Total
            </th>
            <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">
              {formatPaise(totalPaise)}
            </td>
            {withShare ? (
              <td className="py-2.5 text-right font-semibold tabular-nums">
                {totalPaise === 0 ? "—" : "100%"}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </figure>
  );
}
