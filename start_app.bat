@echo off
set BASE_DIR=c:\Fcardene\Utiles\Desarrollos\Tercio

echo Iniciando servicios en segundo plano...

:: Iniciar Frontend usando VBScript para ocultar la ventana
echo Set WshShell = CreateObject("WScript.Shell") > "%temp%\start_frontend.vbs"
echo WshShell.Run "cmd /c ""cd /d %BASE_DIR%\client && npm start""", 0, false >> "%temp%\start_frontend.vbs"
wscript.exe "%temp%\start_frontend.vbs"
del "%temp%\start_frontend.vbs"

echo Aplicacion iniciada correctamente en segundo plano.
timeout /t 3
