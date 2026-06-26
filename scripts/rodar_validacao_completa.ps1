# =============================================================================
# Script de validacao oficial completa - Integracao Bolognesi v2
#
# Executa, em sequencia:
#   1) Docker compose up (PostgreSQL)
#   2) scripts/validar_integracao_oficial.py (Etapas 1-6)
#   3) python -m src.main (ETL completo, caso o script nao tenha rodado)
#   4) python -m src.export_respostas (regeneracao Q9/Q10/Q11)
#   5) Consultas SQL de validacao em grupo4.partidos_ideologia
#   6) pytest -q tests/test_etl_contracts.py
#   7) pytest -q dashboard/backend
#   8) pytest -q tests (completo, com timeout)
#
# Todos os outputs sao salvos em logs/validacao_oficial_*.log
# =============================================================================

$ErrorActionPreference = "Continue"
$REPO = "C:\Users\Caio\Desktop\projetos-em-andamento\BDR"
Set-Location $REPO

$STAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$LOGDIR = Join-Path $REPO "logs\validacao_oficial_$STAMP"
New-Item -ItemType Directory -Force -Path $LOGDIR | Out-Null

$PY = Join-Path $REPO "venv\Scripts\python.exe"
if (-not (Test-Path $PY)) {
    $PY = "python"
}

function Write-Section($title, $logfile) {
    $bar = "=" * 70
    Write-Host ""
    Write-Host $bar -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host $bar -ForegroundColor Cyan
    Add-Content -Path $logfile -Value ""
    Add-Content -Path $logfile -Value $bar
    Add-Content -Path $logfile -Value "  $title"
    Add-Content -Path $logfile -Value $bar
}

$MAIN_LOG = Join-Path $LOGDIR "00_main.log"
Add-Content -Path $MAIN_LOG -Value "VALIDACAO OFICIAL - $STAMP"
Add-Content -Path $MAIN_LOG -Value "Repo: $REPO"
Add-Content -Path $MAIN_LOG -Value "Python: $PY"

# ---------------------------------------------------------------------------
# 1) Docker compose
# ---------------------------------------------------------------------------
Write-Section "1) Docker compose up -d (PostgreSQL)" $MAIN_LOG
$dockerLog = Join-Path $LOGDIR "01_docker.log"
Push-Location (Join-Path $REPO "Banco")
docker compose up -d 2>&1 | Tee-Object -FilePath $dockerLog
Pop-Location
Start-Sleep -Seconds 5

docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" 2>&1 | Tee-Object -FilePath $dockerLog -Append

# ---------------------------------------------------------------------------
# 2) Script oficial de validacao
# ---------------------------------------------------------------------------
Write-Section "2) scripts/validar_integracao_oficial.py" $MAIN_LOG
$validLog = Join-Path $LOGDIR "02_validar_oficial.log"
& $PY scripts/validar_integracao_oficial.py 2>&1 | Tee-Object -FilePath $validLog
$VALID_RC = $LASTEXITCODE
Add-Content -Path $MAIN_LOG -Value "validar_integracao_oficial.py exit code: $VALID_RC"

# ---------------------------------------------------------------------------
# 3) ETL completo (se script nao rodou ou queremos garantir)
# ---------------------------------------------------------------------------
Write-Section "3) python -m src.main (ETL completo)" $MAIN_LOG
$etlLog = Join-Path $LOGDIR "03_etl_main.log"
& $PY -m src.main 2>&1 | Tee-Object -FilePath $etlLog
$ETL_RC = $LASTEXITCODE
Add-Content -Path $MAIN_LOG -Value "src.main exit code: $ETL_RC"

# ---------------------------------------------------------------------------
# 4) Regeneracao Q9/Q10/Q11
# ---------------------------------------------------------------------------
Write-Section "4) python -m src.export_respostas" $MAIN_LOG
$expLog = Join-Path $LOGDIR "04_export_respostas.log"
& $PY -m src.export_respostas 2>&1 | Tee-Object -FilePath $expLog
$EXP_RC = $LASTEXITCODE
Add-Content -Path $MAIN_LOG -Value "src.export_respostas exit code: $EXP_RC"

# ---------------------------------------------------------------------------
# 5) Consultas SQL em partidos_ideologia
# ---------------------------------------------------------------------------
Write-Section "5) Consultas SQL em grupo4.partidos_ideologia" $MAIN_LOG
$sqlLog = Join-Path $LOGDIR "05_sql_partidos_ideologia.log"

$SQL = @'
SET search_path TO grupo4;
SELECT '--- COUNT ---' AS info;
SELECT COUNT(*) AS total FROM partidos_ideologia;
SELECT '--- DETAIL ---' AS info;
SELECT sigla_partido, ideologia FROM partidos_ideologia ORDER BY sigla_partido;
SELECT '--- DISTINCT IDEOLOGIA ---' AS info;
SELECT DISTINCT ideologia FROM partidos_ideologia ORDER BY ideologia;
SELECT '--- ARENA CHECK ---' AS info;
SELECT * FROM partidos_ideologia WHERE sigla_partido='ARENA';
SELECT '--- MISSAO CHECK ---' AS info;
SELECT * FROM partidos_ideologia WHERE sigla_partido='MISSAO';
SELECT '--- HIST PARTIES ---' AS info;
SELECT * FROM partidos_ideologia WHERE sigla_partido IN ('PATRIOTA','PROS','PSC','PTB') ORDER BY sigla_partido;
'@

$SQL | docker exec -i bdr-postgres psql -U admin -d dossie_grupo4 2>&1 | Tee-Object -FilePath $sqlLog

# ---------------------------------------------------------------------------
# 6) Snapshots dos artefatos Q9/Q10/Q11
# ---------------------------------------------------------------------------
Write-Section "6) Snapshot dos artefatos Q9/Q10/Q11" $MAIN_LOG
$artLog = Join-Path $LOGDIR "06_artefatos_q9q10q11.log"

$artefatos = @(
    "JF\partidos-ideologia-votacao\q9\q9_vies_deputado.txt",
    "JF\partidos-ideologia-votacao\q9\q9_vies_deputado_detalhe.csv",
    "JF\partidos-ideologia-votacao\q10\q10_alinhamento_partidos.txt",
    "JF\partidos-ideologia-votacao\q11\q11_ranking_partidos.txt"
)
foreach ($a in $artefatos) {
    $p = Join-Path $REPO $a
    Add-Content -Path $artLog -Value ""
    Add-Content -Path $artLog -Value "==================="
    Add-Content -Path $artLog -Value "ARQUIVO: $a"
    Add-Content -Path $artLog -Value "==================="
    if (Test-Path $p) {
        $info = Get-Item $p
        Add-Content -Path $artLog -Value "  bytes: $($info.Length)"
        Add-Content -Path $artLog -Value "  mtime: $($info.LastWriteTime)"
        Add-Content -Path $artLog -Value ""
        Add-Content -Path $artLog -Value "--- CONTEUDO ---"
        Get-Content $p -Encoding UTF8 | Add-Content -Path $artLog
    } else {
        Add-Content -Path $artLog -Value "  AUSENTE"
    }
}

# ---------------------------------------------------------------------------
# 7) Testes ETL
# ---------------------------------------------------------------------------
Write-Section "7) pytest tests/test_etl_contracts.py" $MAIN_LOG
$etlTestLog = Join-Path $LOGDIR "07_pytest_etl.log"
& $PY -m pytest -q tests/test_etl_contracts.py 2>&1 | Tee-Object -FilePath $etlTestLog
$ETL_TEST_RC = $LASTEXITCODE
Add-Content -Path $MAIN_LOG -Value "pytest etl exit: $ETL_TEST_RC"

# ---------------------------------------------------------------------------
# 8) Testes backend
# ---------------------------------------------------------------------------
Write-Section "8) pytest dashboard/backend" $MAIN_LOG
$beTestLog = Join-Path $LOGDIR "08_pytest_backend.log"
Push-Location (Join-Path $REPO "dashboard\backend")
& $PY -m pytest -q 2>&1 | Tee-Object -FilePath $beTestLog
$BE_TEST_RC = $LASTEXITCODE
Pop-Location
Add-Content -Path $MAIN_LOG -Value "pytest backend exit: $BE_TEST_RC"

# ---------------------------------------------------------------------------
# 9) Testes completos da raiz (com timeout suave)
# ---------------------------------------------------------------------------
Write-Section "9) pytest -q tests (completo)" $MAIN_LOG
$rootTestLog = Join-Path $LOGDIR "09_pytest_root.log"
& $PY -m pytest -q tests 2>&1 | Tee-Object -FilePath $rootTestLog
$ROOT_TEST_RC = $LASTEXITCODE
Add-Content -Path $MAIN_LOG -Value "pytest root exit: $ROOT_TEST_RC"

# ---------------------------------------------------------------------------
# Resumo final
# ---------------------------------------------------------------------------
Write-Section "RESUMO" $MAIN_LOG
$resumo = @"
LOG_DIR: $LOGDIR
docker compose up exit (presumido): 0 (verifique 01_docker.log)
validar_integracao_oficial.py exit: $VALID_RC
src.main exit: $ETL_RC
src.export_respostas exit: $EXP_RC
pytest tests/test_etl_contracts.py exit: $ETL_TEST_RC
pytest dashboard/backend exit: $BE_TEST_RC
pytest tests (raiz) exit: $ROOT_TEST_RC
"@
Write-Host $resumo
Add-Content -Path $MAIN_LOG -Value $resumo
Write-Host "`nLogs gravados em: $LOGDIR" -ForegroundColor Green
