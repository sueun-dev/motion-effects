# 180 · Sweep & Loft · 스윕·로프트

<img src="../previews/180-sweep-loft.webp" width="270" alt="Sweep & Loft preview">

**EN** A glowing star-shaped cross-section rides a trefoil knot, twisting and lofting from round to five-pointed, and leaves a glossy candy-coloured solid behind it.  
**KO** 빛나는 별 모양 단면이 세잎매듭 경로를 달리며 비틀리고 원에서 다섯 꼭지 별로 모양을 바꾸며, 뒤에 반짝이는 사탕색 입체를 남긴다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/180-sweep-loft.mp4) · [Code](../effects/180-sweep-loft.js) · Geometry & modeling · 지오메트리·모델링

## Prompt (English)

```text
Create a "Sweep & Loft" motion effect: a cross-section shape travels along a closed 3D path (a trefoil knot) and leaves a solid behind it; the section twists as it goes and lofts between a round shape and a five-point star.

Look
- Background: a radial gradient, #3A1D4F in the middle to #0E0818 at the edges. A neutral room environment map at 0.5, ACES Filmic tone mapping, a key light #FFF2E6 at 2.2 from (−3, 5, 6) and a hemisphere light #C9B8FF / #2A0F30 at 0.6.
- The path: the trefoil knot C(s) = (sin s + 2 sin 2s, cos s − 2 cos 2s, −sin 3s) × 0.54, s from 0 to 2π.
- The section at parameter s, in polar form round the path: r(s, θ) = R(s) · (1 + k(s)·cos 5(θ + 0.4s)) / (1 + 0.5·k(s)), with R(s) = 0.34 + 0.05·sin 2s and k(s) = 0.2 − 0.18·cos 3s. So it lofts from almost round (k = 0.02) to a soft five-point star (k = 0.38) three times per lap, and twists 0.4 rad per radian of path (2/5 of a turn per lap, which lands the star on itself).
- The solid: 521 rings of 100 points from the tail to the head, wrapped round (no seam), with a flat pale-pink #FFE9F4 cap at each end. Vertex colour by s: HSL(0.93 − 0.45·(0.5 − 0.5·cos s), 0.9, 0.56), pink → violet → teal and back. Physical material, roughness 0.28, metalness 0.05, clearcoat 1 (roughness 0.1); normals recomputed every frame.
- The section at the head is outlined by a white 6 px fat line, drawn a hair ahead of the cap, so the profile reads.
- The path ahead is a dotted guide: 180 small spheres (radius 0.035, #E9D8FF at 55 %) evenly spaced in s along the whole knot.
- Camera: perspective, fov 30°, at (0, 0, 16) looking at the origin; the knot fills the middle of the frame.

Motion (0–5 s), a = 2π · t / 5
- The head runs once round the knot per loop: head = a + 0.6.
- The solid stretches and shrinks: its length (in s) is 2π·(0.56 − 0.3·cos a), from 0.26 of a lap at 0 s to 0.86 at 2.5 s; tail = head − length.
- The whole knot rocks: rotation (x, y, z) = (0.35 + 0.12·sin a, 0.4·sin a, 0.1·cos a).
- Everything on the path is periodic in s (the section's star count, the loft, the twist and the colours), so after one lap the shape is exactly the same.

Technique
- A rotation-minimising frame along one lap, sampled at 3000 points by the double reflection method; the leftover twist between the end and the start of the lap is measured and spread linearly back along the lap, so the frame closes up. Between samples, interpolate the normal and re-orthogonalise it against the analytic tangent; binormal = tangent × normal.
- Each frame, rebuild the swept solid between tail and head: ring j at s = tail + length·j/520, point k = C(s) + N·r·cos θ + B·r·sin θ with θ = 2πk/100. Caps are separate vertices (copies of the end rings plus a centre), so their edges stay sharp. The outline is a Line2 through the head ring.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"스윕·로프트" 모션 효과를 만들어 줘: 단면 도형이 닫힌 3D 경로(세잎매듭)를 따라 움직이며 뒤에 입체를 남긴다. 단면은 가면서 비틀리고, 둥근 모양과 다섯 꼭지 별 사이를 오가며 모양이 바뀐다(로프트).

모양
- 배경: 방사형 그라디언트, 가운데 #3A1D4F에서 가장자리 #0E0818. 중성 룸 환경맵 0.5, ACES Filmic 톤 매핑, 키 라이트 #FFF2E6 2.2 위치 (−3, 5, 6), 반구광 #C9B8FF / #2A0F30 0.6.
- 경로: 세잎매듭 C(s) = (sin s + 2 sin 2s, cos s − 2 cos 2s, −sin 3s) × 0.54, s는 0~2π.
- 경로 매개변수 s에서의 단면(경로 둘레 극좌표): r(s, θ) = R(s) · (1 + k(s)·cos 5(θ + 0.4s)) / (1 + 0.5·k(s)), R(s) = 0.34 + 0.05·sin 2s, k(s) = 0.2 − 0.18·cos 3s. 그래서 한 바퀴에 세 번, 거의 둥근 모양(k = 0.02)과 부드러운 다섯 꼭지 별(k = 0.38) 사이를 오가고, 경로 1라디안마다 0.4라디안 비틀린다(한 바퀴에 2/5바퀴라서 별이 자기 자신과 겹친다).
- 입체: 꼬리에서 머리까지 100점짜리 고리 521개, 둘레로 이어져 이음매가 없다. 양 끝은 연분홍 #FFE9F4 평평한 마개. 꼭짓점 색은 s에 따라 HSL(0.93 − 0.45·(0.5 − 0.5·cos s), 0.9, 0.56): 분홍 → 보라 → 청록 → 다시 분홍. 물리 기반 재질, 거칠기 0.28, 금속성 0.05, 클리어코트 1(거칠기 0.1). 법선은 매 프레임 다시 계산.
- 머리의 단면은 마개 바로 앞에 흰 6px 굵은 선으로 테두리를 그려 모양이 잘 보이게 한다.
- 앞으로 갈 경로는 점선 안내: 작은 구 180개(반지름 0.035, #E9D8FF 55 %)를 매듭 전체에 s 간격을 같게 놓는다.
- 카메라: 원근, 시야각 30°, (0, 0, 16)에서 원점을 본다. 매듭이 화면 가운데를 채운다.

움직임 (0–5초), a = 2π · t / 5
- 머리는 루프마다 매듭을 한 바퀴 돈다: head = a + 0.6.
- 입체가 늘었다 줄었다 한다: 길이(s 기준) 2π·(0.56 − 0.3·cos a), 0초에 0.26바퀴, 2.5초에 0.86바퀴. tail = head − 길이.
- 매듭 전체가 살짝 흔들린다: 회전 (x, y, z) = (0.35 + 0.12·sin a, 0.4·sin a, 0.1·cos a).
- 경로 위의 모든 것(별 꼭지 수, 로프트, 비틀림, 색)이 s에 대해 주기적이어서, 한 바퀴 뒤 모양이 정확히 같다.

기법
- 한 바퀴를 3000점으로 나눠 이중 반사(double reflection) 방법으로 회전 최소 프레임을 만든다. 끝과 시작 사이에 남는 비틀림을 재서 바퀴 전체에 선형으로 나눠 되돌리면 프레임이 닫힌다. 샘플 사이에서는 법선을 보간해 해석적 접선에 대해 다시 직교화하고, 종법선 = 접선 × 법선.
- 매 프레임 꼬리와 머리 사이의 스윕 입체를 다시 만든다: 고리 j는 s = tail + 길이·j/520, 점 k = C(s) + N·r·cos θ + B·r·sin θ, θ = 2πk/100. 마개는 따로 꼭짓점(끝 고리 복사본 + 중심점)을 써서 가장자리가 날카롭게 남는다. 테두리는 머리 고리를 지나는 Line2.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
