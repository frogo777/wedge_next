import page from './page-template.mjs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  if (!request.headers.get('oai-authenticated-user-id')) {
    return new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt?return_to=%2F','Cache-Control':'no-store'}});
  }
  return new Response(page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"}});
}
