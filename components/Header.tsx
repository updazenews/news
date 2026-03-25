export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-700">Updaze News Demo</h1>
        <p className="text-sm text-slate-500">Static Next.js GitHub Pages build</p>
      </div>
    </header>
  );
}
