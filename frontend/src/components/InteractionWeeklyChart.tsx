import type { WeeklyInteractionCount } from "../services/api";

interface InteractionWeeklyChartProps {
  weeks: WeeklyInteractionCount[];
  maxBars?: number;
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00`);
  if (Number.isNaN(d.getTime())) return weekStart;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InteractionWeeklyChart({ weeks, maxBars = 12 }: InteractionWeeklyChartProps) {
  const data = weeks.slice(-maxBars);
  if (data.length === 0) {
    return (
      <p className="section-description" style={{ margin: 0 }}>
        No interactions in the selected date range to chart.
      </p>
    );
  }

  const maxCount = Math.max(...data.map((w) => w.count), 1);
  const chartHeight = 140;

  return (
    <div className="weekly-chart" role="img" aria-label="Interactions per week bar chart">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.5rem",
          height: chartHeight,
          padding: "0.5rem 0",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {data.map((week) => {
          const barHeight = Math.max(4, Math.round((week.count / maxCount) * (chartHeight - 24)));
          return (
            <div
              key={week.week_start}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.25rem",
              }}
              title={`${formatWeekLabel(week.week_start)}: ${week.count} interactions`}
            >
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#374151" }}>{week.count}</span>
              <div
                style={{
                  width: "100%",
                  maxWidth: "2.5rem",
                  height: barHeight,
                  background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "#6b7280",
                  textAlign: "center",
                  lineHeight: 1.2,
                  transform: "rotate(-35deg)",
                  transformOrigin: "center top",
                  marginTop: "0.35rem",
                  whiteSpace: "nowrap",
                }}
              >
                {formatWeekLabel(week.week_start)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
