export default function LinkedInAssistantConnectDonePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-semibold tracking-wide text-emerald-700">CONECTADO A NOTIFICAS</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Extensión autorizada</h1>
        <p className="mt-3 text-sm text-slate-600">
          Ya podés volver al popup de la extensión. Si no se conectó solo, cerrá y volvé a abrirla.
        </p>
        <p className="mt-6 text-xs text-slate-400">Esta pestaña se puede cerrar.</p>
      </section>
    </main>
  );
}
