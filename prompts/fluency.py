"""Executable stages adapted from curriculum/fluidez-real.md (reference only)."""
# label, minutes, block, current instruction; breaks are explicitly marked.
FLUENCY_STAGES = [
    ("Rutina en presente", 1, "1 · Gimnasia temporal", "Agree a familiar routine of 3–4 actions; learner narrates in present for 1 minute. Start only after topic confirmation."),
    ("La misma rutina en pasado", 2, "1 · Gimnasia temporal", "Retell the SAME actions as a finished past event; use past simple/continuous with a clear time anchor."),
    ("Experiencia acumulada", 2, "1 · Gimnasia temporal", "Retell the SAME actions as experience up to now with present perfect; distinguish finished past dates from unfinished periods."),
    ("Transferencia cotidiana", 2, "1 · Gimnasia temporal", "Choose a second everyday routine and shift present/past/present perfect; repetitions are rehearsal, not mastery."),
    ("Monólogo con anclajes", 10, "2 · Anclajes temporales", "Learner gives an extended monologue using temporal anchors at key ideas, circumlocution and deliberate pacing. Wait for explicit completion; no corrections mid-monologue."),
    ("Escucha activa", 5, "3 · Input y réplica", "Find and share a real English clip; learner confirms playback and listens for 5 minutes without Spanish subtitles. Never pretend to hear the clip or assess unavailable content."),
    ("Síntesis del argumento", 3, "3 · Input y réplica", "Ask for a 3-minute own-word synthesis of the speaker's argument. Distinguish learner report from independently verified clip content."),
    ("Postura y contraste", 3, "3 · Input y réplica", "Learner agrees/disagrees and explains why for 3 minutes, contrasting the argument with experience."),
    ("Aplicación con PREP", 4, "3 · Input y réplica", "Learner applies a real/hypothetical example: Point, Reason, Example, Point. Offer framework, not a memorized answer."),
    ("Preparación 4–3–2", 5, "4 · Agilidad y síntesis", "Agree one open question and outline a few keywords, no script. Explain rounds 4/3/2 minutes on SAME ideas, with 30-second breathing breaks. Setup/reflection fills remaining 5 minutes."),
    ("Ronda de 4 minutos", 4, "4 · Agilidad y síntesis", "Learner develops the agreed topic for 4 minutes. No follow-ups or corrections until explicit completion."),
    ("Descanso de 30 segundos", 0.5, "4 · Descanso", "Breathing break: 30 seconds, no production task. After expiry ask confirmation before next round; do not count as speaking."),
    ("Ronda de 3 minutos", 3, "4 · Agilidad y síntesis", "Retell SAME core ideas in 3 minutes with less digression. Wait for explicit completion; this is rehearsal, not independent retrieval."),
    ("Segundo descanso de 30 segundos", 0.5, "4 · Descanso", "Breathing break: 30 seconds. No task or speaking evidence; confirm readiness before next round."),
    ("Ronda de 2 minutos", 2, "4 · Agilidad y síntesis", "Retell SAME argument concisely in 2 minutes. Do not invent fluency or pronunciation scores from STT."),
    ("Microauditoría y próximos repasos", 8, "5 · Microauditoría", "Elicit 60–90 seconds of spontaneous speech; show faithful learner transcription in a text feedback card. Learner first spots third-person -s, tense consistency and missing subjects. Clarify ASR ambiguity. Show up to 2 priority corrections in text, rehearse each 3 times, then request a NEW-context unaided transfer and schedule future reviews. Save actual evidence and finish; never claim three repetitions overwrite habits or establish mastery."),
]

FLUENCY_POLICY = """
Fluency/resistance plan: 55 scheduled minutes, including 1 minute of breathing
breaks and 5 minutes of 4-3-2 setup/reflection. This replaces the 145-minute daily
plan for THIS mode. Five blocks: time shifting 7m, anchors 10m, listening/response
15m, 4-3-2 15m, microaudit 8m. Use familiar personal topics, not only software.
Respect short thinking pauses. During extended speaking wait for explicit
completion; if a speech turn ends early do not introduce a new question.
Use PREP for opinions and STAR for stories (Situation, Task, Action, Result).
Offer rescue phrases sparingly for organizing, returning to a point or self-repair.
Encourage a slightly slower comfortable pace; no imposed 15% or 120–150 WPM
target without a valid individual baseline. Fluency is not absence of all pauses.
Weekly progression: first tense consistency, then endurance toward 20 minutes,
then optional 30-minute simulations only when ready. No January guarantee and
no automatic promotion from calendar dates. Save a weekly assessment with topic,
observed tense difficulty, correction and next objective; do not invent history.
This mode does not itself record audio. Use existing STT as provisional evidence;
pronunciation/rhythm and uninterrupted audio performance require actual audio.
""".strip()
