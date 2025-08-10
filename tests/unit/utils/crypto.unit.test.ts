import { describe, it, expect, beforeEach } from 'vitest';
import { 
  hashPhoneNumber, 
  hashEmail, 
  hashAddress,
  hashCustomerIdentifiers,
  verifyHash,
  normalizePhoneNumber,
  normalizeEmail,
  normalizeAddress
} from '../../../app/utils/crypto.server';
import { resetAllMocks } from '../../setup/unit.setup';

describe('Crypto Utils', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('Phone Number Hashing', () => {
    it('should hash phone numbers consistently', () => {
      const phone1 = '+923001234567';
      const phone2 = '+92 300 123 4567';
      const phone3 = '03001234567';
      
      const hash1 = hashPhoneNumber(phone1);
      const hash2 = hashPhoneNumber(phone2);
      const hash3 = hashPhoneNumber(phone3);
      
      // All variations should produce the same hash
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toBe(hash3);
    });

    it('should produce different hashes for different phone numbers', () => {
      const phone1 = '+923001234567';
      const phone2 = '+923009876543';
      
      const hash1 = hashPhoneNumber(phone1);
      const hash2 = hashPhoneNumber(phone2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should return consistent hash length', () => {
      const phones = [
        '+923001234567',
        '+92300555777',
        '+923456789012'
      ];
      
      phones.forEach(phone => {
        const hash = hashPhoneNumber(phone);
        expect(hash).toHaveLength(64); // SHA-256 produces 64 character hex string
        expect(hash).toMatch(/^[a-f0-9]+$/); // Should be hex characters only
      });
    });

    it('should handle edge cases gracefully', () => {
      expect(() => hashPhoneNumber('')).toThrow('Input must be a non-empty string');
      expect(() => hashPhoneNumber('   ')).toThrow('Phone number cannot be empty after normalization');
      expect(() => hashPhoneNumber('invalid-phone')).toThrow('Invalid phone number format');
    });
  });

  describe('Email Hashing', () => {
    it('should hash emails consistently', () => {
      const email1 = 'test@example.com';
      const email2 = 'TEST@EXAMPLE.COM';
      const email3 = '  test@example.com  ';
      
      const hash1 = hashEmail(email1);
      const hash2 = hashEmail(email2);
      const hash3 = hashEmail(email3);
      
      // All variations should produce the same hash
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should produce different hashes for different emails', () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';
      
      const hash1 = hashEmail(email1);
      const hash2 = hashEmail(email2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should validate email format', () => {
      expect(() => hashEmail('invalid-email')).toThrow('Invalid email format');
      expect(() => hashEmail('')).toThrow('Input must be a non-empty string');
      expect(() => hashEmail('   ')).toThrow('Email cannot be empty after normalization');
    });

    it('should handle valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'number123@test.io'
      ];
      
      validEmails.forEach(email => {
        const hash = hashEmail(email);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]+$/);
      });
    });
  });

  describe('Address Hashing', () => {
    it('should hash addresses consistently', () => {
      const address1 = '123 Main Street, Karachi, Pakistan';
      const address2 = '123 main street, karachi, pakistan';
      const address3 = '  123 Main Street, Karachi, Pakistan  ';
      
      const hash1 = hashAddress(address1);
      const hash2 = hashAddress(address2);
      const hash3 = hashAddress(address3);
      
      // All variations should produce the same hash
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should normalize address formatting', () => {
      const address1 = '123  Main   Street,   Karachi,   Pakistan';
      const address2 = '123 Main Street, Karachi, Pakistan';
      
      const hash1 = hashAddress(address1);
      const hash2 = hashAddress(address2);
      
      expect(hash1).toBe(hash2);
    });

    it('should handle empty addresses', () => {
      expect(() => hashAddress('')).toThrow('Input must be a non-empty string');
      expect(() => hashAddress('   ')).toThrow('Address cannot be empty after normalization');
    });
  });

  describe('Customer Identifiers Hashing', () => {
    it('should hash all provided identifiers', () => {
      const customerData = {
        phone: '+923001234567',
        email: 'test@example.com',
        address: '123 Main Street, Karachi, Pakistan'
      };
      
      const hashedIdentifiers = hashCustomerIdentifiers(customerData);
      
      expect(hashedIdentifiers.phoneHash).toBeDefined();
      expect(hashedIdentifiers.emailHash).toBeDefined();
      expect(hashedIdentifiers.addressHash).toBeDefined();
      
      // Verify consistency with individual hashing
      expect(hashedIdentifiers.phoneHash).toBe(hashPhoneNumber(customerData.phone));
      expect(hashedIdentifiers.emailHash).toBe(hashEmail(customerData.email));
      expect(hashedIdentifiers.addressHash).toBe(hashAddress(customerData.address));
    });

    it('should handle partial identifiers', () => {
      const phoneOnly = { phone: '+923001234567' };
      const emailOnly = { email: 'test@example.com' };
      
      const phoneHash = hashCustomerIdentifiers(phoneOnly);
      const emailHash = hashCustomerIdentifiers(emailOnly);
      
      expect(phoneHash.phoneHash).toBeDefined();
      expect(phoneHash.emailHash).toBeUndefined();
      expect(phoneHash.addressHash).toBeUndefined();
      
      expect(emailHash.phoneHash).toBeUndefined();
      expect(emailHash.emailHash).toBeDefined();
      expect(emailHash.addressHash).toBeUndefined();
    });

    it('should require at least one identifier', () => {
      expect(() => hashCustomerIdentifiers({})).toThrow(
        'At least one identifier (phone, email, or address) must be provided'
      );
    });
  });

  describe('Hash Verification', () => {
    it('should verify correct hashes', () => {
      const phone = '+923001234567';
      const email = 'test@example.com';
      const address = '123 Main Street, Karachi, Pakistan';
      
      const phoneHash = hashPhoneNumber(phone);
      const emailHash = hashEmail(email);
      const addressHash = hashAddress(address);
      
      expect(verifyHash(phone, phoneHash, 'phone')).toBe(true);
      expect(verifyHash(email, emailHash, 'email')).toBe(true);
      expect(verifyHash(address, addressHash, 'address')).toBe(true);
    });

    it('should reject incorrect hashes', () => {
      const phone = '+923001234567';
      const wrongHash = 'incorrect-hash';
      
      expect(verifyHash(phone, wrongHash, 'phone')).toBe(false);
    });

    it('should handle invalid verification types', () => {
      const phone = '+923001234567';
      const phoneHash = hashPhoneNumber(phone);
      
      expect(() => verifyHash(phone, phoneHash, 'invalid' as any)).toThrow(
        'Invalid verification type'
      );
    });
  });

  describe('Normalization Functions', () => {
    describe('normalizePhoneNumber', () => {
      it('should normalize Pakistani phone numbers', () => {
        const testCases = [
          { input: '+923001234567', expected: '+923001234567' },
          { input: '03001234567', expected: '+923001234567' },
          { input: '+92 300 123 4567', expected: '+923001234567' },
          { input: '0300-123-4567', expected: '+923001234567' },
          { input: '+92-300-123-4567', expected: '+923001234567' }
        ];
        
        testCases.forEach(({ input, expected }) => {
          expect(normalizePhoneNumber(input)).toBe(expected);
        });
      });

      it('should handle international numbers', () => {
        const testCases = [
          { input: '+15551234567', expected: '+15551234567' },
          { input: '+447123456789', expected: '+447123456789' }
        ];
        
        testCases.forEach(({ input, expected }) => {
          expect(normalizePhoneNumber(input)).toBe(expected);
        });
      });
    });

    describe('normalizeEmail', () => {
      it('should normalize email cases and whitespace', () => {
        expect(normalizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
        expect(normalizeEmail('User.Name@Domain.COM')).toBe('user.name@domain.com');
      });
    });

    describe('normalizeAddress', () => {
      it('should normalize address formatting', () => {
        const input = '  123   Main   Street  ,  Karachi  ,  Pakistan  ';
        const expected = '123 main street, karachi, pakistan';
        
        expect(normalizeAddress(input)).toBe(expected);
      });
    });
  });

  describe('Security Properties', () => {
    it('should produce deterministic hashes', () => {
      const input = '+923001234567';
      const hash1 = hashPhoneNumber(input);
      const hash2 = hashPhoneNumber(input);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce avalanche effect for small changes', () => {
      const phone1 = '+923001234567';
      const phone2 = '+923001234568'; // Changed last digit
      
      const hash1 = hashPhoneNumber(phone1);
      const hash2 = hashPhoneNumber(phone2);
      
      expect(hash1).not.toBe(hash2);
      
      // Calculate Hamming distance (different characters)
      let differences = 0;
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) {
          differences++;
        }
      }
      
      // Should have significant differences (avalanche effect)
      expect(differences).toBeGreaterThan(20);
    });

    it('should not leak information about input length', () => {
      const shortPhone = '+92301234567';
      const longPhone = '+923001234567890';
      
      const shortHash = hashPhoneNumber(shortPhone);
      const longHash = hashPhoneNumber(longPhone);
      
      // Both hashes should be same length regardless of input length
      expect(shortHash.length).toBe(longHash.length);
      expect(shortHash.length).toBe(64);
    });
  });
}); 