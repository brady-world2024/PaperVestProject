import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const AppField = forwardRef<HTMLInputElement, Props>(function AppField(
  { label, error, ...props },
  ref
) {
  return (
    <div className="pv-field">
      <label>
        <span>{label}</span>
      </label>
      <input ref={ref} className="pv-input" {...props} />
      {error ? <span className="pv-error-text">{error}</span> : null}
    </div>
  );
});
