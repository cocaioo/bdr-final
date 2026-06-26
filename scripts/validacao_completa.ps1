# ==============================================================
# Validacao Oficial — Integracao Bolognesi v2
# Executar na raiz do projeto BDR:
#   .\scripts\validacao_completa.ps1
# ==============================================================

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$logFile = "scripts\validacao_output.log"
"" | Out-File $logFile -Encoding utf8

function Log($msg) {
    Write-Host $msg
    $msg | Out-File $logFile -Append -Encoding utf8
}

Log "============================================================"
Log "  VALIDACAO OFICIAL - Integracao Bolognesi v2"
Log "  Diretorio: $root"
Log "  Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log "============================================================"

# ------ 1. DIFF ------
Log "`n###### ETAPA 1: Revisao do diff ######"
$diffOutput = git diff --stat -- catalogos/partidos.csv src/cleaning.py src/party_catalog.py dashboard/backend/app/party_catalog.py "dashboard/backend/app/adapters/questions.py" tests/test_etl_contracts.py scripts/validar_integracao_oficial.py 2>&1
Log $diffOutput
Log ""
$diffFull = git diff --name-only 2>&1
Log "Arquivos modificados (todos):"
Log $diffFull

# ------ 2. DOCKER ------
Log "`n###### ETAPA 2: Docker/PostgreSQL ######"
$containerStatus = docker ps --filter "name=bdr-postgres" --format "{{.Status}}" 2>&1
if ($containerStatus -match "Up") {
    Log "Container bdr-postgres ja esta ativo: $containerStatus"
} else {
    Log "Container nao encontrado ou parado. Subindo..."
    Set-Location Banco
    docker compose up -d 2>&1 | ForEach-Object { Log $_ }
    Set-Location $root
    Start-Sleep -Seconds 8
    $containerStatus = docker ps --filter "name=bdr-postgres" --format "{{.Status}}" 2>&1
    Log "Status apos docker compose up: $containerStatus"
}

# Testar conectividade
Log "`nTestando conectividade..."
$connTest = docker exec bdr-postgres psql -U admin -d dossie_grupo4 -t -A -c "SELECT 'CONECTADO';" 2>&1
Log "Resultado: $connTest"
if ($connTest -notmatch "CONECTADO") {
    Log "ERRO: Nao foi possivel conectar ao PostgreSQL. Abortando."
    exit 1
}

# Listar tabelas
$tables = docker exec bdr-postgres psql -U admin -d dossie_grupo4 -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname='grupo4' ORDER BY tablename;" 2>&1
Log "`nTabelas no schema grupo4:"
Log $tables

# ------ 3. ETL ------
Log "`n###### ETAPA 3: ETL completo ######"
$etlStart = Get-Date
try {
    $etlOutput = & .\venv\Scripts\python.exe -m src.main 2>&1
    $etlOutput | ForEach-Object { Log $_ }
    $etlEnd = Get-Date
    $etlDuration = ($etlEnd - $etlStart).TotalSeconds
    Log "`nETL concluido em $([math]::Round($etlDuration, 1)) segundos."
} catch {
    Log "ERRO no ETL: $_"
}

# ------ 4. VALIDAR partidos_ideologia ------
Log "`n###### ETAPA 4: Validar partidos_ideologia ######"

$countResult = docker exec bdr-postgres psql -U admin -d dossie_grupo4 -t -A -c "SET search_path TO grupo4; SELECT COUNT(*) FROM partidos_ideologia;" 2>&1
Log "Total de linhas: $countResult"

$partidosList = docker exec bdr-postgres psql -U admin -d dossie_grupo4 -t -A -c "SET search_path TO grupo4; SELECT sigla_partido || '|' || ideologia FROM partidos_ideologia ORDER BY sigla_partido;" 2>&1
Log "`nPartidos carregados:"
Log $partidosList

$ideologias = docker exec bdr-postgres psql -U admin -d dossie_grupo4 -t -A -c "SET search_path TO grupo4; SELECT ideologia, COUNT(*) FROM partidos_ideologia GROUP BY ideologia ORDER BY ideologia;" 2>&1
Log "`nIdeologias distintas:"
Log $ideologias

# Validacoes
$checks = @()
$checks += "Total = 25: $(if ($countResult.Trim() -eq '25') {'OK'} else {'FALHA (' + $countResult.Trim() + ')'})"
$checks += "ARENA ausente: $(if ($partidosList -notmatch 'ARENA') {'OK'} else {'FALHA'})"
$checks += "MISSAO presente: $(if ($partidosList -match 'MISSAO') {'OK'} else {'FALHA'})"
$checks += "PATRIOTA presente: $(if ($partidosList -match 'PATRIOTA') {'OK'} else {'FALHA'})"
$checks += "PROS presente: $(if ($partidosList -match 'PROS') {'OK'} else {'FALHA'})"
$checks += "PSC presente: $(if ($partidosList -match '\bPSC\b') {'OK'} else {'FALHA'})"
$checks += "PTB presente: $(if ($partidosList -match 'PTB') {'OK'} else {'FALHA'})"
$checks += "S.PART. ausente: $(if ($partidosList -notmatch 'S\.PART') {'OK'} else {'FALHA'})"
$checks += "Apenas esquerda/direita: $(if ($ideologias -notmatch 'centro') {'OK'} else {'FALHA'})"

Log "`nValidacoes:"
$checks | ForEach-Object { Log "  $_" }

# ------ 5. EXPORT RESPOSTAS ------
Log "`n###### ETAPA 5: Regenerar Q9/Q10/Q11 (export_respostas) ######"
$exportStart = Get-Date
try {
    $exportOutput = & .\venv\Scripts\python.exe -m src.export_respostas 2>&1
    $exportOutput | ForEach-Object { Log $_ }
    $exportEnd = Get-Date
    $exportDuration = ($exportEnd - $exportStart).TotalSeconds
    Log "`nExport concluido em $([math]::Round($exportDuration, 1)) segundos."
} catch {
    Log "ERRO no export: $_"
}

# Verificar arquivos gerados
$expectedFiles = @(
    "JF\partidos-ideologia-votacao\q9\q9_vies_deputado.txt",
    "JF\partidos-ideologia-votacao\q9\q9_vies_deputado_detalhe.csv",
    "JF\partidos-ideologia-votacao\q10\q10_alinhamento_partidos.txt",
    "JF\partidos-ideologia-votacao\q11\q11_ranking_partidos.txt"
)
Log "`nArquivos regenerados:"
foreach ($f in $expectedFiles) {
    $path = Join-Path $root $f
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Log "  OK: $f ($size bytes)"
    } else {
        Log "  FALTA: $f"
    }
}

# ------ 6. VALIDAR ARTEFATOS ------
Log "`n###### ETAPA 6: Validar artefatos Q9/Q10/Q11 ######"

# Q9
$q9Path = Join-Path $root "JF\partidos-ideologia-votacao\q9\q9_vies_deputado.txt"
if (Test-Path $q9Path) {
    $q9Text = Get-Content $q9Path -Raw -Encoding utf8
    $q9_1Section = if ($q9Text -match "Q9\.2") { $q9Text.Substring(0, $q9Text.IndexOf("Q9.2")) } else { $q9Text.Substring(0, [Math]::Min(3000, $q9Text.Length)) }
    Log "`nQ9 validacao:"
    Log "  ARENA ausente em Q9.1: $(if ($q9_1Section -notmatch 'ARENA') {'OK'} else {'FALHA'})"
    Log "  MISSAO presente: $(if ($q9Text -match 'MISSAO') {'OK'} else {'FALHA'})"
    Log "  Sem 'nao classificado' em Q9.1: $(if ($q9_1Section -notmatch 'nao classificado') {'OK'} else {'FALHA'})"
}

# Q10
$q10Path = Join-Path $root "JF\partidos-ideologia-votacao\q10\q10_alinhamento_partidos.txt"
if (Test-Path $q10Path) {
    $q10Text = Get-Content $q10Path -Raw -Encoding utf8
    $q10Consolidated = if ($q10Text -match "por ano") { $q10Text.Substring(0, $q10Text.IndexOf("por ano")) } else { $q10Text.Substring(0, [Math]::Min(3000, $q10Text.Length)) }
    Log "`nQ10 validacao:"
    Log "  ARENA ausente: $(if ($q10Text -notmatch 'ARENA') {'OK'} else {'FALHA'})"
    $naoClassQ10 = ([regex]::Matches($q10Consolidated, 'nao classificado')).Count
    Log "  Sem 'nao classificado' no consolidado: $(if ($naoClassQ10 -eq 0) {'OK'} else {'FALHA (' + $naoClassQ10 + ' ocorrencias)'})"
}

# Q11
$q11Path = Join-Path $root "JF\partidos-ideologia-votacao\q11\q11_ranking_partidos.txt"
if (Test-Path $q11Path) {
    $q11Text = Get-Content $q11Path -Raw -Encoding utf8
    $naoClassLines = ($q11Text -split "`n") | Where-Object { $_ -match "nao classificado" }
    $onlySpart = ($naoClassLines | Where-Object { $_ -notmatch "S\.PART" }).Count -eq 0
    Log "`nQ11 validacao:"
    Log "  ARENA ausente: $(if ($q11Text -notmatch 'ARENA') {'OK'} else {'FALHA'})"
    Log "  MISSAO classificada: $(if ($q11Text -match 'MISSAO') {'OK'} else {'FALHA'})"
    Log "  Unico 'nao classificado' e S.PART.: $(if ($onlySpart) {'OK'} else {'FALHA'})"
    # Aliases fantasma
    $ghosts = @("PODEMOS", "SOLIDARIED")
    foreach ($g in $ghosts) {
        $ghostCount = ([regex]::Matches($q11Text, "\b$g\b")).Count
        Log "  Alias $g ausente: $(if ($ghostCount -eq 0) {'OK'} else {'FALHA (' + $ghostCount + ')'})"
    }
}

# ------ 7. TESTES ------
Log "`n###### ETAPA 7: Testes ######"

Log "`nTestes ETL:"
$etlTests = & .\venv\Scripts\python.exe -m pytest tests/test_etl_contracts.py -q --tb=short 2>&1
$etlTests | ForEach-Object { Log "  $_" }

Log "`nTestes backend:"
Set-Location (Join-Path $root "dashboard\backend")
$backendTests = & ..\..\venv\Scripts\python.exe -m pytest tests/ -q --tb=short 2>&1
$backendTests | ForEach-Object { Log "  $_" }
Set-Location $root

# ------ 8. BACKEND API ------
Log "`n###### ETAPA 8: Backend API (tentativa) ######"
Log "Tentando subir backend em background por 15 segundos..."
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:root
    & .\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir dashboard/backend --host 127.0.0.1 --port 8099 2>&1
}
Start-Sleep -Seconds 10

$endpoints = @("/api/meta", "/api/questions/q9", "/api/questions/q10", "/api/questions/q11")
foreach ($ep in $endpoints) {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8099$ep" -TimeoutSec 10 -ErrorAction SilentlyContinue
        $status = $resp.StatusCode
        $bodyLen = $resp.Content.Length
        Log "  $ep -> HTTP $status ($bodyLen bytes)"
    } catch {
        Log "  $ep -> ERRO: $($_.Exception.Message)"
    }
}

Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -Force -ErrorAction SilentlyContinue

# ------ 9. RESUMO FINAL ------
Log "`n============================================================"
Log "  RESUMO FINAL"
Log "============================================================"
Log "Docker/PostgreSQL disponivel: SIM"
Log "ETL passou: $(if ($etlOutput -match 'error|Error|ERRO|Traceback') {'COM ERROS (ver log)'} else {'SIM'})"
Log "Total linhas partidos_ideologia: $($countResult.Trim())"
Log "Partidos carregados:"
$partidosList -split "`n" | ForEach-Object { if ($_.Trim()) { Log "  $_" } }
Log "ARENA ficou fora: $(if ($partidosList -notmatch 'ARENA') {'SIM'} else {'NAO'})"
Log "MISSAO entrou como direita: $(if ($partidosList -match 'MISSAO\|direita') {'SIM'} else {'VERIFICAR'})"
Log "PATRIOTA/PROS/PSC/PTB com classificacao propria: $(if ($partidosList -match 'PATRIOTA' -and $partidosList -match 'PROS' -and $partidosList -match 'PSC' -and $partidosList -match 'PTB') {'SIM'} else {'VERIFICAR'})"
Log "Arquivos Q9/Q10/Q11 regenerados:"
foreach ($f in $expectedFiles) {
    $p = Join-Path $root $f
    Log "  $(if (Test-Path $p) {'OK'} else {'FALTA'}): $f"
}
Log "Siglas sem ideologia: S.PART. (esperado)"
Log "Testes ETL: $(if ($etlTests -match 'passed') {($etlTests | Select-String 'passed')} else {'VER LOG'})"
Log "Testes backend: $(if ($backendTests -match 'passed') {($backendTests | Select-String 'passed')} else {'VER LOG'})"
Log "Relatorio: docs\metodologia\ideologia-partidaria\RELATORIO_VALIDACAO_OFICIAL_POSTGRES_Q9_Q10_Q11.md"
Log "Log completo: scripts\validacao_output.log"
Log "============================================================"

Log "`nValidacao oficial concluida. Verifique o log em: $logFile"
