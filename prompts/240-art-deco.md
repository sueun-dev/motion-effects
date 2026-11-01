# 240 · Art Deco · 아르데코

<img src="../previews/240-art-deco.webp" width="270" alt="Art Deco preview">

**EN** Gold-on-black Art Deco poster: a stepped skyscraper telescopes up, a sunburst fans open, ART DECO rises letter by letter and a gleam sweeps the gold.  
**KO** 검정 바탕의 금빛 아르데코 포스터: 계단식 마천루가 한 단씩 솟아오르고 햇살 부채가 펼쳐지며, ART DECO 글자가 한 자씩 올라온 뒤 금박 위로 광택이 지나간다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/240-art-deco.mp4) · [Code](../effects/240-art-deco.js) · Art movements & styles · 예술 사조·스타일

## Prompt (English)

```text
Create an "Art Deco" motion effect: a 1920s gold-on-black poster (Chrysler Building, Gatsby) that assembles itself piece by piece, gleams, folds away and rises again without ever going empty.

Look
- Background: a radial gradient centred at (540, 1150), #1B150C in the middle to #050505 at radius 1200.
- Everything else is gold, painted with ONE metallic linear gradient from (0, 300) to (1080, 1900): #8C6A2A 0, #E9CF7A 0.14, #A47A2C 0.28, #F6E3A0 0.42, #B8893A 0.56, #EED38A 0.70, #8E6828 0.84, #D9B866 1. Windows and gaps are cut out, so the dark background shows through them.
- Frame (always visible): a 5 px rule inset 30 px and a 2 px rule inset 48 px; in each corner three nested stepped L-shapes (8 px bars, 54, 36 and 18 px long).
- Sunburst behind the tower, from the plinth centre (540, 1400): 27 thin wedge rays spread evenly over the upper half circle, alternating long (radius 880, half-width 0.016 rad) and short (radius 700, half-width 0.010 rad); two arcs over it at radius 560 (4 px) and 584 (2 px).
- Side columns: on each side three 4 px vertical rules at x = 540 ± 430, ± 414, ± 398, rising from y 1400 to tops at 520, 580 and 640, each capped with an 18 × 12 px block.
- The tower, centred on x = 540, standing on y = 1400:
  - three tiers, half-widths 200, 150, 108, tops at y 1110, 900, 740; a 4 px cut 14 px below each top (the setback cap); window slits 12 × 46 px in columns every 36 px and rows every 64 px;
  - the right half of each tier is shaded by multiplying with #A27A48;
  - a crown of four stacked arches (centres y 740, 696, 652, 608; radii 78, 63, 48, 33), each with 7 triangular windows radiating round its rim;
  - a needle spire, 20 px wide at y 600, tip at y 360.
- Plinth (always visible, like the frame): three steps 20 px tall at y 1400, 1424, 1448, half-widths 250, 290, 330.
- Chevron frieze: two parallel zigzags (5 px lines, 43 px pitch, 26 px deep) across x 110–970 at y 1500 and 1522.
- Type: "ART DECO" in Futura 500, 150 px, 22 px tracking, baseline 1700, centred; under it two rules (800 × 3 px at y 1728, 720 × 2 px at y 1738); "PARIS · MCMXXV" in Didot 42 px with 14 px letter spacing at y 1800; three small nested chevrons pointing down at y 1822–1846.

Motion (0–5 s): the cycle runs on τ = (t + 0.2) mod 5
- Every piece has a progress p on its own 5 s cycle: with age = (τ − a) mod 5 it builds over [0, d] (cubic ease in-out unless noted), holds, and folds away over its fold window [f, f + fd] (given in τ). A fold may run past τ = 5 into the next cycle's build of other pieces, so the poster is never empty.
- Build: the tower telescopes first. Each part slides up from below the plinth line (clipped at y 1400) by (1 − p) · (1400 − top + 30) px, drawn back to front so each tier slides out of the one below it: tiers a = 0, 0.2, 0.4 (d 0.6), arches a = 0.55 + 0.08k (d 0.55), spire a = 0.85 (d 0.5). Side columns rise (a 0.3, d 0.9).
- Then the fan opens from the vertical to the ray angles (ease out-back), the middle ray first, each next pair 0.035 s later (a = 1.0 + 0.035 · |j − 13|, d 1.0); ray length grows with p. Arcs draw outward from the top (a 1.1, d 0.8); the frieze wipes open from the middle (a 1.2, d 0.6).
- Letters rise out of a slot at their baseline, 160 px below, one every 0.06 s from a = 1.3 (d 0.45); the rules and second line at a = 1.75; the chevrons drop in at a = 1.9, 1.98, 2.06.
- Gleam: a soft cream band (rgba 255, 250, 225, 0.85 in the middle, 400 px wide) travels along (0.6, 0.8) from −300 to 2500 between τ = 2.3 and 3.4 (ease in-out), drawn only over the gold. Four-point star glints at the spire tip (540, 362), at (210, 1448) and (920, 1700) swell to 46, 30 and 26 px as the band passes them.
- Fold, roughly last-in first-out: chevrons from 3.4 (0.35 s), letters from 3.45 + 0.04 · (7 − i) (0.4 s), rules 3.45, frieze 3.6 (0.5 s), columns 3.8 (0.7 s), spire 3.9 (0.45 s), arches 4.0 + 0.07 · (3 − k) (0.5 s), arcs 4.2 (0.6 s), tiers top down at 4.25, 4.4, 4.55 (0.45 s), so the tower has sunk by τ 5.
- The fan folds shut last, outer rays first: f = 4.4 + 0.04 · (13 − |j − 13|), fd 0.8. The middle rays close at τ 5.72 = 0.72 of the next cycle, while the new tower is already rising.
- Between the build and the fold everything holds perfectly still; the frame and the plinth never move.

Technique
- Canvas 2D. All gold shapes are drawn in white on one offscreen layer; windows are cut with destination-out; then the layer is filled with the gold gradient using source-in, and the gleam band is added with source-atop so it only lights the gold. The layer is drawn over the background, then the tier shading (multiply) and the glints.
- Each piece's progress is a pure function of τ through its own cyclic age; the telescoping tiers are clipped above the plinth line.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"아르데코" 모션 효과를 만들어 줘: 1920년대 검정 바탕 금빛 포스터(크라이슬러 빌딩, 개츠비 풍)가 한 조각씩 조립되고, 반짝이고, 접혔다가, 한 번도 텅 비지 않고 다시 솟아오르는 효과.

모양
- 배경: (540, 1150) 중심의 원형 그라디언트, 가운데 #1B150C에서 반지름 1200의 #050505로.
- 나머지는 모두 금색이며 금속 선형 그라디언트 하나로 칠한다. (0, 300)에서 (1080, 1900)까지: #8C6A2A 0, #E9CF7A 0.14, #A47A2C 0.28, #F6E3A0 0.42, #B8893A 0.56, #EED38A 0.70, #8E6828 0.84, #D9B866 1. 창과 틈은 잘라 내서 어두운 배경이 비친다.
- 테두리(항상 보임): 30px 안쪽의 5px 선과 48px 안쪽의 2px 선. 네 모서리마다 계단식 ㄱ자 세 겹(8px 막대, 길이 54, 36, 18px).
- 탑 뒤의 햇살 부채, 받침 가운데 (540, 1400)에서: 위쪽 반원에 고르게 퍼진 가는 쐐기 광선 27개. 긴 것(반지름 880, 반폭 0.016rad)과 짧은 것(반지름 700, 반폭 0.010rad)이 번갈아 나온다. 그 위로 반지름 560(4px)과 584(2px)의 호 두 개.
- 옆 기둥: 양쪽에 4px 세로선 세 개, x = 540 ± 430, ± 414, ± 398, y 1400에서 520, 580, 640까지 올라가고 끝에 18 × 12px 블록.
- 탑, x = 540 중심, y = 1400 위에 선다:
  - 세 단, 반폭 200, 150, 108, 윗면 y 1110, 900, 740. 각 윗면 14px 아래 4px 홈(셋백 처마). 창은 12 × 46px 세로 틈, 가로 36px·세로 64px 간격;
  - 각 단의 오른쪽 절반은 #A27A48을 곱해(multiply) 그늘지게 한다;
  - 아치 네 개를 쌓은 왕관(중심 y 740, 696, 652, 608; 반지름 78, 63, 48, 33), 아치마다 테두리를 따라 방사형 삼각 창 7개;
  - 바늘 첨탑, y 600에서 폭 20px, 끝은 y 360.
- 받침(테두리처럼 항상 보임): 높이 20px 계단 세 개, y 1400, 1424, 1448, 반폭 250, 290, 330.
- 셰브런 띠: 평행한 지그재그 두 줄(5px 선, 43px 간격, 깊이 26px), x 110–970, y 1500과 1522.
- 글자: Futura 500 150px "ART DECO", 자간 22px, 기준선 1700, 가운데 정렬. 그 아래 선 두 개(y 1728에 800 × 3px, y 1738에 720 × 2px), y 1800에 Didot 42px "PARIS · MCMXXV"(자간 14px), y 1822–1846에 아래를 가리키는 작은 셰브런 세 겹.

움직임 (0–5초): 순환 시간축은 τ = (t + 0.2) mod 5
- 조각마다 자기 5초 주기의 진행도 p가 있다. age = (τ − a) mod 5일 때 [0, d] 동안 만들어지고(따로 적지 않으면 3차 ease in-out), 머문 뒤, 접힘 구간 [f, f + fd](τ 기준) 동안 접혀 사라진다. 접힘은 τ = 5를 넘어 다음 주기에 다른 조각이 만들어지는 동안까지 이어질 수 있어서 포스터가 비는 순간이 없다.
- 조립: 탑이 먼저 망원경처럼 솟는다. 각 부분이 받침선 아래(y 1400에서 잘림)에서 (1 − p) · (1400 − 윗면 + 30)px만큼 미끄러져 올라온다. 뒤에서 앞 순서로 그려서 각 단이 아래 단 속에서 빠져나온다: 단 a = 0, 0.2, 0.4(d 0.6), 아치 a = 0.55 + 0.08k(d 0.55), 첨탑 a = 0.85(d 0.5). 옆 기둥이 올라온다(a 0.3, d 0.9).
- 이어 부채가 세로 방향에서 광선 각도로 펼쳐진다(ease out-back). 가운데 광선이 먼저, 양옆 쌍이 0.035초씩 늦게(a = 1.0 + 0.035 · |j − 13|, d 1.0). 광선 길이도 p에 따라 자란다. 호는 위 가운데에서 양쪽으로 그려지고(a 1.1, d 0.8), 셰브런 띠는 가운데에서 열린다(a 1.2, d 0.6).
- 글자는 기준선의 틈에서 160px 아래부터 올라온다. a = 1.3부터 0.06초 간격(d 0.45). 선과 둘째 줄은 a = 1.75, 셰브런은 a = 1.9, 1.98, 2.06에 내려온다.
- 광택: 부드러운 크림색 띠(가운데 rgba 255, 250, 225, 0.85, 폭 400px)가 τ = 2.3–3.4 동안 (0.6, 0.8) 방향으로 −300에서 2500까지 지나간다(ease in-out). 금색 위에만 그린다. 첨탑 끝 (540, 362), (210, 1448), (920, 1700)의 네 갈래 별 반짝임이 띠가 지날 때 46, 30, 26px로 커진다.
- 접힘, 대체로 나중에 온 것이 먼저: 셰브런 3.4부터(0.35초), 글자 3.45 + 0.04 · (7 − i)부터(0.4초), 선 3.45, 셰브런 띠 3.6(0.5초), 기둥 3.8(0.7초), 첨탑 3.9(0.45초), 아치 4.0 + 0.07 · (3 − k)(0.5초), 호 4.2(0.6초), 단은 위에서부터 4.25, 4.4, 4.55(0.45초). 그래서 τ 5면 탑이 다 내려가 있다.
- 부채는 맨 나중에, 바깥 광선부터 접힌다: f = 4.4 + 0.04 · (13 − |j − 13|), fd 0.8. 가운데 광선은 τ 5.72 = 다음 주기의 0.72에 닫힌다. 그때 새 탑은 이미 솟아오르고 있다.
- 조립과 접힘 사이에는 모든 것이 완전히 멈춰 있다. 테두리와 받침은 움직이지 않는다.

기법
- Canvas 2D. 금색 도형은 모두 오프스크린 레이어 하나에 흰색으로 그리고, 창은 destination-out으로 잘라 낸 뒤, source-in으로 금색 그라디언트를 채우고, 광택 띠는 source-atop으로 더해 금색 위에만 빛나게 한다. 이 레이어를 배경 위에 그리고, 단의 그늘(multiply)과 반짝임을 올린다.
- 조각마다 진행도는 자기 순환 나이를 거친 τ의 순수 함수다. 솟아오르는 단은 받침선 위로 클립한다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
