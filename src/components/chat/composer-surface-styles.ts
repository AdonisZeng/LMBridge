export function getComposerShellClass(): string {
  return [
    'mt-auto border-t border-slate-200/80 bg-white/60 px-4 py-4 backdrop-blur-xl',
    'dark:border-slate-700/70 dark:bg-black',
  ].join(' ')
}

export function getComposerRowClass(): string {
  return [
    'relative flex items-end gap-3 rounded-[24px] border border-white/80 bg-white/90 p-3',
    'shadow-[0_18px_40px_rgba(148,163,184,0.14)] dark:border-slate-700/80 dark:bg-black dark:shadow-[0_20px_44px_rgba(2,6,23,0.32)]',
  ].join(' ')
}

export function getComposerTextareaClass(): string {
  return [
    'min-h-[48px] max-h-[132px] w-full resize-none rounded-[18px] border border-slate-200/80 bg-transparent px-4 py-3 text-sm text-slate-900',
    'placeholder:text-slate-400 focus:border-[#4a9eff] focus:outline-none dark:border-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-500',
  ].join(' ')
}

export function getComposerActionButtonClass(kind: 'send' | 'stop', disabled: boolean): string {
  if (kind === 'stop') {
    return [
      'flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dc2626] text-white shadow-lg shadow-[#dc2626]/25',
      'transition-transform duration-200 hover:scale-105 active:scale-95',
    ].join(' ')
  }

  if (disabled) {
    return 'flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-2xl bg-slate-300 text-slate-500'
  }

  return [
    'flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a9eff] to-[#2563eb] text-white',
    'shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition-transform duration-200 hover:scale-105 active:scale-95',
  ].join(' ')
}
