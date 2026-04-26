const TARGET_DOMAIN = process.env.TARGET_DOMAIN || '';

export default async function handler(req) {
  if (!TARGET_DOMAIN) {
    return new Response('TARGET_DOMAIN not configured', { status: 500 });
  }
  
  const path = req.url.slice(req.url.indexOf('/', 8));
  const response = await fetch(TARGET_DOMAIN + path, {
    method: req.method,
    headers: req.headers,
    body: req.body
  });
  return response;
}

export const config = { runtime: 'edge' };
