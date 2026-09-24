import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <h1 className="text-2xl">Page not found</h1>
      <p className="mt-3 max-w-prose text-[15px] leading-7 text-ink-muted">
        That page is not part of this site. It may have been renamed when the branch re-published it.
      </p>
      <p className="mt-6 text-sm">
        <Link href="/" className="text-green-700 underline underline-offset-2">
          Return to the home page
        </Link>
      </p>
    </div>
  );
}
