# English Practicing para Android

Proyecto Android nativo independiente, con Kotlin y Jetpack Compose. No usa WebView
ni empaqueta la web Next.js. Se abre en Android Studio seleccionando esta carpeta.

## Estado inicial

- Pantalla de inicio con las modalidades A, B y diagnóstico.
- Descripciones accesibles desde cada modalidad, sin simular llamadas ni progreso.
- Tema claro/oscuro, soporte de tamaños de texto y lista con composición diferida.
- Gradle Wrapper oficial con verificación SHA-256 de la distribución.
- Android 8.0 (API 26) o posterior; incluye Android 11 del Redmi 10C.

Todavía no hay autenticación, conexión a APIs, micrófono, LiveKit ni almacenamiento.
La app inicial funciona sin red y no pide permisos. No contiene claves ni una URL
de producción predeterminada. El identificador inicial es `com.englishpracticing.android`;
revisarlo antes de registrar el cliente en servicios externos o distribuirlo.

## Herramientas y compilación

- Android Studio compatible con AGP 8.13.2, opcional para compilar desde terminal.
- JDK 17 para Gradle.
- Android SDK Platform 36 y Build Tools 35.0.0 (instalar desde SDK Manager).
- Acceso a Internet para descargar Gradle y dependencias en la primera compilación.

Versiones fijadas: Gradle 8.13, AGP 8.13.2, Kotlin/Compose compiler 2.2.21,
Compose BOM 2025.11.01 y Activity Compose 1.11.0.

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
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

APK de desarrollo: `app/build/outputs/apk/debug/app-debug.apk`.
Con el teléfono conectado y depuración USB autorizada:

```powershell
.\gradlew.bat :app:installDebug
```

En macOS/Linux usar `sh ./gradlew` en lugar de `.\gradlew.bat`.
La variante release activa R8 y reducción de recursos, pero aún no tiene firma de
distribución configurada. No versionar keystores, contraseñas ni credenciales.

### Validación de esta base

Se verificaron el hash oficial del Wrapper, su arranque con JDK 17 y el formato
XML de manifiesto y recursos. Tras instalar el SDK, `:app:assembleDebug` y
`:app:lintDebug` finalizaron correctamente y se generó la APK de desarrollo.
Lint mantiene advertencias sobre versiones más recientes de dependencias y
reglas de respaldo en Android 12 o posterior. La APK se instaló y su actividad
principal inició correctamente en el emulador Android 11. Aún no se ha probado
en un teléfono ni medido su rendimiento.

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

## Integración siguiente

1. Integrar Clerk Android y validar en Next.js las solicitudes autenticadas del
   cliente móvil. Revisar orígenes/partes autorizadas para admitir ese cliente
   sin relajar la validación de la web.
2. Consumir `/api/token` con identidad verificada y conectar LiveKit Android.
   Los secretos LiveKit y de los proveedores permanecen en los servidores.
3. Añadir permisos de micrófono y manejo de audio. Si se necesitan llamadas en
   segundo plano, implementar el servicio y los permisos Android correspondientes.
4. Incorporar ejercicios, correcciones e historial mediante las APIs existentes,
   adaptando contratos cuando haga falta. Los agentes Python siguen en la nube.
5. Medir arranque, memoria, batería y estabilidad de llamadas largas en el Redmi
   10C con una compilación release antes de afirmar que cumple el objetivo.

El código actual del servidor y los agentes permanece en sus ubicaciones originales.
