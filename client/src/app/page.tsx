export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 font-sans p-6">
      <main className="flex max-w-2xl flex-col items-center text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Foundation Setup Ready
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
          Codebase Intelligence
        </h1>
        <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
          AI-powered GitHub repository analysis platform designed for codebase understanding, architecture visualization, semantic search, and grounded Q&amp;A.
        </p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-md pt-4 text-sm">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-left">
            <div className="font-semibold text-slate-200">Frontend (`client/`)</div>
            <div className="text-xs text-slate-500 mt-1">Next.js, TypeScript, Tailwind</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-left">
            <div className="font-semibold text-slate-200">Backend (`server/`)</div>
            <div className="text-xs text-slate-500 mt-1">FastAPI, SQLAlchemy, Alembic</div>
          </div>
        </div>
      </main>
    </div>
  );
}

