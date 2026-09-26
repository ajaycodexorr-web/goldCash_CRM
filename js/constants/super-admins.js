/**
 * Root Super Admin Accounts
 * Credentials live in Firebase Auth only (Authentication → Users).
 */

export const SUPER_ADMIN_ACCOUNTS = [
  {
    id: 'usr_admin',
    name: 'GoldCash Admin',
    email: 'goldcash.co@gmail.com'
  },
  {
    id: 'usr_admin_ritesh',
    name: 'Ritesh',
    email: 'ritesh@codexorr.com'
  }
];

export const SUPER_ADMIN_EMAILS = SUPER_ADMIN_ACCOUNTS.map(a => a.email);
export const SUPER_ADMIN_IDS = SUPER_ADMIN_ACCOUNTS.map(a => a.id);

export function isSuperAdminEmail(email) {
  return SUPER_ADMIN_EMAILS.includes((email || '').trim().toLowerCase());
}

export function getSuperAdminAccount(email) {
  const clean = (email || '').trim().toLowerCase();
  return SUPER_ADMIN_ACCOUNTS.find(a => a.email === clean) || null;
}
