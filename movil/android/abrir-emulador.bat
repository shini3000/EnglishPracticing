@echo off
setlocal
set "SDK_ROOT=%ANDROID_HOME%"
if not defined SDK_ROOT set "SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
if not exist "%SDK_ROOT%\emulator\emulator.exe" (
    echo No se encontro Android Emulator en "%SDK_ROOT%".
    echo Instala el emulador y configura ANDROID_HOME. Consulta README.md.
    pause
    exit /b 1
)
start "" "%SDK_ROOT%\emulator\emulator.exe" -avd EnglishTutorAndroid11
