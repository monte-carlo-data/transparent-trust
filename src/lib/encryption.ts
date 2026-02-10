/**
 * Encryption utilities for sensitive data at rest.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * IMPORTANT: The ENCRYPTION_KEY should be stored in:
 * - Production: AWS Secrets Manager (transparent-trust/prod/encryption-key)
 * - Development: ENCRYPTION_KEY environment variable
 *
 * Requirements:
 * - At least 32 characters (256 bits)
 * - Stored securely (not in code)
 * - Different per environment
 *
 * Generate a key with: openssl rand -hex 32
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { logger } from "@/lib/logger";
import { getSecret } from "@/lib/secrets";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Cache for encryption key (loaded from Secrets Manager or env var)
let cachedEncryptionKey: string | null = null;

/**
 * Get the encryption key from AWS Secrets Manager or environment variable
 */
async function getEncryptionKey(): Promise<string> {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  try {
    // Try Secrets Manager first, fall back to env var
    cachedEncryptionKey = await getSecret("encryption-key", "ENCRYPTION_KEY");

    if (!cachedEncryptionKey || cachedEncryptionKey.length < 32) {
      throw new Error("ENCRYPTION_KEY must be at least 32 characters");
    }

    return cachedEncryptionKey;
  } catch (error) {
    logger.error("Failed to retrieve encryption key", error);
    throw new Error(
      "ENCRYPTION_KEY is required for encryption. " +
        "Set it in AWS Secrets Manager (transparent-trust/prod/encryption-key) " +
        "or as an environment variable. Generate one with: openssl rand -hex 32"
    );
  }
}

/**
 * Derives a 256-bit key from the encryption key using scrypt.
 * This provides key stretching and makes brute force attacks harder.
 */
async function deriveKey(salt: Buffer): Promise<Buffer> {
  const encryptionKey = await getEncryptionKey();

  // Use scrypt for key derivation (memory-hard, resistant to hardware attacks)
  return scryptSync(encryptionKey, salt, 32);
}

/**
 * Encrypts a plaintext string.
 * Returns a base64-encoded string containing: salt + iv + authTag + ciphertext
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted string, or empty string if input is empty
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    return "";
  }

  // Generate random salt and IV for each encryption
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from password + salt
  const key = await deriveKey(salt);

  // Create cipher and encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString("base64");
}

/**
 * Decrypts a base64-encoded encrypted string.
 *
 * @param encryptedBase64 - Base64-encoded string from encrypt()
 * @returns Decrypted plaintext string, or empty string if input is empty
 * @throws Error if decryption fails
 */
export async function decrypt(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64) {
    return "";
  }

  try {
    const combined = Buffer.from(encryptedBase64, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key from password + salt
    const key = await deriveKey(salt);

    // Create decipher and decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    // Log error but don't expose details (could be tampering attempt)
    logger.error("Decryption failed", error);
    throw new Error("Failed to decrypt value. The data may be corrupted or the encryption key may have changed.");
  }
}

/**
 * Checks if the encryption system is properly configured.
 * Call this at startup to fail fast if encryption is misconfigured.
 */
export async function isEncryptionConfigured(): Promise<boolean> {
  try {
    const key = await getEncryptionKey();
    return !!key && key.length >= 32;
  } catch {
    return false;
  }
}

/**
 * Checks if a string appears to be encrypted (base64 with correct length).
 * Note: This is a heuristic, not a guarantee.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;

  try {
    const decoded = Buffer.from(value, "base64");
    // Minimum length: salt (32) + iv (16) + authTag (16) + at least 1 byte ciphertext
    return decoded.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
