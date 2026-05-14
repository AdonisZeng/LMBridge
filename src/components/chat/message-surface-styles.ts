export type ChatVisualRole = 'assistant' | 'user'

export function getMessageRowClass(role: ChatVisualRole): string {
  return role === 'user'
    ? 'flex flex-row-reverse items-end gap-3'
    : 'flex items-start gap-3'
}

export function getMessageColumnClass(role: ChatVisualRole): string {
  return role === 'user'
    ? 'flex max-w-[min(34rem,72%)] flex-col items-end gap-2'
    : 'flex max-w-[min(42rem,78%)] flex-col gap-2'
}

export function getAvatarClass(role: ChatVisualRole): string {
  return role === 'user'
    ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16a34a] text-white shadow-lg shadow-[#22C55E]/20'
    : 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a9eff] to-[#3b82f6] text-white shadow-lg shadow-[#4a9eff]/18'
}

export function getMessageBubbleClass(role: ChatVisualRole): string {
  return role === 'user'
    ? [
        'rounded-[20px] rounded-tr-[12px] px-4 py-3 text-sm leading-relaxed text-white',
        'bg-gradient-to-br from-[#4a9eff] to-[#2563eb] shadow-[0_16px_34px_rgba(37,99,235,0.18)]',
      ].join(' ')
    : [
        'rounded-[22px] rounded-tl-[12px] border px-4 py-3 text-sm leading-relaxed',
        'border-slate-200/80 bg-white/88 text-slate-800 shadow-[0_16px_34px_rgba(148,163,184,0.14)]',
        'dark:border-slate-700/80 dark:bg-black dark:text-slate-100',
      ].join(' ')
}
