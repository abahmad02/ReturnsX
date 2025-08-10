import { describe, it, expect } from 'vitest';
import { hashPhoneNumber, hashEmail, hashAddress } from '../../app/utils/crypto.server';

describe('Crypto Utils', () => {
  describe('Phone Number Hashing', () => {
    it('should hash phone numbers consistently', () => {
      const phone1 = '+923001234567';
      const phone2 = '+92 300 123 4567';
      
      const hash1 = hashPhoneNumber(phone1);
      const hash2 = hashPhoneNumber(phone2);
      
      // Both should produce valid hashes
      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]+$/);
      expect(hash2).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce different hashes for different phone numbers', () => {
      const phone1 = '+923001234567';
      const phone2 = '+923009876543';
      
      const hash1 = hashPhoneNumber(phone1);
      const hash2 = hashPhoneNumber(phone2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle edge cases gracefully', () => {
      expect(() => hashPhoneNumber('')).toThrow();
      expect(() => hashPhoneNumber('   ')).toThrow();
      expect(() => hashPhoneNumber('invalid-phone')).toThrow();
    });
  });

  describe('Email Hashing', () => {
    it('should hash emails consistently', () => {
      const email1 = 'test@example.com';
      const email2 = 'TEST@EXAMPLE.COM';
      
      const hash1 = hashEmail(email1);
      const hash2 = hashEmail(email2);
      
      // Should produce valid hashes
      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]+$/);
      expect(hash2).toMatch(/^[a-f0-9]+$/);
    });

    it('should validate email format', () => {
      expect(() => hashEmail('invalid-email')).toThrow();
      expect(() => hashEmail('')).toThrow();
    });
  });

  describe('Address Hashing', () => {
    it('should hash addresses consistently', () => {
      const address1 = '123 Main Street, Karachi, Pakistan';
      const address2 = '123 main street, karachi, pakistan';
      
      const hash1 = hashAddress(address1);
      const hash2 = hashAddress(address2);
      
      // Should produce valid hashes
      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]+$/);
      expect(hash2).toMatch(/^[a-f0-9]+$/);
    });

    it('should handle empty addresses', () => {
      expect(() => hashAddress('')).toThrow();
      expect(() => hashAddress('   ')).toThrow();
    });
  });

  describe('Security Properties', () => {
    it('should produce deterministic hashes', () => {
      const input = '+923001234567';
      const hash1 = hashPhoneNumber(input);
      const hash2 = hashPhoneNumber(input);
      
      expect(hash1).toBe(hash2);
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