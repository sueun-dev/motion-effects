# 095 · Parallax Layers · 패럴랙스

<img src="../previews/095-parallax-layers.webp" width="270" alt="Parallax Layers preview">

**EN** A red car holds the centre of a dusk road while clouds, mountains, pine hills, road dashes and bushes slide past at different speeds.  
**KO** 해 질 녘 도로 한가운데 빨간 자동차는 제자리에 있고, 구름·산·소나무 언덕·차선·덤불이 서로 다른 속도로 지나간다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/095-parallax-layers.mp4) · [Code](../effects/095-parallax-layers.js) · 3D · 3D

## Prompt (English)

```text
Create a "Parallax Layers" motion effect: a flat 2.5D dusk landscape seen from a car that drives right. The car stays in the middle of the frame and the layers scroll left, far ones slowly, near ones fast. Paler colours sit further away.

Look
- Layers listed back to front.
- Sky: vertical gradient over the top 1300 px, #26215F → #7A4E9E (45 %) → #F2897B (80 %) → #FFCB8E, filling the frame. A sun glow (radial, rgba(255, 236, 190, 0.7) to transparent, radius 60 → 520) and a sun disc #FFEFC4, radius 120, at (650, 900). The sun is infinitely far, so it never moves.
- Clouds: flat ellipses (rx 70–110 px, ry = 0.36·rx) in a group that repeats every 540 px, around y 520 and y 670, rgba(255, 228, 220, 0.45). Put all puffs in one path and fill once, so overlaps do not darken.
- Each mountain or hill line is a periodic skyline y(x) = base − amp·Σ a_k·sin(k·u + p_k) with k = 1, 2, 3, 5, u = 2π·(x + shift)/period, seeded phases p_k and a_k = (0.5 + r)/k, filled down to the bottom of the frame, sampled every 6 px.
  1. Far ridge #C99CC6: base y 1110, amp 150, period 540 px.
  2. Middle ridge #9C6EA8: base 1250, amp 150, period 1080 px.
  3. Hills #6B4C8C: base 1400, amp 70, period 540 px, with pines #4F3A75 every 90 px: triangles 70–150 px tall and 0.64× as wide, standing on the hill line, about a quarter of the slots empty. Choose each pine from a seed that repeats every 6 slots, so the pines repeat with the hills.
- Road: #2E2552 from y 1500 down, a 170 px lane #3A2E63 and a 14 px top edge #4A3C78; yellow #F6C66E dashes 130 × 12 px (radius 6) at y 1580, one every 270 px.
- Car, fixed at x 540, facing right: body #FF5E6C rounded rectangle 320 × 76 (radius 26), cabin 180 × 80 on top with a rounded front, light-blue #BFE6FF windows 72 × 56 and 64 × 56, headlight #FFE9A8 at the front. Soft shadow rgba(20, 12, 40, 0.35), 320 × 28 px ellipse at y 1628. Wheels at x 445 and 635, centre y 1600, radius 2160 / (8·2π) ≈ 43 px: dark #231B3A tyre, #D9D2EA hub at half radius, three 5 px spokes.
- Foreground: very dark #1C1734 bushes, a low skyline (base 1790, amp 40, period 1080) plus clusters of three circles (radius 50–90) every 360 px around y 1720–1760.

Motion (0–5 s)
- Every layer scrolls left by a whole number of its own repeat period per 5 s, linearly with p = t / 5: clouds and far ridge 540 px, middle ridge 1080, hills and pines 1620, road dashes 2160, bushes 3240 (speed ratio 1 : 2 : 3 : 4 : 6). So the loop is seamless.
- The wheels turn 8 full turns per loop clockwise, which matches 2160 px of road exactly, so they roll without slipping.
- The car bounces gently: body y = 1555 + 4·sin(10·2π·p).

Technique
- Canvas 2D, the whole frame repainted every frame. Layers are drawn back to front; nothing depends on the previous frame.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"패럴랙스" 모션 효과를 만들어 줘: 오른쪽으로 달리는 자동차에서 본 납작한 2.5D 해 질 녘 풍경. 자동차는 화면 가운데에 있고 레이어들이 왼쪽으로 흘러가는데, 먼 것은 천천히, 가까운 것은 빠르게 지나간다. 멀수록 색이 옅다.

모양
- 레이어는 뒤에서 앞 순서로 적었다.
- 하늘: 위쪽 1300px에 세로 그라디언트 #26215F → #7A4E9E(45 %) → #F2897B(80 %) → #FFCB8E, 화면 전체를 채운다. 해 광채(방사형, rgba(255, 236, 190, 0.7)에서 투명으로, 반지름 60 → 520)와 해 원판 #FFEFC4, 반지름 120, 위치 (650, 900). 해는 무한히 멀어서 절대 움직이지 않는다.
- 구름: 납작한 타원(rx 70–110px, ry = 0.36·rx) 묶음이 540px마다 반복, y 520과 670 근처, rgba(255, 228, 220, 0.45). 모든 구름 조각을 경로 하나에 넣고 한 번만 칠해 겹친 곳이 진해지지 않게 한다.
- 산·언덕 선은 주기적인 스카이라인 y(x) = base − amp·Σ a_k·sin(k·u + p_k), k = 1, 2, 3, 5, u = 2π·(x + shift)/period, 시드 고정 위상 p_k와 a_k = (0.5 + r)/k. 화면 아래까지 채우고 6px마다 샘플한다.
  1. 먼 산 #C99CC6: base y 1110, amp 150, 주기 540px.
  2. 중간 산 #9C6EA8: base 1250, amp 150, 주기 1080px.
  3. 언덕 #6B4C8C: base 1400, amp 70, 주기 540px. 90px마다 소나무 #4F3A75: 높이 70–150px, 폭은 높이의 0.64배인 삼각형이 언덕선 위에 서고, 네 칸 중 한 칸쯤은 비운다. 소나무마다 6칸마다 반복되는 시드로 골라 언덕과 함께 반복되게 한다.
- 도로: y 1500부터 아래로 #2E2552, 170px 차선 #3A2E63, 14px 위 가장자리 #4A3C78. y 1580에 노란 #F6C66E 점선 130 × 12px(반지름 6), 270px마다 하나.
- 자동차: x 540에 고정, 오른쪽을 향함. 몸체 #FF5E6C 둥근 사각형 320 × 76(반지름 26), 위에 앞이 둥근 객실 180 × 80, 하늘색 #BFE6FF 창 72 × 56과 64 × 56, 앞쪽 전조등 #FFE9A8. 부드러운 그림자 rgba(20, 12, 40, 0.35), y 1628에 320 × 28px 타원. 바퀴는 x 445와 635, 중심 y 1600, 반지름 2160 / (8·2π) ≈ 43px: 어두운 #231B3A 타이어, 반지름 절반의 #D9D2EA 휠, 5px 바큇살 셋.
- 앞쪽: 아주 어두운 #1C1734 덤불. 낮은 스카이라인(base 1790, amp 40, 주기 1080)과 360px마다 원 세 개(반지름 50–90) 묶음, y 1720–1760 근처.

움직임 (0–5초)
- 레이어마다 5초에 자기 반복 주기의 정수 배만큼, p = t / 5에 비례해 왼쪽으로 흐른다: 구름·먼 산 540px, 중간 산 1080, 언덕·소나무 1620, 도로 점선 2160, 덤불 3240(속도 비 1 : 2 : 3 : 4 : 6). 그래서 루프가 끊김 없다.
- 바퀴는 루프마다 시계 방향으로 정확히 8바퀴 돈다. 도로 2160px과 딱 맞아서 미끄러짐 없이 구른다.
- 차는 살짝 통통 튄다: 몸체 y = 1555 + 4·sin(10·2π·p).

기법
- Canvas 2D, 매 프레임 화면 전체를 다시 칠한다. 레이어는 뒤에서 앞으로 그리고, 이전 프레임에 의존하는 것은 없다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
