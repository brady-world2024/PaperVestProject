export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="pv-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
