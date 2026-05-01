$filePath = 'src\index.css'
$content = Get-Content $filePath -Raw -Encoding Default
# 文字化けしたコメント（Eなどが混じったもの）を正規表現で削除
$content = $content -replace '/\* === .*? === \*/', '/* Animation/Section Header */'
$content = $content -replace '/\* .*? \*/', '/* Comment */'
# UTF8 (BOMなし) で保存
[System.IO.File]::WriteAllText((Get-Item $filePath).FullName, $content, (New-Object System.Text.UTF8Encoding($false)))
