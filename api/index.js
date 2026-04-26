/**
 * Vercel Edge Function XHTTP Relay
 * Streams XHTTP traffic to backend Xray server with SNI fronting
 */

// Cache target domain at module scope
const TARGET_DOMAIN = process.env.TARGET_DOMAIN?.replace(/\/$/, '') || '';

if (!TARGET_DOMAIN) {
  throw new Error('TARGET_DOMAIN environment variable is required');
}

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  }

  try {
    // Extract path from URL without allocating URL object
    const path = req.url.slice(req.url.indexOf('/', 8));
    const targetUrl = TARGET_DOMAIN + path;

    // Filter headers in single pass
    const headers = new Headers();
    const hopByHopHeaders = new Set([
      'connection', 'keep-alive', 'transfer-encoding', 'te', 
      'proxy-connection', 'proxy-authorization', 'upgrade'
    ]);

    for (const [key, value] of req.headers) {
      const lowerKey = key.toLowerCase();
      
      // Skip hop-by-hop headers
      if (hopByHopHeaders.has(lowerKey)) continue;
      
      // Skip Vercel-specific headers
      if (lowerKey.startsWith('x-vercel-')) continue;
      
      // Handle forwarded headers
      if (lowerKey === 'x-forwarded-host') {
        try {
          headers.set('host', new URL(TARGET_DOMAIN).host);
        } catch {
          headers.set('host', TARGET_DOMAIN);
        }
        continue;
      }
      
      // Forward client IP as x-forwarded-for
      if (lowerKey === 'x-real-ip') {
        headers.set('x-forwarded-for', value);
        continue;
      }
      
      headers.set(key, value);
    }

    // Set host header for target
    try {
      headers.set('host', new URL(TARGET_DOMAIN).host);
    } catch {
      headers.set('host', TARGET_DOMAIN);
    }

    // Build fetch options
    const options = {
      method: req.method,
      headers,
      redirect: 'manual'
    };

    // Include body for POST/PUT requests (XHTTP uses POST)
    if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
      options.body = req.body;
      options.duplex = 'half';
    }

    // Forward request to target
    const response = await fetch(targetUrl, options);

    // Filter response headers
    const responseHeaders = new Headers();
    for (const [key, value] of response.headers) {
      const lowerKey = key.toLowerCase();
      
      // Skip hop-by-hop headers
      if (hopByHopHeaders.has(lowerKey)) continue;
      
      responseHeaders.set(key, value);
    }

    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    // Return response with streaming body
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Relay error:', error);
    return new Response(`Relay Error: ${error.message}`, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      }
    });
  }
}

export const config = {
  runtime: 'edge'
};
