import { Backdrop, Logo } from './ui';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-gray-400">{subtitle}</p>}
        </div>
        <div className="card p-6 shadow-2xl shadow-black/40 sm:p-8">{children}</div>
        {footer && <p className="mt-6 text-center text-sm text-gray-400">{footer}</p>}
      </div>
    </div>
  );
}
