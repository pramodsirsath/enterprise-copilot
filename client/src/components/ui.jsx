import { AlertCircle, Loader2, Sparkles } from 'lucide-react';

export const Logo = ({ size = 'md' }) => {
  const box = size === 'lg' ? 'h-11 w-11' : 'h-8 w-8';
  const icon = size === 'lg' ? 22 : 16;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${box} grid place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30`}
      >
        <Sparkles size={icon} className="text-white" />
      </div>
      <span className={`font-semibold tracking-tight text-white ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>
        Enterprise Copilot
      </span>
    </div>
  );
};

/** Soft gradient glow behind auth / onboarding screens. */
export const Backdrop = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
    <div className="absolute -top-40 left-1/2 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
    <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-[100px]" />
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage:
          'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
  </div>
);

export const ErrorBanner = ({ children }) =>
  children ? (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  ) : null;

export const Field = ({ label, icon: Icon, hint, ...props }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-gray-300">{label}</span>
    <div className="relative">
      {Icon && (
        <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
      )}
      <input {...props} className={`input ${Icon ? 'pl-10' : ''} ${props.className || ''}`} />
    </div>
    {hint && <span className="mt-1.5 block text-xs text-gray-500">{hint}</span>}
  </label>
);

export const Spinner = ({ size = 18, className = '' }) => (
  <Loader2 size={size} className={`animate-spin ${className}`} />
);
