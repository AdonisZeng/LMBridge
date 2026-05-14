import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitTextIntoChunks } from './text-splitter.ts'

test('splits text into overlapping chunks with stable metadata', () => {
  const chunks = splitTextIntoChunks({
    text: ['Alpha beta gamma delta epsilon.', 'Zeta eta theta iota kappa.'].join('\n\n'),
    sourceId: 'doc-1',
    sourceName: 'notes.md',
    chunkSize: 24,
    chunkOverlap: 6,
  })

  assert.ok(chunks.length > 1)
  assert.equal(chunks[0].sourceId, 'doc-1')
  assert.equal(chunks[0].sourceName, 'notes.md')
  assert.equal(chunks[0].chunkIndex, 0)
  assert.equal(chunks[1].chunkIndex, 1)
  assert.ok(chunks.every((chunk) => chunk.content.length <= 24))
})

test('rejects empty text and invalid chunk settings', () => {
  assert.throws(
    () =>
      splitTextIntoChunks({
        text: '   ',
        sourceId: 'doc-1',
        sourceName: 'empty.txt',
      }),
    /does not contain readable text/
  )

  assert.throws(
    () =>
      splitTextIntoChunks({
        text: 'content',
        sourceId: 'doc-1',
        sourceName: 'bad.txt',
        chunkSize: 10,
        chunkOverlap: 10,
      }),
    /chunkOverlap must be smaller/
  )
})
