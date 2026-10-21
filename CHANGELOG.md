# Historial de versiones

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
