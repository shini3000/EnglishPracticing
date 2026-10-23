# English Practicing

## Versiones publicadas

La versión **1.3.0** añade interfaz en español e inglés, preferencias por alumno
desde Clerk, historial de correcciones por día y mejoras de voz y práctica.
Consulta [las notas de versión](CHANGELOG.md#130---2026-10-23), incluido el
esquema adicional de preferencias para instalaciones existentes.

La primera versión estable fue **1.0.0**. Las versiones estables se publican
solo por decisión manual; subir un commit no aumenta el número. En GitHub,
**Actions → Release → Run workflow**, elige `patch` (corrección), `minor`
(funcionalidad compatible) o `major` (cambio incompatible). El pipeline calcula
el siguiente número, valida el proyecto y publica ambas imágenes con la misma
versión, además de una Release con notas. El workflow debe existir en la rama
predeterminada para que aparezca el botón. También se puede lanzar subiendo
una etiqueta Git `v1.0.0`, `v1.0.1`, etc.

```text
ghcr.io/shini3000/english-practicing-agent:1.3.0
ghcr.io/shini3000/english-practicing-web:1.3.0
```

`develop` sigue siendo una etiqueta móvil para pruebas. Las versiones numeradas
no se sobrescriben mediante el pipeline. Las claves privadas se proporcionan
al ejecutar el contenedor, nunca al construirlo.
Consulta [lanzamientos y recuperación ante fallos](docs/ci-cd.md#versiones-estables-manuales).

## Idiomas y perfil

Desde **tu avatar de Clerk → Preferencias**, cada cuenta elige su idioma nativo: **Español** o
**English**. Esa preferencia cambia la interfaz, los mensajes de Clerk y el idioma
de las explicaciones del tutor. El idioma de aprendizaje permanece fijo en **inglés**;
no tiene selector. El formulario se abre dentro de la ventana de cuenta de Clerk,
sin una pestaña «Perfil» adicional en la navegación. Los apartados de cuenta y seguridad
siguen gestionados por Clerk. `/profile` se conserva para enlaces directos desde las
prácticas. Las preferencias se cargan al abrir su apartado, con esqueleto y reintento;
no al renderizar el avatar. Se guardan en Postgres por usuario, no en `localStorage` ni en una
variable global. Las nuevas llamadas y revisiones toman el idioma del perfil desde
el servidor; las respuestas, citas y correcciones anteriores no se traducen ni se
reescriben. El micrófono sigue transcribiendo exclusivamente en inglés.

En instalaciones existentes aplica una vez la migración aditiva (no borra progreso):

```powershell
.\.venv\Scripts\python.exe scripts/apply_schema.py --profile-preferences
```

En una base nueva, el esquema completo ya incluye esa tabla. La web usa `next-intl`
con catálogos locales ES/EN y las mismas rutas; solo se carga el catálogo del idioma
activo. No se usa IA ni una API de traducción para la interfaz. La lectura de las
preferencias se reutiliza dentro de cada petición, nunca entre cuentas. Para mantener
las traducciones, consulta [la guía de internacionalización](web/i18n/README.md).

## Uso necesario de modelos y ahorro

### Navegación y carga del progreso

Prácticas muestra las opciones después de verificar la cuenta y el perfil;
no espera al análisis completo del historial. Sus cuatro indicadores se cargan
por separado mediante una sola consulta de cuatro columnas sobre las últimas
200 sesiones, con las mismas reglas de nivel y racha que Mi progreso. Si ese
resumen falla, las prácticas permanecen disponibles y no se muestran ceros falsos.

Al navegar entre Prácticas y Mi progreso aparecen esqueletos que respetan el
diseño de destino, con anuncios accesibles y sin animación si se solicita reducir
movimiento. En Mi progreso, aprendizaje, historial y estadísticas se cargan
independientemente y las consultas independientes se ejecutan en paralelo.
No se comparte una caché de datos personales entre usuarios ni se omite la
verificación de sesión. Estas cargas no llaman a modelos de IA. El modo de
desarrollo aún puede tardar más en compilar la primera visita que una imagen
de producción ya construida.

El paso de Gimnasia temporal al bloque 2 muestra un aviso de navegación en el
enlace y un esqueleto de la preparación de llamada mientras carga `/call`.
La carga no inicia llamadas ni abre el micrófono; conserva `practice=fluency`
y `start=anchors` para continuar en el bloque previsto.

La web usa `next/dynamic` (incluido en Next.js, sin librerías adicionales) para
cargar la interfaz de llamada cuando hay conexión, el diálogo de foto al abrirlo
y los visualizadores aura/grid/radial/wave solo cuando se renderiza esa variante.
Hay avisos de carga y se puede terminar la llamada mientras carga su interfaz.
La preparación, el proveedor de sesión y la recepción de progreso permanecen
disponibles desde el inicio. Esto difiere código del navegador, no reduce por sí
solo el consumo de API ni acelera las consultas a la base de datos.

Durante una llamada, la pantalla se divide en dos mitades: tutor y controles a
la izquierda, historial de correcciones a la derecha. El historial abre en el día
de hoy y muestra primero las correcciones más recientes, sin reemplazar las anteriores.
Permite cambiar de día, buscar frases o estructuras, ocultar respuestas
para reformular y volver a las correcciones de hoy. En móvil se apilan las
secciones. Los eventos recibidos en vivo se combinan por identificador con los
registros guardados, sin duplicar una misma corrección; los intentos técnicos
ya no aparecen como JSON. La consulta diaria recupera las correcciones de ese día
sin el antiguo límite global de 200 registros y usa la fecha de Colombia.

En el bloque 2, llegar a cero no corta la voz ni avanza al siguiente bloque.
Termina tu respuesta y pide feedback; el acceso al siguiente bloque se habilita
cuando el feedback escrito está disponible. Tú decides cuándo continuar.
Los cronómetros emiten dos tonos breves al terminar, sin repetirse ni cerrar el
micrófono. El navegador requiere una interacción para habilitar el sonido;
si es necesario, usa «Activar aviso sonoro». Esto no hace peticiones a modelos.

Al abrir la práctica B, `/practice-b` muestra sus cinco bloques y permite entrar
directamente a cualquiera. Gimnasia temporal y la preparación de llamada también
muestran el selector. Durante la llamada, «Ir a este bloque» cambia al comienzo
del bloque elegido tras confirmarlo; no completa los pasos omitidos ni recupera
el minuto exacto de una sesión anterior. El cambio queda registrado como navegación,
no como evidencia de aprendizaje. Confirma el tema para iniciar el nuevo cronómetro.

La entrada `/practice-b` muestra tarjetas visibles en dos columnas (una en móvil)
con los cinco bloques, su duración y acceso directo. Durante la práctica,
la navegación de bloques está en el borde izquierdo como una guía de rayas:
el bloque actual tiene una marca más larga. Al pasar el mouse o enfocar con Tab
se muestran el nombre y la duración o el paso actual. En móvil se usa el menú
«Bloques», sin depender de hover. Se mantienen las confirmaciones de cambio.

El bloque 3, Input activo con réplica inmediata, abre `/practice-b/input`, **sin
llamada**. Elige un video o podcast real en otra pestaña y sigue las instrucciones:
escucha (5 min), síntesis (3), postura (3) y PREP (4). El cronómetro se inicia,
pausa, reinicia y avanza manualmente; llegar a cero no corta la respuesta.
No abre micrófono, no transcribe, no usa LLM y no certifica aprendizaje ni guarda
evidencia evaluada. Desde una llamada, «Abrir bloque 3 sin llamada» termina la
conexión antes de navegar; el bloque 4 continúa con transcripción y corrección escrita.

El bloque 4 ahora abre `/practice-b/agility`: cinco minutos opcionales de preparación,
rondas de 4/3/2 minutos sobre la misma pregunta y dos descansos de 30 segundos.
La preparación sirve para elegir una postura y anotar palabras clave: todavía
no activa el micrófono ni la transcripción. Puedes pasar directamente a la primera
ronda sin esperar a que termine; la captura comienza al iniciar esa ronda.
Como el bloque 1, usa una conexión LiveKit **solo para transcripción en inglés**;
no hay conversación, TTS ni evaluación adicional al colgar. Cada ronda se cierra
explícitamente y se revisa por escrito mediante el mismo servicio de correcciones,
con caché separada por ejercicio y límites compartidos. El descanso comienza al
cerrar el micrófono, sin esperar la respuesta del modelo. Al terminar la última
ronda se desconecta la captura. Las revisiones se guardan por alumno como ensayos
del bloque 4 y se distinguen de Gimnasia temporal en Progreso; no certifican dominio,
pronunciación ni cadencia. Los enlaces antiguos de llamada se redirigen al ejercicio.

El reconocimiento de voz está fijado a inglés, sin detección automática, tanto en
el tutor como en Gimnasia temporal. Para preguntar en otro idioma, usa el chat de
texto de la llamada con el tutor. El idioma nativo de las explicaciones no cambia.
Esto orienta el reconocimiento a inglés; no detecta ni rechaza de forma infalible
el audio hablado en otro idioma.

### Uso de IA durante las prácticas

- El reloj tiene controles directos en pantalla (iniciar, pausar, continuar,
  terminar paso y finalizar) y guias fijas por etapa. No llaman al LLM. El avance
  requiere confirmacion del alumno; no certifica aprendizaje ni verifica por si
  solo que se haya realizado la tarea. Los comandos se aceptan solo del
  participante de la sesion, con deduplicacion y rechazo de pasos obsoletos.
- Gimnasia temporal reutiliza revisiones identicas del mismo alumno durante
  7 dias. La clave incluye modelo, version del corrector, idioma, rutina, paso,
  referencia y texto exacto o hash del audio. Reutilizar el mismo audio evita
  tambien transcribirlo otra vez. Cambiar esos datos requiere revision nueva.
  El reuso se guarda con fecha/hora nuevas, pero no es una evaluacion nueva
  ni evidencia independiente de dominio. El ID de modelo puede ser un alias:
  si cambia su version real, invalida el cache cambiando la version del corrector.
- La voz de la foto se elige explicitamente (Ahmad/Sara). Se elimino la llamada
  visual; `VISION_MODEL` queda como variable heredada sin uso. La animacion
  opcional bitHuman sigue siendo un servicio separado y puede consumir creditos.
- La busqueda pide fuentes sin sintesis de Tavily; el tutor prepara la respuesta.
  No se hacen busquedas por contar dias, guardar avances o calcular metricas.
- La evaluacion final sigue siendo una llamada necesaria para juicio global y
  errores no observados. Reutiliza citas/correcciones/explicaciones ya guardadas
  que realmente aparecen en la transcripcion: el evaluador solo referencia y
  clasifica las validas, sin volver a redactarlas. Si una es incorrecta o ambigua
  puede descartarla. No se reemplaza la evaluacion completa por un simple conteo.

La conversacion libre, la correccion contextual y la transcripcion de audio
siguen utilizando modelos. Texto pegado no llama a Whisper. Estadisticas,
fechas, persistencia y reglas de consolidacion permanecen en codigo.
El ahorro exacto depende del uso; no se garantiza un porcentaje ni cuota extra.

## Fechas y dias de practica

Se conservan instantes reales en UTC y se muestran fecha y hora en
`America/Bogota` (Colombia), tanto en servidor como navegador. Dos llamadas o
ejercicios el mismo dia se guardan por separado, pero no son dos dias de practica.
El historial de `/progress` agrupa llamadas y revisiones sin llamada por fecha,
con sus horas y correcciones desplegables. Las graficas por sesion siguen siendo
por sesion, no por dia; varias mediciones diarias no prueban retencion entre dias.
Las evidencias nuevas usan el timestamp del servidor para calcular la fecha;
las antiguas sin timestamp conservan su fecha registrada. Los ejercicios sin
llamada usan `created_at` de Postgres para el historial, incluso los anteriores
al cambio. No se reescriben ni inventan fechas de practicas pasadas.

## Practica B: bloque 1 con llamada y transcripcion automatica

En Inicio o en la preparacion de la practica B abre **Gimnasia temporal**
(`/drill`). Ejecuta el agente Python y el frontend, escribe tu rutina, elige el
idioma de las explicaciones y pulsa **Empezar práctica**. Ese único botón
conecta la llamada, espera al agente y abre el micrófono. El cronómetro arranca
cuando la captura está lista, no mientras conecta; puedes cancelar la preparación.
Cuatro pasos: presente 1 min, pasado 2 min, present perfect 2 min y segundo
ejemplo 2 min. El texto aparece automaticamente por fragmentos, tras las pausas
y el procesamiento de Whisper; no es dictado palabra por palabra. Las pausas y
el fin del cronometro NO terminan el paso. Pulsa **Terminar y ver correcciones** para
cerrar el microfono, esperar la transcripcion final y solicitar revision escrita.
No hay respuestas habladas ni correcciones durante la captura.
Después de la revisión, **Continuar** inicia directamente el siguiente tiempo
sin reconectar manualmente. La cuarta ronda pide otra rutina antes de empezar.
Si falla la revisión se conserva el texto y se puede reintentar sin grabar de nuevo.

Next.js necesita las claves privadas `DEEPSEEK_API_KEY`,
`DEEPSEEK_LLM_MODEL=deepseek-flash` en `web/.env.local` o
`web/.env`; el entorno del agente en la raiz NO se carga automaticamente en la
web. Nunca uses prefijos `NEXT_PUBLIC_` para estas claves. Reinicia el frontend.
Requiere `DATABASE_URL` y la tabla `practice_journal` ya instalada.

El agente usa `GROQ_API_KEY` y `STT_MODEL` de la raiz para transcribir la llamada.
El endpoint web conserva la opcion de audio para clientes anteriores, que si
requiere `GROQ_API_KEY` en el entorno web. La pantalla nueva envia solo texto.
El audio se envia a Groq/Whisper y se descarta en la aplicacion; DeepSeek revisa
la transcripcion y devuelve tarjetas, sin TTS. El proveedor puede aplicar su
propia politica de retencion. Se guardan texto y revision del alumno autenticado
en el diario como `drill_review` (y `drill_attempt` por peticion nueva), no como evidencia independiente de dominio.
No modifica las estadisticas de llamadas ni certifica minutos de habla. Este
endpoint tiene limites independientes de los presupuestos del agente: 3 intentos
por minuto y 60 por 24h/alumno, incluidos fallos. La exclusión de peticiones
simultaneas es por proceso; en despliegues multirreplica usa un limitador
distribuido. No es un limite monetario garantizado y consume saldo de las APIs
y minutos de LiveKit. La sesion de captura no crea un LLM, TTS, avatar ni una
segunda evaluacion al colgar. Un fallo de STT impide revisar una captura incompleta.

Tras el cuarto paso puedes abrir la preparacion de llamada directamente en
el bloque 2, sin marcar artificialmente el bloque 1 como completado por voz.
Al recargar el ejercicio se reinicia su estado local; los envios guardados
permanecen en el diario. El texto no enviado se pierde al salir; si se corta la
conexion, lo ya recibido permanece en pantalla mientras no cierres la pagina.

## Modalidad: Fluidez y resistencia (55 minutos)

En el selector previo a la llamada puedes elegir **Practica tipo A** (la practica
integral anterior, 145 minutos) o **Practica tipo B** (este plan de fluidez y
resistencia, 55 minutos). El diagnostico inicial permanece como opcion separada.

Selecciona **Practica tipo B** antes de llamar. Es una alternativa a la
practica diaria de 145 minutos y al diagnostico, no su reemplazo. Adapta el
[plan de referencia](prompts/curriculum/fluidez-real.md) en cinco bloques:

1. Gimnasia temporal, 7 min: misma rutina en presente, pasado y present perfect,
   seguida de un segundo contexto cotidiano.
2. Monologo con anclajes temporales, 10 min: circunloquio y ritmo comodo.
3. Input y replica, 15 min: escucha real, sintesis, contraste y ejemplo PREP.
4. Metodo 4–3–2, 15 min: 5 min de preparacion/reflexion, rondas de 4, 3 y 2 min,
   con dos descansos de 30 segundos. El panel distingue cada ronda y descanso.
5. Microauditoria, 8 min: produccion de 60–90 segundos, lectura de la transcripcion,
   hasta dos correcciones escritas, ensayo y transferencia a un contexto nuevo.

El horario suma 55 minutos, incluyendo 1 minuto de descanso; no equivale a 55
minutos hablando. El reloj no avanza de paso sin evidencia y confirmacion.
PREP ayuda a opiniones y STAR a narraciones. La progresion semanal se basa en
evidencia, no en alcanzar automaticamente la meta de enero del documento.
Repetir tres veces no demuestra dominio ni sustituye los repasos entre dias.
Las explicaciones mantienen el idioma nativo seleccionado; se practica en ingles.
La modalidad usa transcripcion, no activa grabacion de audio ni certifica
pronunciacion o cadencia. Las afirmaciones neurocientificas del archivo son
contexto del autor, no garantias del producto. Las pausas de STT siguen sujetas
a la deteccion de turnos configurada; la guia pide no interrumpir los monologos.

## Conversación con DeepSeek V4.1 Flash

La API oficial sirve V4.1 Flash mediante el identificador `deepseek-flash`.
En el `.env` de la raiz configura:

```dotenv
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=tu_clave_privada
DEEPSEEK_LLM_MODEL=deepseek-flash
GRADING_PROVIDER=deepseek
DEEPSEEK_GRADING_MODEL=deepseek-flash
```

Reinicia el agente. Con esa configuracion DeepSeek lleva conversacion y evaluacion
final, usando la misma clave y presupuestos compartidos cuando el modelo coincide.
Conserva `GROQ_API_KEY`: Whisper sigue utilizando Groq. La voz del avatar se elige manualmente.
LiveKit Cloud, las tarjetas y el progreso no cambian.
No hay fallback automatico ni llamadas a Gemini al elegir DeepSeek.
Si falta la clave se informa explicitamente; no se usa otro proveedor a escondidas.

Se usa el plugin OpenAI-compatible oficial de LiveKit y la API de DeepSeek,
sin intermediarios. El razonamiento esta desactivado para la conversacion por
voz. El presupuesto local es 32.000 tokens por solicitud (incluyendo herramientas
y reserva de salida de 1.024), hasta 48 turnos anteriores y 10 segundos maximos
de espera por cuota local. Estos valores no garantizan latencia del proveedor.

**La API de DeepSeek es de pago**, aunque su aplicacion de chat permita uso
gratuito. Revisa saldo y [precios oficiales](https://api-docs.deepseek.com/quick_start/pricing/).
Los limites `DEEPSEEK_*` son salvaguardas locales, no una cuota gratuita ni un
tope monetario garantizado. No actives recargas ni hagas pruebas reales si no
quieres consumir saldo. Para regresar usa `LLM_PROVIDER=groq` o `google`.

## Logs del agente

Se utiliza `logging` de Python con `python-json-logger`, `QueueHandler` /
`QueueListener` para escritura en segundo plano y `RotatingFileHandler`.
Arranca el agente normalmente: los registros se guardan automaticamente en
`logs/agent-<PID>.jsonl`, ademas de la consola administrada por LiveKit.
Cada linea es JSON, con fecha UTC, nivel, logger y campos de contexto.

Las llamadas al modelo registran `request_id`, proveedor, modelo, duracion,
consumo reportado, estado HTTP, esperas de cuota y reintentos. Las sesiones
tienen `session_id` y sala. No se registran prompts ni transcripciones en estos
eventos; los SDK HTTP se limitan a WARNING para evitar volcados de peticiones.
Las claves del entorno, Bearer y conexiones Postgres se ocultan como defensa
adicional, no como garantia de anonimizar cualquier dato arbitrario.

Para diagnosticar la demora, `llm.request.completed` separa `first_response_ms`
(primer contenido del proveedor) de `first_delivery_ms` (primera entrega al
flujo de voz/herramientas); ambos se miden desde el comienzo de la petición e
incluyen una eventual espera local de cuota. `tts.audio.first_byte` mide la
llegada del primer audio comprimido, no su reproducción. `voice.turn.metrics`
registra las métricas disponibles de LiveKit por mensaje: transcripción,
fin de turno, primer texto, primer audio y `e2e_latency_ms`. Esta última llega
hasta la salida de audio del agente; no garantiza el instante de escucha en
el navegador. No se registran frases ni respuestas en estos eventos.

La voz se decodifica progresivamente con el decodificador de LiveKit, sin
descargar primero todo el MP3. Se mantienen los 3 segundos de pausa para pensar.
El texto solo se entrega inmediatamente cuando no hay herramientas habilitadas
o están desactivadas con `tool_choice=none`. Si pueden llegar correcciones,
la narración espera a confirmar la respuesta completa para no leerlas en voz;
las llamadas de corrección ya recibidas se entregan sin esperar al final del
stream. No hay peticiones adicionales al modelo para conseguirlo.

Configuracion opcional en `.env`: `LOG_LEVEL=INFO`, `LOG_DIR=logs`,
`LOG_MAX_BYTES=5242880`, `LOG_BACKUP_COUNT=5`. La rotacion conserva un archivo
actual y cinco anteriores **por proceso**; archivos de procesos antiguos no
se eliminan automaticamente. No se comparte un archivo rotativo entre procesos.
En despliegues duraderos gestiona la retencion global con el recolector de logs
o una politica externa y protege el acceso a la carpeta. Los archivos se excluyen
de Git y Docker. Esto cubre el agente Python; no sustituye los logs de Next.js.

Para ver el archivo mas reciente en PowerShell:

```powershell
$latestLog = Get-ChildItem .\logs\agent-*.jsonl | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Get-Content -LiteralPath $latestLog.FullName -Tail 50 -Wait
```

La configuracion no corrige por si sola los fallos del proveedor: permite
identificarlos y medir las esperas. Los JSONL pueden enviarse despues a Loki,
Elastic u otro recolector; no se ha configurado ningun servicio externo.

## Conversación con Gemini o Groq

El agente admite ambos proveedores sin cambiar las herramientas de práctica,
las correcciones escritas ni el progreso. Groq sigue encargado de Whisper,
la evaluación final (`GRADING_MODEL`) y la visión del avatar: conserva su clave.
No hay cambio automático de proveedor ni consumo de Google cuando eliges Groq.

Para usar Google AI Studio, instala `requirements.txt` y agrega en el `.env`
de la raíz (nunca en las variables públicas del frontend):

```dotenv
LLM_PROVIDER=google
GOOGLE_API_KEY=tu_clave_nueva
GOOGLE_LLM_MODEL=gemini-3-flash-preview
GOOGLE_HISTORY_TURNS=48
GOOGLE_MAX_REQUEST_TOKENS=32000
GOOGLE_MAX_COMPLETION_TOKENS=2048
```

Reinicia el agente. Para volver al modelo existente, usa `LLM_PROVIDER=groq`;
`LLM_MODEL` conserva el modelo de Groq y `GOOGLE_LLM_MODEL` el de Gemini.
Gemini conserva hasta 48 turnos anteriores dentro del presupuesto, frente a 3
con Groq; el diario persistente sigue guardando las evidencias completas.
El presupuesto local de 32.000 tokens incluye entrada, herramientas y reserva
de salida; no utiliza automaticamente toda la ventana del modelo. Cambiar de
Flash Lite a Flash no implica por si solo una ventana mayor ni mas cuota gratis.
Las cuotas mostradas para Flash Lite no son las de Gemini 3 Flash: verifica el
modelo exacto en AI Studio antes de planificar sesiones de 150 minutos.

Los presupuestos `GOOGLE_*` del ejemplo son límites locales ilustrativos, no
una promesa de cuota gratis. Ajusta RPM, RPD y TPM a lo mostrado en
[AI Studio](https://aistudio.google.com/). El contexto del modelo y la cuota por
minuto/día son distintos. La estimación local usa un tokenizador aproximado;
Google determina el consumo real. No se garantiza una práctica larga con el
plan gratuito. La evaluación final de Groq mantiene su presupuesto independiente.
Consulta los [modelos actuales](https://ai.google.dev/gemini-api/docs/models)
y [límites de cuota](https://ai.google.dev/gemini-api/docs/rate-limits).
Si compartiste una clave, revócala y genera otra antes de usarla.

Tutor de inglés hablado con conversación por voz, correcciones escritas y práctica
acumulativa. El estudiante elige a Ahmad o Sara, su idioma nativo y el tipo de
sesión. **El idioma de aprendizaje siempre es inglés**: las explicaciones de las
tarjetas se escriben en el idioma nativo seleccionado.

El objetivo es producir inglés propio, entender los errores y volver a usar las
formas corregidas en situaciones nuevas. La metodología no consiste en memorizar
listas ni escuchar largos monólogos del tutor.

## Metodología de práctica

### 1. Diagnóstico inicial

Antes de seguir una rutina, se recomienda elegir **Diagnóstico inicial**. Dura
aproximadamente 30–40 minutos y recorre estas tareas:

1. Presentación personal, rutina y presente.
2. Narración en pasado y referencia de las terminaciones **-ed**.
3. Planes y predicciones.
4. Resolver un problema, explicar vocabulario y contrastar palabras.
5. Narración u opinión con preguntas de seguimiento.
6. Reparar una conversación: pedir aclaración y describir una palabra olvidada.
7. Revisión de evidencias, fortalezas y prioridades.

Las respuestas son en inglés, sin traductor, guion preparado ni lectura de
respuestas. El tutor no ofrece una respuesta modelo antes del intento.

El nivel CEFR/MCER es una estimación de la expresión oral, no una certificación.
El agente recibe transcripciones: **no evalúa directamente la pronunciación ni el
ritmo acústico**. Esos criterios quedan pendientes; no se inventa una nota /30
cuando faltan criterios evaluables.

### 2. Práctica diaria: 145 minutos efectivos

La ruta base se divide en tres bloques. Los descansos de 5–10 minutos entre bloques
no cuentan como práctica efectiva. Una jornada puede durar más que 145 minutos
de reloj por descansos, búsquedas y tiempo adicional para ver material.

Al comenzar, el tutor ofrece un tema propio o permite que el estudiante lo elija.
Se define una meta oral concreta y se recupera vocabulario pendiente. No se asume
que todo estudiante nuevo tiene nivel A2.

| Bloque | Paso | Minutos | Evidencia esperada |
|---|---|---:|---|
| 1 · Recuperación y diagnóstico | Preparación | 5 | Tema, objetivo oral y repasos |
| 1 | Recuperación sin leer | 15 | Uso nuevo de elementos pendientes; resultado por intento |
| 1 | Conversación espontánea | 20 | Ideas propias y 2–4 necesidades comunicativas observadas |
| 1 | Selección | 5 | Un patrón gramatical y elementos léxicos útiles |
| 2 · Estructura y escucha | Gramática aplicada | 20 | Frase personal, otro tiempo verbal, pregunta o hipótesis |
| 2 | Enlace e instrucciones | 2 | Material compartido y consigna clara |
| 2 | Primera escucha | 6 | Tema, hablante e idea principal, sin transcripción |
| 2 | Segunda escucha | 6 | 3–5 detalles y dos expresiones útiles |
| 2 | Shadowing | 8 | Repetición de un fragmento comprendido de 20–40 segundos |
| 2 | Paraphrasing | 8 | Resumen propio de 45–90 segundos y conexión personal |
| 3 · Transferencia y cierre | Conversación principal | 25 | Narrar, opinar, resolver y reutilizar lo aprendido |
| 3 | Taller léxico | 15 | Fichas completas y transferencia a contextos nuevos |
| 3 | Grabación y registro | 10 | Producción final de 2–3 minutos, balance y próximas revisiones |

Una etapa no cuenta como completada solo porque terminó su tiempo: requiere
evidencia. El tutor no debe cortar una respuesta para avanzar. El cronómetro
muestra bloque, paso y tiempo restante; puedes pedir **pausar**, **continuar** o
**terminar**. Si cierras antes, las actividades no confirmadas quedan pendientes.
El tiempo de llamada no equivale automáticamente al tiempo que hablaste.

La secuencia y las consignas se orientan mediante las instrucciones del modelo y
las herramientas del agente. El cronómetro mide tiempo; no certifica por sí mismo
que se haya alcanzado un objetivo pedagógico.

### 3. Correcciones escritas, recuperación oral

Cuando aparece un error gramatical o de estructura, se muestra una tarjeta con:

- Lo que dijiste y la frase corregida, conservando tu intención.
- La estructura o fórmula gramatical.
- Por qué hay un error, explicado en tu idioma nativo.
- Una tarea en inglés para reutilizar la forma correcta.

La explicación completa **no se narra por voz**. El tutor solo invita brevemente
a mirar la tarjeta y reformular. Puedes ocultarla para practicar sin leer.
Las tarjetas anteriores siguen disponibles en el registro.

Se distinguen errores, opciones más naturales y palabras o intenciones que necesitan
aclaración. Una transcripción dudosa no debe convertirse en una corrección inventada.
Después de revisar la tarjeta, se recupera la frase y se transfiere el patrón a
otra situación antes de cambiar de tema.

### 4. Vocabulario acumulativo

Primero se escucha producción espontánea. Luego se seleccionan **2–4 palabras,
colocaciones o expresiones** que ayuden a comunicar esas mismas ideas; no hay una
cuota de términos arbitrarios.

Cada ficha incluye necesidad observada, significado, patrón, pronunciación de
referencia, restricciones, colocaciones, dos ejemplos y una tarea de transferencia.
La pronunciación de referencia no es una evaluación de cómo habló el estudiante.

- Un elemento nuevo comienza **EN PRÁCTICA**.
- Se reutiliza hoy y se programa revisión a **+1, +3, +7 y +14 días**.
- Cada intento registra resultado: sin ayuda, con ayuda o falló.
- Pasa a **EN CONSOLIDACIÓN** al demostrar recuperación correcta en dos días.
- Se considera **CONSOLIDADA** con al menos tres días correctos sin ayuda,
  un intervalo mínimo de siete días y dos contextos diferentes.
- Repetir el modelo, leer una frase o usarla una sola vez no demuestra dominio.
- Tras 14 días sin recuperación independiente, pasa a **REPASO PENDIENTE**.
- Si vuelve a fallar, regresa a **EN PRÁCTICA**; se conserva su evidencia anterior.

El tutor recibe un conjunto breve de repasos vencidos y evidencias recientes,
no todo el historial dentro de cada petición.

### Estadísticas de aprendizaje

En **Progreso** (`/progress`) puedes ver vocabulario y estructuras por separado:
elementos trabajados, en consolidación, consolidados y repasos vencidos; días de
recuperación; usos sin ayuda, con ayuda y fallidos; porcentaje de éxito y una
gráfica diaria. Cada elemento muestra sus evidencias, días correctos, variedad de
contextos e intervalo entre prácticas.

Las palabras contadas en una transcripción se muestran como **palabras usadas**,
no como vocabulario aprendido. Los intentos antiguos sin contexto o sin evidencia
verificada se conservan, pero no acreditan consolidación. La valoración del tutor
sigue dependiendo de la transcripción: estas estadísticas no certifican dominio.

Después de esta actualización, desde la raíz:

```powershell
.\.venv\Scripts\python.exe scripts\apply_schema.py
.\.venv\Scripts\python.exe scripts\rebuild_learning.py
```

El segundo comando recalcula la tabla derivada `learner_learning_items` sin
reescribir ni borrar el diario original. Los nuevos intentos se validan contra
la intervención actual; se identifican como repetición, revisión o transferencia.

Si Postgres falla, la evidencia se conserva en una cola local
`.data/practice-pending.sqlite3` y se reintenta al guardar o iniciar otra práctica
desde el mismo equipo. La cola no se sube a Git ni se incorpora a la imagen Docker.
En un alojamiento efímero necesitas un volumen persistente para conservarla tras
reinicios del contenedor; el guardado remoto solo se confirma cuando se sincroniza.

Para Neon, el agente utiliza Postgres a través de un túnel WebSocket TLS (puerto
443), manteniendo las transacciones. Esto evita depender de que tu red permita
conexiones Postgres directas. Las otras bases Postgres siguen usando conexión
directa. El sitio conserva su driver HTTPS. No se requieren nuevas credenciales.

### 5. Escucha, shadowing y parafraseo

Se busca un video de 2–6 minutos relacionado con el tema. La aplicación muestra
el enlace y comprueba que la página abra. **Eso no garantiza reproducción,
subtítulos, duración ni calidad del audio**: el estudiante debe confirmarlos.

Primero se escucha sin transcripción, después se recuperan detalles con subtítulos
en inglés cuando existan. El shadowing usa un fragmento ya comprendido; finalmente
se explica el mensaje con palabras propias y se conecta con una experiencia.

Si no hay material adecuado, se reserva tiempo adicional para elegirlo o se utiliza
audio aportado por el estudiante. Si no se reprodujo material, la actividad queda
pendiente. La producción final puede hacerse en la llamada; conservar un archivo
de audio requiere una grabación aparte, no se genera automáticamente.

### 6. Ciclo semanal y evaluación

| Día | Enfoque sugerido |
|---|---|
| 1 | Universidad, rutinas y presente |
| 2 | Prácticas profesionales, pasado y presente perfecto |
| 3 | Emociones, causas y explicación |
| 4 | Viajes, futuro y condicionales |
| 5 | Tecnología, comparación y opinión |
| 6 | Integración; evaluación nueva en semanas pares |
| 7 | Escucha ligera o descanso activo |

La propuesta intensiva es de 120–150 minutos efectivos durante seis días, con
60–75 minutos de producción oral diaria, evaluación quincenal y revisión mensual.
La meta de 12–16 semanas es orientativa: **no garantiza un cambio de nivel**.
La carga debe reducirse si aparece fatiga persistente.

Los documentos de referencia están en [prompts/curriculum](prompts/curriculum):
[rol del profesor](prompts/curriculum/rol-del-profesor.md),
[práctica diaria](prompts/curriculum/practica-diaria.md),
[diagnóstico](prompts/curriculum/examen-diagnostico.md) y
[guía](prompts/curriculum/guia.md). Sus referencias a un MCP externo, español fijo
o archivos personales se adaptan a esta aplicación: cronómetro propio, idioma
nativo seleccionable y registro por alumno en Postgres.

## Arquitectura

El navegador se conecta a una sala LiveKit. El sitio Next.js valida el acceso y
firma el token; el agente Python escucha y conduce la práctica.

```text
Micrófono → Silero VAD → Whisper en Groq → GPT-OSS en Groq → Edge TTS → Altavoces
                                              ↓
                                  Tarjetas escritas y cronómetro
                                              ↓
                                  Registro acumulativo en Postgres
```

Ahmad y Sara son avatares dibujados en el navegador. Una foto animada mediante
bitHuman es opcional y puede requerir un plan de pago y créditos adicionales.
Sin base de datos, se puede conversar y ver evidencia de la llamada actual, pero
no se conserva el progreso entre sesiones. Sin bitHuman, funcionan los personajes
incluidos.

## Requisitos

- Python 3.13.
- Node.js 20 o posterior y pnpm; el proyecto declara pnpm 9.15.9.
- Un proyecto de [LiveKit](https://cloud.livekit.io/).
- Claves de [Groq](https://console.groq.com/keys) y [Tavily](https://app.tavily.com/).
- Opcional: Postgres; el frontend utiliza el driver de [Neon](https://neon.com/).
- Opcional: API de bitHuman para el avatar con foto.

Los servicios tienen cuotas independientes. Una sesión de 150 minutos no está
garantizada por sus planes gratuitos ni implica que se pueda practicar esa duración
todos los días del mes sin agotar algún servicio.

## Configuración de entorno

Hay **dos archivos independientes**; no se sincronizan automáticamente.

| Ubicación | Variables |
|---|---|
| Raíz: `.env` | LiveKit, Groq, Tavily, modelos, límites y tolerancia a pausas |
| Raíz: `.env`, opcionales | `PROGRESS_DATABASE_URL`, `BITHUMAN_API_SECRET` |
| Frontend: `web/.env.local` | LiveKit, `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`, `AGENT_NAME` vacío |
| Frontend, opcionales | `AVATAR_PASSCODE` |

Usa [.env.example](.env.example) para el agente y
[web/.env.example](web/.env.example) para el sitio. El frontend también admite
`web/.env` si ya lo estás usando; evita crear valores contradictorios en otro
archivo de mayor prioridad.

Las tres credenciales LiveKit deben coincidir en ambos archivos.
`PROGRESS_DATABASE_URL` y `DATABASE_URL` apuntan a la misma base, con nombres
distintos. **No pongas `DATABASE_URL`, `CLERK_*` ni `AGENT_NAME` en el
`.env` de la raíz:** el agente rechaza campos desconocidos.

El acceso usa **cuentas individuales de Clerk**, no `APP_PASSCODE` (ya no se usa).
Cada identidad se vincula a un UUID interno; las prácticas, vocabulario,
correcciones y estadísticas se consultan solo para esa persona. La foto del
menú abre la gestión de cuenta de Clerk. Cualquier persona que complete el
registro e inicie sesión puede practicar, sin listas manuales de usuarios.
`AVATAR_PASSCODE` sigue protegiendo la carga de fotos opcional.
Mantén `AGENT_NAME` vacío para asignar automáticamente el agente a las salas.

Antes de arrancar esta versión, configura Clerk y aplica la ampliación del
esquema. **No se vincula el progreso anterior por nombre ni correo.** Consulta
[configuración y migración segura de cuentas](docs/authentication.md).

El ejemplo de la raíz selecciona GPT-OSS 20B para conversar, GPT-OSS 120B para
evaluar, Whisper Turbo para transcribir y Qwen 3.8 para la foto opcional. Copia
esas selecciones explícitas: algunos valores predeterminados históricos del código
pueden corresponder a modelos retirados. No publiques tus archivos con secretos.

## Ejecutar localmente en Windows

Desde la raíz del proyecto, crea el entorno si todavía no existe:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path web/.env.local) -and -not (Test-Path web/.env)) {
    Copy-Item web/.env.example web/.env.local
}
```

Edita los archivos de entorno y sustituye los placeholders antes de iniciar.
Si no utilizas una opción, déjala comentada o elimina su línea; no dejes una
conexión de ejemplo como si fuera real.

Si configuraste la base de datos, aplica el esquema idempotente:

```powershell
.\.venv\Scripts\python.exe scripts\apply_schema.py
```

**Terminal 1 — agente**, desde la raíz:

```powershell
.\.venv\Scripts\python.exe main.py download-files
.\.venv\Scripts\python.exe main.py dev
```

Espera a que aparezca `registered worker`. La instalación y descarga se hacen
al preparar el entorno; los siguientes arranques solo necesitan `main.py dev`.

**Terminal 2 — sitio**:

```powershell
cd web
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000), entra con tu cuenta de Clerk
verificada, selecciona idioma nativo, modo y personaje, y permite el micrófono.
La misma cuenta recupera su historial en otro dispositivo; el nombre no es la
identidad. Detén cada proceso con `Ctrl+C`.

`main.py console` sirve para probar audio en la terminal; no sustituye al agente
en modo `dev` que atiende las llamadas del sitio.

## Pausas al hablar

El agente espera aproximadamente **3 segundos de silencio detectado** antes de
responder. Una pausa corta puede generar un segmento de transcripción separado,
pero no debería cerrar tu turno. Retomar la voz reinicia la detección del final.

Puedes ampliar el margen en el `.env` de la raíz:

```env
TURN_END_SILENCE_SECONDS=4.0
```

Reinicia el agente después de cambiarlo. Un margen mayor permite pensar, pero
también hace más lenta la respuesta cuando realmente terminaste.

## Ahorro de cuota de Groq

Cada petición incluye las reglas esenciales, el paso actual, evidencias breves y
hasta tres turnos anteriores. La respuesta actual y sus pares de herramientas se
conservan. No se consume otra petición para resumir todo el historial.

Se cuenta el tamaño localmente, se limita la salida y se ajusta la reserva con
el uso real informado por Groq. El contador se comparte entre procesos locales
de la misma clave/modelo mediante SQLite temporal. No puede conocer el consumo
desde otras computadoras o instancias.

Los límites conservadores incluidos en el ejemplo son:

```env
GROQ_TPM_BUDGET=7200
GROQ_TPD_BUDGET=180000
GROQ_RPM_BUDGET=24
GROQ_RPD_BUDGET=900
GROQ_MAX_REQUEST_TOKENS=3600
GROQ_MAX_COMPLETION_TOKENS=640
GROQ_MAX_WAIT_SECONDS=60
```

Estos valores **no aumentan la cuota del proveedor**. La generación especulativa
está desactivada; hay un único responsable de los reintentos, y no se repite una
respuesta que ya empezó. Si hace falta esperar, el cronómetro se pausa y el panel
lo indica. Una corrección escrita utiliza una invitación oral fija, sin otra
petición para narrar la tarjeta.

Una respuesta demasiado grande se trabaja en partes, sin recortarla silenciosamente.
La evaluación automática de toda una sesión puede quedar pendiente si su
transcripción o la cuota restante no caben: se conservan las métricas disponibles
y las evidencias del registro. No se presenta una muestra como evaluación completa.
El límite de audio de Whisper es independiente de los tokens del modelo.

## Registro y comprobaciones

Postgres conserva sesiones, métricas y el diario `practice_journal`. Las nuevas
evidencias se añaden; no se reemplazan las sesiones anteriores. El alumno puede
consultar el diario de la llamada y sus tarjetas. Si el guardado no está disponible,
la aplicación lo indica y las notas de esa llamada deben conservarse antes de salir.

```powershell
# Pruebas sin llamadas de pago o consumo a Groq.
.\.venv\Scripts\python.exe -m unittest discover -s tests -v

# Comprobación real: sí consume algunas peticiones de Groq.
.\.venv\Scripts\python.exe scripts\check_voice.py

# Desde web/
pnpm exec tsc --noEmit
pnpm build
```

## Resolución de problemas

| Síntoma | Qué revisar |
|---|---|
| Error `extra_forbidden: database_url` | En la raíz debe llamarse `PROGRESS_DATABASE_URL` |
| La llamada conecta y nadie habla | Agente registrado, mismas credenciales LiveKit y `AGENT_NAME` vacío |
| Error de modelo no disponible | Selecciones de modelos en el ejemplo de la raíz y acceso de tu cuenta |
| Groq devuelve 413 o 429 | Tamaño de petición, límites y uso restante; el panel muestra la espera |
| No se guarda progreso | Ambas conexiones a la misma base y esquema aplicado |
| Tutor responde durante una pausa | Aumentar `TURN_END_SILENCE_SECONDS` y reiniciar el agente |
| No aparece la foto animada | Clave, plan y créditos de bitHuman; usar Ahmad o Sara como alternativa |

## Despliegue y procedencia

### GitHub Actions e imágenes Docker

El workflow de GitHub Actions ejecuta las pruebas de Python y web, comprueba la
compilación y después construye imágenes separadas para el agente y la web.
En pushes a `develop`, `main` o `master` de este fork publica ambas imágenes en
GHCR, después de probarlas, usando el token temporal de GitHub. Los pull requests
no publican. No despliega ni necesita tus claves reales de LiveKit o de IA.

Imágenes: `ghcr.io/shini3000/english-practicing-agent:develop` y
`ghcr.io/shini3000/english-practicing-web:develop`. También hay etiquetas por SHA
para fijar una versión. Tus credenciales se proporcionan solo al ejecutar los
contenedores, mediante `--env-file` u otro mecanismo de secretos del servidor;
no forman parte de la imagen publicada.

En una ejecución manual puedes activar `export_images` para descargarlas como
artefactos con un día de retención. No se guardan imágenes en cada push.
Consulta [CI e imágenes Docker](docs/ci-cd.md) para ver las etapas, comandos
locales, el check obligatorio y los límites de las pruebas.

El frontend y el agente se despliegan por separado; sus variables también deben
configurarse por separado en el alojamiento. No reutilices sin revisar las referencias
de despliegue del autor original en `livekit.toml` o en los documentos históricos.

Fork de [Asad-Mhmood/EnglishTutor](https://github.com/Asad-Mhmood/EnglishTutor).
La documentación histórica adicional se conserva en [ARCHITECTURE.md](ARCHITECTURE.md)
y [DEPLOY.md](DEPLOY.md); algunos ejemplos reflejan la instalación original.
Este README describe la metodología y configuración de esta versión.
