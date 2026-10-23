-- Additive, idempotent profile migration. No historical evidence is changed.
CREATE TABLE IF NOT EXISTS learner_preferences (
  learner_id uuid PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  native_language text NOT NULL DEFAULT 'es' CHECK (native_language IN ('es', 'en')),
  target_language text NOT NULL DEFAULT 'en' CHECK (target_language = 'en'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
