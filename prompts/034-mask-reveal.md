# 034 · Mask Reveal · 마스크 리빌

<img src="../previews/034-mask-reveal.webp" width="270" alt="Mask Reveal preview">

**EN** Four lines of bold type, "EVERY / LINE / RISES / IN TURN", rise one by one out of invisible slots, hold, then slide up and out.  
**KO** "EVERY / LINE / RISES / IN TURN" 네 줄의 굵은 글자가 보이지 않는 틈에서 한 줄씩 솟아올라 머문 뒤 위로 빠져나간다.

[Video (mp4)](../videos/034-mask-reveal.mp4) · [Code](../effects/034-mask-reveal.js) · Typography · 타이포그래피

## Prompt (English)

```text
Create a "Mask Reveal" motion effect (line reveal): each line of type sits in its own invisible clipping window, so it can only be seen inside that slot; the lines rise into view one after another, hold, then keep rising out through the top of their windows.

Look
- All positions are in px on the 1080 × 1920 frame, top-left origin.
- Background: vertical gradient #F7EFE3 → #EBDCCB, with one large soft circle in rgba(255, 90, 54, 0.12) at (820, 1500), radius 360 + 20 sin(2π t/5) (it breathes slowly and partly sits behind the last line).
- Text: Helvetica Neue weight 800, 210 px, left-aligned at x 110, alphabetic baselines 700, 930, 1160, 1390 (line height 230). Lines "EVERY", "LINE", "RISES", "IN TURN" in dark ink #1B1530, except "RISES" in orange-red #FF5A36.
- Each line's window: the full width, from baseline − 172 to baseline + 54 (226 px tall). Text outside its window is simply not drawn — no fade, a crisp cut edge, as if the letters slide out of a slot.

Motion (0–5 s)
- In: line i rises from one line height (230 px) below its baseline up to the baseline, starting at 0.15 + 0.20 i s and taking 0.7 s with ease-out cubic (1 − (1 − k)³); the letters slide up through the bottom edge of their window.
- Hold: all four lines sit still from about 1.45 s to 3.65 s.
- Out: line i keeps rising another 230 px, starting at 3.65 + 0.17 i s and taking 0.6 s with ease-in cubic (k³); it disappears through the top edge of its window. The last line is gone by about 4.76 s and the page stays empty until the loop restarts (the frame at 0 s is empty too).

Technique
- Canvas 2D: for each line, save, clip to its window rectangle, fillText at the animated y, restore.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"마스크 리빌" 모션 효과(라인 리빌)를 만들어 줘: 글자 줄마다 보이지 않는 자기만의 클리핑 창 안에 있어서 그 틈 안에서만 보인다. 줄들이 차례로 솟아올라 보였다가, 머물고, 계속 올라가 창 위쪽으로 빠져나가는 효과.

모양
- 모든 위치는 1080 × 1920 화면의 px, 왼쪽 위 기준.
- 배경: 세로 그라디언트 #F7EFE3 → #EBDCCB, 그리고 (820, 1500)에 rgba(255, 90, 54, 0.12)의 크고 부드러운 원 하나, 반지름 360 + 20 sin(2π t/5)(천천히 숨 쉬고, 마지막 줄 뒤에 일부 걸친다).
- 글자: Helvetica Neue 굵기 800, 210 px, x 110 왼쪽 정렬, 알파벳 기준선 700, 930, 1160, 1390(줄 간격 230). 줄은 "EVERY", "LINE", "RISES", "IN TURN", 어두운 잉크 #1B1530, "RISES"만 주황빛 빨강 #FF5A36.
- 줄마다 창: 화면 너비 전체, 기준선 − 172부터 기준선 + 54까지(높이 226 px). 창 밖의 글자는 그냥 그리지 않는다. 흐려지지 않고 날카롭게 잘려서, 글자가 틈에서 미끄러져 나오는 것처럼 보인다.

움직임 (0–5초)
- 들어오기: i번째 줄은 기준선보다 한 줄 높이(230 px) 아래에서 기준선까지 올라온다. 0.15 + 0.20 i초에 시작해 0.7초 동안, ease-out cubic(1 − (1 − k)³). 글자가 창 아래 가장자리를 지나 솟아오른다.
- 머물기: 약 1.45초부터 3.65초까지 네 줄 모두 가만히 있다.
- 나가기: i번째 줄은 230 px를 더 올라간다. 3.65 + 0.17 i초에 시작해 0.6초 동안, ease-in cubic(k³). 창 위 가장자리를 지나 사라진다. 마지막 줄은 약 4.76초에 사라지고 루프가 다시 시작될 때까지 빈 화면이다(0초 화면도 비어 있다).

기법
- Canvas 2D: 줄마다 save, 그 창 사각형으로 clip, 움직이는 y에 fillText, restore.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
