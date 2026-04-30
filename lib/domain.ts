/**
 * Domain-level helpers and narrowed types.
 *
 * The persistence layer (`lib/types.ts`) has nullable fields like
 * `Client.phone`, `Client.callmebot_key`, `AppSettings.admin_phone`, etc.
 * Anywhere we want to send a WhatsApp, we have to check both at once.
 *
 * Instead of repeating `if (!c.phone || !c.callmebot_key) return;` in every
 * call site, narrow once and let the compiler enforce it everywhere else.
 */

import type { AppSettings, Client } from './types';

// ──────────────────────────────────────────────────────────────────────────
// NotifiableClient — a Client guaranteed to have a phone + CallMeBot key
// ──────────────────────────────────────────────────────────────────────────

export type NotifiableClient = Client & {
  phone: string;
  callmebot_key: string;
};

export function isNotifiableClient(c: Client): c is NotifiableClient {
  return Boolean(c.phone && c.callmebot_key);
}

// ──────────────────────────────────────────────────────────────────────────
// AdminRecipient — settings narrowed for sending notifications to admin
// ──────────────────────────────────────────────────────────────────────────

export interface AdminRecipient {
  phone: string;
  key: string;
  name: string;
}

export function getAdminRecipient(s: AppSettings | null | undefined): AdminRecipient | null {
  if (!s) return null;
  if (!s.admin_phone || !s.admin_callmebot_key) return null;
  return {
    phone: s.admin_phone,
    key: s.admin_callmebot_key,
    name: s.admin_name ?? 'Admin',
  };
}
