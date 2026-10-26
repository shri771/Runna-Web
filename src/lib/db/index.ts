import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
}

/**
 * Two drivers, picked by host.
 *
 * Neon's HTTP driver avoids connection-pool exhaustion on serverless, which is
 * what production needs — but it speaks Neon's own protocol and cannot talk to
 * a plain Postgres. A local database gets postgres.js instead, so development
 * and testing need no cloud account at all.
 *
 * Both expose the same query-builder surface for everything this app does, so
 * the type is pinned to one of them rather than left as a union — a union of
 * the two collapses Drizzle's insert/update overloads.
 */
const isNeon = /\.neon\.tech|neon\.build/.test(connectionString)

export const db: PostgresJsDatabase<typeof schema> = isNeon
  ? (drizzleNeon(neon(connectionString), { schema }) as unknown as PostgresJsDatabase<typeof schema>)
  : drizzlePostgres(postgres(connectionString, { max: 5, prepare: false }), { schema })

export { schema }
