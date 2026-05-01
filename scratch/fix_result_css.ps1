$filePath = 'src\index.css'
$content = Get-Content $filePath -Raw
$target = '.result-screen {\s+position: absolute;\s+inset: 0;'
$replacement = '.result-screen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    min-width: 100%;
    box-sizing: border-box;'
$content = $content -replace $target, $replacement
$content | Set-Content $filePath
