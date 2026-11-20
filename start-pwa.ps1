$Port = 5187
Set-Location $PSScriptRoot
Write-Host "Avvio MemoBam PWA (Sola Lettura) su http://localhost:$Port" -ForegroundColor Cyan
python -m http.server $Port
