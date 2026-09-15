// Compile-only contract. A missing diagnostic also fails tsc (@ts-expect-error).
import { env } from 'cloudflare:workers';

env.DB.prepare('SELECT 1');
// @ts-expect-error An undeclared binding must not silently become `any`.
env.UNKNOWN_FINANCIAL_DATABASE.prepare('SELECT 1');
// @ts-expect-error D1 SQL must be a string.
env.DB.prepare({ sql: 'SELECT 1' });
