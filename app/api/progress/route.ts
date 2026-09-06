import { env } from 'cloudflare:workers';
import { handleProgress } from '../../progress-service.mjs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleProgress(request, env.DB); }
export function POST(request: Request) { return handleProgress(request, env.DB); }
