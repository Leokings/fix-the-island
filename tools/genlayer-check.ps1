param([string]$PythonPath = 'C:/Users/leoki/anaconda3/python.exe')
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $taskRoot
try {
    $taskSites = Get-Content contracts/sites/manifest.json -Raw | ConvertFrom-Json
    foreach ($taskSite in $taskSites.PSObject.Properties) {
        & $PythonPath -X utf8 -B -c 'from genvm_linter.cli import cli; cli()' check $taskSite.Value.file --json
        if ($LASTEXITCODE -ne 0) { throw "Site lint failed: $($taskSite.Name)" }
    }
    & $PythonPath -X utf8 -B tools/build-site-contracts.py
    if ($LASTEXITCODE -ne 0) { throw 'Per-site generated source is stale.' }
    & node node_modules/typescript/bin/tsc -p tools/genlayer-tsconfig.json
    if ($LASTEXITCODE -ne 0) { throw 'Backend TypeScript checks failed.' }
    & node node_modules/vitest/vitest.mjs run --config tools/genlayer-vitest.config.ts --maxWorkers=1
    if ($LASTEXITCODE -ne 0) { throw 'Backend TypeScript tests failed.' }
    python -m pytest -q -p no:gltest tests/direct/test_site_contracts.py tests/direct/test_village_pump_council.py
    if ($LASTEXITCODE -ne 0) { throw 'Per-site direct-mode tests failed.' }
} finally { Pop-Location }
