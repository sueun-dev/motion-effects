# 061 · Slit-Scan · 슬릿 스캔

<img src="../previews/061-slit-scan.webp" width="270" alt="Slit-Scan preview">

**EN** Each row shows a different moment, so a spinning, swaying rainbow flower smears into twisted shapes over wavy stripes.  
**KO** 줄마다 다른 순간을 보여 줘서, 돌며 흔들리는 무지개 꽃이 비틀린 모양으로 늘어지고 배경 줄무늬는 물결이 된다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/061-slit-scan.mp4) · [Code](../effects/061-slit-scan.js) · Shaders & generative · 셰이더·제너러티브

## Prompt (English)

```text
Create a "Slit-Scan" motion effect (time displacement): every row of the frame shows the scene at a different moment, so simple moving shapes stretch through time.

Look
- Units: frame widths (1 = 1080 px), origin at the frame centre, y up (rows run from about −0.89 to +0.89).
- The scene at a time τ:
  - Background vertical gradient #0D0D1F (bottom) → #1F0F33 (top).
  - Vertical stripes: period 120 px (9 across), each 38 px wide, colour #332E5C, sliding sideways by 0.5 · sway(τ). Edges anti-aliased with fwidth.
  - A five-petal flower: edge radius 0.3 + 0.1 · cos(5θ) (324 px ± 108 px), rotated by 2π · τ / 5 and moved sideways by sway(τ) = 0.2 · sin(2 · 2π · τ / 5) (±216 px, twice per loop). Colour: a rainbow by angle from the cosine palette A + B · cos(2π(x + D)), A = (0.6, 0.5, 0.55), B = 0.4, D = (0, 0.33, 0.6), x = θ / 2π + 0.15r (red #FF4E3A, violet #9926C8, sky blue #33B1DF, lime #99D950 …). Brighter toward the middle (× 0.8 → 1.05) with a cream #FFF2D9 centre spot (solid inside 54 px, gone by 76 px). Edge soft over ±4 px.
- Slit-scan: the row at height y shows the scene at τ = t + 2.6 · y. Top rows are about 2.3 s ahead, bottom rows 2.3 s behind. The straight stripes turn into smooth sine waves (wavelength about 1040 px, ±108 px), and the flower smears into a twisted, swept shape.
- On top, the real undistorted flower at the current time t (no row offset) as a thin white outline at 75 % opacity, about 5 px wide (|distance to the edge| < 0.0025 plus fwidth anti-aliasing).

Motion (0–5 s)
- The flower turns once and sways twice per 5 s; the stripes slide with half the sway. All motion is periodic in 5 s, so any time offset still loops seamlessly.
- The smeared shape keeps twisting and flowing while the white outline shows what the flower really looks like now.

Technique
- A WebGL2 full-screen fragment shader that evaluates the scene analytically for each pixel at its own row time; no frame history is stored.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"슬릿 스캔" 모션 효과(시간 변위)를 만들어 줘: 화면의 줄마다 장면의 다른 순간을 보여 줘서, 단순하게 움직이는 도형이 시간 속으로 늘어지는 효과.

모양
- 단위는 화면 너비(1 = 1080px), 원점은 화면 중심, y는 위쪽이 +(줄은 약 −0.89에서 +0.89까지).
- 시간 τ의 장면:
  - 배경 세로 그라디언트 #0D0D1F(아래) → #1F0F33(위).
  - 세로 줄무늬: 주기 120px(가로 9개), 폭 38px, 색 #332E5C, 0.5 · sway(τ)만큼 옆으로 미끄러진다. 경계는 fwidth로 안티에일리어싱.
  - 꽃잎 다섯 장 꽃: 가장자리 반지름 0.3 + 0.1 · cos(5θ)(324px ± 108px), 2π · τ / 5만큼 회전하고 sway(τ) = 0.2 · sin(2 · 2π · τ / 5)만큼 옆으로 이동(±216px, 루프당 두 번). 색은 각도에 따른 무지개: 코사인 팔레트 A + B · cos(2π(x + D)), A = (0.6, 0.5, 0.55), B = 0.4, D = (0, 0.33, 0.6), x = θ / 2π + 0.15r(빨강 #FF4E3A, 보라 #9926C8, 하늘색 #33B1DF, 연두 #99D950 …). 가운데로 갈수록 밝게(× 0.8 → 1.05), 가운데에 크림색 #FFF2D9 점(54px 안은 꽉 차고 76px에서 사라짐). 경계는 ±4px 부드럽게.
- 슬릿 스캔: 높이 y의 줄은 τ = t + 2.6 · y의 장면을 보여 준다. 맨 위 줄은 약 2.3초 앞, 맨 아래 줄은 2.3초 뒤. 곧은 줄무늬가 부드러운 사인 물결(파장 약 1040px, ±108px)이 되고, 꽃은 비틀리며 쓸린 모양으로 늘어진다.
- 맨 위에는 지금 시간 t(줄 오프셋 없음)의 왜곡 없는 진짜 꽃을 얇은 흰 윤곽선(불투명도 75 %, 폭 약 5px: 가장자리까지 거리 < 0.0025 + fwidth 안티에일리어싱)으로 그린다.

움직임 (0–5초)
- 꽃은 5초에 한 바퀴 돌고 두 번 흔들리며, 줄무늬는 그 흔들림의 절반만큼 미끄러진다. 모든 움직임이 5초 주기라서 어떤 시간 오프셋을 줘도 끊김 없이 반복된다.
- 늘어진 모양은 계속 비틀리며 흐르고, 흰 윤곽선이 지금 꽃의 진짜 모양을 보여 준다.

기법
- WebGL2 전체 화면 프래그먼트 셰이더가 픽셀마다 자기 줄의 시간으로 장면을 해석적으로 계산한다. 지난 프레임은 저장하지 않는다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
