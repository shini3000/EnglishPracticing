# Android · English Practicing

Cliente nativo en Kotlin y Jetpack Compose, independiente de la interfaz Next.js.
La guía completa de instalación, servidor, SDK, uso y diagnóstico está en la
[wiki Android](https://github.com/shini3000/EnglishPracticing/wiki/Android).

## Funcionalidades actuales

- Registro e inicio de sesión con Clerk; perfil, seguridad y preferencias.
- Llamadas LiveKit, micrófono, silenciar/finalizar, transcripción y correcciones.
- Práctica B con cinco bloques: gimnasia temporal, monólogo, input con réplica,
  agilidad 4–3–2 y microauditoría. Incluye pasos, cronómetros y revisión escrita.
- Interfaz Android fija en español. El idioma nativo guardado se usa en las
  explicaciones y correcciones y se comparte con la web.

Cada usuario administra su propio backend y compila su APK personal. No se
publica una APK central ni se incluye un servidor o un horario del autor.
Los agentes y las claves secretas permanecen en el servidor.

## Configuración y compilación

Requiere JDK 17, Android SDK Platform 36, Build Tools 35.0.0 y Platform Tools.
Android Studio puede crear `local.properties`; desde terminal también se admite
`ANDROID_HOME`. Android mínimo: 8.0 (API 26).

Desde esta carpeta, copiar `mobile.properties.example` a `mobile.properties` y
configurar la URL HTTPS y la clave **publicable** de tu propia instancia Clerk.
Habilitar Native API en esa instancia. Sin ambos valores la app muestra acceso
sin configurar y no utiliza un backend predeterminado.

```powershell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

APK personal: `app/build/outputs/apk/debug/app-debug.apk`. Con un dispositivo o
emulador conectado:

```powershell
.\gradlew.bat :app:installDebug
```

En macOS/Linux usar `sh ./gradlew`. La variante release optimiza con R8 y reduce
recursos, pero no tiene firma de distribución configurada. La APK debug sí se
puede instalar para uso personal.

`mobile.properties`, las APK, los entornos privados y las claves de firma están
ignorados por Git. La URL y clave publicable se incluyen en la APK personal;
no colocar contraseñas, tokens de sesión ni claves secretas en ese archivo.
El inicio de sesión se realiza dentro de la app.

## Versiones y validación

Versión Android: 0.4.0. Gradle 8.13, AGP 8.13.2, Kotlin/Compose compiler 2.4.21,
Compose BOM 2026.06.01, Clerk 1.2.1 y LiveKit 2.29.1. Se fija R8 9.1.29 desde su
repositorio oficial para compatibilidad con Kotlin 2.4.

Se verificaron compilación debug/release, lint, seis pruebas unitarias y pantallas
en un emulador Android 11. Se comprobó el acceso y el guardado autenticado de
preferencias contra un backend configurado. Faltan las pruebas completas de voz,
grabación/revisión, reconexión y rendimiento en un teléfono físico.

Los ejercicios autónomos cierran la grabación al ocultar la app. La revisión se
solicita explícitamente; el cero del cronómetro no corta la respuesta. El audio y
el recorrido local no sobreviven al cierre del proceso. Las revisiones guardadas
se conservan en el servidor. Consulta los detalles y límites en la wiki.
