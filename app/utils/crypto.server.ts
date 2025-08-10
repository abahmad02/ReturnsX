import { createHash } from 'crypto';

/**
 * ReturnsX Crypto Utilities
 * 
 * Provides secure hashing functions for PII data (phone numbers, emails, addresses)
 * Uses SHA-256 with salt for consistent, one-way hashing to protect customer privacy
 */

// Salt for hashing - should be set as environment variable in production
const HASH_SALT = process.env.RETURNSX_HASH_SALT || 'returnsx-default-salt-change-in-production';

/**
 * Creates a consistent hash for a given input string with salt
 * @param input - The string to hash
 * @returns SHA-256 hash of the salted input
 */
function createSecureHash(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Input must be a non-empty string');
  }
  
  const saltedInput = `${HASH_SALT}:${input.toLowerCase().trim()}`;
  return createHash('sha256').update(saltedInput).digest('hex');
}

/**
 * Hash a phone number for storage and lookup
 * Normalizes phone number format before hashing
 * @param phoneNumber - Phone number in any format
 * @returns Hashed phone number
 */
export function hashPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    throw new Error('Phone number is required');
  }
  
  // Normalize phone number - remove all non-digit characters
  const normalized = phoneNumber.replace(/\D/g, '');
  
  if (normalized.length < 10) {
    throw new Error('Phone number must have at least 10 digits');
  }
  
  return createSecureHash(normalized);
}

/**
 * Hash an email address for storage and lookup
 * Normalizes email format before hashing
 * @param email - Email address
 * @returns Hashed email address
 */
export function hashEmail(email: string): string {
  if (!email) {
    throw new Error('Email is required');
  }
  
  // Validate basic email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  
  // Normalize email - lowercase and trim
  const normalized = email.toLowerCase().trim();
  
  return createSecureHash(normalized);
}

/**
 * Hash a delivery address for storage and lookup
 * Normalizes address format before hashing
 * @param address - Full delivery address
 * @returns Hashed address
 */
export function hashAddress(address: string): string {
  if (!address) {
    throw new Error('Address is required');
  }
  
  // Normalize address - remove extra spaces, lowercase, trim
  const normalized = address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, '') // Remove special characters except spaces
    .trim();
  
  if (normalized.length < 10) {
    throw new Error('Address must be at least 10 characters long');
  }
  
  return createSecureHash(normalized);
}

/**
 * Hash customer identifiers for a complete customer profile
 * @param customerData - Object containing phone, email, and/or address
 * @returns Object with hashed identifiers
 */
export interface CustomerIdentifiers {
  phone?: string;
  email?: string;
  address?: string;
}

export interface HashedCustomerIdentifiers {
  phoneHash?: string;
  emailHash?: string;
  addressHash?: string;
}

export function hashCustomerIdentifiers(
  customerData: CustomerIdentifiers
): HashedCustomerIdentifiers {
  const hashed: HashedCustomerIdentifiers = {};
  
  if (customerData.phone) {
    hashed.phoneHash = hashPhoneNumber(customerData.phone);
  }
  
  if (customerData.email) {
    hashed.emailHash = hashEmail(customerData.email);
  }
  
  if (customerData.address) {
    hashed.addressHash = hashAddress(customerData.address);
  }
  
  if (!hashed.phoneHash && !hashed.emailHash && !hashed.addressHash) {
    throw new Error('At least one identifier (phone, email, or address) must be provided');
  }
  
  return hashed;
}

/**
 * Verify if a plain text identifier matches a hash
 * Useful for testing or verification purposes
 * @param plainText - The original identifier
 * @param hash - The stored hash
 * @param type - Type of identifier ('phone', 'email', 'address')
 * @returns boolean indicating if they match
 */
export function verifyHash(
  plainText: string, 
  hash: string, 
  type: 'phone' | 'email' | 'address'
): boolean {
  try {
    let computedHash: string;
    
    switch (type) {
      case 'phone':
        computedHash = hashPhoneNumber(plainText);
        break;
      case 'email':
        computedHash = hashEmail(plainText);
        break;
      case 'address':
        computedHash = hashAddress(plainText);
        break;
      default:
        throw new Error('Invalid hash type');
    }
    
    return computedHash === hash;
  } catch {
    return false;
  }
} 