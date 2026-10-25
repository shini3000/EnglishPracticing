# English Practicing

> Practica inglés con un tutor por voz, entiende tus errores y convierte la práctica en progreso.

[![CI](https://github.com/shini3000/EnglishPracticing/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/shini3000/EnglishPracticing/actions/workflows/ci.yml)
[![Release](https://github.com/shini3000/EnglishPracticing/actions/workflows/release.yml/badge.svg)](https://github.com/shini3000/EnglishPracticing/actions/workflows/release.yml)

[Documentación](https://github.com/shini3000/EnglishPracticing/wiki) ·
[Instalación](https://github.com/shini3000/EnglishPracticing/wiki/Instalacion) ·
[Android](https://github.com/shini3000/EnglishPracticing/wiki/Android) ·
[Releases](https://github.com/shini3000/EnglishPracticing/releases) ·
[Reportar un problema](https://github.com/shini3000/EnglishPracticing/issues)

English Practicing es una aplicación de práctica oral con sesiones guiadas, correcciones
escritas y seguimiento individual. Combina conversación en tiempo real con ejercicios
autónomos: no todas las actividades necesitan una llamada ni una respuesta del tutor.

Disponible como **web** y **app nativa para Android**. La interfaz web admite español e
inglés; la interfaz Android permanece en **español**. Cada cuenta puede elegir el
idioma de las explicaciones. El idioma de aprendizaje es siempre **inglés**.

## Características

- **Tutor por voz:** conversación y actividades guiadas mediante LiveKit.
- **Correcciones escritas:** frase original, corrección, estructura y explicación, sin interrumpir con una explicación larga por voz.
- **Historial diario:** correcciones recientes primero, búsqueda y respuestas ocultables para practicar.
- **Mi progreso en Android:** resumen, aprendizaje, gr�ficas de m�tricas, sesiones y actividad con los mismos datos y c�lculos de la web.
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

- **Android:** Kotlin · Jetpack Compose · Clerk Android · LiveKit Android.
- **Web:** Next.js · React · TypeScript · next-intl.
- **Agente:** Python · LiveKit Agents.
- **Identidad y datos:** Clerk · PostgreSQL.
- **IA y voz:** DeepSeek, Gemini o Groq según configuración · Whisper en Groq · Edge TTS.

Consulta la [arquitectura](https://github.com/shini3000/EnglishPracticing/wiki/Arquitectura-e-interfaz)
y el [uso de proveedores](https://github.com/shini3000/EnglishPracticing/wiki/Proveedores-y-cuotas)
para conocer qué servicio interviene en cada actividad.

## Inicio rápido

### Requisitos locales de la web y el agente

- Git, Python **3.13**, Node.js **20 o posterior** y pnpm **9.15.9**. CI utiliza Node 24.
- Micrófono, navegador con permiso de audio y conexión a Internet.
- Docker con contenedores Linux, solo si vas a utilizar las imágenes.

### Cuentas y servicios necesarios

| Servicio | Qué debes preparar | Para qué se utiliza |
|---|---|---|
| [LiveKit Cloud](https://cloud.livekit.io/) | Un proyecto con URL, API key y API secret | Salas y conexión de audio entre navegador o Android y el agente. También se admite un servidor LiveKit propio. |
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

### Proveedores

Groq, Google Gemini y DeepSeek se seleccionan **por función**: conversación
(`LLM_PROVIDER`), corrección (`CORRECTION_PROVIDER`) y evaluación
(`GRADING_PROVIDER`). El corrector de ejercicios independientes se configura
además en el entorno web. Elegir un proveedor no cambia los demás ni habilita
fallback automático; configura la clave de cada función donde se ejecuta.

Whisper utiliza Groq, el transporte de voz utiliza LiveKit y Edge TTS genera la voz
del tutor. Los valores, ejemplos y límites están en la
[wiki de proveedores](https://github.com/shini3000/EnglishPracticing/wiki/Proveedores-y-cuotas)
y la [guía técnica](docs/ai-providers.md).

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

## Android

La app nativa incluye registro e inicio de sesión, llamadas por voz, transcripción,
correcciones, perfil y preferencias. La práctica B ofrece sus **cinco bloques**,
con pasos, cronómetros, grabación y revisión escrita donde corresponde.

Cada persona configura **su propio servidor y servicios** y compila su APK de uso
personal. Los agentes y las claves secretas se ejecutan en el servidor; no en el
teléfono. No se distribuye una APK ni un backend compartido.

Consulta la **[guía Android de la wiki](https://github.com/shini3000/EnglishPracticing/wiki/Android)**
para preparar el SDK, desplegar el backend y generar tu APK. El código está en
[`movil/android`](movil/android/README.md). Requiere Android 8.0 o posterior; la
estabilidad y el rendimiento en un teléfono físico siguen pendientes de medir.

## Documentación

La **[Wiki](https://github.com/shini3000/EnglishPracticing/wiki)** reúne las guías de uso y operación:

- **Practicar:** [Práctica A y diagnóstico](https://github.com/shini3000/EnglishPracticing/wiki/Practica-A-y-diagnostico) · [Práctica B](https://github.com/shini3000/EnglishPracticing/wiki/Practica-B).
- **Revisar resultados:** [Progreso](https://github.com/shini3000/EnglishPracticing/wiki/Progreso-y-aprendizaje) · [Correcciones](https://github.com/shini3000/EnglishPracticing/wiki/Historial-de-correcciones).
- **Android:** [Instalar y compilar tu APK](https://github.com/shini3000/EnglishPracticing/wiki/Android).
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
