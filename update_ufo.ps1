$ufoBytes = [System.IO.File]::ReadAllBytes("assets\ufo.png")
$newVal = "data:image/png;base64," + [Convert]::ToBase64String($ufoBytes)

$reader = [System.IO.StreamReader]::new("js\sprites_b64.js", [System.Text.Encoding]::UTF8)
$content = $reader.ReadToEnd()
$reader.Close()

# Find bounds of old ufo value
$keyPos = $content.IndexOf('"ufo":"')
$valStart = $keyPos + 7
$valEnd = $content.IndexOf('"', $valStart)

$newContent = $content.Substring(0, $valStart) + $newVal + $content.Substring($valEnd)

$writer = [System.IO.StreamWriter]::new("js\sprites_b64.js", $false, [System.Text.Encoding]::UTF8)
$writer.Write($newContent)
$writer.Close()

Write-Host "Done. New ufo value length: $($newVal.Length)"
