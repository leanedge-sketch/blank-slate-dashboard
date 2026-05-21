import type { StrategicFitItem } from "../utils/profileText";

function scoreStyles(score: number): {
  backgroundColor: string;
  borderColor: string;
  scoreColor: string;
} {
  if (score >= 3) {
    return {
      backgroundColor: "#ecfdf5",
      borderColor: "#10b981",
      scoreColor: "#10b981",
    };
  }
  if (score === 2) {
    return {
      backgroundColor: "#eff6ff",
      borderColor: "#3b82f6",
      scoreColor: "#3b82f6",
    };
  }
  if (score === 1) {
    return {
      backgroundColor: "#fffbeb",
      borderColor: "#f59e0b",
      scoreColor: "#f59e0b",
    };
  }
  return {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    scoreColor: "#9ca3af",
  };
}

export function StrategicFitAssessment({ items }: { items: StrategicFitItem[] }) {
  if (!items.length) return null;

  return (
    <section
      className="card"
      style={{
        marginBottom: 0,
        padding: "2rem",
        backgroundColor: "#ffffff",
      }}
    >
      <h3
        style={{
          fontSize: "1.5rem",
          fontWeight: "700",
          color: "#111827",
          marginBottom: "1rem",
          paddingBottom: "1rem",
          borderBottom: "3px solid #3b82f6",
        }}
      >
        Strategic Fit Assessment
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {items.map((item) => {
          const styles = scoreStyles(item.score);
          return (
            <div
              key={item.category}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "1rem 1.25rem",
                backgroundColor: styles.backgroundColor,
                borderRadius: "0.75rem",
                border: `2px solid ${styles.borderColor}`,
              }}
            >
              <span
                style={{
                  fontWeight: "700",
                  minWidth: "160px",
                  color: "#111827",
                  flexShrink: 0,
                }}
              >
                {item.category}:
              </span>
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "800",
                  color: styles.scoreColor,
                  minWidth: "56px",
                  flexShrink: 0,
                  lineHeight: 1.2,
                }}
              >
                {item.score}/3
              </span>
              {item.reason ? (
                <span
                  style={{
                    color: "#6b7280",
                    flex: 1,
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                  }}
                >
                  {item.reason}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
