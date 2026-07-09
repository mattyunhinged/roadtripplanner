import type { AIProviderId } from '../types';

export function detectProvider(key: string): AIProviderId | null {
  const trimmed = key.trim();
  if (trimmed.startsWith('sk-ant-')) return 'anthropic';
  if (trimmed.startsWith('sk-')) return 'openai';
  return null;
}

export function friendlyError(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const msg = error.message;
    const lower = msg.toLowerCase();
    if (lower.includes('quota') || lower.includes('rate')) {
      return 'API quota exceeded. Check your billing or try again later.';
    }
    if (lower.includes('invalid') && lower.includes('key')) {
      return 'That API key looks invalid. Double-check it in Settings.';
    }
    if (lower.includes('not found') || lower.includes('zero_results')) {
      return 'No route or places found for that request. Try adjusting the destination.';
    }
    // Zod dumps are useless in the UI — keep them short.
    if (msg.trim().startsWith('[') && msg.includes('"code"') && msg.includes('invalid_type')) {
      return 'Autopilot returned incomplete stop data. Retrying usually fixes it — hit generate again.';
    }
    if (msg.length > 280) {
      return `${msg.slice(0, 240).replace(/\s+/g, ' ')}…`;
    }
    return msg || fallback;
  }
  return fallback;
}

export function formatMiles(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function priceLevelLabel(level?: number): string {
  if (level == null) return '';
  return '$'.repeat(Math.max(1, Math.min(4, level)));
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
