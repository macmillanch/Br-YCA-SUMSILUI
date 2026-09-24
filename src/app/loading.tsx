export default function Loading() {
  return (
    <div className="container-page py-12" role="status" aria-live="polite">
      <div className="h-8 w-2/3 animate-pulse rounded-[4px] bg-green-100" />
      <div className="mt-4 h-4 w-full animate-pulse rounded-[4px] bg-green-100" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded-[4px] bg-green-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-[12px] bg-green-100" />
        <div className="h-40 animate-pulse rounded-[12px] bg-green-100" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
