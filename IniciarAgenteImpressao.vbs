Set WshShell = CreateObject("WScript.Shell")
pasta = "C:\Users\wescleygarrett\Desktop\etiquetas"
' Roda o agente de impressão escondido (o zero no final significa "janela invisível")
WshShell.Run "cmd /c cd /d """ & pasta & """ && node agente-impressora.js", 0, False
