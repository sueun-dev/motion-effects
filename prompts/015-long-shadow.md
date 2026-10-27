# 015 · Long Shadow · 롱 섀도

<img src="../previews/015-long-shadow.webp" width="270" alt="Long Shadow preview">

**EN** Flat icon badges (camera, heart, star, bolt) cast long fading shadows that swing all the way round as the light circles once.  
**KO** 카메라·하트·별·번개 플랫 아이콘 배지의 길게 옅어지는 그림자가, 빛이 한 바퀴 도는 동안 함께 한 바퀴 돈다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/015-long-shadow.mp4) · [Code](../effects/015-long-shadow.js) · Design styles · 디자인 스타일

## Prompt (English)

```text
Create a "Long Shadow" motion effect: flat-design icon badges with long, fading shadows that swing all the way round as the light circles once.

Look
- Background: dark slate blue #2C3E57.
- Badges (flat circles): a big teal #1ABC9C badge of radius 320 at (540, 860) with a white camera icon; three small badges of radius 125 at y 1480: coral #E85D4E with a heart (x 250), orange #F4A62A with a five-point star (x 540), purple #8E5BD8 with a lightning bolt (x 830).
- White flat icons, given here in badge-centred px and scaled by 0.9 on the small badges (about 1.06 on the camera badge):
  - camera: body rounded rect 320 × 210 (radius 34) from (−160, −80) plus a top hump 140 × 70 (radius 16) from (−70, −130); a lens made of a badge-coloured disc of radius 70 with a white disc of radius 44 inside, centred at (0, 25); a badge-coloured flash dot of radius 14 at (110, −40);
  - heart: the classic heart curve x = 4.2·16·sin³θ, y = −4.2·(13·cosθ − 5·cos2θ − 2·cos3θ − cos4θ) − 8 (60 points);
  - star: 10 points alternating radius 72 and 30, pointing up;
  - bolt: polygon (18, −78), (−46, 10), (−4, 10), (−18, 78), (46, −12), (4, −12).
- A long shadow is the shape swept along the light direction: the union of the shape, a copy moved by the shadow vector, and for every edge the quad between the edge and its moved copy. Wind all pieces the same way and fill once with the nonzero rule, which gives the union. Fill the sweep with a linear gradient from black at the shape to transparent at the far end.
  - Each badge throws its shadow onto the background: sweep length 3.2·r, gradient black 32 % → 0 over that length.
  - Each icon throws a shadow across its badge, clipped to the badge circle: sweep length 2·r, gradient black 28 % → 0 over 1.6·r.
- Draw order: all badge shadows first, then for each badge the badge, its icon shadow (clipped), then the white icon.

Motion (0–5 s)
- The shadow direction angle is 2π·t / 5 + π/4 (screen coordinates, y down): it starts pointing down-right at 45° and turns once clockwise per loop at constant speed. All shadows turn together, crossing over the neighbouring badges as they swing.

Technique
- Canvas 2D, fully redrawn each frame: polygons built once, the sweep path rebuilt each frame from the direction vector, canvas clip for the icon shadows.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"롱 섀도" 모션 효과를 만들어 줘: 플랫 디자인 아이콘 배지의 길고 옅어지는 그림자가, 빛이 한 바퀴 도는 동안 함께 한 바퀴 휙 도는 효과.

모양
- 배경: 어두운 슬레이트 블루 #2C3E57.
- 배지(평평한 원): (540, 860)에 반지름 320 큰 청록 #1ABC9C 배지와 흰 카메라 아이콘. y 1480에 반지름 125 작은 배지 셋: 코랄 #E85D4E 하트(x 250), 주황 #F4A62A 오각별(x 540), 보라 #8E5BD8 번개(x 830).
- 흰 평면 아이콘(배지 가운데 기준 px, 작은 배지에서는 0.9배, 카메라 배지에서는 약 1.06배):
  - 카메라: (−160, −80)에서 시작하는 320 × 210 몸체 둥근 사각형(반지름 34)과 (−70, −130)에서 시작하는 140 × 70 윗부분(반지름 16). (0, 25) 중심에 배지색 반지름 70 원과 그 안의 흰 반지름 44 원으로 된 렌즈, (110, −40)에 배지색 반지름 14 플래시 점;
  - 하트: 고전 하트 곡선 x = 4.2·16·sin³θ, y = −4.2·(13·cosθ − 5·cos2θ − 2·cos3θ − cos4θ) − 8(점 60개);
  - 별: 반지름 72와 30을 번갈아 찍은 점 10개, 위쪽을 향함;
  - 번개: 다각형 (18, −78), (−46, 10), (−4, 10), (−18, 78), (46, −12), (4, −12).
- 긴 그림자는 도형을 빛 방향으로 쓸어 낸 모양이다: 도형, 그림자 벡터만큼 옮긴 사본, 그리고 변마다 그 변과 옮긴 변 사이의 사각형을 합친 것. 조각을 모두 같은 방향으로 감고 nonzero 규칙으로 한 번에 채우면 합집합이 된다. 도형 쪽은 검정, 먼 끝은 투명인 선형 그라디언트로 채운다.
  - 배지마다 배경에 그림자: 쓸기 길이 3.2·r, 그 길이에 걸쳐 검정 32 % → 0.
  - 아이콘마다 배지 위에 그림자, 배지 원으로 클립: 쓸기 길이 2·r, 1.6·r에 걸쳐 검정 28 % → 0.
- 그리는 순서: 배지 그림자 전부 → 배지마다 배지, (클립한) 아이콘 그림자, 흰 아이콘.

움직임 (0–5초)
- 그림자 방향 각도는 2π·t / 5 + π/4(화면 좌표, y가 아래): 오른쪽 아래 45°에서 시작해 일정한 속도로 루프마다 시계 방향으로 한 바퀴. 모든 그림자가 함께 돌며 옆 배지 위를 가로질러 지나간다.

기법
- Canvas 2D, 매 프레임 전부 다시 그린다. 다각형은 한 번 만들고, 쓸기 경로는 방향 벡터로 매 프레임 다시 만든다. 아이콘 그림자는 캔버스 clip.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
