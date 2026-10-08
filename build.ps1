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
  <script src="https://www.youtube.com/game_api/v1"></script>
  <title>UFO Ranch - Abduct &amp; Fly!</title>
  <style>
$fonts
$css
  </style>
</head>
<body>
  <div id="frame">
    <div id="stage">
      <canvas id="game" width="1600" height="900"></canvas>

      <div id="level-bubble">
        <div id="level-label">LEVEL 1</div>
        <div id="level-mission"></div>
      </div>

      <div id="hud">
        <div class="spacer"></div>
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
        <div class="pill pill-stat">
          <div class="icon-wrap star-ic">★</div>
          <div class="stat"><span class="score-lbl">SCORE</span> <span id="score-stat">0</span></div>
        </div>
        <button id="pause-btn" type="button" aria-label="Pause game">❚❚</button>
      </div>

      <div id="goal-chip">ANIMALS <b id="goal-stat">0 / 5</b></div>

      <div id="banner" class="hidden"></div>

      <div id="joy-pad" role="slider" aria-label="Move UFO" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0">
        <div id="joy-ring"></div>
        <div id="joy-knob"></div>
      </div>

      <button id="beam-btn" type="button" aria-label="Activate tractor beam">☄️<br>BEAM</button>

      <div id="overlay" class="show">
        <div class="panel">
          <canvas id="ov-ufo" width="220" height="152"></canvas>
          <div id="ov-level"></div>
          <h1 id="ov-title">UFO RANCH</h1>
          <div id="ov-sub"></div>
          <button id="ov-btn" type="button">TAP / CLICK TO START</button>
        </div>
      </div>
    </div>
    <div id="hint">
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows fly (starts gravity)</span>
      <span><kbd>Space</kbd> beam — UFO almost stops</span>
      <span><kbd>P</kbd> pause</span>
    </div>
  </div>
  <script>
  // ── YouTube Playables integration ──────────────────────────────────────────
  (function () {
    "use strict";

    function resizeCanvas() {
      var canvas = document.getElementById("game");
      var stage  = document.getElementById("stage");
      if (!canvas || !stage) return;
      var vw = stage.clientWidth  || window.innerWidth;
      var vh = stage.clientHeight || window.innerHeight;
      if (vw <= 0 || vh <= 0) return;
      var gameAspect = 1600 / 900;
      var vpAspect   = vw / vh;
      var cssW, cssH;
      if (vpAspect >= gameAspect) {
        cssH = vh;
        cssW = vh * gameAspect;
      } else {
        cssW = vw;
        cssH = vw / gameAspect;
      }
      canvas.style.width  = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.style.position = "absolute";
      canvas.style.left = ((vw - cssW) / 2) + "px";
      canvas.style.top  = ((vh - cssH) / 2) + "px";
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    var _ytFirstFrameCalled = false;
    var _ytGameReadyCalled  = false;

    window._ytSignalFirstFrame = function () {
      if (_ytFirstFrameCalled) return;
      _ytFirstFrameCalled = true;
      try {
        if (window.youtube && window.youtube.playables &&
            typeof window.youtube.playables.firstFrameReady === "function") {
          window.youtube.playables.firstFrameReady();
        }
      } catch (e) {}
    };

    window._ytSignalGameReady = function () {
      if (_ytGameReadyCalled) return;
      _ytGameReadyCalled = true;
      try {
        if (window.youtube && window.youtube.playables &&
            typeof window.youtube.playables.gameReady === "function") {
          window.youtube.playables.gameReady();
        }
      } catch (e) {}
    };

    window._ytAudioEnabled = true;
    try {
      if (window.youtube && window.youtube.playables) {
        var ytAudio = window.youtube.playables.isAudioEnabled;
        if (typeof ytAudio === "boolean") window._ytAudioEnabled = ytAudio;
        if (typeof window.youtube.playables.onAudioEnabledChange === "function") {
          window.youtube.playables.onAudioEnabledChange(function (enabled) {
            window._ytAudioEnabled = enabled;
            try {
              if (window._gameAudioCtx) {
                if (!enabled && window._gameAudioCtx.state === "running") {
                  window._gameAudioCtx.suspend();
                } else if (enabled && window._gameAudioCtx.state === "suspended") {
                  window._gameAudioCtx.resume();
                }
              }
            } catch (e) {}
          });
        }
      }
    } catch (e) {}

    window._ytPaused = false;
    try {
      if (window.youtube && window.youtube.playables) {
        if (typeof window.youtube.playables.onPause === "function") {
          window.youtube.playables.onPause(function () {
            window._ytPaused = true;
            if (window._ytPauseGame) window._ytPauseGame();
          });
        }
        if (typeof window.youtube.playables.onResume === "function") {
          window.youtube.playables.onResume(function () {
            window._ytPaused = false;
            if (window._ytResumeGame) window._ytResumeGame();
          });
        }
      }
    } catch (e) {}

    window._ytSaveData = function (data) {
      try {
        if (window.youtube && window.youtube.playables &&
            typeof window.youtube.playables.saveData === "function") {
          window.youtube.playables.saveData(JSON.stringify(data));
        }
      } catch (e) {}
    };

    window._ytLoadData = function (callback) {
      try {
        if (window.youtube && window.youtube.playables &&
            typeof window.youtube.playables.loadData === "function") {
          window.youtube.playables.loadData(function (raw) {
            try { callback(raw ? JSON.parse(raw) : null); }
            catch (e) { callback(null); }
          });
          return;
        }
      } catch (e) {}
      callback(null);
    };
  }());
  </script>
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
