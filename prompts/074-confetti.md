# 074 · Confetti · 컨페티

<img src="../previews/074-confetti.webp" width="270" alt="Confetti preview">

**EN** Two striped party poppers in the bottom corners fire bursts of colourful paper that fly up, then spin, flip and flutter down.  
**KO** 아래 양쪽 모서리의 줄무늬 파티 폭죽 두 개가 색종이를 쏘아 올리고, 색종이는 돌고 뒤집히며 팔랑팔랑 떨어진다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/074-confetti.mp4) · [Code](../effects/074-confetti.js) · Particles · 파티클

## Prompt (English)

```text
Create a "Confetti" motion effect: two party poppers fire confetti that shoots up, slows, then flutters down while spinning and flipping.

Look
- Background: a radial gradient, warm cream #FFF7EC in the middle (around y 870–960) to soft pink #FFD3DF at the edges.
- Two poppers in the bottom corners: one at (150, 1740) aimed up-right at −1.08 rad (about 62° above horizontal), one at (930, 1740) mirrored, aimed up-left. Each is a cone 190 px long, 32 px wide at its closed end and 92 px at the mouth, violet #7C5CFF with diagonal gold #FFD04A stripes (20 px wide, one every 46 px). Draw them on top of everything.
- 400 paper pieces (100 per popper per shot). Colours cycle #FF5476, #FFBE32, #32BEFF, #8060FF, #28CD91, #FF843C. Most are rectangles 22–34 × 12–18 px; every 7th is a dot (radius 0.75 × its height), every 5th a long thin strip (2 × width by 0.44 × height).

Motion (0–5 s)
- Both poppers fire at t = 0 and at t = 2.5 s. A piece's age is a = (t − shotTime) mod 5, so two waves always overlap and the loop is seamless.
- Launch from the mouth: angle = popper angle ± 0.375 rad, speed 2000–3500 px/s.
- Path in closed form (drag K = 2.5 /s, terminal fall speed 165 px/s): E = (1 − e^(−K·a))/K; x = x0 + vx·E + sway·sin(f·a + φ)·smoothstep(0.3, 1.4, a); y = y0 + 165·a + (vy − 165)·E. Sway amplitude 25–70 px, f = 1.2–2.4 rad/s. The shot rises to about y 500, stalls, then drifts down.
- Spin: angle = rot0 + spin·a, spin within ±2 rad/s. Flip: c = cos(flip·a + φ), flip = 1.8–4.2 rad/s; scale the piece's height by |c|·0.9 + 0.1 and darken the back side: colour × (0.72 + 0.28·smoothstep(−0.4, 0.4, c)).
- Each piece lives 4.8 s and fades out over its last 0.5 s.
- On every shot the popper recoils back along its axis by 22·e^(−6s)·min(1, 30s) px (s = seconds since the shot), and a white puff (radial, radius 260 px) flashes at the mouth with opacity 0.8·(s/0.12)·e^(1 − s/0.12).

Technique
- Canvas 2D, full redraw each frame: background, puffs, pieces (translate, rotate, then scale(1, flip)), poppers last.
- Pieces are solid shapes at least 12 px across and the flip is a smooth cosine, so nothing flickers.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"컨페티" 모션 효과를 만들어 줘: 파티 폭죽 두 개가 색종이를 쏘아 올리고, 색종이가 느려졌다가 돌고 뒤집히며 팔랑팔랑 떨어지는 효과.

모양
- 배경: 방사형 그라디언트, 가운데(y 870–960 근처)는 따뜻한 크림색 #FFF7EC, 가장자리는 연분홍 #FFD3DF.
- 아래 양쪽 모서리에 폭죽 두 개: 하나는 (150, 1740)에서 −1.08 rad(수평에서 약 62° 위) 오른쪽 위를 겨누고, 다른 하나는 (930, 1740)에서 좌우 대칭으로 왼쪽 위를 겨눈다. 각각 길이 190 px, 막힌 쪽 폭 32 px, 입구 폭 92 px의 원뿔이고, 보라 #7C5CFF 바탕에 금색 #FFD04A 사선 줄무늬(폭 20 px, 46 px 간격). 폭죽은 맨 위에 그린다.
- 색종이 400장(한 번 쏠 때 폭죽마다 100장). 색은 #FF5476, #FFBE32, #32BEFF, #8060FF, #28CD91, #FF843C 순으로 돈다. 대부분 22–34 × 12–18 px 직사각형, 7번째마다 동그라미(반지름 = 높이 × 0.75), 5번째마다 길고 가는 띠(폭 × 2, 높이 × 0.44).

움직임 (0–5초)
- 두 폭죽이 t = 0과 t = 2.5초에 함께 터진다. 색종이의 나이 a = (t − 발사 시각) mod 5. 그래서 두 물결이 늘 겹쳐 있고 루프가 끊기지 않는다.
- 입구에서 발사: 각도 = 폭죽 각도 ± 0.375 rad, 속력 2000–3500 px/s.
- 경로는 닫힌 식(공기저항 K = 2.5 /s, 종단 낙하 속도 165 px/s): E = (1 − e^(−K·a))/K; x = x0 + vx·E + 흔들림·sin(f·a + φ)·smoothstep(0.3, 1.4, a); y = y0 + 165·a + (vy − 165)·E. 흔들림 폭 25–70 px, f = 1.2–2.4 rad/s. y 500 근처까지 솟았다가 멈칫하고 천천히 내려온다.
- 회전: 각도 = rot0 + spin·a, spin은 ±2 rad/s 안. 뒤집힘: c = cos(flip·a + φ), flip = 1.8–4.2 rad/s. 색종이 높이에 |c|·0.9 + 0.1을 곱하고, 뒷면은 어둡게: 색 × (0.72 + 0.28·smoothstep(−0.4, 0.4, c)).
- 색종이 수명은 4.8초, 마지막 0.5초 동안 서서히 사라진다.
- 쏠 때마다 폭죽이 축을 따라 22·e^(−6s)·min(1, 30s) px 뒤로 반동하고(s = 발사 후 초), 입구에 흰 연기(반지름 260 px 방사형)가 불투명도 0.8·(s/0.12)·e^(1 − s/0.12)로 번쩍인다.

기법
- Canvas 2D, 매 프레임 전체를 다시 그린다: 배경, 연기, 색종이(translate, rotate, 그다음 scale(1, 뒤집힘)), 마지막에 폭죽.
- 색종이는 12 px 이상의 꽉 찬 도형이고 뒤집힘은 부드러운 코사인이라 깜빡임이 없다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
