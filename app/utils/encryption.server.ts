import crypto from 'crypto';
import { logger } from '../services/logger.server';

/**
 * Enhanced Encryption Service
 * 
 * Provides enterprise-grade encryption for sensitive data
 * Implements AES-256-GCM with proper key management
 */

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

interface DatabaseEncryptionResult {
  encryptedValue: string;
  keyId: string;
  version: string;
}

// Encryption configuration
const ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  tagLength: 16, // 128 bits
  saltLength: 32 // 256 bits for key derivation
};

// Key rotation tracking
interface EncryptionKey {
  id: string;
  key: Buffer;
  createdAt: Date;
  rotationDate: Date;
  isActive: boolean;
  version: string;
}

class EncryptionService {
  private primaryKey: Buffer;
  private keyHistory: Map<string, EncryptionKey> = new Map();
  private keyRotationInterval: number = 90 * 24 * 60 * 60 * 1000; // 90 days

  constructor() {
    this.initializePrimaryKey();
  }

  /**
   * Initialize primary encryption key from environment
   */
  private initializePrimaryKey(): void {
    const keyString = process.env.RETURNSX_ENCRYPTION_KEY;
    
    if (!keyString) {
      throw new Error('RETURNSX_ENCRYPTION_KEY environment variable is required');
    }

    if (keyString.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }

    // Use PBKDF2 to derive a proper key from the environment variable
    const salt = Buffer.from(process.env.RETURNSX_HASH_SALT || 'returnsx-salt', 'utf8');
    this.primaryKey = crypto.pbkdf2Sync(keyString, salt, 100000, ENCRYPTION_CONFIG.keyLength, 'sha256');

    // Create initial key entry
    const keyId = this.generateKeyId();
    const initialKey: EncryptionKey = {
      id: keyId,
      key: this.primaryKey,
      createdAt: new Date(),
      rotationDate: new Date(Date.now() + this.keyRotationInterval),
      isActive: true,
      version: '1.0'
    };

    this.keyHistory.set(keyId, initialKey);

    logger.info('Encryption service initialized', {
      component: 'encryption',
      keyId,
      algorithm: ENCRYPTION_CONFIG.algorithm,
      keyLength: ENCRYPTION_CONFIG.keyLength
    });
  }

  /**
   * Encrypt sensitive data with AES-256-GCM
   */
  public encrypt(plaintext: string, useKeyDerivation: boolean = false): EncryptedData {
    try {
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      let encryptionKey = this.primaryKey;
      let salt: Buffer | undefined;

      // Use key derivation for additional security if requested
      if (useKeyDerivation) {
        salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
        encryptionKey = crypto.pbkdf2Sync(this.primaryKey, salt, 10000, ENCRYPTION_CONFIG.keyLength, 'sha256');
      }

      const cipher = crypto.createCipherGCM(ENCRYPTION_CONFIG.algorithm, encryptionKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      const result: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt?.toString('hex')
      };

      return result;

    } catch (error) {
      logger.error('Encryption failed', {
        component: 'encryption',
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Encryption operation failed');
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  public decrypt(encryptedData: EncryptedData, keyId?: string): string {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      let decryptionKey = this.primaryKey;

      // Use specific key if keyId provided (for key rotation)
      if (keyId && this.keyHistory.has(keyId)) {
        decryptionKey = this.keyHistory.get(keyId)!.key;
      }

      // Handle key derivation if salt is present
      if (encryptedData.salt) {
        const salt = Buffer.from(encryptedData.salt, 'hex');
        decryptionKey = crypto.pbkdf2Sync(decryptionKey, salt, 10000, ENCRYPTION_CONFIG.keyLength, 'sha256');
      }

      const decipher = crypto.createDecipherGCM(ENCRYPTION_CONFIG.algorithm, decryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      logger.error('Decryption failed', {
        component: 'encryption',
        error: error instanceof Error ? error.message : String(error),
        keyId
      });
      throw new Error('Decryption operation failed');
    }
  }

  /**
   * Encrypt data for database storage with metadata
   */
  public encryptForDatabase(plaintext: string): DatabaseEncryptionResult {
    const activeKey = Array.from(this.keyHistory.values()).find(k => k.isActive);
    if (!activeKey) {
      throw new Error('No active encryption key found');
    }

    const encrypted = this.encrypt(plaintext, true); // Use key derivation for database
    
    // Combine all encryption components into a single string
    const encryptedValue = JSON.stringify(encrypted);

    return {
      encryptedValue,
      keyId: activeKey.id,
      version: activeKey.version
    };
  }

  /**
   * Decrypt data from database with metadata
   */
  public decryptFromDatabase(dbResult: DatabaseEncryptionResult): string {
    const encryptedData: EncryptedData = JSON.parse(dbResult.encryptedValue);
    return this.decrypt(encryptedData, dbResult.keyId);
  }

  /**
   * Generate a new encryption key for rotation
   */
  public rotateKey(): string {
    try {
      // Deactivate current key
      const currentKey = Array.from(this.keyHistory.values()).find(k => k.isActive);
      if (currentKey) {
        currentKey.isActive = false;
      }

      // Generate new key
      const newKeyMaterial = crypto.randomBytes(ENCRYPTION_CONFIG.keyLength);
      const keyId = this.generateKeyId();
      
      const newKey: EncryptionKey = {
        id: keyId,
        key: newKeyMaterial,
        createdAt: new Date(),
        rotationDate: new Date(Date.now() + this.keyRotationInterval),
        isActive: true,
        version: this.getNextVersion()
      };

      this.keyHistory.set(keyId, newKey);
      this.primaryKey = newKeyMaterial;

      logger.info('Encryption key rotated', {
        component: 'encryption',
        newKeyId: keyId,
        version: newKey.version,
        previousKeyId: currentKey?.id
      });

      return keyId;

    } catch (error) {
      logger.error('Key rotation failed', {
        component: 'encryption',
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Key rotation operation failed');
    }
  }

  /**
   * Check if key rotation is needed
   */
  public needsKeyRotation(): boolean {
    const activeKey = Array.from(this.keyHistory.values()).find(k => k.isActive);
    if (!activeKey) return true;

    return new Date() >= activeKey.rotationDate;
  }

  /**
   * Get encryption key status for monitoring
   */
  public getKeyStatus(): {
    activeKeyId: string;
    activeKeyAge: number; // days
    rotationDue: boolean;
    totalKeys: number;
    nextRotation: Date;
  } {
    const activeKey = Array.from(this.keyHistory.values()).find(k => k.isActive);
    
    if (!activeKey) {
      throw new Error('No active encryption key found');
    }

    const keyAge = Math.floor((Date.now() - activeKey.createdAt.getTime()) / (24 * 60 * 60 * 1000));

    return {
      activeKeyId: activeKey.id,
      activeKeyAge: keyAge,
      rotationDue: this.needsKeyRotation(),
      totalKeys: this.keyHistory.size,
      nextRotation: activeKey.rotationDate
    };
  }

  /**
   * Encrypt field-level data (for specific sensitive fields)
   */
  public encryptField(fieldName: string, value: string): string {
    // Add field name to the encryption context for additional security
    const contextualValue = `${fieldName}:${value}`;
    const encrypted = this.encrypt(contextualValue, true);
    return Buffer.from(JSON.stringify(encrypted)).toString('base64');
  }

  /**
   * Decrypt field-level data
   */
  public decryptField(fieldName: string, encryptedValue: string): string {
    try {
      const encryptedData: EncryptedData = JSON.parse(Buffer.from(encryptedValue, 'base64').toString());
      const decrypted = this.decrypt(encryptedData);
      
      // Remove field name context
      const prefix = `${fieldName}:`;
      if (!decrypted.startsWith(prefix)) {
        throw new Error('Field context mismatch');
      }
      
      return decrypted.substring(prefix.length);

    } catch (error) {
      logger.error('Field decryption failed', {
        component: 'encryption',
        fieldName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Field decryption operation failed');
    }
  }

  /**
   * Secure delete of key material from memory
   */
  public secureDeleteKey(keyId: string): void {
    const key = this.keyHistory.get(keyId);
    if (key && !key.isActive) {
      // Overwrite key material in memory
      key.key.fill(0);
      this.keyHistory.delete(keyId);

      logger.info('Encryption key securely deleted', {
        component: 'encryption',
        keyId
      });
    }
  }

  /**
   * Generate encryption key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get next version number for keys
   */
  private getNextVersion(): string {
    const versions = Array.from(this.keyHistory.values()).map(k => parseFloat(k.version));
    const maxVersion = Math.max(...versions, 0);
    return (maxVersion + 0.1).toFixed(1);
  }
}

// Singleton instance
const encryptionService = new EncryptionService();

/**
 * Public API functions
 */

/**
 * Encrypt sensitive data
 */
export function encryptSensitiveData(data: string): string {
  return encryptionService.encryptField('sensitive', data);
}

/**
 * Decrypt sensitive data
 */
export function decryptSensitiveData(encryptedData: string): string {
  return encryptionService.decryptField('sensitive', encryptedData);
}

/**
 * Encrypt for database storage
 */
export function encryptForDatabase(data: string): DatabaseEncryptionResult {
  return encryptionService.encryptForDatabase(data);
}

/**
 * Decrypt from database
 */
export function decryptFromDatabase(dbResult: DatabaseEncryptionResult): string {
  return encryptionService.decryptFromDatabase(dbResult);
}

/**
 * Get encryption service status
 */
export function getEncryptionStatus(): {
  isHealthy: boolean;
  keyStatus: ReturnType<EncryptionService['getKeyStatus']>;
  needsRotation: boolean;
} {
  try {
    const keyStatus = encryptionService.getKeyStatus();
    const needsRotation = encryptionService.needsKeyRotation();

    return {
      isHealthy: true,
      keyStatus,
      needsRotation
    };
  } catch (error) {
    logger.error('Encryption health check failed', {
      component: 'encryption',
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      isHealthy: false,
      keyStatus: {} as any,
      needsRotation: true
    };
  }
}

/**
 * Rotate encryption keys
 */
export function rotateEncryptionKeys(): string {
  return encryptionService.rotateKey();
}

/**
 * Hash sensitive data with salt (one-way) - DEPRECATED
 * This function has been removed as we now store raw customer data
 */

/**
 * Generate cryptographically secure random values
 */
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Verify data integrity with HMAC
 */
export function createDataIntegritySignature(data: string): string {
  const key = process.env.RETURNSX_HASH_SALT || 'default-key';
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * Verify data integrity signature
 */
export function verifyDataIntegritySignature(data: string, signature: string): boolean {
  const expectedSignature = createDataIntegritySignature(data);
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}

/**
 * Encrypt configuration values
 */
export function encryptConfiguration(config: Record<string, any>): Record<string, string> {
  const encrypted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.length > 0) {
      encrypted[key] = encryptionService.encryptField(key, value);
    } else {
      encrypted[key] = encryptionService.encryptField(key, JSON.stringify(value));
    }
  }

  return encrypted;
}

/**
 * Decrypt configuration values
 */
export function decryptConfiguration(encryptedConfig: Record<string, string>): Record<string, any> {
  const decrypted: Record<string, any> = {};
  
  for (const [key, encryptedValue] of Object.entries(encryptedConfig)) {
    try {
      const decryptedValue = encryptionService.decryptField(key, encryptedValue);
      
      // Try to parse as JSON, fallback to string
      try {
        decrypted[key] = JSON.parse(decryptedValue);
      } catch {
        decrypted[key] = decryptedValue;
      }
    } catch (error) {
      logger.error('Failed to decrypt configuration value', {
        component: 'encryption',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to decrypt configuration key: ${key}`);
    }
  }

  return decrypted;
}

/**
 * Memory-safe string comparison
 */
export function secureStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Export the service instance for advanced usage
export { encryptionService };

/**
 * Initialize encryption service on module load
 */
logger.info('Encryption service module loaded', {
  component: 'encryption',
  algorithm: ENCRYPTION_CONFIG.algorithm,
  keyLength: ENCRYPTION_CONFIG.keyLength
});
