# English Practicing para Android

Proyecto Android nativo independiente, con Kotlin y Jetpack Compose. No usa WebView
ni empaqueta la web Next.js. Se abre en Android Studio seleccionando esta carpeta.

## Estado de la integración Android (0.4.0)

- Acceso nativo con Clerk, usando la misma aplicación de autenticación del servidor.
- Solicitudes HTTPS con token de sesión; los secretos permanecen en el backend.
- Audio LiveKit, permiso de micrófono, silenciar y finalizar la llamada.
- Servicio de micrófono con notificación mientras la llamada está activa.
- Transcripción limitada a 80 mensajes y correcciones limitadas a 50 entradas.
- Controles de práctica y temporizador sincronizado con el agente.

Práctica B incluye sus cinco bloques nativos: gimnasia temporal (7 min), monólogo
con anclajes (10 min), input con réplica (15 min), agilidad 4–3–2 (15 min) y
microauditoría (8 min). Los bloques con tutor entran directamente en los pasos
firmados 4 y 15. El monólogo ofrece continuar al input cuando llega la devolución.

Gimnasia temporal y 4–3–2 graban AAC en la caché privada y envían el audio a
`/api/time-shifting` solo al pedir revisión; también admiten texto escrito.
El servidor transcribe con la configuración existente y aplica el proveedor de
corrección seleccionado, sin cambiarlo automáticamente. Las revisiones se guardan
en el mismo historial que la web. Los límites de tamaño y de revisiones siguen
vigentes. El audio se conserva para reintentar durante esta sesión y se elimina
al avanzar, reiniciar el bloque, cerrar sesión o iniciar un nuevo proceso.

La grabación se detiene al ocultar la app o bloquear la pantalla. El cero del
cronómetro avisa pero no corta una respuesta. Input es autoguiado: no se graba ni
se evalúa el material externo. Sus tiempos se calculan con un reloj monotónico,
incluso al abrir el video en otra app. El recorrido local se conserva al rotar y
cambiar de bloque; no es una certificación de dominio ni sobrevive al cierre del
proceso. Los datos de una cuenta se limpian al cambiar de usuario.
La compilación y las pruebas locales no sustituyen una llamada real autenticada ni
las mediciones de estabilidad en un Redmi 10C.

## Configuración local

Copiar `mobile.properties.example` a `mobile.properties` y completar
`CLERK_PUBLISHABLE_KEY` con la clave **publicable** de la misma instancia Clerk que
usa el backend. Habilitar Native API en Clerk Dashboard. `API_BASE_URL` debe ser
la URL HTTPS del backend. El archivo local está ignorado por Git.

La clave publicable y la URL se incluyen en la APK y no son secretos. Nunca colocar
Clerk Secret Key, LiveKit API Secret, credenciales de proveedores ni contraseñas en
estos campos. El backend acepta los JWT de sesión en las rutas móviles explícitas;
las solicitudes con cookies u Origin mantienen la validación de origen de la web.

## Herramientas y compilación

- Android Studio compatible con AGP 8.13.2, opcional para compilar desde terminal.
- JDK 17 para Gradle.
- Android SDK Platform 36 y Build Tools 35.0.0 (instalar desde SDK Manager).
- Acceso a Internet para descargar Gradle y dependencias en la primera compilación.

Versiones fijadas: Gradle 8.13, AGP 8.13.2, Kotlin/Compose compiler 2.4.21,
Compose BOM 2026.06.01, Activity Compose 1.13.0, Clerk 1.2.1 y LiveKit 2.29.1.
Se fija R8 9.1.29 desde su repositorio oficial para compatibilidad con Kotlin 2.4.

Android Studio configura `local.properties` con `sdk.dir`. Para compilar desde
terminal también se puede definir `ANDROID_HOME` apuntando al SDK instalado.
`local.properties` es local y no debe versionarse.

En el equipo de desarrollo se instaló el SDK mediante las herramientas oficiales
de línea de comandos 19.0, compatibles con JDK 17, en
`%LOCALAPPDATA%\Android\Sdk`. Incluye Platform 36, Build Tools 35.0.0 y
Platform Tools (ADB). Se configuraron `ANDROID_HOME` para el usuario de Windows
y `local.properties` para este proyecto. Las terminales ya abiertas pueden
necesitar reiniciarse para ver la nueva variable.

Desde esta carpeta, en PowerShell:

```powershell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

APK de desarrollo: `app/build/outputs/apk/debug/app-debug.apk`.
Con el teléfono conectado y depuración USB autorizada:

```powershell
.\gradlew.bat :app:installDebug
```

En macOS/Linux usar `sh ./gradlew` en lugar de `.\gradlew.bat`.
La variante release activa R8 y reducción de recursos, pero aún no tiene firma de
distribución configurada. No versionar keystores, contraseñas ni credenciales.

### Validación local

Se verificaron el Wrapper, la compilación debug, tres pruebas unitarias, lint y
la compilación release con R8. La APK debug se instaló en Android 11 y cargó el
formulario nativo de Clerk. Lint mantiene advertencias de versiones y respaldo.
La APK release generada todavía no tiene firma de distribución. Falta completar
el acceso con una cuenta real y comprobar una llamada completa contra Azure.
Aún no se ha probado en un teléfono ni medido su rendimiento.

## Emulador local

Se instaló Android Emulator con la imagen Google APIs x86_64 de Android 11
(API 30), revisión 16, en el SDK del equipo. El dispositivo virtual se llama
`EnglishTutorAndroid11`, usa 2 GB de RAM y una pantalla de 720 × 1600 con
densidad de 320 dpi. Su configuración está en `%USERPROFILE%\.android\avd`;
no forma parte del código versionado.

En este equipo se puede abrir haciendo doble clic en `abrir-emulador.bat`.
El script requiere que exista ese dispositivo virtual. Para recrearlo en otro
equipo, instalar los paquetes `emulator` y
`system-images;android-30;google_apis;x86_64` con `sdkmanager`, y crear el AVD
con `avdmanager` antes de usar el script.

Para cargar una APK, arrastrarla a la ventana del emulador o ejecutar
`:app:installDebug` con Gradle. Este dispositivo permite probar la interfaz;
no reproduce el procesador, la memoria disponible ni las restricciones de MIUI
del Redmi 10C.

## Validación pendiente

1. Iniciar sesión en el emulador con una cuenta de la instancia Clerk configurada.
2. Probar una llamada con la VM encendida, audio en ambos sentidos y correcciones.
3. Verificar permiso denegado, pérdida de red, reconexión y finalización del servicio.
4. Comprobar grabación/revisión de gimnasia temporal y 4–3–2 y el recorrido completo.
5. Medir memoria, batería y llamadas largas en el teléfono con una versión release.

El código del servidor y los agentes permanece en sus ubicaciones originales.

## Perfil y preferencias

`Mi perfil` abre la vista nativa oficial de Clerk: datos personales, direcciones
verificadas, seguridad y gestión de sesiones según lo habilitado en la instancia.
La opción personalizada `Preferencias` carga `/api/profile` únicamente al abrirla.
El guardado usa PATCH con el token de la sesión y no crea cookies de navegador.
Se admite español o inglés como idioma nativo y el idioma objetivo sigue siendo
inglés. Los cambios se guardan en la misma tabla que usa la web y se aplican a las
próximas solicitudes de token y revisión. Los datos y peticiones pendientes se
limpian al cambiar de cuenta; no se presentan valores por defecto como guardados
cuando falla la lectura. Un error de red permite reintentar conservando la selección.

La interfaz Android permanece fija en español, incluidos los recursos españoles
que ya incorpora Clerk. La preferencia `nativeLanguage` nunca cambia el idioma
de los recursos Android. No se incorpora una versión inglesa de las pantallas.

## Infraestructura de cada usuario

El repositorio no incluye un backend compartido, un horario de servicio ni una
URL predeterminada del autor. Cada instalación debe usar su propio servidor,
instancia Clerk, proyecto LiveKit, base de datos y credenciales de proveedores.
Sin URL y clave publicable configuradas, la app muestra una pantalla de configuración
pendiente y no intenta conectarse a ningún servidor.

`mobile.properties` es privado e ignorado por Git. Su URL y clave publicable se
incluyen en la APK configurada: ignorar el archivo protege el repositorio, pero
no oculta esos valores a quien recibe la APK. No publiques tu APK personalizada
si quieres mantener privado tu endpoint. Los secretos de proveedores, Clerk y
LiveKit permanecen en el servidor; nunca se incluyen en el cliente Android.

### APK de uso personal

No se publica ni distribuye una APK central. Cada administrador debe configurar
su propio servidor y compilar su APK usando su archivo `mobile.properties`:

```powershell
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

El resultado es `app/build/outputs/apk/debug/app-debug.apk`, listo para el servidor
y la instancia Clerk que haya configurado ese administrador. Para instalarlo en
su propio teléfono con depuración USB, usar `:app:installDebug` o transferir esa
APK al dispositivo. El inicio de sesión se realiza en la app; no se escriben
contraseñas ni tokens de sesión en el código.

La URL y la clave publicable se incluyen en esa APK personal. Las claves secretas
de los proveedores, LiveKit y Clerk se mantienen en los entornos privados de su
servidor, donde corren los agentes y se validan las sesiones. Ninguna de estas
configuraciones personales debe incorporarse al repositorio.
