# 126 · Page Curl · 페이지 넘김

<img src="../previews/126-page-curl.webp" width="270" alt="Page Curl preview">

**EN** A finger lifts the bottom corner of a book page and peels it over to the left, revealing a picture page, then turns back to the text.  
**KO** 손가락이 책장 아래 모서리를 들어 왼쪽으로 넘기면 그림이 있는 다음 장이 나오고, 다시 글 페이지로 넘어온다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/126-page-curl.mp4) · [Code](../effects/126-page-curl.js) · UI & interaction · UI·인터랙션

## Prompt (English)

```text
Create a "Page Curl" motion effect: a page peel. The bottom-right corner of a book page is dragged across the page; the fold line is the perpendicular bisector of the corner and the finger, the part past it is cut off and drawn mirrored (the paper's back, shaded like a curl), and the next page shows below.

Look
- Background: a dark wooden-brown radial gradient centred at (540, 1000), #3A2C24 (inner radius 200) to #16100D at radius 1300.
- The page: 860 × 1360 at (110, 360), spine on the left. Under it, three page edges for thickness: rectangles offset 4, 8, 12 px down and 7, 14, 21 px wider to the right, colours rgb(218,210,192), rgb(204,196,178), rgb(190,182,164), with a shadow rgba(0,0,0,0.5) blur 50 offset y 20.
- Paper: horizontal gradient #E9E1D0 at the spine (first 6 %) → #FBF7EF → #FFFDF8. Every page has a running head "바다로 가는 길" (Apple SD Gothic Neo 500, 28 px, #A89A84) centred 90 px from the top and "· · ·" 70 px from the bottom.
- Page A (text): "III" (Didot 500, 40 px, #B4462F) at (80, 250) in page coordinates; title "바다로 가는 길" (800, 64 px, #2A2118) at (80, 340); a 90 × 5 #B4462F rule at y 380; body text (500, 38 px, #3B3128) at x 80 from y 500, line height 64: "새벽 다섯 시, 마을은 아직" / "잠들어 있었다. 하늘은 남색에서" / "보라로 천천히 물들었고, 멀리서" / "첫 버스가 언덕을 넘어오는" / "소리가 났다." / (blank) / "나는 낡은 배낭을 메고 정류장" / "으로 걸었다. 주머니 속 쪽지에는" / "할머니의 글씨로 짧은 한 줄이" / "적혀 있었다." / (blank) / "“바다는 늘 그 자리에 있단다.”".
- Page B (picture): a 700 × 560 picture (radius 20) at (80, 180): a flat-illustration sunset (big pale-yellow sun, violet-pink-orange sky, layered magenta/purple mountains, a lake with horizontal sun-reflection stripes); italic caption "그날 아침의 바다" (500, 30 px, #8A7C68) at y 800; body from y 920: "버스 창밖으로 해가 떠오르자" / "바다가 한꺼번에 빛났다." / "나는 그제야 쪽지의 뜻을" / "조금 알 것 같았다.".

Motion (0–5 s)
- Two turns: at 0.2 s (A → B) and at 2.7 s (B → A), each 2.2 s long, e = smoothstep(0, 1, progress).
- The dragged corner: C = the page's bottom-right (970, 1720); P = (970 − 1720 e, 1720 − 420 sin(π e)(1 − e)), so it travels to its mirror image past the spine, lifting on the way.
- Fold: M = midpoint of C and P, n = unit vector from P to C. Split the page rectangle by the line through M perpendicular to n (polygon clipping against a half-plane). Draw the next page, then the current page clipped to the part that stays, then the cut-off part reflected across the fold line (the flap), clipped to the right of the spine.
- Flap shading: a gradient along −n from the fold: #DED5C3 at the fold, #FFFDF7 at 7 % (the bright roll of the curl), #E6DDCB at 600 px; a soft shadow under the flap (rgba(20,10,0, 0.38 f), blur 60, offset 10 px towards the fold); the current page's print showing through mirrored at 5 % opacity. On the next page, a shadow along the fold (rgba(40,25,10, 0.32 f) → 0 over 220 px). f = sqrt(sin(π e)).
- Finger: a translucent circle r 52, rgba(30,20,10,0.3), 5 px white ring, holding the corner at P + (10, −10); it fades in over e 0–0.12 and out over 0.55–0.75 while the page finishes falling.

Technique
- Canvas 2D. The page sweeps fast, so add motion blur: render the frame 6 times spread over one frame (t ± 1/60 s) to an off-screen canvas and average them (alpha 1 / (k + 1) for render k). Pre-render both pages once.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"페이지 넘김" 모션 효과를 만들어 줘: 책장 벗기기. 책장의 오른쪽 아래 모서리를 끌어 페이지를 가로지르면, 모서리와 손가락을 잇는 선의 수직이등분선이 접히는 선이 되고, 그 너머 부분은 잘려 거울처럼 뒤집혀 그려지며(종이 뒷면, 말린 것처럼 음영), 아래로 다음 장이 보이는 효과.

모양
- 배경: 짙은 나무 갈색 방사형 그라디언트, 중심 (540, 1000), #3A2C24(안쪽 반지름 200)에서 반지름 1300의 #16100D까지.
- 페이지: 860 × 1360, (110, 360), 책등은 왼쪽. 그 아래 두께를 위한 종이 가장자리 세 겹: 4, 8, 12 px 아래로, 오른쪽으로 7, 14, 21 px 더 넓은 사각형, 색 rgb(218,210,192), rgb(204,196,178), rgb(190,182,164), 그림자 rgba(0,0,0,0.5) 흐림 50 y 오프셋 20.
- 종이: 가로 그라디언트, 책등 쪽(처음 6 %) #E9E1D0 → #FBF7EF → #FFFDF8. 모든 장에 위에서 90 px 가운데 머리글 "바다로 가는 길"(Apple SD Gothic Neo 500, 28 px, #A89A84), 아래에서 70 px에 "· · ·".
- A 장(글): 페이지 좌표 (80, 250)에 "III"(Didot 500, 40 px, #B4462F), (80, 340)에 제목 "바다로 가는 길"(800, 64 px, #2A2118), y 380에 90 × 5 #B4462F 줄, 본문(500, 38 px, #3B3128) x 80, y 500부터 줄 간격 64: "새벽 다섯 시, 마을은 아직" / "잠들어 있었다. 하늘은 남색에서" / "보라로 천천히 물들었고, 멀리서" / "첫 버스가 언덕을 넘어오는" / "소리가 났다." / (빈 줄) / "나는 낡은 배낭을 메고 정류장" / "으로 걸었다. 주머니 속 쪽지에는" / "할머니의 글씨로 짧은 한 줄이" / "적혀 있었다." / (빈 줄) / "“바다는 늘 그 자리에 있단다.”".
- B 장(그림): (80, 180)에 700 × 560 그림(반지름 20): 플랫 일러스트 노을(크고 옅은 노란 해, 보라·분홍·주황 하늘, 마젠타·보라 산 여러 겹, 햇빛이 가로 줄무늬로 비치는 호수). y 800에 이탤릭 설명 "그날 아침의 바다"(500, 30 px, #8A7C68). y 920부터 본문: "버스 창밖으로 해가 떠오르자" / "바다가 한꺼번에 빛났다." / "나는 그제야 쪽지의 뜻을" / "조금 알 것 같았다.".

움직임 (0–5초)
- 넘기기 두 번: 0.2초(A → B)와 2.7초(B → A), 각각 2.2초, e = smoothstep(0, 1, 진행도).
- 끌리는 모서리: C = 페이지 오른쪽 아래 (970, 1720), P = (970 − 1720 e, 1720 − 420 sin(π e)(1 − e)). 그래서 책등 너머 거울 위치까지 가면서 도중에 들린다.
- 접는 선: M = C와 P의 중점, n = P에서 C로 가는 단위 벡터. 페이지 사각형을 M을 지나고 n에 수직인 선으로 나눈다(반평면으로 다각형 자르기). 다음 장을 그리고, 남는 부분만큼 지금 장을 그리고, 잘려 나간 부분을 접는 선에 대해 뒤집어(날개) 책등 오른쪽으로 클립해 그린다.
- 날개 음영: 접는 선에서 −n 방향 그라디언트: 접는 선 #DED5C3, 7 %에서 #FFFDF7(말린 부분의 밝은 띠), 600 px에서 #E6DDCB. 날개 아래 부드러운 그림자(rgba(20,10,0, 0.38 f), 흐림 60, 접는 선 쪽으로 10 px). 지금 장의 글씨가 5 % 불투명도로 뒤집혀 비친다. 다음 장에는 접는 선을 따라 그림자(rgba(40,25,10, 0.32 f) → 0, 220 px). f = sqrt(sin(π e)).
- 손가락: 반투명 원 반지름 52, rgba(30,20,10,0.3), 5 px 흰 테두리, P + (10, −10)에서 모서리를 잡는다. e 0–0.12에 나타나고 0.55–0.75에 사라지며 페이지는 끝까지 넘어간다.

기법
- Canvas 2D. 페이지가 빠르게 쓸고 지나가므로 모션 블러를 넣는다: 한 프레임 안(t ± 1/60초)에 프레임을 6번 오프스크린 캔버스에 그려 평균 낸다(k번째는 알파 1 / (k + 1)). 두 장은 한 번만 그려 둔다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
