import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export function UnauthorizedPage() {
  const location = useLocation();
  const attemptedPath = location.state?.from?.pathname;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Access restricted</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your role does not have permission to open
          {attemptedPath ? ` ${attemptedPath}` : ' this workspace area'}.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
