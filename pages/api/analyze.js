import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { url } = req.body;

  try {
    const start = Date.now();
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
      maxRedirects: 5,
    });
    const elapsed = (Date.now() - start) / 1000;
    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || 'No Title';
    const tech = detectTechnologies(html, response.headers);
    const headers = response.headers;
    const security = {
      HTTPS: url.startsWith('https://'),
      'Strict-Transport-Security': !!headers['strict-transport-security'],
      'Content-Security-Policy': !!headers['content-security-policy'],
      'X-Frame-Options': !!headers['x-frame-options'],
      'X-Content-Type-Options': !!headers['x-content-type-options'],
      'X-XSS-Protection': !!headers['x-xss-protection'],
    };
    const apiEndpoints = await scanAPIs(url);

    const report = {
      url,
      status_code: response.status,
      response_time: elapsed,
      score: calculateScore(security, response.status, elapsed),
      info: {
        Title: title,
        Server: headers.server || 'Unknown',
        'Total Links': $('a').length,
        'Total Forms': $('form').length,
        'Total Images': $('img').length,
        'Total Scripts': $('script').length,
      },
      technologies: tech,
      security,
      apis: apiEndpoints,
    };
    res.status(200).json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}

function detectTechnologies(html, headers) {
  const tech = { CMS: [], Frameworks: [], Servers: [], Languages: [], CDN: [] };
  const content = html.toLowerCase();
  const hdr = JSON.stringify(headers).toLowerCase();

  if (content.includes('wp-content') || content.includes('wp-includes')) tech.CMS.push('WordPress');
  if (content.includes('joomla') || content.includes('media/jui')) tech.CMS.push('Joomla');
  if (content.includes('drupal') || content.includes('sites/all')) tech.CMS.push('Drupal');
  if (content.includes('magento') || content.includes('skin/frontend')) tech.CMS.push('Magento');
  if (content.includes('shopify') || content.includes('cdn.shopify.com')) tech.CMS.push('Shopify');

  if (content.includes('laravel') || content.includes('csrfmiddlewaretoken')) tech.Frameworks.push('Laravel');
  if (content.includes('django') || content.includes('csrfmiddlewaretoken')) tech.Frameworks.push('Django');
  if (content.includes('react') || content.includes('__NEXT_DATA__')) tech.Frameworks.push('React');
  if (content.includes('vue') || content.includes('vue-router')) tech.Frameworks.push('Vue.js');
  if (content.includes('angular') || content.includes('ng-')) tech.Frameworks.push('Angular');

  if (hdr.includes('server: apache')) tech.Servers.push('Apache');
  if (hdr.includes('server: nginx')) tech.Servers.push('Nginx');
  if (hdr.includes('server: microsoft-iis')) tech.Servers.push('IIS');
  if (hdr.includes('cloudflare') || hdr.includes('cf-ray')) tech.Servers.push('CloudFlare');

  if (hdr.includes('x-powered-by: php')) tech.Languages.push('PHP');
  if (hdr.includes('x-powered-by: express') || hdr.includes('node')) tech.Languages.push('Node.js');
  if (hdr.includes('x-powered-by: python') || content.includes('django')) tech.Languages.push('Python');
  if (hdr.includes('x-powered-by: java') || hdr.includes('servlet')) tech.Languages.push('Java');

  if (hdr.includes('cloudflare')) tech.CDN.push('CloudFlare');
  if (hdr.includes('akamai') || hdr.includes('x-akamai')) tech.CDN.push('Akamai');
  if (hdr.includes('fastly')) tech.CDN.push('Fastly');
  if (hdr.includes('cloudfront') || hdr.includes('x-amz-cf')) tech.CDN.push('AWS CloudFront');

  return tech;
}

function calculateScore(security, status, time) {
  let score = 100;
  if (status !== 200) score -= 20;
  if (!security.HTTPS) score -= 30;
  if (security['Strict-Transport-Security']) score += 5;
  if (security['Content-Security-Policy']) score += 5;
  if (security['X-Frame-Options']) score += 5;
  if (time > 3) score -= 10;
  if (time > 5) score -= 10;
  return Math.max(0, Math.min(100, score));
}

async function scanAPIs(baseUrl) {
  const common = ['/wp-json/', '/api/', '/api/v1/', '/graphql', '/rest/', '/soap/', '/xmlrpc.php', '/admin/', '/phpmyadmin/', '/backup/', '/logs/'];
  const found = [];
  for (const path of common) {
    try {
      const testUrl = baseUrl.replace(/\/+$/, '') + path;
      const resp = await axios.head(testUrl, { timeout: 3000 });
      if (resp.status < 400) found.push({ endpoint: path, status: resp.status, type: 'HTTP' });
    } catch (e) {}
  }
  return found;
}
