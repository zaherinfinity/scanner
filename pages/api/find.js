import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { domain, limit = 50 } = req.body;

  try {
    let targets = [];
    // 1. HackerTarget API (subdomain enumeration)
    try {
      const hackResp = await axios.get(`https://api.hackertarget.com/hostsearch/?q=${domain}`, { timeout: 8000 });
      const lines = hackResp.data.split('\n').filter(Boolean);
      const subdomains = lines.map(line => line.split(',')[0]).filter(s => s.includes(domain));
      targets = subdomains.map(s => `https://${s}`);
    } catch (e) { console.warn('HackerTarget failed, falling back to scraping'); }

    // 2. DuckDuckGo scraping for "site:domain"
    if (targets.length < limit) {
      const ddgTargets = await scrapeDuckDuckGo(domain, limit - targets.length);
      targets = [...targets, ...ddgTargets];
    }

    // 3. Fallback common subdomains if none found
    if (targets.length === 0) {
      const common = ['www', 'mail', 'admin', 'secure', 'portal', 'blog', 'shop', 'api'];
      targets = common.map(sub => `https://${sub}.${domain}`);
    }

    const unique = [...new Set(targets)].slice(0, limit);
    res.status(200).json({ targets: unique });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
}

async function scrapeDuckDuckGo(domain, needed) {
  const results = [];
  try {
    const url = `https://duckduckgo.com/html/?q=site%3A${encodeURIComponent(domain)}`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    $('a.result__url, a[href*="' + domain + '"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http') && href.includes(domain) && !results.includes(href)) {
        results.push(href);
      }
    });
  } catch (e) { console.warn('DuckDuckGo scrape failed', e.message); }
  return results.slice(0, needed);
}
