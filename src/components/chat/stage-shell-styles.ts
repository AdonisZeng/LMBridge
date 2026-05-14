export function getStageWorkspaceBackdropClass(): string {
  return [
    'relative h-full overflow-hidden px-4 py-4 md:px-6 md:py-5',
    'bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98)_0%,_rgba(239,246,255,0.96)_34%,_rgba(226,232,240,0.94)_100%)]',
    'dark:bg-[radial-gradient(circle_at_top,_rgba(51,65,85,0.32)_0%,_rgba(15,23,42,0.96)_42%,_rgba(2,6,23,1)_100%)]',
  ].join(' ')
}

export function getStageShellClass(): string {
  return [
    'mx-auto flex h-full w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-[28px]',
    'border border-white/70 bg-white/72 shadow-[0_28px_80px_rgba(148,163,184,0.20)] backdrop-blur-xl',
    'dark:border-slate-700/70 dark:bg-black dark:shadow-[0_32px_90px_rgba(2,6,23,0.44)]',
  ].join(' ')
}

export function getStageToolbarClass(): string {
  return [
    'flex items-center justify-between gap-3 border-b border-slate-200/75 bg-white/72 px-4 py-3',
    'backdrop-blur-md dark:border-slate-700/70 dark:bg-black',
  ].join(' ')
}

export function getStageStatusClusterClass(): string {
  return [
    'flex items-center gap-3 rounded-full border border-white/80 bg-white/74 px-4 py-1.5 text-xs text-slate-500',
    'shadow-[0_10px_24px_rgba(148,163,184,0.12)] dark:border-slate-700/70 dark:bg-black dark:text-slate-400',
  ].join(' ')
}

export function getSessionTabClass(active: boolean): string {
  return active
    ? [
        'flex items-center gap-1 rounded-full bg-white/88 px-3 py-1.5 text-xs text-slate-900 shadow-sm',
        'dark:bg-black dark:text-slate-50',
      ].join(' ')
    : [
        'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-slate-500 transition-colors',
        'hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-black dark:hover:text-slate-200',
      ].join(' ')
}
