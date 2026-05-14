export function getThinkingWrapperClass(expanded: boolean): string {
  return expanded
    ? 'overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out max-h-[70vh] opacity-100 mt-2'
    : 'overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out max-h-0 opacity-0 mt-0'
}

export function getThinkingPanelClass(): string {
  return [
    'rounded-2xl border border-slate-200/80 bg-white/78 shadow-[0_16px_38px_rgba(148,163,184,0.16)] backdrop-blur-xl',
    'dark:border-slate-700/80 dark:bg-black dark:shadow-[0_18px_42px_rgba(2,6,23,0.34)]',
  ].join(' ')
}

export function getThinkingBodyClass(): string {
  return 'max-h-[60vh] overflow-y-auto px-4 pb-4'
}
