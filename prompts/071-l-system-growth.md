# 071 · L-System Growth · L-시스템 성장

<img src="../previews/071-l-system-growth.webp" width="270" alt="L-System Growth preview">

**EN** A fractal plant grows from its trunk out to its twigs, pops pink blossoms at the branch tips, sways in the wind, then fades away.  
**KO** 프랙털 식물이 줄기에서 잔가지 끝까지 자라나 가지 끝마다 분홍 꽃을 피우고, 바람에 흔들리다가 사라진다.

[Video (mp4)](../videos/071-l-system-growth.mp4) · [Code](../effects/071-l-system-growth.js) · Shaders & generative · 셰이더·제너러티브

## Prompt (English)

```text
Create an "L-System Growth" motion effect: Lindenmayer's fractal plant drawn by a turtle, growing outward along its branches, blossoming, swaying, then fading out.

Look
- Sky gradient #FBE7D3 (top) → #F6C9B8 (70 %) → #EBB3A6 (bottom); a pale sun disc rgba(255, 248, 230, 0.8) of radius 150 at (760, 640); a green hill #9DB58C, an ellipse centred at (540, 1960) with radii 900 × 260.
- L-system: axiom X; rules X → F+[[X]-X]-F[-FX]+X and F → FF; 5 iterations (1488 F symbols).
- Turtle: F = forward 14 px; + and − turn by 25° plus a fixed per-symbol jitter of ±0.125 rad (seeded RNG); [ pushes the state and adds 1 to the branch depth, ] pops. Start at (320, 1730) heading straight up, tilted 0.38 rad to the right (y down). The full plant spans roughly x 290–910, y 560–1730.
- Segments: draw all segments of one branch depth as a single path (one stroke per depth, never overlapping strokes): width max(2.5, 22 × 0.6^depth) px, colour rgb(95 − 20g, 60 + 90g, 40 + 30g) with g = depth / 6 (brown trunk #5F3C28 to green twigs #4B9646), round caps.
- Blossoms: at every branch end (a ] whose branch ends in an F with no bracket in between, at depth ≥ 3) a pink dot rgba(240, 110, 150, 0.85) of radius 9 px × open, all in one filled path.

Motion (0–5 s)
- Every F segment stores "born" = its path distance from the root, counted in segments. The growth front T = easeOutCubic(t / 3.4) × the largest distance. A segment is drawn once T > born, only partly (fraction min(1, T − born)), so the plant grows from the root out to the tips.
- Blossoms open with smoothstep(born, born + 6, T), popping after their twig is done.
- Wind: every turn also gets + 0.012 · sin(2 · 2π · t / 5) · (1 + depth) rad (twice per loop), so outer branches sway more than the trunk.
- 4.15–4.95 s: the whole plant (branches and blossoms) fades out with alpha 1 − smoothstep(4.15, 4.95, t). At t = 5 only the background remains, the same as t = 0.

Technique
- Canvas 2D; expand the L-system string once at setup and walk it every frame.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"L-시스템 성장" 모션 효과를 만들어 줘: 린덴마이어의 프랙털 식물을 거북이 그래픽으로 그리되, 가지를 따라 바깥으로 자라고 꽃을 피우고 흔들리다가 사라지는 효과.

모양
- 하늘 그라디언트 #FBE7D3(위) → #F6C9B8(70 %) → #EBB3A6(아래). (760, 640)에 반지름 150의 옅은 해 rgba(255, 248, 230, 0.8). 초록 언덕 #9DB58C: 중심 (540, 1960), 반지름 900 × 260의 타원.
- L-시스템: 공리 X, 규칙 X → F+[[X]-X]-F[-FX]+X, F → FF, 5회 반복(F 1488개).
- 거북이: F = 14px 전진, +와 −는 25°에 기호마다 고정된 ±0.125 rad 흔들림(시드 난수)을 더해 회전, [는 상태를 쌓고 가지 깊이 +1, ]는 꺼낸다. (320, 1730)에서 위쪽을 보되 오른쪽으로 0.38 rad 기울여 출발(y는 아래가 +). 다 자란 식물은 대략 x 290–910, y 560–1730.
- 가지: 같은 깊이의 조각은 모두 경로 하나로 그린다(깊이마다 한 번만 긋고 겹쳐 긋지 않음). 폭 max(2.5, 22 × 0.6^깊이)px, 색 rgb(95 − 20g, 60 + 90g, 40 + 30g), g = 깊이 / 6(갈색 줄기 #5F3C28에서 초록 잔가지 #4B9646로), 둥근 끝.
- 꽃: 모든 가지 끝(사이에 괄호 없이 F로 끝나는 가지를 닫는 ], 깊이 3 이상)에 분홍 점 rgba(240, 110, 150, 0.85), 반지름 9px × 피어난 정도. 모두 하나의 채우기 경로로.

움직임 (0–5초)
- F 조각마다 "born" = 뿌리에서부터의 경로 거리(조각 수)를 저장한다. 성장 앞머리 T = easeOutCubic(t / 3.4) × 가장 먼 거리. T > born이 되면 그 조각을 그리되 min(1, T − born)만큼만 그려서, 식물이 뿌리에서 가지 끝으로 자란다.
- 꽃은 smoothstep(born, born + 6, T)로 피어나, 자기 잔가지가 다 자란 뒤 톡 열린다.
- 바람: 회전마다 + 0.012 · sin(2 · 2π · t / 5) · (1 + 깊이) rad를 더한다(루프당 두 번). 그래서 바깥 가지가 줄기보다 더 흔들린다.
- 4.15–4.95초: 식물 전체(가지와 꽃)가 alpha 1 − smoothstep(4.15, 4.95, t)로 사라진다. t = 5에는 배경만 남아 t = 0과 같다.

기법
- Canvas 2D. L-시스템 문자열은 처음에 한 번 펼치고, 매 프레임 그 문자열을 따라 걷는다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
