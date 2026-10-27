# 136 · Light Leak · 라이트 리크

<img src="../previews/136-light-leak.webp" width="270" alt="Light Leak preview">

**EN** Warm light leaks sweep diagonally and flare to a near-white burn while a sunset lake crossfades to a night city, then back again.  
**KO** 따뜻한 빛 번짐이 대각선으로 쓸고 지나가며 거의 흰빛으로 타오르는 사이 노을 호수가 밤 도시로 바뀌고, 다시 노을로 돌아온다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/136-light-leak.mp4) · [Code](../effects/136-light-leak.js) · Transitions · 트랜지션

## Prompt (English)

```text
Create a "Light Leak" (film burn) scene transition: warm red, orange and golden light leaks sweep diagonally across the frame and swell to a near-white burn while a sunset landscape crossfades into a night city, then the same again to bring the sunset back.

Look
Picture A, a sunset over mountains and a lake (flat illustration; its sun bobs and its reflection breathes on the 5 s loop):
- Sky over the top 62 % (y 0–1190): vertical gradient #2B1B5A (top) → #E8577A (55 %) → #FFB36B (horizon).
- Sun: flat disc #FFE6A8, radius 184 px, centre x 540, y 710 + 19·sin(2π·t/5). Behind it, over the sky, a glow: radial gradient rgba(255, 220, 150, 0.55) at 0.8 r fading to 0 at 3 r.
- Four mountain ridges, back to front #C2507E, #8E3B78, #5A2A68, #2E1A4A, each filled from the bottom up to a ridge line y = H·(base − amp·(0.5 + n(x))) with base 0.47 / 0.52 / 0.57 / 0.62, amp 0.10 / 0.12 / 0.11 / 0.08 and n a 4-octave smooth fractal noise (about ±0.4) at 2 / 3 / 4 / 5 cycles per frame width, sampled every 8 px.
- Lake below y 1190: vertical gradient #E0748A → #7A3B78 (30 %) → #1E1238 (bottom).
- Sun on the water: 14 horizontal bars rgba(255, 226, 160, 0.7) centred on x 540; bar i (0–13) at y = 1210 + 2.6·i², height 4 + 0.6·i px, half-width 184·(1 − i/16)·(0.8 + 0.2·sin(2π·t/5 + i)), so they narrow and spread apart going down and gently breathe.
Picture B, a night city by a river (static):
- Sky: vertical gradient #0B1030 (top) → #3A2A6E (y 783) → #E0607E at the waterline y 1306, staying #E0607E below it.
- 90 stars at fixed seeded positions in the top 45 %: white dots, 80 % opacity, radius 1–3 px.
- Moon: disc #FFF1D6, radius 72 px, centre (778, 384), with a 260 px glow rgba(255, 240, 210, 0.45) → 0.
- Skyline standing on y 1306, seeded random buildings 70–180 px wide with 6 px gaps: a back row of plain #2A2F5E blocks 260–620 px tall, and a front row of #141433 towers 160–820 px tall with 12 × 18 px windows on a 26 × 34 px grid (from 12 px inside the left wall and 24 px below the roof); 42 % of the windows are lit, 80 % of those warm yellow #FFD36E and 20 % ice blue #9BE7FF.
- River below y 1306: everything above the waterline mirrored, drawn in 6 px horizontal strips at 45 % opacity, each strip shifted sideways by 6·sin(0.05·y) px (ripples), then darkened by a vertical gradient rgba(20, 16, 50, 0.35) → rgba(8, 8, 26, 0.95).
The transition:
- Underneath, a crossfade: the incoming picture drawn over the outgoing one at alpha smoothstep(0.25, 0.75, p).
- Burn strength b = sin²(π·p): 0 → 1 → 0 across the transition.
- On top, with 'screen' blending: a full-frame warm wash rgba(255, 120, 50, 0.3·b), then three soft leaks, then a hot core with additive ('lighter') blending:
  1. red-orange rgb(255, 60, 20), radius 1000 px, stretch 2.2, strength 1.0, path (−0.6, 0.85) → (1.4, 0.15)
  2. orange rgb(255, 135, 25), 820 px, stretch 2.0, strength 0.95, path (−0.5, 0.6) → (1.5, 0.4)
  3. gold rgb(255, 205, 80), 700 px, stretch 1.8, strength 0.9, path (−0.7, 0.38) → (1.4, 0.75)
  4. hot core rgb(255, 246, 225), 480 px, stretch 1.6, strength 0.8, path (−0.5, 0.62) → (1.6, 0.42)
  (path points are fractions of the frame width and height).
- Each leak is a radial gradient with alpha strength·b at the centre, 0.5·strength·b at 45 % of the radius and 0 at the edge, rotated −0.6 rad (about 34°, rising to the right) and stretched horizontally by its stretch factor, so the glows are long tilted streaks.

Motion (0–5 s)
- Schedule: A holds 0–0.5 s, A → B 0.5–2.0 s, B holds 2.0–3.0 s, B → A 3.0–4.5 s, A holds 4.5–5 s. In each transition p runs linearly 0 → 1.
- Leak i (0–3) moves along its path by smoothstep(0.05·i, 0.85 + 0.05·i, p), so they cross the frame left to right at slightly different times. Because b is 0 at both ends, the light fades in and out with no pop.

Technique
- Canvas 2D with globalCompositeOperation 'screen' and 'lighter'; translate, rotate and scale the context before filling each radial gradient. Picture B is drawn once off-screen, picture A every frame (its sun moves).

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"라이트 리크"(필름 번) 장면 전환을 만들어 줘: 따뜻한 빨강·주황·금빛 빛 번짐이 화면을 대각선으로 쓸고 지나가며 거의 흰빛으로 타오르는 동안 노을 풍경이 밤 도시로 크로스페이드되고, 같은 방식으로 노을로 돌아온다.

모양
그림 A, 산과 호수 위의 노을(플랫 일러스트. 해가 5초 루프로 출렁이고 물에 비친 빛이 숨 쉬듯 변한다):
- 하늘(위쪽 62 %, y 0–1190): 세로 그라디언트 #2B1B5A(맨 위) → #E8577A(55 %) → #FFB36B(수평선).
- 해: 단색 원 #FFE6A8, 반지름 184 px, 중심 x 540, y 710 + 19·sin(2π·t/5). 뒤쪽 하늘에 빛무리: 0.8 r에서 rgba(255, 220, 150, 0.55)로 시작해 3 r에서 투명해지는 방사형 그라디언트.
- 산 능선 네 겹, 뒤에서 앞으로 #C2507E, #8E3B78, #5A2A68, #2E1A4A. 각 겹은 아래에서 능선 y = H·(base − amp·(0.5 + n(x)))까지 채운 실루엣이다. base 0.47 / 0.52 / 0.57 / 0.62, amp 0.10 / 0.12 / 0.11 / 0.08, n은 화면 너비당 2 / 3 / 4 / 5 주기의 4옥타브 부드러운 프랙털 노이즈(약 ±0.4), 8 px마다 샘플.
- 호수(y 1190 아래): 세로 그라디언트 #E0748A → #7A3B78(30 %) → #1E1238(맨 아래).
- 물에 비친 해: x 540에 가운데 맞춘 가로 막대 14개, rgba(255, 226, 160, 0.7). i번째 막대(0–13)는 y = 1210 + 2.6·i², 두께 4 + 0.6·i px, 반폭 184·(1 − i/16)·(0.8 + 0.2·sin(2π·t/5 + i)). 아래로 갈수록 좁아지고 간격이 벌어지며, 폭이 천천히 숨 쉬듯 변한다.
그림 B, 강가의 밤 도시(정지):
- 하늘: 세로 그라디언트 #0B1030(맨 위) → #3A2A6E(y 783) → 수면선 y 1306에서 #E0607E, 그 아래는 #E0607E 그대로.
- 별 90개: 위쪽 45 % 안의 시드로 고정한 위치에 흰 점, 불투명도 80 %, 반지름 1–3 px.
- 달: 원 #FFF1D6, 반지름 72 px, 중심 (778, 384), 반지름 260 px 빛무리 rgba(255, 240, 210, 0.45) → 투명.
- 스카이라인(y 1306 위에 선다): 시드 난수로 정한 폭 70–180 px, 사이 간격 6 px의 빌딩들. 뒷줄은 높이 260–620 px의 민무늬 #2A2F5E 덩어리, 앞줄은 높이 160–820 px의 #141433 빌딩이고 12 × 18 px 창문이 가로 26 px·세로 34 px 간격 격자로 있다(왼쪽 벽에서 12 px 안쪽, 지붕에서 24 px 아래부터). 창문의 42 %가 켜져 있고, 그중 80 %는 따뜻한 노랑 #FFD36E, 20 %는 얼음빛 하늘색 #9BE7FF.
- 강(y 1306 아래): 수면선 위의 모든 것을 위아래로 뒤집어 6 px 가로 띠로 나눠 불투명도 45 %로 그리고, 띠마다 6·sin(0.05·y) px씩 옆으로 밀어 물결을 만든 뒤, 세로 그라디언트 rgba(20, 16, 50, 0.35) → rgba(8, 8, 26, 0.95)로 어둡게 덮는다.
전환:
- 아래에서는 크로스페이드: 나가는 그림 위에 들어오는 그림을 alpha smoothstep(0.25, 0.75, p)로 그린다.
- 타오름 세기 b = sin²(π·p): 전환 동안 0 → 1 → 0.
- 그 위에 'screen' 블렌딩으로: 화면 전체에 따뜻한 빛 rgba(255, 120, 50, 0.3·b), 이어서 부드러운 빛 번짐 셋, 마지막으로 가산('lighter') 블렌딩의 뜨거운 중심:
  1. 주홍 rgb(255, 60, 20), 반지름 1000 px, 늘임 2.2, 세기 1.0, 경로 (−0.6, 0.85) → (1.4, 0.15)
  2. 주황 rgb(255, 135, 25), 820 px, 늘임 2.0, 세기 0.95, 경로 (−0.5, 0.6) → (1.5, 0.4)
  3. 금빛 rgb(255, 205, 80), 700 px, 늘임 1.8, 세기 0.9, 경로 (−0.7, 0.38) → (1.4, 0.75)
  4. 뜨거운 중심 rgb(255, 246, 225), 480 px, 늘임 1.6, 세기 0.8, 경로 (−0.5, 0.62) → (1.6, 0.42)
  (경로 좌표는 화면 너비·높이에 대한 비율).
- 빛 번짐은 각각 방사형 그라디언트: 중심 alpha 세기·b, 반지름의 45 %에서 0.5·세기·b, 가장자리 0. −0.6 rad(약 34°, 오른쪽 위로) 회전하고 가로로 늘임 배율만큼 늘려 길게 기운 빛줄기가 되게 한다.

움직임 (0–5초)
- 일정: 0–0.5초 A 유지, 0.5–2.0초 A → B, 2.0–3.0초 B 유지, 3.0–4.5초 B → A, 4.5–5초 A 유지. 전환마다 p는 0 → 1로 일정하게 증가한다.
- i번째 빛 번짐(0–3)은 smoothstep(0.05·i, 0.85 + 0.05·i, p)만큼 경로를 따라가, 조금씩 다른 때에 왼쪽에서 오른쪽으로 화면을 건너며 서로 엇갈린다. b가 양 끝에서 0이므로 빛이 툭 튀지 않고 부드럽게 나타났다 사라진다.

기법
- Canvas 2D, globalCompositeOperation 'screen'과 'lighter'. 빛 번짐마다 컨텍스트를 translate·rotate·scale한 뒤 방사형 그라디언트를 칠한다. 그림 B는 오프스크린에 한 번만, 그림 A는 해가 움직이므로 매 프레임 그린다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
