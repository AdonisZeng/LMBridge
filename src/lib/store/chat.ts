import { create } from 'zustand'
import type { ChatSession, Message } from '@/types/providers'

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  isGenerating: boolean

  createSession: () => ChatSession
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  addMessage: (sessionId: string, message: Message) => void
  updateMessage: (sessionId: string, messageId: string, content: string) => void
  updateMessageState: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  appendToMessage: (sessionId: string, messageId: string, content: string) => void
  updateThinking: (sessionId: string, messageId: string, thinking: string) => void
  setThinkingExpanded: (sessionId: string, messageId: string, expanded: boolean) => void
  toggleThinkingExpanded: (sessionId: string, messageId: string) => void
  setGenerating: (generating: boolean) => void
  clearMessages: (sessionId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSessionId: null,
  isGenerating: false,

  createSession: () => {
    const session: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: '你好！我是 AI Box 助手。有什么我可以帮助你的吗？',
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
    }))
    return session
  },

  deleteSession: (id: string) => {
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== id)
      const newActiveId =
        state.activeSessionId === id
          ? newSessions[0]?.id || null
          : state.activeSessionId
      return { sessions: newSessions, activeSessionId: newActiveId }
    })
  },

  setActiveSession: (id: string) => {
    set({ activeSessionId: id })
  },

  addMessage: (sessionId: string, message: Message) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
          : s
      ),
    }))
  },

  updateMessage: (sessionId: string, messageId: string, content: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m
              ),
              updatedAt: Date.now(),
            }
          : s
      ),
    }))
  },

  updateMessageState: (sessionId: string, messageId: string, updates: Partial<Message>) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
              updatedAt: Date.now(),
            }
          : s
      ),
    }))
  },

  appendToMessage: (sessionId: string, messageId: string, content: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, content: m.content + content } : m
              ),
              updatedAt: Date.now(),
            }
          : s
      ),
    }))
  },

  updateThinking: (sessionId: string, messageId: string, thinking: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, thinking } : m
              ),
              updatedAt: Date.now(),
            }
          : s
      ),
    }))
  },

  setThinkingExpanded: (sessionId: string, messageId: string, expanded: boolean) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, thinkingExpanded: expanded } : m
              ),
              updatedAt: Date.now(),
            }
          : s
      ),
    }))
  },

  toggleThinkingExpanded: (sessionId: string, messageId: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, thinkingExpanded: !m.thinkingExpanded } : m
              ),
              updatedAt: Date.now(),
            }
          : s
      ),
    }))
  },

  setGenerating: (generating: boolean) => {
    set({ isGenerating: generating })
  },

  clearMessages: (sessionId: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: '对话已清空。有什么我可以帮助你的吗？',
                  timestamp: Date.now(),
                },
              ],
            }
          : s
      ),
    }))
  },
}))
