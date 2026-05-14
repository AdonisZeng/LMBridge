import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

export interface LoadedRagFile {
  id: string
  name: string
  path: string
  text: string
}

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.jsonl',
  '.csv',
  '.tsv',
  '.log',
  '.xml',
  '.html',
  '.htm',
  '.yaml',
  '.yml',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.scss',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
])

const MAX_FILE_BYTES = 8 * 1024 * 1024

export function loadTextFile(filePath: string): LoadedRagFile {
  const absolutePath = resolve(filePath)
  const stats = statSync(absolutePath)
  if (!stats.isFile()) {
    throw new Error(`${basename(absolutePath)} 不是文件`)
  }
  if (stats.size > MAX_FILE_BYTES) {
    throw new Error(`${basename(absolutePath)} 超过 8MB，暂不支持索引`)
  }

  const extension = extname(absolutePath).toLowerCase()
  if (!TEXT_EXTENSIONS.has(extension)) {
    throw new Error(`${basename(absolutePath)} 的格式暂不支持，请先转换为文本/Markdown/CSV/JSON`)
  }

  const buffer = readFileSync(absolutePath)
  if (buffer.includes(0)) {
    throw new Error(`${basename(absolutePath)} 看起来不是文本文件`)
  }

  const text = buffer.toString('utf8')
  const hash = createHash('sha256').update(absolutePath).digest('hex').slice(0, 16)

  return {
    id: hash,
    name: basename(absolutePath),
    path: absolutePath,
    text,
  }
}
