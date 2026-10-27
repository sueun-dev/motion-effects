# 115 · Toggle Morph · 토글·아이콘 모프

<img src="../previews/115-toggle-morph.webp" width="270" alt="Toggle Morph preview">

**EN** A finger taps three controls in turn: a switch slides and turns green, a hamburger morphs into an X, play morphs into pause.  
**KO** 손가락이 컨트롤 세 개를 차례로 누르면 스위치가 초록으로 넘어가고, 햄버거가 X로, 재생이 일시정지로 바뀐다.

[Video (mp4)](../videos/115-toggle-morph.mp4) · [Code](../effects/115-toggle-morph.js) · UI & interaction · UI·인터랙션

## Prompt (English)

```text
Create a "Toggle Morph" motion effect: three micro-interactions on settings cards. A finger taps a switch, a hamburger icon and a play button; each morphs to its "on" state and later back.

Look
- Background: vertical gradient #EAF4F2 to #D5E2F3.
- Three white cards 940 × 460 at x 70, y 330 / 830 / 1330, corner radius 48, shadow rgba(30,50,90,0.13) blur 50 offset y 16. The control sits at (790, card top + 230).
- Left side of each card (Apple SD Gothic Neo): title 800, 64 px, #141A2E at (130, cy − 10); caption 500, 32 px at (130, cy + 50) that cross-fades from grey rgba(120,128,150) "off" text to green rgba(40,150,110) "on" text.
  Row 1 "알림": "알림이 꺼져 있어요" → "새 소식을 알려드려요". Row 2 "메뉴": "닫힘" → "열림". Row 3 "음악": "Midnight Drive · 일시정지" → "Midnight Drive · 재생 중".
- Switch: a 270 × 156 pill track whose colour goes from #E2E5EC to iOS green #34C759; a white knob 140 px tall, inset 8 px, with a shadow (rgba(0,0,0,0.25), blur 16, offset y 6).
- Hamburger: a 210 × 210 rounded square (radius 56) #1B1F3B with three white lines 112 px long, 15 px thick, round caps, 38 px apart.
- Play button: a circle r 105 with a diagonal gradient #FF5E7E → #FF9F43 and a white icon made of two four-point shapes (filled plus a 6 px round-joined stroke).
- Finger: translucent circle r 48, fill rgba(30,40,90,0.2), soft shadow, 5 px white ring.

Motion (0–5 s)
- Taps (on, off): switch 0.45 s and 2.95 s; hamburger 1.2 s and 3.7 s; play 1.95 s and 4.45 s. Each state change is an ease-in-out over 0.4 s (s goes 0 → 1, later 1 → 0).
- Switch: the knob slides across while stretching wider by 34 × sin(π s) px in the middle of the travel (a gooey pill), the track colour blends.
- Hamburger: first half of s, the top and bottom lines slide to the centre while the middle line fades; second half, they rotate ±45° into an X. Reverse to close.
- Play → pause: morph vertex by vertex. Play = quad (−30,−50),(8,−25),(8,25),(−30,50) plus (8,−25),(46,0),(46,0),(8,25); pause = bars (−40,−46),(−13,−46),(−13,46),(−40,46) and (13,−46),(40,−46),(40,46),(13,46) (offsets from the circle centre).
- While playing, a small 4-bar equaliser (12 px bars, 22 px apart, starting x 290, rgba(255,94,126) at opacity s) bounces next to "음악": height 14 + 30 s (0.5 + 0.5 sin(2π t / 5 × (6 + b) + 1.7 b)).
- Finger: rests on each control at (824, cy + 46), visiting rows 1, 2, 3, 1, 2, 3 — arrive/leave at 0.35/0.6, 1.1/1.35, 1.85/2.1, 2.85/3.1, 3.6/3.85, 4.35/4.6 s — and glides (ease-in-out) between them, wrapping from row 3 back to row 1 across the loop. On each tap it shrinks to r 39, darkens (alpha 0.34) and its shadow drops for about 0.3 s.

Technique
- Canvas 2D, everything driven by t through eased state values.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"토글·아이콘 모프" 모션 효과를 만들어 줘: 설정 카드 위의 마이크로 인터랙션 세 개. 손가락이 스위치, 햄버거 아이콘, 재생 버튼을 누르면 각각 "켜짐" 상태로 바뀌었다가 나중에 되돌아가는 효과.

모양
- 배경: 세로 그라디언트 #EAF4F2 → #D5E2F3.
- 흰 카드 세 장 940 × 460, x 70, y 330 / 830 / 1330, 모서리 반지름 48, 그림자 rgba(30,50,90,0.13) 흐림 50 y 오프셋 16. 컨트롤은 (790, 카드 위 + 230)에 있다.
- 카드 왼쪽(Apple SD Gothic Neo): 제목 800, 64 px, #141A2E, (130, cy − 10). 설명 500, 32 px, (130, cy + 50)은 회색 rgba(120,128,150) "꺼짐" 문구에서 초록 rgba(40,150,110) "켜짐" 문구로 교차 페이드.
  1행 "알림": "알림이 꺼져 있어요" → "새 소식을 알려드려요". 2행 "메뉴": "닫힘" → "열림". 3행 "음악": "Midnight Drive · 일시정지" → "Midnight Drive · 재생 중".
- 스위치: 270 × 156 알약 트랙, 색은 #E2E5EC에서 iOS 초록 #34C759로. 흰 손잡이 높이 140 px, 안쪽 여백 8 px, 그림자(rgba(0,0,0,0.25), 흐림 16, y 오프셋 6).
- 햄버거: 210 × 210 둥근 사각형(반지름 56) #1B1F3B 안에 흰 선 세 개, 길이 112 px, 두께 15 px, 둥근 끝, 간격 38 px.
- 재생 버튼: 대각선 그라디언트 #FF5E7E → #FF9F43 원(반지름 105) 안에 꼭짓점 네 개짜리 도형 두 개로 만든 흰 아이콘(채움 + 6 px 둥근 이음 선).
- 손가락: 반투명 원 반지름 48, 채움 rgba(30,40,90,0.2), 부드러운 그림자, 5 px 흰 테두리.

움직임 (0–5초)
- 탭(켜기, 끄기): 스위치 0.45초와 2.95초, 햄버거 1.2초와 3.7초, 재생 1.95초와 4.45초. 상태 변화는 각각 0.4초 ease-in-out(s가 0 → 1, 나중에 1 → 0).
- 스위치: 손잡이가 건너가면서 이동 중간에 34 × sin(π s) px만큼 가로로 늘어나고(말랑한 알약), 트랙 색이 섞인다.
- 햄버거: s의 앞 절반에 위·아래 선이 가운데로 모이고 가운데 선은 사라진다. 뒤 절반에 ±45° 돌아 X가 된다. 닫을 때는 거꾸로.
- 재생 → 일시정지: 꼭짓점끼리 보간. 재생 = (−30,−50),(8,−25),(8,25),(−30,50) 사각형과 (8,−25),(46,0),(46,0),(8,25). 일시정지 = 막대 (−40,−46),(−13,−46),(−13,46),(−40,46)과 (13,−46),(40,−46),(40,46),(13,46)(원 중심 기준).
- 재생 중에는 "음악" 옆에서 작은 막대 4개짜리 이퀄라이저(막대 12 px, 간격 22 px, x 290부터, rgba(255,94,126), 불투명도 s)가 춤춘다: 높이 14 + 30 s (0.5 + 0.5 sin(2π t / 5 × (6 + b) + 1.7 b)).
- 손가락: 컨트롤마다 (824, cy + 46)에 머무르며 1, 2, 3, 1, 2, 3행 순서로 간다. 도착/출발 0.35/0.6, 1.1/1.35, 1.85/2.1, 2.85/3.1, 3.6/3.85, 4.35/4.6초. 사이에는 ease-in-out으로 미끄러지고, 루프를 넘어 3행에서 1행으로 돌아간다. 탭할 때마다 약 0.3초 동안 반지름 39로 줄고 진해지며(알파 0.34) 그림자가 사라진다.

기법
- Canvas 2D. 모든 것은 t에서 계산한 이징 상태 값으로 움직인다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
