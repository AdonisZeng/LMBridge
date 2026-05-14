import * as assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { resolveAppIconPath } from './app-icon.ts'

test('resolves the app icon path for development and packaged runs', () => {
  assert.equal(
    resolveAppIconPath({
      isDev: true,
      cwd: 'D:/Development/Electron/AI-Box',
      appPath: 'C:/Program Files/AI Box/resources/app.asar',
    }),
    join('D:/Development/Electron/AI-Box', 'electron/assets/icon.ico')
  )

  assert.equal(
    resolveAppIconPath({
      isDev: false,
      cwd: 'D:/Development/Electron/AI-Box',
      appPath: 'C:/Program Files/AI Box/resources/app.asar',
    }),
    join('C:/Program Files/AI Box/resources/app.asar', 'electron/assets/icon.ico')
  )
})

test('ships a custom icon without embedded iCCP PNG chunks', () => {
  const iconPath = resolveAppIconPath({
    isDev: true,
    cwd: process.cwd(),
    appPath: process.cwd(),
  })
  assert.equal(existsSync(iconPath), true)

  const icon = readFileSync(iconPath)
  const embeddedPngs = extractPngImagesFromIco(icon)
  assert.equal(embeddedPngs.length > 0, true)

  for (const png of embeddedPngs) {
    assert.equal(hasPngChunk(png, 'iCCP'), false)
  }
})

function extractPngImagesFromIco(icon: Buffer): Buffer[] {
  if (icon.length < 6 || icon.readUInt16LE(0) !== 0 || icon.readUInt16LE(2) !== 1) {
    return []
  }

  const images: Buffer[] = []
  const count = icon.readUInt16LE(4)
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16
    if (entryOffset + 16 > icon.length) {
      continue
    }

    const size = icon.readUInt32LE(entryOffset + 8)
    const imageOffset = icon.readUInt32LE(entryOffset + 12)
    const image = icon.subarray(imageOffset, imageOffset + size)
    if (image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      images.push(image)
    }
  }

  return images
}

function hasPngChunk(png: Buffer, chunkName: string): boolean {
  let offset = 8

  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('ascii')
    if (type === chunkName) {
      return true
    }

    offset += 12 + length
    if (type === 'IEND') {
      return false
    }
  }

  return false
}
