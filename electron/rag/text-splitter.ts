import type { RagChunkDraft } from './types.ts'

export interface SplitTextOptions {
  text: string
  sourceId: string
  sourceName: string
  chunkSize?: number
  chunkOverlap?: number
}

const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 180

export function splitTextIntoChunks(options: SplitTextOptions): RagChunkDraft[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0')
  }

  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be smaller than chunkSize')
  }

  const normalized = normalizeText(options.text)
  if (!normalized) {
    throw new Error(`${options.sourceName} does not contain readable text`)
  }

  const chunks: RagChunkDraft[] = []
  let start = 0

  while (start < normalized.length) {
    const end = findChunkEnd(normalized, start, chunkSize)
    const content = normalized.slice(start, end).trim()

    if (content) {
      chunks.push({
        sourceId: options.sourceId,
        sourceName: options.sourceName,
        chunkIndex: chunks.length,
        content,
      })
    }

    if (end >= normalized.length) {
      break
    }

    start = Math.max(0, end - chunkOverlap)
  }

  return chunks
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findChunkEnd(text: string, start: number, chunkSize: number): number {
  const hardEnd = Math.min(start + chunkSize, text.length)
  if (hardEnd === text.length) {
    return hardEnd
  }

  const window = text.slice(start, hardEnd)
  const paragraphBreak = window.lastIndexOf('\n\n')
  if (paragraphBreak > chunkSize * 0.45) {
    return start + paragraphBreak
  }

  const lineBreak = window.lastIndexOf('\n')
  if (lineBreak > chunkSize * 0.55) {
    return start + lineBreak
  }

  const sentenceBreak = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('。'),
    window.lastIndexOf('! '),
    window.lastIndexOf('！'),
    window.lastIndexOf('? '),
    window.lastIndexOf('？')
  )
  if (sentenceBreak > chunkSize * 0.55) {
    return start + sentenceBreak + 1
  }

  const space = window.lastIndexOf(' ')
  if (space > chunkSize * 0.65) {
    return start + space
  }

  return hardEnd
}
