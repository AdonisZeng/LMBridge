export interface EncryptedValue {
  encrypted: true
  data: string // base64
}

export function isEncryptedValue(value: unknown): value is EncryptedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as EncryptedValue).encrypted === true &&
    typeof (value as EncryptedValue).data === 'string'
  )
}

export type SecureValue = string | EncryptedValue

export async function encrypt(plaintext: string): Promise<EncryptedValue | null> {
  if (!plaintext) return null
  try {
    const result = await window.electronAPI.crypto.encrypt(plaintext)
    if (result === null) return null
    return { encrypted: true, data: result }
  } catch {
    return null
  }
}

export async function decrypt(encrypted: EncryptedValue): Promise<string | null> {
  try {
    return await window.electronAPI.crypto.decrypt(encrypted.data)
  } catch {
    return null
  }
}

export async function decryptAll(
  items: Record<string, SecureValue>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(items)) {
    if (isEncryptedValue(value)) {
      const decrypted = await decrypt(value)
      result[key] = decrypted ?? ''
    } else {
      result[key] = value
    }
  }
  return result
}
