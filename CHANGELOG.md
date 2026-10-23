# Historial de versiones

## 1.3.1 - 2026-10-23

### Proveedores independientes

- Correcciones configurables con Groq, Gemini o DeepSeek, tanto en llamadas
  como en los bloques 1 y 4 de la práctica B. DeepSeek deja de ser obligatorio.
- Evaluación final compatible con Gemini, además de Groq y DeepSeek.
- Selectores independientes para conversación, corrección y evaluación, con
  modelo configurable por función y sin fallback automático entre proveedores.
- Validación de respuestas JSON, citas observadas y límites de entrada; caché
  separado por proveedor/modelo y revisión pendiente ante fallos, sin notas ficticias.

### Documentación y actualización

- README reorganizado con requisitos, servicios, inicio rápido y enlaces a la Wiki.
- Guía técnica de proveedores y ejemplos de entorno ampliados.
- Configura `CORRECTION_PROVIDER` en el agente y en la web para separar ambos
  correctores. Si se omite, se conserva el comportamiento anterior: tarjetas de
  llamada en el modelo de conversación y corrector web en DeepSeek.
- Reinicia web y agente juntos; no requiere migración de base de datos ni
  modificar las claves de servicios que sigas utilizando.
- Pruebas aisladas de los tres proveedores, sin consumo de APIs reales.
- El pipeline publica las imágenes `1.3.1`; no despliega servicios ni migra bases.

## 1.3.0 - 2026-10-23

### Idiomas y preferencias

- Interfaz en español e inglés con next-intl y preferencias persistentes por alumno.
- Preferencias accesibles desde el menú de cuenta de Clerk; inglés como objetivo fijo.
- Traducciones de prácticas, progreso, controles y estados de carga.

### Práctica y correcciones

- Pantalla dividida entre llamada y correcciones, con búsqueda y respuestas ocultables.
- Historial por día, hoy por defecto y correcciones recientes primero; fecha de Colombia.
- Gimnasia temporal simplificada: rutina primero y captura lista antes del cronómetro.
- Bloque 2 espera feedback antes de continuar manualmente; llegar a cero no corta la voz.
- Aviso de dos tonos al terminar el cronómetro, sin llamadas a modelos.
- Bloque 4 explica la preparación opcional y separa los controles.

### Voz y actualización

- Mejoras de entrega de audio y registro de latencia; las correcciones siguen por escrito.
- Reiniciar web y agente juntos. Para una instalación existente sin preferencias,
  aplicar `python scripts/apply_schema.py --profile-preferences` con la conexión
  configurada. La migración es aditiva y no elimina progreso.
- El pipeline valida y publica imágenes `1.3.0`; no despliega ni migra bases reales.
- Las credenciales se suministran al ejecutar los contenedores, no en las imágenes.

## 1.2.0 - 2026-10-22

### Práctica B y navegación

- Selector inicial de cinco bloques con tarjetas visibles; entrada directa sin
  repetir ni marcar artificialmente como completados los bloques anteriores.
- Navegación lateral compacta con etiquetas al pasar el mouse o usar teclado;
  menú táctil en móvil, bloque actual resaltado y cambio manual con confirmación.
- Bloque 3 autónomo: instrucciones y cronómetro para escucha, síntesis, postura
  y PREP; sin micrófono, llamada ni solicitudes al modelo.
- Bloque 4: preparación y rondas 4–3–2, descansos de 30 segundos, captura de voz
  en inglés y corrección exclusivamente escrita. LiveKit se usa solo para
  transcripción; no hay conversación, TTS ni evaluación adicional al desconectar.
- Revisiones aisladas por alumno, guardadas como ensayos del bloque 4 y visibles
  en Progreso. Caché separada por ejercicio y límites de revisión compartidos.
- Los enlaces antiguos a los bloques 3 y 4 redirigen a las nuevas actividades.

### Voz y rendimiento

- Reconocimiento de voz fijado a inglés en ambas modalidades de captura;
  las preguntas en otro idioma se envían por chat escrito.
- Aviso inmediato y esqueleto al pasar de Gimnasia temporal a la llamada.
- Carga diferida con `next/dynamic` para la interfaz de llamada, el diálogo de
  foto y los visualizadores opcionales; sin dependencias nuevas.
- Controles para terminar la llamada mientras carga su interfaz.

### Actualización

- Actualiza y reinicia **web y agente** juntos para alinear las nuevas rutas y
  el modo de captura del bloque 4. No requiere cambios adicionales al esquema
  de 1.1.0 ni claves nuevas. Conserva Clerk, LiveKit, Groq y el corrector DeepSeek
  configurados en tiempo de ejecución; las imágenes no incluyen credenciales.
- Los cronómetros locales no certifican aprendizaje. El bloque 3 no guarda
  evidencia evaluada; las rondas repetidas son ensayos, no dominio consolidado.
- Este release publica imágenes, pero no despliega servicios ni migra bases reales.

## 1.1.0 - 2026-10-21

### Cuentas y progreso individual

- Acceso y registro mediante Clerk; cada cuenta tiene un perfil interno único.
- Registro abierto: una sesión válida permite practicar sin aprobar IDs manualmente.
- Menú de cuenta, gestión de perfil y cierre de sesión con Clerk, en español.
- Historial, correcciones, vocabulario y estadísticas aislados por persona.
- Las rutas antiguas de acceso por clave compartida ya no generan sesiones.
- Herramienta de administrador para vincular explícitamente un historial antiguo,
  con simulación por defecto y rechazo de asociaciones conflictivas.

### Navegación y rendimiento

- Prácticas no espera al análisis detallado del historial para mostrar sus opciones.
- Indicadores ligeros: una sola consulta, cargada por separado, sobre las últimas
  200 sesiones; conserva las reglas de nivel y racha del dashboard.
- Esqueletos de carga para Prácticas y Progreso, con avisos accesibles y respeto
  a la preferencia de movimiento reducido.
- Aprendizaje, historial y estadísticas aparecen de forma independiente;
  las consultas independientes se ejecutan en paralelo.
- Un fallo del resumen opcional no bloquea la selección de prácticas ni muestra
  datos ficticios como si fueran un historial vacío.

### Actualización necesaria

1. Configura `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` y
   `CLERK_AUTHORIZED_PARTIES` en el entorno de la **web**, junto con `DATABASE_URL`.
   Se proporcionan al ejecutar el contenedor, nunca al construirlo.
2. Antes de iniciar la nueva web, aplica `progress/schema.sql` mediante
   `python scripts/apply_schema.py` desde la raíz. Usa la misma base en web
   (`DATABASE_URL`) y agente (`PROGRESS_DATABASE_URL`). La ampliación añade
   `learners.clerk_user_id` y su índice único; no elimina historiales.
3. Las sesiones anteriores deben iniciar sesión de nuevo con Clerk.
   `APP_PASSCODE` ya no autentica y `CLERK_ALLOWED_USER_IDS` no se utiliza.
   `AVATAR_PASSCODE` sigue protegiendo la foto opcional.
4. No se reclama progreso antiguo por nombre ni correo. Planifica el enlace
   explícito antes de la primera visita autenticada si necesitas conservarlo.

Registrar usuarios habilita el consumo de tus cuotas de práctica. Los límites
existentes se conservan, pero el registro abierto no garantiza un límite de gasto
ni impide por sí solo el abuso mediante múltiples cuentas.

La publicación no despliega servicios, no aplica migraciones a bases reales y
no incluye credenciales en las imágenes.

Consulta [configuración y migración de cuentas](docs/authentication.md).

## 1.0.0 - 2026-10-21

- Primera publicación numerada de las imágenes del agente y la web en GHCR.
- Lanzamientos manuales con pruebas y comprobaciones de contenedores antes de publicar.
- Credenciales suministradas al ejecutar las imágenes; sin despliegue automático.
