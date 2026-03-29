# Git commit helper - 自动添加前缀并生成结构化提交信息
param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Message,
    
    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Points
)

# 检查前缀
$prefixes = "feat:", "fix:", "docs:", "style:", "refactor:", "test:", "chore:"
$hasPrefix = $false
foreach ($p in $prefixes) {
    if ($Message.StartsWith($p)) {
        $hasPrefix = $true
        break
    }
}

# 自动推断前缀
if (-not $hasPrefix) {
    $prefix = "feat"
    $stagedFiles = git diff --cached --name-only 2>$null
    if ($stagedFiles | Select-String "test") { $prefix = "test" }
    elseif ($stagedFiles | Select-String "\.(md|txt)$") { $prefix = "docs" }
    elseif ($stagedFiles | Select-String "\.(css|scss|html)$") { $prefix = "style" }
    $finalMsg = "$prefix`: $Message"
} else {
    $finalMsg = $Message
}

# 添加核心内容
if ($Points.Count -gt 0) {
    $finalMsg += "`n`n"
    foreach ($point in $Points) {
        $finalMsg += "- $point`n"
    }
}

# 执行提交
git add -A
git commit -m $finalMsg
Write-Host "✓ Committed" -ForegroundColor Green
