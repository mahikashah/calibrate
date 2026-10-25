import type { ReactNode } from "react";

const CONF: Record<string, { label: string; cls: string; dot: string }> = {
  clear: { label: "Clear signal", cls: "text-clear border-clear/30 bg-clear/5", dot: "bg-clear" },
  emerging: {
    label: "Emerging",
    cls: "text-emerging border-emerging/30 bg-emerging/5",
    dot: "bg-emerging",
  },
  insufficient: {
    label: "Gathering data",
    cls: "text-insufficient border-insufficient/30 bg-insufficient/5",
    dot: "bg-insufficient",
  },
};

export function ConfidenceBadge({ level }: { level: string }) {
  const c = CONF[level] ?? CONF.insufficient;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${c.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

/** A horizontal score bar, 0..max. */
export function Bar({
  value,
  max = 100,
  color = "#208B8B",
  track = "#D8E4D5",
}: {
  value: number;
  max?: number;
  color?: string;
  track?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: track }}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card grid place-items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="label mb-1">{eyebrow}</p>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

export function AiTag({ provider }: { provider?: string }) {
  // Demo mode must never be presented as real AI output.
  if (provider === "calibrate-demo") {
    return (
      <span className="chip border-emerging/40 bg-[#FFF8EE] text-[#8A5A16]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerging" />
        Demo generation
      </span>
    );
  }
  return (
    <span className="chip border-brand/30 bg-brand-soft text-brand-ink">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      AI-assisted
    </span>
  );
}
