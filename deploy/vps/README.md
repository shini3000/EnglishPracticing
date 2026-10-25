# Plantilla para desplegar tu propio servidor

Cada usuario proporciona su propio servidor, dominio, servicios y credenciales.
Esta plantilla no conecta con un despliegue compartido.

Configuración de despliegue. Ejecuta las imágenes publicadas
del agente y Next.js. Caddy publica únicamente `/api/*` por HTTPS para Android.
Las páginas y recursos de la interfaz web devuelven 404 desde Internet. El agente
se registra como worker en LiveKit y no publica puertos de entrada.

La base de datos, Clerk, LiveKit y los proveedores de IA siguen siendo servicios
externos. Esta configuración no crea ni factura recursos Azure automáticamente.

## Requisitos

- VPS Linux x86_64 (Ubuntu 24.04 LTS como punto de partida) con Docker Engine y
  Docker Compose 2.30 o posterior, necesario para `env_file.format: raw`.
- Dominio o nombre DNS público apuntando a la IP del VPS. Abrir TCP 80 y 443 en
  Azure NSG y en el firewall del host. Restringir SSH a la IP del administrador.
- Salida a Internet por HTTPS/WSS y conectividad de medios a LiveKit; no limitar
  toda la salida a TCP 443 sin revisar los requisitos de red de LiveKit.
- Dos imágenes de la misma revisión accesibles en GHCR. Si son privadas, hacer
  `docker login ghcr.io` con acceso de lectura antes de descargarlas.
- Esquema de base de datos actualizado por separado, conforme a DEPLOY.md.

Para Azure, comprobar primero suscripción, saldo, caducidad, región, cuotas y
precio total (VM, disco, IP pública y transferencia). Un punto de partida para
evaluar una sesión es 2 vCPU y 4 GB de RAM; no es una garantía de capacidad.
Configurar alertas de presupuesto; una alerta no detiene los recursos.
Para dejar de facturar cómputo, desasignar la VM en Azure; discos e IP pueden
seguir generando cargos. No se necesitan GPU ni modelos de Azure OpenAI.

## Configuración

Para preparar un Ubuntu nuevo, revisar `install-docker.sh`, copiarlo al servidor
y ejecutarlo con `bash install-docker.sh` desde el usuario SSH con sudo. Instala
Docker Engine y Compose desde el repositorio oficial, habilita Docker al arrancar
y prueba `hello-world`. No inicia los contenedores de la aplicación ni modifica
sus secretos. Este procedimiento se verificó en Ubuntu 24.04 x86_64.

Desde la raíz del repositorio, preparar copias privadas de los entornos locales:

```powershell
.venv/Scripts/python.exe deploy/vps/prepare-env.py --domain DOMINIO_REAL --image-tag TAG_PUBLICADO
```

Requiere `python-dotenv` del proyecto. Valida credenciales requeridas, coincidencia
LiveKit, endpoints de base de datos y proveedores seleccionados, sin imprimir
valores secretos. Genera `.env`, `agent.env` y `web.env` ignorados por Git, sin
sobrescribir archivos existentes. Revisar las variables seleccionadas y proteger
las copias locales y remotas antes de transferirlas al servidor.

En el VPS, copiar esta carpeta y preparar archivos privados:

1. Copiar `.env.example` a `.env`. Elegir una etiqueta de imagen realmente
   publicada y el dominio real. No se presupone que exista `latest`.
2. Crear `agent.env` a partir del `.env.example` de la raíz del repositorio.
   Configurar `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
   `GROQ_API_KEY`, `TAVILY_API_KEY` y las claves de los proveedores seleccionados.
   Configurar `PROGRESS_DATABASE_URL` para conservar el progreso.
3. Crear `web.env` a partir de `web/.env.example`. Configurar Clerk con la
   instancia correcta, `DATABASE_URL`, LiveKit y el corrector escrito. Definir
   `CLERK_AUTHORIZED_PARTIES=https://DOMINIO_REAL`. Dejar `AGENT_NAME` vacío:
   el worker actual usa despacho automático.
4. Ambos archivos deben apuntar al mismo proyecto LiveKit y a la misma base.
   `DATABASE_URL` y `PROGRESS_DATABASE_URL` son nombres distintos para esa base.
5. Proteger `.env`, `agent.env` y `web.env` con permisos de lectura del propietario
   (`chmod 600 .env agent.env web.env`). No versionarlos ni incluirlos en la APK.

Los archivos `agent.env` y `web.env` usan formato literal: no entrecomillar los
valores y no depender de expansión `${VARIABLE}` dentro de esos archivos.

Desde esta carpeta en el VPS:

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail 100 agent
```

El agente debe registrar `registered worker` sin traceback. Un contenedor en
estado Running no demuestra por sí solo que el agente se haya registrado.
Comprobar que `https://DOMINIO_REAL/` y `/login` devuelven 404 y que un POST sin
autenticación a `/api/token` devuelve 401. El healthcheck de `/login` sigue siendo
interno al contenedor; no publica esa pantalla. La autenticación y la llamada real
se probarán desde el cliente Android al integrar sus SDKs.
`verify-runtime.py`, ejecutado en el VPS desde la carpeta de despliegue, muestra
el estado y logs redactados, y comprueba respuestas internas `200/401/401` de
login/token/progress. No sustituye comprobar HTTPS desde Internet ni el acceso
con una cuenta real desde Android. Las claves Clerk de desarrollo solo sirven para pruebas;
la puesta en producción requiere configurar su instancia y dominios reales.
No ejecutar actualizaciones ni recrear el worker durante llamadas activas.

Los volúmenes de Caddy conservan los certificados. No eliminarlos al actualizar.
La ruta 3000 y el agente no se publican al exterior. El host Docker y sus
administradores tienen acceso a los secretos del contenedor.

## Android

La URL pública del backend será `https://DOMINIO_REAL`. La app no se conecta a una
URL HTTP del agente. El backend valida la identidad y devuelve URL/token LiveKit.
Next.js se conserva como servidor de API interno, sin servir su interfaz al público.
La app Android integra Clerk, el cliente HTTPS y LiveKit. Requiere habilitar
Native API en la misma instancia Clerk. La validación de una llamada autenticada
es independiente de las comprobaciones de infraestructura.

## Verificación local de la plantilla

Sin secretos, sin descargar imágenes ni iniciar servicios:

```bash
docker compose --env-file .env.example config --no-env-resolution --quiet
```

Esta comprobación solo valida la estructura Compose. No valida imágenes,
credenciales, certificados, cuotas, permisos ni una sesión real.

## Backend y agente con soporte Android

`compose.android.yaml` permite usar la imagen local `english-practicing-web:android-0.5`
con el ajuste de validación de tokens nativos. También selecciona el agente
`english-practicing-agent:android-0.3`, que corrige el registro duplicado de
`record_learning` y omite eventos de handoff en las métricas de mensajes.
Se construye desde la raíz con
`docker build -t english-practicing-agent:android-0.3 -f deploy/vps/Dockerfile.agent-android .`. Compilar fuera de la VM de 4 GB para
no competir con los procesos de audio. La imagen no incluye credenciales; sigue
usando `web.env` en ejecución. Transferir la imagen con `docker save`, copiarla al
servidor y cargarla con `docker load` antes de aplicar el overlay.

Desde la carpeta de despliegue en el VPS (anteponer `sudo` si es necesario):

```bash
docker compose -f compose.yaml -f compose.android.yaml up -d --no-deps --wait web agent
```

Para volver al backend versionado original:

```bash
docker compose -f compose.yaml up -d --no-deps --wait web agent
```

Al actualizar este despliegue móvil, incluir ambos archivos Compose. Un reinicio
de la VM conserva el contenedor ya creado y su política de reinicio. El proxy
sigue exponiendo únicamente `/api/*`. La excepción de `authorizedParties` se limita
a JWT Bearer sin cookies ni Origin en las rutas móviles explícitas; Clerk sigue
comprobando la firma y vigencia de la sesión.

La imagen web Android 0.3 acepta también POST `/api/time-shifting` con sesión
Bearer nativa sin cookies ni Origin, para revisar los ejercicios de la ruta B.
Las solicitudes de navegador conservan el control de origen. No se modifica el
proveedor de corrección configurado, la cuota ni el aislamiento por estudiante.

La imagen web Android 0.4 añade PATCH `/api/profile` a la lista explícita de APIs
nativas Bearer sin cookies ni Origin. Conserva la autorización de Clerk, la
validación de campos/idiomas y el aislamiento por estudiante. Los navegadores
siguen sujetos al control de origen y reciben su cookie de idioma; Android no
recibe esa cookie para evitar contaminar sus siguientes solicitudes Bearer.
