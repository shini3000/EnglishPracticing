# Validación continua e imágenes Docker

El workflow `.github/workflows/ci.yml` valida el proyecto y construye dos imágenes.
**No despliega, no publica en Docker Hub/GHCR y no usa credenciales reales.**

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
3. **Docker / agent** y **Docker / web**: solo después de aprobar ambas etapas.
   Construyen las imágenes y comprueban que no ejecuten como root. El agente
   debe poder importar su aplicación; la web debe responder en `/login`.
   Estas comprobaciones de contenedores se hacen con `--network none`:
   no registran workers, no crean llamadas y no consumen cuota de IA.
4. **CI required**: solo aprueba si pruebas y ambas imágenes aprobaron. Este es
   el check que conviene exigir en la protección de ramas. La protección se
   configura en GitHub; el archivo por sí solo no impide hacer merge.

Las acciones están fijadas a SHA completos y `checkout` no conserva
credenciales. Dependabot revisa semanalmente **solo GitHub Actions** y propone
actualizaciones mediante PR; no las fusiona automáticamente. No se usa
`pull_request_target` ni se comparten secretos con código de pull requests.

## Descargar las imágenes

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

Por ahora no hay publicación en registros, despliegue automático ni promoción
a producción. Ese paso se configurará cuando se elija un destino.

Referencias: [seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use),
[salida standalone de Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
