$path = 'e:\ufo game\js\game.js'
$bytes = [System.IO.File]::ReadAllBytes($path)

$replacements = @(
    ,@(@(0xC3,0xB0,0xC5,0xB8,0xC2,0x90,0xC2,0xBE), @(0xF0,0x9F,0x90,0xBE))
    ,@(@(0xC3,0xA2,0xC2,0xAD,0xC2,0x90),            @(0xE2,0xAD,0x90))
    ,@(@(0xC3,0xA2,0xE2,0x80,0xBA,0xC2,0xBD),       @(0xE2,0x9B,0xBD))
    ,@(@(0xC3,0xB0,0xC5,0xB8,0xC2,0x8F,0xE2,0x80,0xA0), @(0xF0,0x9F,0x8F,0x86))
    ,@(@(0xC3,0xB0,0xC5,0xB8,0xE2,0x80,0xBA,0xC2,0xB8), @(0xF0,0x9F,0x9B,0xB8))
)

$ms = New-Object System.IO.MemoryStream($bytes.Length)
$i = 0
while ($i -lt $bytes.Length) {
    $replaced = $false
    foreach ($pair in $replacements) {
        $find = [byte[]]$pair[0]
        $rep  = [byte[]]$pair[1]
        $fl   = $find.Length
        if ($i + $fl -le $bytes.Length) {
            $match = $true
            for ($j = 0; $j -lt $fl; $j++) {
                if ($bytes[$i+$j] -ne $find[$j]) { $match = $false; break }
            }
            if ($match) {
                $ms.Write($rep, 0, $rep.Length)
                $i += $fl
                $replaced = $true
                break
            }
        }
    }
    if (-not $replaced) {
        $ms.WriteByte($bytes[$i])
        $i++
    }
}

$result = $ms.ToArray()
[System.IO.File]::WriteAllBytes($path, $result)
Write-Host "Done. Old size: $($bytes.Length) New size: $($result.Length)"
