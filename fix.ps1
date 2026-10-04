$lines = Get-Content 'js\game.js' -Encoding UTF8
$out = [System.Collections.Generic.List[string]]::new()

for ($i = 0; $i -lt $lines.Count; $i++) {
    $ln = $i + 1
    if ($ln -eq 1423) {
        # close joystick block properly, add floaters, close render
        $out.Add('    }')
        $out.Add('')
        $out.Add('    G.floaters.forEach((f) => {')
        $out.Add('      ctx.save();')
        $out.Add('      ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);')
        $out.Add('      ctx.font = "900 36px Trebuchet MS, sans-serif";')
        $out.Add('      ctx.textAlign = "center";')
        $out.Add('      ctx.lineJoin = "round";')
        $out.Add('      ctx.strokeStyle = "#8a4a00";')
        $out.Add('      ctx.lineWidth = 8;')
        $out.Add('      ctx.strokeText(f.text, f.x, f.y);')
        $out.Add('      ctx.fillStyle = "#ffd23a";')
        $out.Add('      ctx.fillText(f.text, f.x, f.y);')
        $out.Add('      ctx.restore();')
        $out.Add('    });')
        $out.Add('  }')
    } elseif ($ln -ge 1424 -and $ln -le 1439) {
        # skip orphaned lines
    } else {
        $out.Add($lines[$i])
    }
}

[System.IO.File]::WriteAllLines((Resolve-Path 'js\game.js'), $out, [System.Text.UTF8Encoding]::new($false))
Write-Output "Done. Total lines: $($out.Count)"
