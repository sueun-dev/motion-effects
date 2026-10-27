# 134 · Venetian Blinds · 블라인드

<img src="../previews/134-venetian-blinds.webp" width="270" alt="Venetian Blinds preview">

**EN** Twelve horizontal slats turn over one after another from the top, flipping a sunset lake into a night city, then turning back.  
**KO** 가로 띠 열두 개가 위에서부터 차례로 뒤집히며 노을 호수를 밤 도시로 바꾸고, 한 번 더 돌아 노을로 되돌린다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/134-venetian-blinds.mp4) · [Code](../effects/134-venetian-blinds.js) · Transitions · 트랜지션

## Prompt (English)

```text
Create a "Venetian Blinds" scene transition: the frame is cut into twelve horizontal slats that turn over one after another from the top; their fronts show a sunset landscape and their backs a night city, and a second turn brings the sunset back.

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
- 12 slats, each 160 px tall and the full 1080 px wide. Slat i covers rows 160·i to 160·(i + 1) and always shows that same strip of a picture.
- A slat at angle a (turning about its own horizontal centre line) is drawn squashed to a height of 160·|cos a| px, centred in its slot. When cos a ≥ 0 it shows picture A's strip (front); when cos a < 0, picture B's strip (back, not mirrored).
- Behind the slats, seen through the gaps: near-black violet #0B0814.
- Shading while tilted: a vertical gradient over the slat from a light end rgba(255, 240, 220, 0.22·sin²a) to a dark end rgba(8, 5, 20, 0.7·sin²a); the light end is at the top when sin a > 0 and at the bottom when sin a < 0. Flat slats (sin a = 0) are unshaded. Skip slats thinner than 0.5 px.

Motion (0–5 s)
- Slat i's angle = π·(T(span(t, 0.5, 2.0)) + T(span(t, 3.0, 4.5))), with span(t, a, b) = clamp((t − a)/(b − a)), T(p) = smoothstep(d, d + 0.55, p) and delay d = 0.45·i/11.
- So in 0.5–2.0 s each slat turns 0 → 180° (A → B), and in 3.0–4.5 s on to 360° (B → A) in the same direction; it holds in between. 360° looks like 0°, so t = 5 matches t = 0.
- The top slat turns first and the bottom slat last; each turn takes about 0.83 s on a smoothstep, and the cascade spreads over about 0.68 s.

Technique
- Canvas 2D: fill the gap colour, then for each slat drawImage the source strip (0, 160·i, 1080, 160) of A or B into the destination (0, y, 1080, h) and overlay the shading gradient. Picture B is drawn once off-screen, picture A every frame (its sun moves).

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"블라인드"(베니션 블라인드) 장면 전환을 만들어 줘: 화면을 가로 띠 열두 개로 나누고, 띠가 위에서부터 차례로 뒤집힌다. 띠의 앞면은 노을 풍경, 뒷면은 밤 도시이고, 한 번 더 돌면 노을로 돌아온다.

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
- 띠 12개, 각각 높이 160 px, 폭은 화면 전체 1080 px. i번째 띠는 160·i부터 160·(i + 1)까지의 행을 차지하고, 늘 그림의 그 띠 부분을 보여 준다.
- 각도 a만큼 (자기 가로 중심선을 축으로) 돈 띠는 높이 160·|cos a| px로 눌러 슬롯 가운데에 그린다. cos a ≥ 0이면 그림 A의 띠(앞면), cos a < 0이면 그림 B의 띠(뒷면, 뒤집지 않음).
- 띠 뒤, 틈으로 보이는 곳: 거의 검은 보라 #0B0814.
- 기울어진 동안의 음영: 띠 위에 세로 그라디언트, 밝은 끝 rgba(255, 240, 220, 0.22·sin²a)에서 어두운 끝 rgba(8, 5, 20, 0.7·sin²a)로. sin a > 0이면 밝은 끝이 위, sin a < 0이면 아래. 평평한 띠(sin a = 0)에는 음영이 없다. 0.5 px보다 얇은 띠는 건너뛴다.

움직임 (0–5초)
- i번째 띠의 각도 = π·(T(span(t, 0.5, 2.0)) + T(span(t, 3.0, 4.5))). span(t, a, b) = clamp((t − a)/(b − a)), T(p) = smoothstep(d, d + 0.55, p), 지연 d = 0.45·i/11.
- 그래서 0.5–2.0초에 띠마다 0 → 180° 돌고(A → B), 3.0–4.5초에 같은 방향으로 360°까지 돈다(B → A). 그 사이에는 멈춰 있다. 360°는 0°와 같아 보이므로 t = 5는 t = 0과 같다.
- 맨 위 띠가 먼저, 맨 아래 띠가 마지막에 돈다. 띠 하나는 smoothstep으로 약 0.83초에 돌고, 전체 연쇄는 약 0.68초에 걸쳐 퍼진다.

기법
- Canvas 2D: 틈 색을 칠하고, 띠마다 A나 B의 원본 띠 (0, 160·i, 1080, 160)를 목적지 (0, y, 1080, h)로 drawImage한 뒤 음영 그라디언트를 덮는다. 그림 B는 오프스크린에 한 번만, 그림 A는 해가 움직이므로 매 프레임 그린다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
