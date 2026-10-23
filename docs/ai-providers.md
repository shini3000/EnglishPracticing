# Proveedores de IA por función

Las funciones de texto admiten Groq, Google Gemini y DeepSeek. Elegir un proveedor
no cambia los demás ni activa fallback. Los modelos deben estar disponibles para
tu cuenta y admitir las capacidades que usa cada función: herramientas para
conversación y salida JSON para correcciones/evaluación.

## Configuración independiente

| Función | Entorno | Selector | Modelo |
|---|---|---|---|
| Conversación | Agente, `.env` | `LLM_PROVIDER` | `LLM_MODEL`, `GOOGLE_LLM_MODEL` o `DEEPSEEK_LLM_MODEL` |
| Tarjetas de llamada | Agente, `.env` | `CORRECTION_PROVIDER` | `CORRECTION_MODEL` o el modelo de conversación del proveedor elegido |
| Evaluación final | Agente, `.env` | `GRADING_PROVIDER` | `GRADING_MODEL`, `GOOGLE_GRADING_MODEL` o `DEEPSEEK_GRADING_MODEL` |
| Revisión de bloques 1 y 4 | Web, `web/.env.local` | `CORRECTION_PROVIDER` | `CORRECTION_MODEL` o `LLM_MODEL` / `GOOGLE_LLM_MODEL` / `DEEPSEEK_LLM_MODEL` |

Cada proceso necesita las claves que utiliza: `GROQ_API_KEY`, `GOOGLE_API_KEY` o
`DEEPSEEK_API_KEY`. Nunca se infiere el proveedor de las claves presentes ni se
acepta seleccionarlo desde la petición del alumno. Reinicia los procesos tras
cambiar el entorno. No requiere migración de base de datos.

Ejemplo del agente, sin claves reales:

```dotenv
LLM_PROVIDER=deepseek
DEEPSEEK_LLM_MODEL=deepseek-flash
CORRECTION_PROVIDER=groq
CORRECTION_MODEL=openai/gpt-oss-20b
GRADING_PROVIDER=google
GOOGLE_GRADING_MODEL=gemini-3-flash-preview
```

Ejemplo web, independiente de la conversación:

```dotenv
CORRECTION_PROVIDER=groq
CORRECTION_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=tu_clave_privada
```

Los identificadores son ejemplos de configuración, no un catálogo actualizado ni
una garantía de acceso. DeepSeek deja de ser necesario si no lo eliges en ninguna función.
Whisper sigue requiriendo Groq; Edge TTS y LiveKit no dependen de estos selectores.

## Comportamiento y compatibilidad

- **Instalaciones existentes:** sin `CORRECTION_PROVIDER`, las tarjetas de llamada
  siguen siendo redactadas por el modelo de conversación y el corrector web sigue
  en DeepSeek. Defínelo explícitamente en ambos entornos para separar las funciones.
- **Llamada:** cuando existe un corrector independiente, el tutor solicita revisión
  con una cita de la respuesta actual, sin redactar él mismo la tarjeta. Se revisa
  la respuesta una sola vez por sesión/configuración y se validan las citas antes
  de guardar. No se analiza cada fragmento de voz ni se duplica la revisión por error.
- **Ejercicios:** la autenticación, idioma del perfil, límites por alumno y guardado
  se mantienen. El caché diferencia alumno, ejercicio, proveedor, modelo, idioma,
  referencia y texto/audio. Cambiar de proveedor no reutiliza una revisión anterior.
- **Límites:** el agente usa los presupuestos del proveedor elegido y comparte su
  contador local por proveedor/clave/modelo. La web conserva sus límites persistentes
  por alumno y admite `CORRECTION_MAX_REQUEST_TOKENS` y
  `CORRECTION_MAX_COMPLETION_TOKENS`; no comparte el contador SQLite del agente.
  No son topes monetarios ni cuotas garantizadas. No se trunca evidencia para hacerla caber.
- **Errores:** no hay reintento del corrector ni cambio de proveedor automático.
  La web conserva el texto para reintentar; una evaluación fallida queda sin nota,
  no como cero errores. Una revisión en llamada fallida no guarda tarjetas ni un
  feedback ficticio. No se registran claves, frases ni cuerpos de error de las APIs
  en los eventos de corrección.

## Implementación y pruebas

- `agent/models.py`: conversación y selección de evaluación.
- `agent/corrections.py`: revisión de llamadas mediante el proveedor elegido.
- `progress/grading.py`: evaluación final con transporte nativo Google o clientes Groq/DeepSeek.
- `web/lib/correction-provider.ts`: transporte HTTP privado de correcciones web.
- `web/app/api/time-shifting/route.ts`: validación, caché y persistencia de ejercicios.

Las pruebas de Python y `pnpm test` usan dobles de los tres proveedores: no consumen
saldo y no garantizan que una clave o modelo concreto esté habilitado en tu cuenta.

Referencias de integración: [Gemini JSON](https://ai.google.dev/gemini-api/docs/structured-output),
[Gemini REST](https://ai.google.dev/api/generate-content) y
[Groq JSON](https://console.groq.com/docs/structured-outputs).
