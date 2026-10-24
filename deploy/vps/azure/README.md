# Programación opcional de una VM propia en Azure

Esta guía es una plantilla para infraestructura administrada por cada usuario.
No contiene un servidor compartido ni un horario predeterminado. Cada persona
elige su suscripción, VM, región, zona horaria, días y horas de uso.

## Configuración por el propietario

1. En tu VM, abrir Automatización → Tareas y crear una tarea de inicio si deseas
   encendido programado. Configurar tus propias conexiones y permisos.
2. Elegir la recurrencia y la zona horaria correspondientes a tu ubicación.
3. Si deseas apagado programado, configurarlo en la VM con tu propio horario.
4. Revisar las ejecuciones y comprobar que el apagado desasigna la VM.

`vm-power.ps1` es una alternativa parametrizada para Azure Automation con identidad
administrada. Requiere tus propios permisos y programaciones; copiar el archivo
no crea una VM ni activa horarios.

Guarda los datos de tu despliegue en archivos locales ignorados por Git, nunca en
esta guía. Las credenciales del plano de control de Azure no pertenecen a la APK.

Referencias: [tareas de automatización](https://learn.microsoft.com/en-us/azure/logic-apps/create-automation-tasks-azure-resources),
[apagado automático](https://learn.microsoft.com/en-us/azure/virtual-machines/auto-shutdown-vm).
