// Read-only connectivity check. Never print connection strings or user records.
const { neon } = require('@neondatabase/serverless');
for (const file of ['.env.local', '.env']) {
  try { process.loadEnvFile(file); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
(async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql.query('SELECT 1 AS ok', []);
    console.log('Neon HTTPS connectivity:', rows[0].ok === 1);
    const tables = await sql.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('practice_journal','learner_learning_items')", []);
    console.log('Learning tables present:', tables[0].count);
  } catch (error) {
    console.log('Database diagnostic:', error.name, error.code || 'no SQL code');
    process.exitCode = 1;
  }
})();
