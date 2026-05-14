import type { Message } from '../../src/lib/providers/types.ts'
import type { RagSearchResult } from './types.ts'

export interface BuildRagMessagesOptions {
  messages: Message[]
  matches: RagSearchResult[]
  retrievalQuery?: string
}

export function buildRagMessages(options: BuildRagMessagesOptions): Message[] {
  if (options.matches.length === 0) {
    if (!options.retrievalQuery) {
      return options.messages
    }

    return [
      createSystemMessage([
        `检索查询：${options.retrievalQuery}`,
        '本次未检索到可靠的知识库内容。',
        '请明确告诉用户知识库中缺少答案；如果补充通用知识，必须明确标注，并且不要伪造参考来源。',
      ]),
      ...options.messages,
    ]
  }

  const headerLines = [
    '优先使用以下知识库内容回答用户问题。',
    '如果知识库内容不足以回答，请明确说明缺少哪些信息，并可以基于通用知识补充但要标注。',
    '回答末尾用简短的“参考来源”列出使用到的来源文件名。',
  ]

  if (options.retrievalQuery) {
    headerLines.push(`检索查询：${options.retrievalQuery}`)
  }

  const context = options.matches
    .map((match, index) => {
      const sourceLabel = `[来源 ${index + 1}: ${match.chunk.sourceName} #${match.chunk.chunkIndex + 1}]`
      return `${sourceLabel}\n${match.chunk.content}`
    })
    .join('\n\n---\n\n')

  return [
    createSystemMessage([
      ...headerLines,
      '',
      context,
    ]),
    ...options.messages,
  ]
}

function createSystemMessage(lines: string[]): Message {
  return {
    id: 'rag-context',
    role: 'system',
    timestamp: Date.now(),
    content: lines.join('\n'),
  }
}
