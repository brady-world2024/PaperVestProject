export function InlineNotice({
  tone,
  message,
}: {
  tone: 'error' | 'info';
  message: string;
}) {
  return <div className={`pv-inline-notice ${tone}`}>{message}</div>;
}
