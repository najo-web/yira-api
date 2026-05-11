# YIRA — generate-all.ps1
# Toujours utiliser ce script pour regenerer les clients Prisma
# Ne jamais lancer npx prisma generate seul

Write-Host "Generation client-orientation..."
$env:DATABASE_URL = "postgresql://yira:yira2026@localhost:5433/yira_orientation"
npx prisma generate --schema=prisma\schemas\schema_orientation.prisma

Write-Host "Generation client-sync..."
$env:DATABASE_URL = "postgresql://yira:yira2026@localhost:5432/yira_sync"
npx prisma generate --schema=prisma\schemas\schema_sync.prisma

Write-Host ""
Write-Host "Clients generes :"
dir node_modules\.prisma | Select-Object Name

Write-Host "OK tous les clients Prisma sont prets"
