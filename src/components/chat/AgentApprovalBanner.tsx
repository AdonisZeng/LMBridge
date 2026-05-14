import { Check, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentApprovalRequest } from '@/types/agent'

interface AgentApprovalBannerProps {
  approval: AgentApprovalRequest
  onApprove: (actionId: string) => void
  onReject: (actionId: string) => void
}

export function AgentApprovalBanner({
  approval,
  onApprove,
  onReject,
}: AgentApprovalBannerProps) {
  return (
    <section className="mt-5 rounded-[24px] border border-amber-200/80 bg-amber-50/90 p-4 shadow-[0_18px_40px_rgba(245,158,11,0.14)] dark:border-amber-900/70 dark:bg-amber-950/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" />
            <span>{approval.title}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-800/90 dark:text-amber-200/90">
            {approval.details}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onApprove(approval.actionId)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
              'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500'
            )}
          >
            <Check className="h-4 w-4" />
            <span>批准</span>
          </button>
          <button
            type="button"
            onClick={() => onReject(approval.actionId)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100',
              'dark:border-amber-800 dark:bg-black dark:text-amber-100 dark:hover:bg-amber-950/60'
            )}
          >
            <X className="h-4 w-4" />
            <span>拒绝</span>
          </button>
        </div>
      </div>
    </section>
  )
}
