import type { RefObject } from 'react'
import type { ChatSurfaceMode } from './agent-mode'

interface ScrollableTimelineContainer {
  scrollTop: number
  scrollHeight: number
}

export function scrollSurfaceTimelineToBottom(input: {
  surfaceMode: ChatSurfaceMode
  chatTimelineContainerRef: RefObject<ScrollableTimelineContainer>
  agentTimelineContainerRef: RefObject<ScrollableTimelineContainer>
}): void {
  const activeTimelineContainerRef =
    input.surfaceMode === 'agent'
      ? input.agentTimelineContainerRef
      : input.chatTimelineContainerRef

  if (!activeTimelineContainerRef.current) {
    return
  }

  activeTimelineContainerRef.current.scrollTop = activeTimelineContainerRef.current.scrollHeight
}
