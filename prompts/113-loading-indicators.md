# 113 · Loading Indicators · 로딩 인디케이터

<img src="../previews/113-loading-indicators.webp" width="270" alt="Loading Indicators preview">

**EN** Five loaders on dark cards: an arc spinner, bouncing dots, a progress ring that fills to a tick, an activity wheel and an upload bar.  
**KO** 어두운 카드 위 로딩 다섯 가지: 호 스피너, 튀는 점 세 개, 체크로 끝나는 진행 링, 액티비티 휠, 업로드 막대.

[Video (mp4)](../videos/113-loading-indicators.mp4) · [Code](../effects/113-loading-indicators.js) · UI & interaction · UI·인터랙션

## Prompt (English)

```text
Create a "Loading Indicators" motion effect: five classic loaders running side by side on dark glass cards.

Look
- Background: diagonal gradient #0E1124 (top left) to #171433 (bottom right), plus a soft violet glow (radial, centre (540, 1100), radius 900, rgba(110,90,255,0.18) fading to 0).
- Cards: vertical gradient #232946 to #1A1F38, corner radius 44, shadow rgba(0,0,0,0.35) blur 50 offset y 18, 2 px border rgba(255,255,255,0.07).
- Four square-ish cards 450 × 560 at (70, 330), (560, 330), (70, 930), (560, 930). Each loader is centred at (card x + 225, card y + 230). Under it, centred: a title in Helvetica Neue 700, 42 px, white (baseline card bottom − 104) and a Korean caption in Apple SD Gothic Neo 500, 30 px, white at 50 % (baseline card bottom − 56): "Spinner" / "불러오는 중", "Dots" / "입력 중", "Progress" / "다운로드", "Activity" / "동기화 중".
- A wide card 940 × 270 at (70, 1530): "사진 3장 업로드 중" (700, 40 px, white, at x 120, baseline 1625), "잠시만 기다려 주세요" (500, 30 px, 50 % white, baseline 1675), and a track 840 × 18 at (120, 1720), radius 9, rgba(255,255,255,0.08).

Motion (0–5 s)
- Spinner: track ring r 110, 24 px stroke, rgba(255,255,255,0.07); a #7C8CFF arc with round caps. Every 1.25 s (4 cycles) the head runs 3/4 turn ahead (ease-in-out, first half of the cycle) and then the tail catches up (second half), and the arc never shrinks below a short minimum length (head offset +0.25 rad); the whole spinner also turns 2 full turns per loop.
- Dots: #FF7A9A, #FFC15E, #5EE0C1, radius 34, 100 px apart. lift = max(0, sin(2π · fract(t / 1.25 − 0.14 i))); each dot rises 90 px × lift, opacity 0.55 + 0.45 × lift, a tiny squash when low. A wave of hops, 4 per loop.
- Progress ring: r 118, 22 px stroke, track rgba(255,255,255,0.08). A 2.5 s cycle (2 per loop): the arc fills clockwise from the top 0→100 % (ease-in-out, 0.2–1.6 s) with a conic gradient #4FD1FF → #8B6CFF, and a centred "NN%" in 700, 60 px white counts up. At 1.55–1.75 s the ring turns green #5EE08A and the number fades into a green check mark (16 px stroke, round joins, points (−44, 2), (−12, 34), (48, −30) from centre); at 2.15–2.4 s the tick fades back out while the arc empties from its tail (2.0–2.45 s) and the label reads "0%".
- Activity: 12 white spokes from r 56 to r 108, 18 px round strokes. A highlight goes round once per second (5 turns per loop); each spoke brightens quickly as it arrives and then fades over the rest of the turn, opacity 0.14–1.
- Upload bar: a gradient segment #4FD1FF → #8B6CFF slides across the track (ease-in-out, 1.25 s per pass, 4 passes per loop), its length 120 + 260 × sin(π u), clipped to the rounded track.

Technique
- Canvas 2D, all cycles are 1.25 s or 2.5 s so everything lines up at t = 5.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"로딩 인디케이터" 모션 효과를 만들어 줘: 대표적인 로딩 표시 다섯 개가 어두운 유리 카드 위에서 나란히 도는 효과.

모양
- 배경: 대각선 그라디언트 #0E1124(왼쪽 위) → #171433(오른쪽 아래), 그리고 부드러운 보라 빛(원형, 중심 (540, 1100), 반지름 900, rgba(110,90,255,0.18) → 0).
- 카드: 세로 그라디언트 #232946 → #1A1F38, 모서리 반지름 44, 그림자 rgba(0,0,0,0.35) 흐림 50 y 오프셋 18, 2 px 테두리 rgba(255,255,255,0.07).
- 450 × 560 카드 네 장: (70, 330), (560, 330), (70, 930), (560, 930). 로딩 표시는 (카드 x + 225, 카드 y + 230)에 가운데 정렬. 그 아래 가운데에 제목 Helvetica Neue 700, 42 px, 흰색(기준선 카드 아래 − 104)과 한글 설명 Apple SD Gothic Neo 500, 30 px, 50 % 흰색(기준선 카드 아래 − 56): "Spinner" / "불러오는 중", "Dots" / "입력 중", "Progress" / "다운로드", "Activity" / "동기화 중".
- 넓은 카드 940 × 270, (70, 1530): "사진 3장 업로드 중"(700, 40 px, 흰색, x 120, 기준선 1625), "잠시만 기다려 주세요"(500, 30 px, 50 % 흰색, 기준선 1675), 트랙 840 × 18 (120, 1720), 반지름 9, rgba(255,255,255,0.08).

움직임 (0–5초)
- 스피너: 트랙 원 반지름 110, 선 24 px, rgba(255,255,255,0.07). 끝이 둥근 #7C8CFF 호. 1.25초마다(4주기) 머리가 3/4바퀴 앞서 나가고(주기 앞 절반, ease-in-out) 꼬리가 따라잡는다(뒤 절반). 호는 완전히 사라지지 않고 짧은 최소 길이(머리 +0.25 rad)를 남긴다. 스피너 전체도 루프마다 2바퀴 돈다.
- 점: #FF7A9A, #FFC15E, #5EE0C1, 반지름 34, 간격 100 px. lift = max(0, sin(2π · fract(t / 1.25 − 0.14 i))). 점마다 90 px × lift만큼 뛰어오르고 불투명도 0.55 + 0.45 × lift, 낮을 때 살짝 납작해진다. 루프마다 4번의 물결 점프.
- 진행 링: 반지름 118, 선 22 px, 트랙 rgba(255,255,255,0.08). 2.5초 주기(루프마다 2번): 위에서부터 시계 방향으로 0→100 % 차오르고(ease-in-out, 0.2–1.6초) 색은 원뿔 그라디언트 #4FD1FF → #8B6CFF, 가운데 "NN%"(700, 60 px, 흰색)가 올라간다. 1.55–1.75초에 링이 초록 #5EE08A로 바뀌고 숫자가 초록 체크 표시(선 16 px, 둥근 이음, 중심 기준 점 (−44, 2), (−12, 34), (48, −30))로 바뀐다. 2.15–2.4초에 체크가 사라지고, 그동안(2.0–2.45초) 호가 꼬리부터 비워지며 숫자는 "0%".
- 액티비티: 흰 살 12개, 반지름 56에서 108까지, 선 18 px 둥근 끝. 밝은 부분이 1초에 한 바퀴(루프마다 5바퀴) 돈다. 살마다 도착할 때 빠르게 밝아지고 남은 한 바퀴 동안 흐려진다(불투명도 0.14–1).
- 업로드 막대: #4FD1FF → #8B6CFF 그라디언트 조각이 트랙을 가로질러 미끄러진다(ease-in-out, 한 번 1.25초, 루프마다 4번). 길이 120 + 260 × sin(π u), 둥근 트랙 안에 클립.

기법
- Canvas 2D. 주기는 전부 1.25초나 2.5초라서 t = 5에서 모두 맞아떨어진다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
