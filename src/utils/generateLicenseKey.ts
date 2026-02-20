import crypto from 'crypto';

export function generateLicenseKey(prefix = 'CH') {
  const token = crypto.randomBytes(10).toString('hex').toUpperCase();
  return `${prefix}-${token.slice(0, 5)}-${token.slice(5, 10)}-${token.slice(10, 15)}-${token.slice(15, 20)}`;
}

