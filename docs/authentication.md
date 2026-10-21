# Cuentas individuales con Clerk

## Qué se guarda para cada persona

Clerk gestiona el registro, acceso, datos de cuenta, correo verificado y sesiones.
La aplicación conserva un UUID interno en `learners`, vinculado de manera única
al `user_...` de Clerk. Bajo ese UUID se guardan prácticas, transcripciones,
correcciones, vocabulario, evidencias de aprendizaje y estadísticas. Las
fechas/horas de práctica siguen siendo UTC con presentación en America/Bogota.

El perfil interno se crea en la primera visita con sesión de Clerk: `created_at` es
esa fecha, no necesariamente la fecha de registro de Clerk. El nombre visible
inicial viene del perfil de Clerk. El menú de cuenta de la cabecera permite
consultar/gestionar el perfil actual en Clerk; no comparte historiales ni crea
un panel público de alumnos. Los registros de autenticación de Clerk son
distintos del historial de prácticas de la aplicación.

Los endpoints y páginas obtienen el UUID de la sesión validada en el servidor,
no de un nombre, correo, parámetro `learnerId` ni una cookie antigua. El agente
Python continúa recibiendo `learner_<UUID>` en el token LiveKit firmado por el
servidor: no necesita claves de Clerk ni cambios de proveedor de IA.

## Configurar por primera vez

1. Crea una aplicación en [Clerk Dashboard](https://dashboard.clerk.com/).
   Activa Google en los métodos de acceso si quieres usarlo. En producción,
   configura también sus credenciales OAuth, dominios y URLs según el panel.
2. En **API keys**, copia la Publishable key y la Secret key de la **misma
   aplicación/instancia** a `web/.env.local` (o al archivo web/.env que ya uses):

   ```dotenv
   CLERK_PUBLISHABLE_KEY=pk_test_REEMPLAZAR
   CLERK_SECRET_KEY=sk_test_REEMPLAZAR
   CLERK_AUTHORIZED_PARTIES=http://localhost:3000
   ```

   Son ejemplos, no claves válidas. La Publishable key se entrega al navegador
   y no es secreta. La Secret key es exclusivamente privada. No publiques ese
   archivo ni pegues la clave secreta en chats. No se modifican automáticamente
   los archivos de credenciales existentes.
3. Aplica el esquema ampliado a la misma base que usa la web. Desde la raíz:

   ```powershell
   .\.venv\Scripts\python.exe scripts/apply_schema.py
   ```

   Este comando escribe en la base configurada con `PROGRESS_DATABASE_URL`.
   Añade `learners.clerk_user_id` y su índice único. Es aditivo y conserva los
   UUID e historiales. `DATABASE_URL` de la web debe apuntar a esa misma base.
4. Reinicia `pnpm dev` desde `web/`, abre `/register` y crea tu cuenta.
   Al completar el acceso se crea automáticamente tu perfil y puedes practicar.
   No hay una lista manual de usuarios permitidos ni aprobación del administrador.
5. Comprueba que el nombre de tu cuenta aparece y que “Mi progreso” es el tuyo.
   Cada persona debe registrarse con su propia cuenta: no compartas la tuya.

La variable antigua `CLERK_ALLOWED_USER_IDS` ya no se consulta y puede eliminarse
del entorno. `CLERK_AUTHORIZED_PARTIES` sigue siendo necesaria para restringir
los orígenes del navegador; no es una lista de personas.

El registro debe estar habilitado en la configuración de Clerk (sin modo de
solo invitaciones). Cualquier usuario registrado con sesión válida podrá usar
tus servicios de práctica y consumir sus cuotas. Los límites de uso existentes
siguen aplicándose; esto no garantiza un límite monetario ni evita por sí solo
el abuso mediante múltiples cuentas.

Sin claves, `/login` muestra una explicación y la práctica queda bloqueada.
Sin base de datos no se crean llamadas que luego no puedan guardar progreso.
Los errores de base/Clerk no activan una alternativa de acceso con clave
compartida. Las cookies `tutor_session` y `APP_PASSCODE` ya no autorizan nada;
elimina la variable obsoleta de la configuración web cuando migres.

## Recuperar un historial anterior sin suplantaciones

El nombre/correo no demuestra quién creó el historial antiguo. El administrador
debe comprobar la identidad de la persona y elegir explícitamente el UUID del
alumno y el ID de Clerk en la instancia correcta. No hay endpoint público para
reclamar historiales. Si debes recuperar un historial, planifica el enlace antes
de la primera visita autenticada: el registro ya no tiene una fase de aprobación.
Si Clerk ya ha creado un perfil nuevo, el script no lo fusionará con el anterior.

Para localizar los perfiles anteriores, consulta en tu herramienta SQL privada:

```sql
SELECT id, username, display_name, created_at, clerk_user_id
FROM learners ORDER BY created_at;
```

Desde la raíz, primero simula con los identificadores reales:

```powershell
.\.venv\Scripts\python.exe scripts/link_clerk_learner.py --learner-id UUID_ANTERIOR --clerk-user-id user_ID_DE_CLERK
```

Después de revisar el resultado, repite con `--apply`. Solo añade la asociación:
no copia prácticas ni cambia sus UUID o fechas. Rechaza un alumno ya vinculado
a otra cuenta o una cuenta que ya tiene otro alumno. Usa transacción y el índice
único para evitar colisiones incluso si alguien inicia sesión simultáneamente.
Si ya existe un perfil nuevo, no borres ni fusiones datos automáticamente:
requiere revisar ambos historiales y decidir una migración aparte.

## Imágenes Docker y producción

`CLERK_PUBLISHABLE_KEY` es intencionalmente una variable **del servidor**, sin
prefijo `NEXT_PUBLIC_`. El layout dinámico se la pasa al SDK al atender cada
petición. Así la imagen sigue siendo genérica: no se necesitan claves en
`docker build`, ni claves ficticias de producción, ni `ARG` con secretos.
Ambas claves reales se inyectan únicamente al ejecutar la web con `--env-file`.
Sin configuración el contenedor sirve la pantalla de configuración, no acceso
anónimo. La prueba Docker de `/login` valida arranque, no autenticación real.

Al desplegar, usa las claves de la instancia de producción de Clerk, configura
su dominio y añade el origen HTTPS exacto a `CLERK_AUTHORIZED_PARTIES`, sin barra
final (lista separada por comas si hay varios). El SDK valida el emisor/instancia
de la sesión y sus partes autorizadas. Por defecto solo se admite
`http://localhost:3000`. Los IDs de usuarios de desarrollo y producción pueden
ser distintos: revisa permisos y asociaciones antes de cambiar de instancia.
`clerk_user_id` supone una sola instancia activa; no mezcles usuarios de varios
tenants o aplicaciones en la misma instalación.

Usa el panel de Clerk para administrar cuentas y revocar sesiones; pueden existir tokens
de sesión de corta duración hasta que se revaliden. Una llamada LiveKit ya
abierta no se corta por cerrar una sesión web: hay que terminarla explícitamente
si se necesita revocación inmediata. Cerrar sesión termina la sesión de Clerk
y descarta las páginas en caché del usuario anterior; no borra sus prácticas.

## Verificación

`pnpm test` incluye pruebas aisladas de identidad y registro sin aprobación manual,
usuarios con el mismo nombre, recuperación por cuenta entre dispositivos,
provisión concurrente y separación del progreso. Se prueban también las rutas
antiguas deshabilitadas. Las pruebas usan dobles de Clerk/DB; no crean cuentas
ni llamadas reales. Las pruebas Python del enlace verifican simulación,
idempotencia y rechazo de conflictos, sin tocar la base.

La comprobación Docker también inicia la imagen con claves ficticias y red
deshabilitada: verifica que la clave pública se suministra al ejecutarla,
que la secreta no aparece en el HTML y que las APIs de llamadas e historial
rechazan visitantes sin sesión. No verifica credenciales reales de Clerk.

El flujo real de Google/Clerk debe probarse con tus propias claves después de
configurarlas. Esta integración no crea una aplicación externa, no aplica
migraciones a tu base ni vincula datos reales sin una acción explícita.

Referencias: [SDK Next.js](https://clerk.com/docs/nextjs/getting-started/quickstart),
[validación de sesión](https://clerk.com/docs/reference/nextjs/app-router/auth),
[middleware](https://clerk.com/docs/reference/nextjs/clerk-middleware).
