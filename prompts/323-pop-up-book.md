# 323 · Pop-up Book · 팝업북

<img src="../previews/323-pop-up-book.webp" width="270" alt="Pop-up Book preview">

**EN** A red pop-up book opens to a right angle: towers, trees, a gate and a keep with a dragon rise from the fold on parallel folds, then fold flat as the book shuts.  
**KO** 빨간 팝업북이 직각으로 펼쳐지면 평행 접기로 탑·나무·성문과 용이 앉은 성탑이 접힌 선에서 일어서고, 책이 닫히며 다시 납작하게 접힌다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/323-pop-up-book.mp4) · [Code](../effects/323-pop-up-book.js) · Art & craft · 예술·공예

## Prompt (English)

```text
Create a "Pop-up Book" motion effect: a cloth-bound book opens on a desk, its back page standing up as a backdrop, and paper structures rise from the fold. Every structure is a parallel fold (all its creases parallel to the spine), so it unfolds and folds flat exactly with the pages.

Look
- three.js, ACES tone mapping, a 40° camera at (0.3·sin a, 6.6, 10.2) looking at (0, 0.85, 1.0). A dark wood desk #5B3A26 with faint grain; clear colour #2C2420.
- The book: two halves, each a page block 3.2 wide, 3.0 deep and 0.1 thick (cream edges) on a red cloth board #8E2B2B (0.16 wider, 0.1 deeper, 0.04 thick). The spine runs along x at the back edge of the front half.
  - The front page (lying on the desk) is printed as a meadow (#6FA85A → #8CC06C) with a blue moat ring #5E93C8, a sandy road #E3C78E to the gate, a little bridge and 70 soft flower dots.
  - The back page is printed as a dusk sky #2C3A78 → #8A6AA8 (55 %) → #F6B27A with 14 small four-point stars, a soft glowing moon and purple hills #8E6E9A along its lower edge.
  - The back cover carries a gold #E2B65A double border and the title "The Dragon Castle" (112 px serif) with "용의 성 · 팝업북".
- Pop-up pieces, printed paper (pale lavender stone #BDB5C9 with soft mottling, tops #CFC8DA), all double-sided, with cut-outs by alpha test. In the side view, a point is P(f, b) = spine + f·(floor direction) + b·(back-page direction):
  - two tree rows at x ±1.04…±1.52: a box fold with depth a = 1.3 and height b = 0.16, carrying a cut-out 0.95 high (two pines and a round apple tree over a hedge);
  - two towers at x ±0.64…±0.98: a box fold with a = 1.0, b = 1.12 (stone with two lit arched windows), carrying a red cone roof 0.46 high with a yellow pennant;
  - the gate and the keep at x −0.6…0.6: one stepped fold — the gate wall at depth 0.78 and 0.55 high (an arched portcullis gate and two lit windows), a ledge back to depth 0.4, the keep face 1.02 high (three lit windows and a red banner), and the keep top back to the back page at height 1.57; the keep face carries a cut-out 0.88 high of a green dragon with bat wings, horns and a puff of flame, standing on the keep.
- Light: a warm directional light #FFF1DC (2.6) from (−3.5, 7, 6) with soft 2048 px shadows (radius 5), so every piece casts a shadow on the meadow and the sky page; a hemisphere light #FFF4E6 / #5A4636 (1.0).
- Below the book, a dark panel (60, 1560, 960 × 300 px, #1C1411) shows the stepped fold from the side: the floor and back pages as two 6 px lines #C9A57A meeting at the spine, the chain of panels in #E8E2F2, the dragon in #7BC48A and the creases as 7 px gold dots #F2C14E (95 px per unit), with the text "Parallel folds", "every crease parallel to the spine · 모든 접는 선이 책등과 평행", "side view of the gate and keep · 성문과 탑을 옆에서 본 접힘".

Motion (0–5 s): local time u = (t + 0.3) mod 5, a = 2π · t / 5
- Openness k = s(u / 1.8) · (1 − s((u − 2.9) / 1.8)) with the sine ease s(x) = (1 − cos πx) / 2 (clamped to 0..1): the book opens over 0–1.8, stays open 1.8–2.9, closes 2.9–4.7 and stays shut 4.7–5. The fold angle is θ = k · 90°; the back half turns about the spine.
- Every piece follows θ: a box is P(a, 0) → P(a, b) (front) and P(0, b) → P(a, b) (top), its cut-out from P(a, b) to P(a, b + e); the stepped fold is P(0.78, 0) → P(0.78, 0.55) → P(0.4, 0.55) → P(0.4, 1.57) → P(0, 1.57). With the back-page direction (0, sin θ, cos θ) the chain is a set of parallelograms, so it stands up as boxes at 90° and lies flat at 0°.
- The camera only drifts sideways (0.3·sin a); the side-view diagram follows the same angle.

Technique
- Each panel is a four-vertex quad whose corners are set every frame from θ; nothing is simulated.
- Every frame averages 24 renders spread over its 1/30 s (accumulated in a half-float target, then tone mapped), so the turning page blurs smoothly; the diagram averages 12 instants the same way.
- The textures are made once on canvases; fine high-contrast detail is avoided on moving panels so they do not shimmer as they swing.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"팝업북" 모션 효과를 만들어 줘: 천 장정 책이 책상 위에서 펼쳐지며 뒤 페이지가 배경처럼 일어서고, 접힌 선에서 종이 구조물이 솟아오른다. 모든 구조물은 평행 접기(모든 접는 선이 책등과 평행)라서 페이지와 정확히 함께 펼쳐지고 납작하게 접힌다.

모양
- three.js, ACES 톤 매핑, 시야각 40° 카메라를 (0.3·sin a, 6.6, 10.2)에 두고 (0, 0.85, 1.0)을 본다. 은은한 결의 어두운 나무 책상 #5B3A26, 지우는 색 #2C2420.
- 책: 두 쪽, 각각 폭 3.2·깊이 3.0·두께 0.1의 페이지 묶음(크림색 단면)이 빨간 천 표지판 #8E2B2B(0.16 넓고 0.1 깊고 두께 0.04) 위에 있다. 책등은 앞쪽 절반의 뒤 가장자리를 따라 x 방향으로 놓인다.
  - 앞 페이지(책상에 누운 쪽)는 초원(#6FA85A → #8CC06C)으로 인쇄: 파란 해자 고리 #5E93C8, 성문까지 이어진 모랫길 #E3C78E, 작은 다리, 부드러운 꽃점 70개.
  - 뒤 페이지는 해 질 녘 하늘 #2C3A78 → #8A6AA8(55 %) → #F6B27A, 네 갈래 작은 별 14개, 은은히 빛나는 달, 아래 가장자리를 따라 보랏빛 언덕 #8E6E9A.
  - 뒤 표지에는 금색 #E2B65A 이중 테두리와 제목 "The Dragon Castle"(112px 세리프), "용의 성 · 팝업북".
- 팝업 조각: 인쇄한 종이(부드러운 얼룩이 있는 연보라 돌 #BDB5C9, 윗면 #CFC8DA), 모두 양면, 알파 테스트로 오려 낸다. 옆에서 본 점은 P(f, b) = 책등 + f·(바닥 페이지 방향) + b·(뒤 페이지 방향):
  - 나무 줄 둘, x ±1.04…±1.52: 깊이 a = 1.3, 높이 b = 0.16의 상자 접기 위에 높이 0.95의 오림(산울타리 위 소나무 둘과 둥근 사과나무);
  - 탑 둘, x ±0.64…±0.98: a = 1.0, b = 1.12의 상자 접기(불 켜진 아치 창 둘이 있는 돌) 위에 노란 깃발을 단 높이 0.46의 빨간 원뿔 지붕;
  - 성문과 성탑, x −0.6…0.6: 계단식 접기 하나 — 깊이 0.78, 높이 0.55의 성문 벽(아치형 쇠창살 문과 불 켜진 창 둘), 깊이 0.4까지 들어가는 턱, 높이 1.02의 성탑 면(불 켜진 창 셋과 빨간 깃발), 높이 1.57에서 뒤 페이지로 이어지는 성탑 윗면; 성탑 면 위에는 높이 0.88의 오림, 박쥐 날개·뿔·불꽃 한 줄기를 가진 초록 용이 성탑 위에 서 있다.
- 조명: (−3.5, 7, 6)에서 오는 따뜻한 방향광 #FFF1DC(2.6), 부드러운 2048px 그림자(반지름 5)로 조각마다 초원과 하늘 페이지에 그림자를 드리운다; 반구광 #FFF4E6 / #5A4636(1.0).
- 책 아래 어두운 판(60, 1560, 960 × 300px, #1C1411)에 계단식 접기를 옆에서 본 모습: 책등에서 만나는 바닥·뒤 페이지 6px 선 #C9A57A, 패널 사슬 #E8E2F2, 용 #7BC48A, 접는 선은 7px 금색 점 #F2C14E(1당 95px), 글자 "Parallel folds", "every crease parallel to the spine · 모든 접는 선이 책등과 평행", "side view of the gate and keep · 성문과 탑을 옆에서 본 접힘".

움직임 (0–5초): 로컬 시간 u = (t + 0.3) mod 5, a = 2π · t / 5
- 펼침 정도 k = s(u / 1.8) · (1 − s((u − 2.9) / 1.8)), 사인 이징 s(x) = (1 − cos πx) / 2(0..1로 자름): 0–1.8에 펼치고, 1.8–2.9에 펼친 채, 2.9–4.7에 닫고, 4.7–5에 닫힌 채. 접힘 각 θ = k · 90°, 뒤쪽 절반이 책등을 축으로 돈다.
- 조각마다 θ를 따른다: 상자는 P(a, 0) → P(a, b)(앞면)와 P(0, b) → P(a, b)(윗면), 오림은 P(a, b)에서 P(a, b + e)까지; 계단식 접기는 P(0.78, 0) → P(0.78, 0.55) → P(0.4, 0.55) → P(0.4, 1.57) → P(0, 1.57). 뒤 페이지 방향이 (0, sin θ, cos θ)라 사슬은 평행사변형들이 되어 90°에서는 상자로 서고 0°에서는 납작하게 눕는다.
- 카메라는 옆으로만 흘러간다(0.3·sin a). 옆모습 도식도 같은 각을 따른다.

기법
- 패널마다 꼭짓점 네 개의 사각형이고, 꼭짓점을 매 프레임 θ로 정한다. 시뮬레이션은 없다.
- 매 프레임은 그 1/30초에 걸친 렌더 24장의 평균(half-float 타깃에 누적한 뒤 톤 매핑)이라 도는 페이지가 매끄럽게 흐려진다. 도식도 같은 방식으로 12순간을 평균한다.
- 텍스처는 캔버스로 한 번 만든다. 움직이는 패널에는 대비가 센 잔 무늬를 두지 않아 흔들릴 때 반짝이지 않는다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
