export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="pv-metric-card">
      <div className="pv-metric-label">{label}</div>
      <div className={tone ? `pv-metric-value ${tone}` : 'pv-metric-value'}>{value}</div>
    </div>
  );
}
