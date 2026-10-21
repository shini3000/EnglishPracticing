import type { Sql } from '@/lib/db';

/**
 * Learner rows — the only module in the web half that writes to `learners`.
 *
 * Same rule as lib/progress/summary.ts: SQL lives in one place, and the routes above it deal
 * in Learner objects and know nothing about the schema.
 */

export interface Learner {
  id: string;
  username: string;
  displayName: string;
}

interface LearnerRow {
  id: string;
  username: string;
  display_name: string;
}

function toLearner(row: LearnerRow): Learner {
  return { id: row.id, username: row.username, displayName: row.display_name };
}

/**
 * Resolve an immutable Clerk subject to the existing internal UUID. New users get
 * fresh rows even when they have the same name as another user. Unique-index upsert
 * makes simultaneous first requests safe. Legacy rows require explicit admin linking.
 */
export async function resolveClerkLearner(
  sql: Sql,
  userId: string,
  displayName: () => Promise<string>
): Promise<string> {
  const existing = await sql<{ id: string }>`
    SELECT id FROM learners WHERE clerk_user_id = ${userId}
  `;
  if (existing.length) return existing[0].id;
  const name = (await displayName()).slice(0, 100);
  const rows = await sql<{ id: string }>`
    INSERT INTO learners (clerk_user_id, display_name)
    VALUES (${userId}, ${name})
    ON CONFLICT (clerk_user_id) DO UPDATE SET last_seen_at = now()
    RETURNING id
  `;
  return rows[0].id;
}

/**
 * Look up a signed-in learner by id, or null if the row is gone.
 *
 * A missing row is never a reason to select a different learner by name.
 */
export async function getLearner(sql: Sql, learnerId: string): Promise<Learner | null> {
  const rows = await sql<LearnerRow>`
    SELECT id, coalesce(username, display_name) AS username, display_name
    FROM learners WHERE id = ${learnerId}
  `;
  return rows.length > 0 ? toLearner(rows[0]) : null;
}
