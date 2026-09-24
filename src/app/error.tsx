"use client";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page py-16">
      <h1 className="text-2xl text-red-700">Details are temporarily unavailable</h1>
      <p className="mt-3 max-w-prose text-[15px] leading-7 text-ink-muted">
        The branch records could not be loaded just now. Please try again in a moment. Figures are
        never shown from an older copy, because an out-of-date balance is worse than none at all.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-[4px] bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
      >
        Try again
      </button>
      {error.digest ? (
        <p className="mt-4 text-xs text-ink-muted">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
