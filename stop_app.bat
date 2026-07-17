@echo off
echo Deteniendo servicios de Control Horario...

:: Detener procesos de Node/npm
taskkill /IM node.exe /F 2>nul

echo Aplicacion detenida correctamente.
timeout /t 3
