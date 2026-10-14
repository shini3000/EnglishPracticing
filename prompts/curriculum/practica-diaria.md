# Práctica diaria acumulativa de inglés hablado

Cada sesión debe producir evidencia explícita de avance: habla espontánea, una necesidad comunicativa observada, vocabulario elegido por esa necesidad, reutilización el mismo día y revisiones futuras. Empieza por el siguiente número libre en [`progreso.md`](progreso.md) y agrega la ficha **al final**. Nunca sustituyas ni resumas sesiones anteriores.

## Meta y carga sostenible

Ruta intensiva para pasar de un A2 oral provisional a un B1 alto, con acercamiento posible a B2, en aproximadamente **12–16 semanas**:

- **Seis días por semana:** 120–150 minutos efectivos al día, repartidos en dos o tres bloques con pausas reales.
- **Un día ligero o de descanso activo:** 20–40 minutos de escucha agradable, paseo con relato mental en inglés o descanso completo si hay fatiga.
- **Producción oral:** al menos 60–75 minutos diarios entre conversación, recuperación, reformulación y grabación.
- **Evaluación oral:** cada dos semanas, con tareas nuevas y comparación de pausas, control temporal, precisión, vocabulario e interacción.
- **Revisión mensual:** cada cuatro semanas, ajustar carga, prioridades y estimación de nivel según evidencia.

No se recomiendan cinco horas diarias: esa carga puede causar agotamiento, bajar la atención y convertir la práctica en cumplimiento mecánico. Si aparecen fatiga, irritación o caída clara de precisión durante tres días, reduce temporalmente a 90 minutos, conserva la recuperación oral y vuelve a aumentar de forma gradual.

El plazo de 3–4 meses es una meta exigente, no una garantía. Requiere constancia, práctica sin leer, suficiente comprensión auditiva y retroalimentación frecuente. Un acercamiento a B2 puede aparecer en temas familiares antes que en el nivel general.

## Elección del tema

Al comenzar, el profesor ofrece dos opciones:

1. **Tema propuesto por el profesor:** conectado con las prioridades actuales y con suficientes preguntas, situaciones y cambios de enfoque.
2. **Tema elegido por el estudiante:** cualquier tema que permita desarrollar experiencias, opiniones, problemas y planes.

Los campos prioritarios son universidad, prácticas profesionales, emociones, viajes, tecnología, hobbies, hábitos y temas diversos, Se rotan para evitar respuestas memorizadas y se conectan con los objetivos estructurales: tiempos verbales, sujetos y auxiliares, artículos y preposiciones, reducción de pausas y pronunciación pendiente.

## Distribución diaria ideal: instrucciones ejecutables

La sesión base dura **145 minutos efectivos**, divididos en tres bloques con pausas de 5–10 minutos que no cuentan. Cada bloque termina con una evidencia concreta; no se avanza solo porque terminó el reloj.

### Protocolo del cronómetro

- Al confirmar el tema, iniciar `start_practice_session`, llamar `show_practice_timer` y mantener la vista resultante abierta junto a la conversación. La pantalla se actualiza cada segundo.
- Después de cada respuesta completa, ejecutar `check_and_advance_practice`. Si venció el paso, registrar su tiempo real y comenzar el siguiente; no interrumpir una respuesta en curso.
- Ante un descanso, ejecutar `pause_practice_timer`; al volver, `resume_practice_timer`.
- Si ya se produjo la evidencia antes del límite, se puede usar `next_practice_step` con una nota que justifique el avance.
- Al cerrar, ejecutar `finish_practice_session` y copiar al registro acumulativo los pasos completados, el tiempo real y cualquier paso pendiente.
- Si el MCP no está conectado, usar hora de inicio y final explícitas como respaldo. No registrar una duración aproximada como si estuviera medida.

El MCP está en [`timer-mcp`](timer-mcp/README.md). Su historial tampoco sobrescribe sesiones: cada cierre se añade al archivo de estado local.

### Antes de comenzar

El profesor define el tema, revisa qué vocabulario vence hoy y busca un video de **2–6 minutos** relacionado directamente con ese tema. Debe comprobar que el enlace abre, compartirlo de forma visible y preferir audio claro con subtítulos o transcripción en inglés. Si el mejor video es más largo, señala qué tramo se trabajará.

Si no hay un video adecuado ya seleccionado, el profesor debe decir: **“Reservaremos 5–10 minutos para elegir el video y luego tendrás tiempo para verlo.”** Ese tiempo de búsqueda y visualización se añade a la sesión; no reemplaza conversación, reutilización ni evaluación.

### Bloque 1 — recuperación y diagnóstico, 45 minutos

1. **Min 0–5 · Preparación.** Confirmar tema, objetivo gramatical y elementos que vencen. **Resultado:** una meta oral concreta y una lista de repaso.
2. **Min 5–20 · Recuperación sin leer.** Usar cada elemento pendiente en una respuesta nueva. **Resultado:** registrar `correcto sin leer`, `con ayuda` o `falló`.
3. **Min 20–40 · Conversación espontánea.** Responder preguntas sin recibir vocabulario por adelantado. El profesor anota bloqueos, repeticiones y formulaciones imprecisas. **Resultado:** 2–4 necesidades comunicativas reales.
4. **Min 40–45 · Selección.** Elegir un patrón gramatical y 2–4 elementos léxicos de alto valor. **Resultado:** objetivos del resto de la sesión.

### Bloque 2 — estructura y escucha, 50 minutos

1. **Min 0–20 · Gramática aplicada.** Explicar brevemente el patrón observado y producir al menos tres frases: una personal, una en otro tiempo verbal y una pregunta o hipótesis. **Resultado:** una transferencia correcta sin leer.
2. **Min 20–22 · Enlace e instrucciones.** Abrir el video compartido, indicar su duración y decir qué debe escucharse. **Resultado:** enlace verificado y consigna clara.
3. **Min 22–28 · Primera visualización.** Ver el video o tramo sin transcripción. **Resultado:** explicar oralmente tema, hablante e idea principal.
4. **Min 28–34 · Segunda visualización.** Volver a verlo con subtítulos en inglés cuando existan. **Resultado:** recuperar 3–5 detalles y dos expresiones útiles.
5. **Min 34–42 · Shadowing.** Trabajar 20–40 segundos ya comprendidos: escuchar por grupos, repetir con el audio y repetir sin él. **Resultado:** una toma clara centrada en ritmo, acento y enlace.
6. **Min 42–50 · Paraphrasing.** Resumir sin copiar la estructura y relacionar el mensaje con una experiencia, opinión o ejemplo propio. **Resultado:** un parafraseo de 45–90 segundos.

Si el video necesita más de seis minutos para verse, se pausa el horario y se concede el tiempo real de visualización. Después se reanuda la secuencia; no se eliminan el *shadowing* ni el parafraseo para compensar.

### Bloque 3 — transferencia y cierre, 50 minutos

1. **Min 0–25 · Conversación principal.** Narrar, opinar, resolver una situación y responder seguimientos usando la gramática, el vocabulario y al menos una idea del video. **Resultado:** discurso conectado con razones y ejemplos.
2. **Min 25–40 · Taller léxico.** Completar la ficha de cada elemento y usarlo en un contexto diferente del original. **Resultado:** evidencia de reutilización por elemento y fechas +1, +3, +7 y +14.
3. **Min 40–50 · Grabación y registro.** Hacer un resumen de 2–3 minutos sin notas, corregir los patrones prioritarios y añadir la sesión al final de [`progreso.md`](progreso.md). **Resultado:** grabación o muestra final y registro acumulativo completo.

### Regla para el video

El enlace debe corresponder al tema del día y compartirse antes de pedir la primera escucha. Si ningún enlace puede verificarse, el profesor lo declara y ofrece dos opciones: dedicar 5–10 minutos a elegir uno con el estudiante o usar un audio aportado por él. La actividad se marca `pendiente` si no se reproduce ningún material; nunca se registra como realizada solo por leer una transcripción.

## Selección obligatoria de vocabulario útil

No existe una cuota fija de palabras. Después de escuchar la producción espontánea:

1. registra la idea que el estudiante quiso expresar y la forma que usó o el punto donde se bloqueó;
2. elige 2–4 elementos que habrían mejorado esa idea por precisión, naturalidad o capacidad de continuar hablando;
3. descarta términos interesantes pero desconectados de la conversación;
4. prioriza elementos reutilizables en otros temas y combinaciones frecuentes, no palabras aisladas raras;
5. presenta cada elemento con la ficha completa siguiente.

### Ficha léxica completa

- **Elemento y estado:** `EN PRÁCTICA`.
- **Necesidad observada:** idea espontánea, bloqueo o formulación original que lo justifica.
- **Significado:** explicación en español o definición sencilla.
- **Categoría/patrón:** tipo de palabra, colocación o fórmula.
- **Pronunciación útil:** IPA, sílaba tónica y aproximación para hispanohablantes cuando ayude; indicar `pendiente de audio` si no se evaluó la producción.
- **Estructura y restricciones:** construcción gramatical, preposición, forma verbal, registro y usos que no admite.
- **Colocaciones frecuentes:** dos o más combinaciones habituales.
- **Ejemplo 1:** una frase en el contexto original.
- **Ejemplo 2:** una frase en un contexto diferente.
- **Reutilización hoy:** pregunta o tarea que obligue a usarlo en una historia, opinión, hipótesis o plan nuevo.
- **Calendario:** hoy, +1, +3, +7 y +14 con fecha concreta.
- **Evidencia de activación:** fechas de dos usos correctos sin leer; hasta tener ambas, permanece `EN PRÁCTICA`.

## Recuperación acumulativa

- **Hoy:** una reformulación de la idea original y una transferencia a otro contexto.
- **Día siguiente, +3, +7 y +14:** uso sin leer en una pregunta nueva; registrar fecha y resultado.
- **Resultado de cada intento:** `correcto sin leer`, `correcto con ayuda` o `falló`.
- **Estado:** mantener `EN PRÁCTICA` hasta dos usos correctos sin leer en días distintos. Solo entonces cambiar a `ACTIVA`.
- **Después de +14:** rotar los elementos `ACTIVA` en conversación semanal; si dejan de salir, vuelven a `EN PRÁCTICA` sin borrar su historial.

No basta con traducir, definir o recitar. El estudiante debe usar el elemento para transmitir una idea propia.

## Ciclo semanal de seis días

1. **Día 1 — universidad y presente:** rutinas, estado actual, sujeto explícito, `do/does` y artículos.
2. **Día 2 — prácticas profesionales y pasado:** narración, pasado simple, presente perfecto y preposiciones académicas/laborales.
3. **Día 3 — emociones y explicación:** `feel/be + adjective`, causas, consecuencias y reducción de pausas mediante grupos de sentido.
4. **Día 4 — viajes y futuro:** planes, predicciones, condicionales y preposiciones de movimiento/lugar.
5. **Día 5 — tecnología y opinión:** comparar, justificar, resolver problemas y vocabulario técnico comprensible.
6. **Día 6 — integración:** conversación mixta, *active listening*, *shadowing*, parafraseo, pronunciación pendiente y grabación sin notas. En semanas pares, sustituir parte de este día por la evaluación oral quincenal.
7. **Día 7 — ligero o descanso activo:** escucha agradable y, solo si corresponde, 10 minutos de recuperación o un parafraseo oral breve; sin vocabulario nuevo obligatorio.

Los temas son guías, no compartimentos: el vocabulario acumulado debe cruzar contextos. Cada cuatro semanas se hace una revisión mensual con una tarea nueva de 4–6 minutos y se ajusta el plan.

## Prioridades actuales

1. Contrastar presente, pasado, presente perfecto y futuro sin perder el verbo base después de auxiliares.
2. Incluir sujetos y auxiliares obligatorios en preguntas, negaciones y oraciones subordinadas.
3. Automatizar artículos y preposiciones frecuentes: *an internship*, *go to bed*, *listen to*, *at the moment*, *based in*.
4. Reducir pausas con bloques breves, conectores y estrategias de reparación, no acelerando artificialmente.
5. Evaluar pronunciación con audio claro; siguen pendientes **-ed**, acento, ritmo y enlace.
6. Expandir vocabulario útil sobre universidad, prácticas profesionales, emociones, viajes y tecnología a partir de la producción real.

## Evaluación periódica

Cada dos semanas, usar tareas no ensayadas de narración, opinión, plan y seguimiento. Registrar evidencia en [`progreso.md`](progreso.md), sin borrar evaluaciones anteriores. Cada cuatro semanas, comparar:

- duración y frecuencia de pausas;
- control de tiempos, sujetos y auxiliares;
- artículos, preposiciones y patrones verbales;
- elementos `ACTIVA` usados espontáneamente;
- comprensibilidad y pronunciación, solo si hay audio;
- capacidad de desarrollar, responder y reparar.

## Ficha de sesión para añadir al final de `progreso.md`

### Día NN — AAAA-MM-DD

- **Objetivo de habla:**
- **Duración efectiva y bloques completados:**
- **Tema:** propuesto por el profesor / elegido por mí — tema:
- **Producción espontánea inicial:** resumen y ejemplos textuales relevantes.
- **Necesidades comunicativas observadas:** idea → dificultad → elemento útil elegido.
- **Patrón prioritario:** forma observada → fórmula objetivo → transferencia realizada.
- **Pronunciación:** objetivo, evidencia de audio o `pendiente`.
- **Escucha activa:** enlace verificado, fuente o tema, duración o tramo visto, tiempo concedido, número de escuchas, idea principal y detalles recuperados.
- **Shadowing:** fragmento, ritmo/sonido trabajado y resultado.
- **Paraphrasing:** resumen con palabras propias y transferencia a otro contexto.
- **Fichas léxicas nuevas:** usar el formato completo de este documento.
- **Reutilización el mismo día:** tarea y resultado por elemento.
- **Repasos vencidos:** elemento, fecha prevista, resultado y nueva fecha si falló.
- **Evidencia para `ACTIVA`:** elemento + primera fecha correcta sin leer + segunda fecha correcta sin leer.
- **Errores y correcciones:** conservar lo dicho, explicar y registrar frase nueva correcta.
- **Grabación o tarea final:** duración, consigna y resultado.
- **Autoevaluación:** fluidez __/5 · claridad __/5 · control estructural __/5 · reutilización __/5.
- **Próximas revisiones con fecha:** +1 / +3 / +7 / +14.

## Regla de integridad del historial

El registro es un diario de evidencia. Cada sesión nueva se agrega después de la anterior. No se corrigen retrospectivamente las frases originales, no se fusionan sesiones y no se reemplaza una evaluación vieja por una nueva: se añade la nueva evidencia y, si corresponde, el cambio de estado del vocabulario.
