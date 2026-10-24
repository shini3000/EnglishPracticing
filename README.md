# English Practicing

> Practica inglés con un tutor por voz, entiende tus errores y convierte la práctica en progreso.

[![CI](https://github.com/shini3000/EnglishPracticing/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/shini3000/EnglishPracticing/actions/workflows/ci.yml)
[![Release](https://github.com/shini3000/EnglishPracticing/actions/workflows/release.yml/badge.svg)](https://github.com/shini3000/EnglishPracticing/actions/workflows/release.yml)

[Documentación](https://github.com/shini3000/EnglishPracticing/wiki) ·
[Instalación](https://github.com/shini3000/EnglishPracticing/wiki/Instalacion) ·
[Releases](https://github.com/shini3000/EnglishPracticing/releases) ·
[Reportar un problema](https://github.com/shini3000/EnglishPracticing/issues)

English Practicing es una aplicación de práctica oral con sesiones guiadas, correcciones
escritas y seguimiento individual. Combina conversación en tiempo real con ejercicios
autónomos: no todas las actividades necesitan una llamada ni una respuesta del tutor.

La interfaz y las explicaciones están disponibles en **español e inglés**.
El idioma de aprendizaje es siempre **inglés**.

## Características

- **Tutor por voz:** conversación y actividades guiadas mediante LiveKit.
- **Correcciones escritas:** frase original, corrección, estructura y explicación, sin interrumpir con una explicación larga por voz.
- **Historial diario:** correcciones recientes primero, búsqueda y respuestas ocultables para practicar.
- **Aprendizaje progresivo:** vocabulario y estructuras con evidencias, repasos y estadísticas entre días.
- **Cuentas individuales:** acceso con Clerk, preferencias e historial separados por alumno.
- **Actividades flexibles:** acceso directo a bloques, cronómetros y ejercicios con transcripción sin conversación.

## Modalidades

| Modalidad | Enfoque | Duración orientativa |
|---|---|---|
| Diagnóstico | Identificar fortalezas y prioridades | 30–40 min |
| Práctica A | Recuperación, conversación, gramática, escucha y transferencia | 145 min |
| Práctica B | Gimnasia temporal, monólogo, input activo, rondas 4–3–2 y microauditoría | 55 min |

Los tiempos corresponden al plan completo, no a minutos garantizados de habla.
Repetir una palabra una vez no la marca como aprendida; el nivel estimado no es una certificación.

## Stack

- **Web:** Next.js · React · TypeScript · next-intl.
- **Agente:** Python · LiveKit Agents.
- **Identidad y datos:** Clerk · PostgreSQL.
- **IA y voz:** DeepSeek, Gemini o Groq según configuración · Whisper en Groq · Edge TTS.

Consulta la [arquitectura](https://github.com/shini3000/EnglishPracticing/wiki/Arquitectura-e-interfaz)
y el [uso de proveedores](https://github.com/shini3000/EnglishPracticing/wiki/Proveedores-y-cuotas)
para conocer qué servicio interviene en cada actividad.

## Inicio rápido

### Requisitos locales

- Git, Python **3.13**, Node.js **20 o posterior** y pnpm **9.15.9**. CI utiliza Node 24.
- Micrófono, navegador con permiso de audio y conexión a Internet.
- Docker con contenedores Linux, solo si vas a utilizar las imágenes.

### Cuentas y servicios necesarios

| Servicio | Qué debes preparar | Para qué se utiliza |
|---|---|---|
| [LiveKit Cloud](https://cloud.livekit.io/) | Un proyecto con URL, API key y API secret | Salas y conexión de audio entre navegador y agente. También se admite un servidor LiveKit propio. |
| [Clerk](https://dashboard.clerk.com/) | Una aplicación con registro habilitado, Publishable key y Secret key; Google como método de acceso si lo deseas | Registro, inicio de sesión y cuentas individuales. |
| [Neon / PostgreSQL](https://neon.com/) | Una base de datos y su cadena de conexión; aplicar el esquema del proyecto | Identidad interna, preferencias, prácticas y progreso. La web usa el driver de Neon; no cualquier URL PostgreSQL es intercambiable sin adaptar el acceso. |
| [Groq](https://console.groq.com/keys) | Una cuenta y `GROQ_API_KEY` | Transcripción de voz con Whisper, incluso si eliges otro proveedor para conversar. También puede conversar y evaluar. |
| [Tavily](https://app.tavily.com/) | Una cuenta y `TAVILY_API_KEY` | Búsqueda de material y fuentes. La configuración actual del agente exige esta variable. |
| [DeepSeek](https://platform.deepseek.com/) | `DEEPSEEK_API_KEY`, solo para las funciones en las que lo selecciones | Alternativa para conversación, correcciones y evaluación. No es obligatorio. |
| [Google AI Studio](https://aistudio.google.com/) | `GOOGLE_API_KEY`, solo para las funciones en las que elijas Gemini | Alternativa para conversación, correcciones y evaluación. No es obligatorio. |
| [bitHuman](https://www.bithuman.ai/) | Credenciales y acceso al servicio, solo si quieres una foto animada | Avatar personalizado opcional; Ahmad y Sara no lo necesitan. |

**Para utilizar todas las modalidades con un solo proveedor de texto:** puedes usar
Groq para conversación, correcciones y evaluación, además de LiveKit, Clerk, Neon
y Tavily. DeepSeek, Google y bitHuman son opcionales. Edge TTS no requiere una API key
en esta implementación. Cada servicio tiene sus propias cuotas y condiciones.

### Proveedores implementados

La compatibilidad depende de la función, no solo del proveedor seleccionado:

| Función | Implementación disponible | Configuración |
|---|---|---|
| Conversación del tutor | Groq, Google Gemini o DeepSeek | `LLM_PROVIDER=groq`, `google` o `deepseek` en el agente |
| Evaluación final de la llamada | Groq, Google Gemini o DeepSeek | `GRADING_PROVIDER=groq`, `google` o `deepseek` en el agente |
| Transcripción en inglés | Whisper mediante Groq | `GROQ_API_KEY` y `STT_MODEL` en el agente |
| Correcciones durante la llamada | Groq, Google Gemini o DeepSeek | `CORRECTION_PROVIDER` y, opcionalmente, `CORRECTION_MODEL` en el agente |
| Revisión escrita de bloques 1 y 4 de práctica B | Groq, Google Gemini o DeepSeek desde Next.js | `CORRECTION_PROVIDER` y, opcionalmente, `CORRECTION_MODEL` en el entorno web |
| Síntesis de voz del tutor | Edge TTS | Voces configuradas en el agente; sin clave adicional |
| Búsqueda web | Tavily | `TAVILY_API_KEY` en el agente |
| Transporte de audio | LiveKit Cloud o servidor propio | Las mismas credenciales LiveKit en agente y web |

Cada función se selecciona por separado. Por ejemplo:

```dotenv
# .env del agente
LLM_PROVIDER=deepseek
CORRECTION_PROVIDER=groq
CORRECTION_MODEL=openai/gpt-oss-20b
GRADING_PROVIDER=google
GOOGLE_GRADING_MODEL=gemini-3-flash-preview
```

```dotenv
# web/.env.local: corrector de ejercicios independientes
CORRECTION_PROVIDER=groq
CORRECTION_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=tu_clave_privada
```

Configura la clave de cada proveedor seleccionado en el proceso que lo utiliza.
Para conversar se usa `LLM_MODEL`, `GOOGLE_LLM_MODEL` o `DEEPSEEK_LLM_MODEL`;
para evaluar, `GRADING_MODEL`, `GOOGLE_GRADING_MODEL` o `DEEPSEEK_GRADING_MODEL`.
Reinicia agente y web tras modificar su entorno. No hay cambios de base de datos.

En instalaciones anteriores, omitir `CORRECTION_PROVIDER` mantiene el corrector web
en DeepSeek y las tarjetas de llamada en el modelo de conversación. Defínelo
explícitamente en ambos entornos para separar las funciones. El corrector de llamada
solo recibe una respuesta al solicitar revisión; no analiza cada fragmento de voz.

Cambiar un proveedor no cambia los demás. No existe fallback automático entre
proveedores. Un fallo deja la revisión pendiente, no una nota perfecta; el texto
del ejercicio se conserva para reintentar. El caché distingue proveedor y modelo.
Los presupuestos locales limitan el tamaño enviado sin recortar silenciosamente
tu respuesta. No garantizan cuota ni acceso a todos los modelos de cada proveedor.

Consulta la [guía técnica de proveedores](docs/ai-providers.md) para los valores
predeterminados, límites y comportamiento de las correcciones en llamada.

Los comandos siguientes usan **PowerShell en Windows**. La instalación detallada
está en la [Wiki](https://github.com/shini3000/EnglishPracticing/wiki/Instalacion).

### 1. Preparar el proyecto

```powershell
git clone https://github.com/shini3000/EnglishPracticing.git
cd EnglishPracticing
git switch develop

py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2. Configurar el entorno

Si todavía no tienes archivos de entorno:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path web/.env.local) -and -not (Test-Path web/.env)) {
    Copy-Item web/.env.example web/.env.local
}
```

Completa [.env.example](.env.example) y [web/.env.example](web/.env.example) con tus valores.
Son entornos independientes: usa el mismo proyecto LiveKit y la misma base de datos
(`PROGRESS_DATABASE_URL` en el agente; `DATABASE_URL` en la web).

Configura Clerk y revisa la [guía de configuración y cuentas](https://github.com/shini3000/EnglishPracticing/wiki/Configuracion-y-cuentas)
antes de aplicar el esquema a la base seleccionada:

```powershell
.\.venv\Scripts\python.exe scripts\apply_schema.py
.\.venv\Scripts\python.exe main.py download-files
```

### 3. Ejecutar

En una terminal, desde la raíz:

```powershell
.\.venv\Scripts\python.exe main.py dev
```

Espera a `registered worker`. En otra terminal:

```powershell
cd web
pnpm install --frozen-lockfile
pnpm dev
```

Abre **[localhost:3000](http://localhost:3000)**, crea tu cuenta y elige una práctica.
El idioma se cambia desde **avatar de Clerk → Preferencias**.

> No publiques archivos `.env` ni claves privadas. Los servicios tienen cuotas y costes
> independientes; no se garantiza una sesión gratuita de 150 minutos.

## Documentación

### Android nativo y despliegue para móvil

- [`movil/android`](movil/android/README.md): cliente Kotlin con Jetpack Compose,
  pantalla inicial de modalidades y configuración para compilar una APK. La
  autenticación y las llamadas LiveKit todavía están pendientes de integrar.
- [`deploy/vps`](deploy/vps/README.md): despliegue Docker del agente y backend de
  APIs por HTTPS. La interfaz web permanece privada en esta configuración.
- [Horarios de la VM en Azure](deploy/vps/azure/README.md): encendido diario y
  apagado con desasignación para controlar el consumo de cómputo.

La **[Wiki](https://github.com/shini3000/EnglishPracticing/wiki)** reúne las guías de uso y operación:

- **Practicar:** [Práctica A y diagnóstico](https://github.com/shini3000/EnglishPracticing/wiki/Practica-A-y-diagnostico) · [Práctica B](https://github.com/shini3000/EnglishPracticing/wiki/Practica-B).
- **Revisar resultados:** [Progreso](https://github.com/shini3000/EnglishPracticing/wiki/Progreso-y-aprendizaje) · [Correcciones](https://github.com/shini3000/EnglishPracticing/wiki/Historial-de-correcciones).
- **Configurar:** [Cuentas e idiomas](https://github.com/shini3000/EnglishPracticing/wiki/Configuracion-y-cuentas) · [Proveedores y cuotas](https://github.com/shini3000/EnglishPracticing/wiki/Proveedores-y-cuotas).
- **Operar:** [Logs y solución de problemas](https://github.com/shini3000/EnglishPracticing/wiki/Logs-y-solucion-de-problemas) · [Docker, CI y versiones](https://github.com/shini3000/EnglishPracticing/wiki/Docker-CI-y-versiones).

Los [documentos de metodología](prompts/curriculum), las [guías técnicas de CI/CD](docs/ci-cd.md)
y el [historial de versiones](CHANGELOG.md) permanecen versionados junto al código.

## Docker y releases

Versión del código: **1.3.1**. Las imágenes se publican en GitHub Container Registry:

```text
ghcr.io/shini3000/english-practicing-agent:1.3.1
ghcr.io/shini3000/english-practicing-web:1.3.1
```

El lanzamiento se decide manualmente. El pipeline valida y publica ambas imágenes;
**no despliega servicios ni migra bases de datos**. Las credenciales se proporcionan
al ejecutar los contenedores, nunca al construirlos.
Consulta [Releases](https://github.com/shini3000/EnglishPracticing/releases)
y [Actions](https://github.com/shini3000/EnglishPracticing/actions) para comprobar cada publicación.

## Desarrollo

Pruebas del agente, desde la raíz:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Comprobaciones de la web, desde `web/`:

```powershell
pnpm test
pnpm lint
pnpm build
pnpm typecheck
```

Las pruebas de regresión usan dobles de servicios: no validan tus credenciales
ni sustituyen una prueba real de micrófono y conectividad.

Para reportar un problema, incluye pasos para reproducirlo y errores relevantes
**sin claves, cookies ni datos personales**. Los cambios de metodología deben mantener
la separación entre práctica realizada y aprendizaje demostrado.

## Créditos

Basado en [Asad-Mhmood/EnglishTutor](https://github.com/Asad-Mhmood/EnglishTutor).
Los archivos [ARCHITECTURE.md](ARCHITECTURE.md) y [DEPLOY.md](DEPLOY.md) se conservan
como documentación histórica del proyecto original; la guía actual está en la Wiki.
