package com.englishpracticing.android.practice

data class ExerciseStep(val title: String, val seconds: Int, val instruction: String, val speaking: Boolean = false)
data class FluencyBlock(val title: String, val duration: String, val description: String, val startStep: Int? = null, val steps: List<ExerciseStep> = emptyList())

val fluencyBlocks = listOf(
    FluencyBlock("Gimnasia temporal", "7 min", "Cuenta la misma rutina en presente, pasado y present perfect.", steps = listOf(
        ExerciseStep("A · Presente", 60, "Elige una rutina conocida de 3–4 acciones. Descríbela en presente simple o continuo.", true),
        ExerciseStep("B · Pasado terminado", 120, "Cuenta LAS MISMAS acciones como algo ocurrido el año pasado. Usa pasado simple o continuo.", true),
        ExerciseStep("C · Experiencia acumulada", 120, "Transforma las mismas acciones en experiencia hasta hoy usando present perfect, sin fechas de pasado terminado.", true),
        ExerciseStep("D · Segunda rutina", 120, "Elige OTRA rutina cotidiana y exprésala en presente, pasado y present perfect.", true))),
    FluencyBlock("Monólogo con anclajes", "10 min · Con tutor", "Sostén una idea y conecta tus experiencias con referencias de tiempo.", startStep = 4),
    FluencyBlock("Input activo con réplica", "15 min · Sin llamada", "Escucha, resume el argumento y desarrolla tu propia postura.", steps = listOf(
        ExerciseStep("Escucha activa", 300, "Elige un video, entrevista o podcast real en inglés. Escucha sin subtítulos en español e identifica el argumento principal. Puedes abrirlo en otra app y volver aquí."),
        ExerciseStep("Síntesis del argumento", 180, "Pausa el material y explica en voz alta, en inglés y con tus propias palabras, qué dijo la persona y cuál es su argumento. No leas una transcripción."),
        ExerciseStep("Postura y contraste", 180, "Responde en inglés: ¿estás de acuerdo o en desacuerdo? Explica por qué y contrástalo con una experiencia propia."),
        ExerciseStep("Aplicación con PREP", 240, "Desarrolla tu respuesta en inglés con PREP: punto, razón, ejemplo y cierre. Usa un ejemplo conectado con lo que escuchaste."))),
    FluencyBlock("Agilidad y síntesis · 4–3–2", "15 min · Corrección escrita", "Expresa las mismas ideas en rondas de cuatro, tres y dos minutos.", steps = listOf(
        ExerciseStep("Preparación", 300, "Elige una pregunta abierta y anota unas palabras clave, sin escribir un guion. Mantendrás LAS MISMAS ideas en las tres rondas."),
        ExerciseStep("Ronda de 4 minutos", 240, "Desarrolla libremente tu respuesta a la pregunta durante cuatro minutos.", true),
        ExerciseStep("Descanso", 30, "Respira. El micrófono está cerrado. Confirma cuando estés listo para la siguiente ronda."),
        ExerciseStep("Ronda de 3 minutos", 180, "Cuenta LAS MISMAS ideas en tres minutos, quitando desvíos y mejorando las conexiones.", true),
        ExerciseStep("Segundo descanso", 30, "Respira y prepara una versión más concisa del mismo argumento."),
        ExerciseStep("Ronda de 2 minutos", 120, "Cuenta EL MISMO argumento central de forma concisa en dos minutos.", true))),
    FluencyBlock("Microauditoría", "8 min · Con tutor", "Revisa tus errores prioritarios y practica la corrección en otro contexto.", startStep = 15),
)

/** Monotonic deadline survives pauses, rotation and temporarily opening external material. */
fun secondsLeft(remaining: Int, deadline: Long?, now: Long): Int =
    if (deadline == null) remaining else (((deadline - now).coerceAtLeast(0) + 999) / 1000).toInt()

fun referenceForReview(block: Int, step: Int, reference: String): String =
    if (block == 0 && step in 1..2 || block == 3 && step in listOf(3, 5)) reference else ""
