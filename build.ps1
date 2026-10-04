$fonts   = Get-Content "css\fonts.css"   -Raw -Encoding UTF8
$css     = Get-Content "css\game.css"    -Raw -Encoding UTF8
$sprites = Get-Content "js\sprites_b64.js" -Raw -Encoding UTF8
$game    = Get-Content "js\game.js"      -Raw -Encoding UTF8

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <meta name="screen-orientation" content="landscape" />
  <title>UFO Ranch — Abduct &amp; Fly!</title>
  <style>
$fonts
$css
  </style>
</head>
<body>
  <div id="frame">
    <div id="stage">
      <canvas id="game" width="1600" height="900"></canvas>

      <div id="hud">
        <div class="pill pill-bar">
          <div class="icon-wrap"><canvas id="icon-ufo" width="72" height="72"></canvas></div>
          <div class="pill-body">
            <div class="lbl">FUEL</div>
            <div class="bar"><i id="fuel-bar"></i></div>
          </div>
        </div>
        <div class="pill pill-bar">
          <div class="icon-wrap bolt">⚡</div>
          <div class="pill-body">
            <div class="lbl">ENERGY</div>
            <div class="bar"><i id="energy-bar"></i></div>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="pill pill-stat">
          <div class="icon-wrap star-ic">★</div>
          <div class="stat"><span class="score-lbl">SCORE</span> <span id="score-stat">0</span></div>
        </div>
        <button id="pause-btn" type="button" aria-label="Pause">❚❚</button>
      </div>

      <div id="goal-chip">ANIMALS <b id="goal-stat">0 / 5</b></div>

      <div id="banner" class="hidden"></div>

      <div id="joy-pad" aria-label="Move">
        <div id="joy-ring"></div>
        <div id="joy-knob"></div>
      </div>

      <button id="beam-btn" type="button" aria-label="Beam">☄️<br>BEAM</button>

      <div id="overlay" class="show">
        <div class="panel">
          <canvas id="ov-ufo" width="220" height="152"></canvas>
          <h1 id="ov-title">UFO RANCH</h1>
          <div id="ov-sub"></div>
          <button id="ov-btn" type="button">TAP / CLICK TO START</button>
        </div>
      </div>
    </div>
  </div>
  <script>
$sprites
  </script>
  <script>
$game
  </script>
</body>
</html>
"@

[System.IO.File]::WriteAllText("$PWD\index-final.html", $html, [System.Text.Encoding]::UTF8)
Write-Host "Done. Size: $([math]::Round((Get-Item 'index-final.html').Length / 1KB)) KB"
