$filePath = 'src\App.jsx'
$content = Get-Content $filePath -Raw -Encoding Default

# 文字化けしたREALMSの修正
$content = $content -replace "n: '歯軁E", "n: '歯車'"
$content = $content -replace "n: '古斁E'", "n: '古文書'"
$content = $content -replace "n: '氷河朁E", "n: '氷河期'"
$content = $content -replace "n: '廁EE", "n: '廃墟'"
$content = $content -replace "n: ''", "n: '歯車'" # 万が一のための予備

# その他、個別に修正が必要な箇所があれば追加
$content = $content -replace "n: '噴水'", "n: '噴水'"
$content = $content -replace "n: '機械'", "n: '機械'"
$content = $content -replace "n: '電池'", "n: '電池'"
$content = $content -replace "n: '惑星'", "n: '惑星'"

# 文字化けしたコメントを削除
$content = $content -replace '// === .*? ===', '// Animation/Section Header'
$content = $content -replace '// .*?', '// Comment'

# UTF8 (BOMなし) で保存
[System.IO.File]::WriteAllText((Get-Item $filePath).FullName, $content, (New-Object System.Text.UTF8Encoding($false)))
