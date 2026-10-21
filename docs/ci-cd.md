# Validación continua e imágenes Docker

El workflow `.github/workflows/ci.yml` valida el proyecto y construye dos imágenes.
**Publica en GHCR desde ramas autorizadas, pero no despliega ni usa tus claves de IA.**

## Cuándo se ejecuta

- Al subir cambios a `develop`, `main` o `master`.
- En los pull requests, incluidos los de forks, con permisos de lectura.
- Manualmente desde **Actions → CI → Run workflow**. GitHub solo muestra este
  botón cuando el workflow existe también en la rama predeterminada.

Un nuevo cambio cancela la ejecución anterior de la misma referencia. No hay
filtros por rutas: el control obligatorio no se queda pendiente por un cambio
solo de documentación.

## Etapas

1. **Python tests**: Python 3.13, instalación con caché, `pip check` y pruebas
   `unittest`. Las claves son valores ficticios; no hay conexión a una base real
   ni llamadas de práctica. Se prueban los proveedores mediante dobles de prueba.
2. **Web checks**: Node 24 y pnpm 9.15.9, instalación con lockfile congelado,
   lint, pruebas de regresión, compilación Next.js y comprobación de tipos.
   Next descarga la fuente de Google durante la compilación; se necesita red
   para instalar dependencias y compilar, pero no claves de proveedores.
3. **Docker / agent** y **Docker / web**: en pull requests, forks y ejecuciones
   manuales desde otras ramas, solo después de aprobar ambas etapas.
   Construyen las imágenes con permisos de lectura y comprueban que no ejecuten como root. El agente
   debe poder importar su aplicación; la web debe responder en `/login`.
   Estas comprobaciones de contenedores se hacen con `--network none`:
   no registran workers, no crean llamadas y no consumen cuota de IA.
4. **Publish GHCR**: sustituye las comprobaciones Docker anteriores en pushes
   y ejecuciones manuales de `develop`, `main` o `master` del repositorio
   `shini3000/EnglishPracticing`. Construye y comprueba ambas imágenes con el
   mismo script antes de autenticarse y publicarlas. No se reconstruyen para
   publicar: se suben exactamente las imágenes que pasaron las comprobaciones.
   Solo este job tiene `packages: write` y usa el `GITHUB_TOKEN` temporal.
5. **CI required**: solo aprueba si pruebas y ambas imágenes aprobaron y, cuando
   corresponde publicar, la publicación también terminó correctamente. Este es
   el check que conviene exigir en la protección de ramas. La protección se
   configura en GitHub; el archivo por sí solo no impide hacer merge.

Las acciones están fijadas a SHA completos y `checkout` no conserva
credenciales. Dependabot revisa semanalmente **solo GitHub Actions** y propone
actualizaciones mediante PR; no las fusiona automáticamente. No se usa
`pull_request_target` ni se comparten secretos con código de pull requests.

## Imágenes en GHCR: sin claves incluidas

Se publican dos paquetes:

```text
ghcr.io/shini3000/english-practicing-agent:develop
ghcr.io/shini3000/english-practicing-web:develop
```

También se publica `sha-<SHA completo del commit>`. `develop`, `main` y `master`
son etiquetas móviles de su propia rama; no se crea `latest`. Para ejecutar las
dos imágenes de una misma versión, usa en ambas la etiqueta del mismo SHA.
La subida de los dos paquetes no es una transacción atómica: si una subida
falla, el workflow falla y puede haber quedado solo uno de los paquetes nuevos.

Las imágenes llevan etiquetas OCI con repositorio de origen y revisión. Al
publicarse con `GITHUB_TOKEN`, GHCR puede vincularlas al repositorio. Los paquetes
nuevos son privados por defecto; el workflow no cambia su visibilidad. Se ven
en **Packages** de la cuenta o del repositorio. Un paquete preexistente sin
permisos para este repositorio necesita autorizarlo en **Manage Actions access**.

Para imágenes privadas, inicia sesión en `ghcr.io` desde Docker con una cuenta
autorizada (para uso local, un token clásico con `read:packages`). Ese acceso al
registry es distinto de tus claves LiveKit, Groq, DeepSeek y base de datos.
No hace falta crear ni guardar un PAT para que este workflow publique.

```powershell
docker pull ghcr.io/shini3000/english-practicing-agent:develop
docker pull ghcr.io/shini3000/english-practicing-web:develop

# Desde la raíz del proyecto. Las claves permanecen en tu equipo.
docker run --rm --env-file .env ghcr.io/shini3000/english-practicing-agent:develop
docker run --rm -p 3000:3000 --env-file web/.env ghcr.io/shini3000/english-practicing-web:develop
```

No se copian archivos `.env` a las imágenes ni se pasan claves de producción a
`docker build`. Las pruebas de las imágenes comprueban además la ausencia de
archivos `.env*` en `/app`. La autenticación del registry ocurre después de la
construcción y las pruebas; el token solo se proporciona al paso de login y se
cierra la sesión al terminar. Cambiar las claves requiere recrear el contenedor,
no reconstruir o volver a publicar la imagen. Un administrador del host/Docker
sí puede inspeccionar las credenciales de un contenedor en ejecución: el archivo
local y el servidor deben protegerse, o usar un gestor de secretos.

## Versiones estables manuales

El workflow `.github/workflows/release.yml` empieza en **1.0.0**. No aumenta
la versión con cada commit: cada lanzamiento requiere una acción manual.
Ambas imágenes comparten el mismo número y no se publica `latest`.

### Lanzar desde GitHub

1. Guarda todos los cambios y súbelos a una rama autorizada.
2. Abre **Actions → Release → Run workflow** y selecciona `develop`, `main`
   o `master`, según el commit que quieras publicar.
3. Elige `patch`, `minor` o `major`. Sin versiones previas, cualquiera empieza
   en `1.0.0`. Después de `1.2.3`, producen `1.2.4`, `1.3.0` o `2.0.0`.
4. Espera a que termine: primero calcula la versión, reutiliza las pruebas de
   CI sin publicar etiquetas de rama, construye y comprueba ambas imágenes,
   verifica que ninguna imagen versionada exista y reserva la etiqueta Git.
   Solo después publica las imágenes y crea una Release con notas automáticas.

El botón requiere que el workflow exista en la rama predeterminada de GitHub
(actualmente `production`).
Mientras solo esté en `develop`, usa el lanzamiento por etiqueta descrito abajo;
no se cambia la rama predeterminada automáticamente.

### Lanzar mediante una etiqueta Git

Desde un commit ya subido de una rama autorizada:

```powershell
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

Esto dispara el mismo workflow, usando el número de la etiqueta en lugar de
calcularlo. La etiqueta debe tener el formato exacto `vX.Y.Z`, sin ceros a la
izquierda ni sufijos. Se rechazan versiones anteriores a `1.0.0` o a una
etiqueta estable ya existente. No se permiten commits ajenos al historial de
las ramas autorizadas. No subas etiquetas desde commits que aún no estén allí.

### Resultado y protección contra sobrescrituras

```text
ghcr.io/shini3000/english-practicing-agent:1.0.0
ghcr.io/shini3000/english-practicing-web:1.0.0
```

Las siguientes versiones se calculan con la mayor etiqueta estable `vX.Y.Z`
existente, no con la fecha de los commits. Los lanzamientos se serializan y
no se cancela uno que esté publicando. GitHub puede sustituir una ejecución
pendiente por otra más reciente: no acumules varios lanzamientos manuales.

El workflow rechaza la publicación si cualquiera de las dos imágenes ya
existe. Los errores de autenticación o red también detienen la comprobación;
no se interpretan como una versión disponible. Se guarda el SHA de origen
en las etiquetas OCI de las imágenes y en la etiqueta Git de la Release.
La protección es del pipeline, no una política de inmutabilidad de GHCR:
un administrador con acceso al registry aún podría modificar las etiquetas.

La subida de ambos paquetes no es atómica. Si falla tras reservar la etiqueta
Git, esta se conserva como evidencia; si solo se subió una imagen, tampoco se
borra ni se sobrescribe automáticamente. Si no se subió ninguna, puedes
reintentar el lanzamiento desde esa etiqueta. Si ya existe alguna imagen,
resuelve el fallo y lanza una versión nueva (por ejemplo `1.0.1`). No reutilices
el número. Si ambas imágenes se publicaron pero falló únicamente la creación
de la Release, crea la Release desde la etiqueta existente en GitHub sin
volver a publicar las imágenes. El workflow solo crea la Release después de
ambas subidas; notas automáticas pueden ser escuetas si los cambios se subieron
directamente y no mediante pull requests.

La autenticación usa únicamente el `GITHUB_TOKEN` temporal, con permisos de
escritura de contenido y paquetes en el job de lanzamiento. No requiere PAT
ni claves de servicios de IA. No despliega nada. Las imágenes se ejecutan con
los mismos comandos `--env-file`, sustituyendo `:develop` por `:1.0.0`.

## Descargar archivos de imagen opcionales

En una ejecución manual, activa `export_images` si necesitas descargar ambas
imágenes. Tras aprobar las verificaciones, la sección **Artifacts** contendrá
un archivo para cada imagen, etiquetada con el SHA del commit.

No se guardan imágenes en cada push o pull request. Los artefactos manuales
caducan en un día y pueden ocupar bastante espacio: revisa los límites de
almacenamiento y Actions de tu cuenta antes de activar la exportación.

Descarga y descomprime el ZIP de GitHub. Después puedes cargar el `.tar.gz`:

```powershell
docker load --input english-practicing-agent.tar.gz
docker load --input english-practicing-web.tar.gz
docker image ls
```

No hay etiqueta `latest` publicada; `docker load` conserva la etiqueta del SHA.

## Construir en tu equipo

Requiere Docker con el motor de contenedores Linux iniciado. Ejecuta desde la
**raíz del repositorio**, no desde `web/`:

```powershell
docker build -t english-practicing-agent:local .
docker build -f web/Dockerfile -t english-practicing-web:local .
```

El agente usa el Dockerfile de la raíz; la web usa una compilación multietapa
y activa `NEXT_STANDALONE=1` para generar la salida `standalone` de Next.js.
CI también activa esa opción en Linux. Un `pnpm build` local normal no la
activa, para no exigir permisos de enlaces simbólicos en Windows.
La imagen final de la web no incluye el
árbol completo de fuentes ni las dependencias de desarrollo.

`.dockerignore` excluye archivos `.env*`, cachés, logs, evidencia local, claves,
Git y skills. El Dockerfile del agente copia solo los módulos de ejecución.
**No pases claves mediante `ARG`, `ENV` dentro de un Dockerfile ni build args.**

Para ejecutar las imágenes más adelante, suministra las variables privadas en
tiempo de ejecución, por separado para agente y web. Las claves LiveKit deben
corresponder al mismo servidor. No hay valores de producción incluidos.
Las opciones `NEXT_PUBLIC_*` de Next.js se fijan al compilar; estos builds usan
la configuración predeterminada de este proyecto y su endpoint `/api/token`.

## Versiones y límites de estas comprobaciones

`constraints.txt` fija las versiones de LiveKit que usa el código y que se han
probado. No es un lock completo de Python: otras dependencias transitivas y las
imágenes base pueden actualizarse. Para actualizar LiveKit, cambia las
restricciones y valida la compatibilidad en CI antes de integrar el cambio.

No se incluyen pruebas reales de micrófono, llamadas, modelos remotos ni
migraciones de PostgreSQL. Construir una imagen no demuestra por sí solo que
las credenciales y la conectividad de un futuro despliegue funcionen.

No hay despliegue automático ni promoción a producción. Guardar una imagen en
GHCR no inicia la aplicación ni configura credenciales de ejecución.

Referencias: [seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use),
[salida standalone de Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/output),
[autenticación y visibilidad de GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
