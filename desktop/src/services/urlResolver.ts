/**
 * Lumina SI Browser - Intelligent URL and Natural Language Navigation Resolver
 * Resolves natural language commands, domain shortcuts, and search queries into valid URLs.
 */

const KNOWN_SITES: Record<string, string> = {
  linkedin: 'https://www.linkedin.com',
  'linkedin.com': 'https://www.linkedin.com',
  'www.linkedin.com': 'https://www.linkedin.com',
  google: 'https://www.google.com',
  'google.com': 'https://www.google.com',
  'www.google.com': 'https://www.google.com',
  youtube: 'https://www.youtube.com',
  'youtube.com': 'https://www.youtube.com',
  'www.youtube.com': 'https://www.youtube.com',
  github: 'https://www.github.com',
  'github.com': 'https://www.github.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  'x.com': 'https://x.com',
  reddit: 'https://www.reddit.com',
  'reddit.com': 'https://www.reddit.com',
  amazon: 'https://www.amazon.com',
  'amazon.com': 'https://www.amazon.com',
  netflix: 'https://www.netflix.com',
  spotify: 'https://open.spotify.com',
  gmail: 'https://mail.google.com',
  hackernews: 'https://news.ycombinator.com',
  'hacker news': 'https://news.ycombinator.com',
  laptops: 'http://127.0.0.1:8765/test-site/laptops',
  jobs: 'http://127.0.0.1:8765/test-site/jobs',
  booking: 'http://127.0.0.1:8765/test-site/booking',
};

export function resolveInputToUrl(rawInput: string): string {
  const input = rawInput.trim();
  if (!input) return 'https://www.google.com';

  // Already a full URL
  if (
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('about:') ||
    input.startsWith('file://')
  ) {
    return input;
  }

  const lower = input.toLowerCase();

  // Strip natural language action prefixes
  const stripped = lower
    .replace(/^(open|go\s+to|visit|launch|navigate\s+to|take\s+me\s+to|head\s+to)\s+/i, '')
    .trim();

  // Direct match in known sites
  if (KNOWN_SITES[stripped]) {
    return KNOWN_SITES[stripped];
  }

  // Look for site keyword anywhere in input (e.g. "open linkedin please")
  for (const [key, url] of Object.entries(KNOWN_SITES)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(stripped)) {
      return url;
    }
  }

  // Check if it's a domain with a valid TLD (e.g. "example.com", "bbc.co.uk", "localhost:8765")
  if (
    !stripped.includes(' ') &&
    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(stripped)
  ) {
    return `https://${stripped}`;
  }

  // Localhost or IP address with port
  if (/^localhost:\d+/.test(stripped) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/.test(stripped)) {
    return `http://${stripped}`;
  }

  // Single word with no spaces or dots -> default to .com domain
  if (!stripped.includes(' ') && !stripped.includes('.')) {
    return `https://www.${stripped}.com`;
  }

  // Fallback to web search
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}
