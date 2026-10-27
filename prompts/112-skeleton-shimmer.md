# 112 · Skeleton Shimmer · 스켈레톤 시머

<img src="../previews/112-skeleton-shimmer.webp" width="270" alt="Skeleton Shimmer preview">

**EN** A light band sweeps over grey skeleton cards, the real posts (photo, name, text) fade in piece by piece, then fold back.  
**KO** 회색 스켈레톤 카드 위로 빛줄기가 훑고, 사진·이름·글이 하나씩 나타났다가 다시 스켈레톤으로 돌아간다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/112-skeleton-shimmer.mp4) · [Code](../effects/112-skeleton-shimmer.js) · UI & interaction · UI·인터랙션

## Prompt (English)

```text
Create a "Skeleton Shimmer" motion effect: a social feed shows grey skeleton placeholders with a diagonal light band sweeping over them, then the real posts fade in piece by piece and later fold back into the skeleton.

Look
- Background: vertical gradient #EEF1F8 (top) to #DCE2EE (bottom). Heading "피드" in Apple SD Gothic Neo 800, 64 px, #151A2D, baseline at y 360, x 76.
- Two white post cards, 940 × 680 px, corner radius 40, at x 70 and y 420 and y 1140, with a soft shadow (rgba(30,40,90,0.12), blur 50, offset y 16).
- Six placeholder shapes per card (positions relative to the card's top-left): avatar circle at (98, 96) r 48; name bar at (176, 58) 300 × 34; sub bar at (176, 110) 200 × 26; image block at (50, 180) 840 × 330 with radius 28; two text bars at (50, 556) 740 × 30 and (50, 608) 460 × 30. Bars are fully rounded pills. Skeleton colour #E1E6EF.
- Loaded content, all in Apple SD Gothic Neo, left-aligned at the bar's x and centred on the bar's height:
  Post 1: avatar = gradient circle #FF8A65 to #E8577A with a white "김" (700, 40 px); name "김하늘" (700, 40 px, #151A2D); "2분 전 · 제주" (500, 30 px, #8A91A5); photo = a flat-illustration sunset (big pale-yellow sun, violet-to-pink-to-orange sky, four layered magenta/purple mountain ridges, a lake with horizontal sun-reflection stripes); "노을이 이렇게 예쁠 줄은 몰랐어요." (500, 36 px, #2A3047); "#여행  #주말  #노을" (600, 34 px, #5B6CFF).
  Post 2: avatar #6C8BFF to #8E5CF7 with "이"; "이도윤"; "1시간 전 · 서울"; photo = a night city skyline with lit yellow (#FFD36E) and a few cyan windows under a navy-to-violet-to-pink sky with small stars; "퇴근길에 올려다본 오늘의 야경"; "#야경  #도시  #퇴근길".

Motion (0–5 s)
- Shimmer: a linear gradient from (bx − 320, 0) to (bx + 320, 240), transparent → white at 90 % → transparent, clipped to the skeleton shapes only. bx = −900 + fract(3t / 5) × 3000, so it sweeps left to right 3 times per loop; because it is slanted it reaches the lower card a moment later.
- Loading: shape i of post p starts at 1.9 + 0.3p + 0.07i s and takes 0.45 s (ease-out cubic). As it loads, the grey shape fades out and the real piece fades in while sliding up from 14 px below.
- Unloading: everything returns to skeleton with a smoothstep from 4.25 + 0.1p to 4.75 + 0.1p s, so t = 5 matches t = 0.

Technique
- Canvas 2D. Pre-render the two pictures once into 840 × 330 off-screen canvases and draw them clipped to the rounded image rect.
- Clean fades and a wide soft band; no hard-edged moving lines.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"스켈레톤 시머" 모션 효과를 만들어 줘: 소셜 피드의 회색 스켈레톤 자리표시 위로 비스듬한 빛줄기가 훑고 지나가고, 실제 게시물이 조각조각 나타났다가 나중에 다시 스켈레톤으로 돌아가는 효과.

모양
- 배경: 세로 그라디언트 #EEF1F8(위) → #DCE2EE(아래). 제목 "피드"는 Apple SD Gothic Neo 800, 64 px, #151A2D, 기준선 y 360, x 76.
- 흰 게시물 카드 두 장, 940 × 680 px, 모서리 반지름 40, x 70 / y 420과 y 1140, 부드러운 그림자(rgba(30,40,90,0.12), 흐림 50, y 오프셋 16).
- 카드마다 자리표시 도형 여섯 개(카드 왼쪽 위 기준): 아바타 원 (98, 96) 반지름 48, 이름 막대 (176, 58) 300 × 34, 보조 막대 (176, 110) 200 × 26, 이미지 블록 (50, 180) 840 × 330 반지름 28, 글 막대 두 개 (50, 556) 740 × 30과 (50, 608) 460 × 30. 막대는 양끝이 완전히 둥근 알약 모양. 스켈레톤 색 #E1E6EF.
- 불러온 내용은 모두 Apple SD Gothic Neo, 막대의 x에서 왼쪽 정렬, 막대 높이의 가운데에 맞춘다:
  게시물 1: 아바타 = #FF8A65 → #E8577A 그라디언트 원 안에 흰 "김"(700, 40 px), 이름 "김하늘"(700, 40 px, #151A2D), "2분 전 · 제주"(500, 30 px, #8A91A5), 사진 = 플랫 일러스트 노을(크고 옅은 노란 해, 보라→분홍→주황 하늘, 마젠타·보라 산 능선 네 겹, 햇빛이 가로 줄무늬로 비치는 호수), "노을이 이렇게 예쁠 줄은 몰랐어요."(500, 36 px, #2A3047), "#여행  #주말  #노을"(600, 34 px, #5B6CFF).
  게시물 2: 아바타 #6C8BFF → #8E5CF7에 "이", "이도윤", "1시간 전 · 서울", 사진 = 남색→보라→분홍 하늘과 작은 별 아래 노란(#FFD36E) 창문과 몇몇 하늘색 창문이 켜진 밤 도시 스카이라인, "퇴근길에 올려다본 오늘의 야경", "#야경  #도시  #퇴근길".

움직임 (0–5초)
- 시머: (bx − 320, 0)에서 (bx + 320, 240)까지의 선형 그라디언트(투명 → 90 % 흰색 → 투명)를 스켈레톤 도형 안에만 클립한다. bx = −900 + fract(3t / 5) × 3000 이라서 루프마다 왼쪽→오른쪽으로 3번 훑는다. 비스듬해서 아래 카드에는 조금 늦게 닿는다.
- 불러오기: 게시물 p의 도형 i는 1.9 + 0.3p + 0.07i 초에 시작해 0.45초 동안(ease-out cubic) 바뀐다. 회색 도형은 사라지고 실제 내용은 14 px 아래에서 올라오며 나타난다.
- 되돌리기: 4.25 + 0.1p 초에서 4.75 + 0.1p 초까지 smoothstep으로 전부 스켈레톤으로 돌아가서 t = 5가 t = 0과 같다.

기법
- Canvas 2D. 두 그림은 처음에 한 번만 840 × 330 오프스크린 캔버스에 그려 두고, 둥근 이미지 사각형으로 클립해서 그린다.
- 깔끔한 페이드와 넓고 부드러운 빛줄기. 모서리가 날카롭게 움직이는 선은 없다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
