import { existsSync, mkdirSync, readdirSync, copyFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      mkdirSync(dirname(destPath), { recursive: true })
      copyFileSync(srcPath, destPath)
    }
  }
}

export function migrateLegacyPaths(): void {
  const legacyRoot = 'C:\\Users\\33664\\.agents'
  if (!existsSync(legacyRoot)) {
    return
  }

  const newRoot = join(homedir(), '.agents')

  // If new root already has data, skip migration to avoid overwriting
  if (existsSync(newRoot)) {
    return
  }

  copyDirRecursive(legacyRoot, newRoot)

  // Rename legacy root to indicate migration is complete
  const backupPath = `${legacyRoot}.migrated-backup`
  if (!existsSync(backupPath)) {
    try {
      renameSync(legacyRoot, backupPath)
    } catch {
      // Ignore rename errors — migration data is already copied
    }
  }
}
