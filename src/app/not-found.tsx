import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Cognicare</p>
      <h1 className="font-display text-2xl font-bold">Page not found</h1>
      <Link href="/" className="text-sm text-accent-ink underline">
        Return home
      </Link>
    </main>
  );
}
