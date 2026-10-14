import { errorMessage } from "../api/client";

export function Loading() {
  return (
    <div className="feedback" role="status">
      <span className="spinner" /> Loading…
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div className="feedback error" role="alert">
      <strong>Unable to complete the request</strong>
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button className="secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
