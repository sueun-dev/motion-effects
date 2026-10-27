# 124 · Border Beam · 보더 빔

<img src="../previews/124-border-beam.webp" width="270" alt="Border Beam preview">

**EN** Two glowing beams, orange-pink and cyan-violet, chase each other round the rounded border of a dark pricing card, lighting it as they pass.  
**KO** 주황·분홍 빛과 하늘·보라 빛 두 줄기가 어두운 요금제 카드의 둥근 테두리를 따라 돌며 지나가는 자리를 밝힌다.

[Video (mp4)](https://sueun-dev.github.io/motion-effects/videos/124-border-beam.mp4) · [Code](../effects/124-border-beam.js) · UI & interaction · UI·인터랙션

## Prompt (English)

```text
Create a "Border Beam" motion effect: an animated gradient border. Two glowing trails run round a card's rounded border at constant speed, drawn sharp plus blurred copies for glow, and their heads light up the card surface below.

Look
- Background #07080F with a soft violet glow (radial, centre (540, 1060), radius 900, rgba(90,70,200,0.22) → 0).
- Card: (110, 470), 860 × 1180, corner radius 56, fill #10121F, 2 px border rgba(255,255,255,0.09).
- Pricing content (Apple SD Gothic Neo for Korean, Helvetica Neue for numbers), left edge x 180:
  a badge pill 190 × 64 (radius 32) at (180, 550), fill rgba(255,120,100,0.14), text "★ 인기" (800, 32 px) filled with a gradient #FF9A3C → #FF3C8C;
  "Pro 플랜" (800, 70 px, white) at baseline 720; "팀을 위한 모든 기능" (500, 34 px, white 55 %) at 776;
  "₩19,900" (Helvetica Neue 800, 120 px, white) at baseline 940, followed by "/ 월" (500, 40 px, white 50 %);
  four features at baselines 1060, 1152, 1244, 1336, each with a check badge (circle r 26, rgba(90,230,170,0.16), a #5AE6AA tick 6 px, round) and text (500, 38 px, white 88 %): "무제한 프로젝트", "AI 요약 · 번역", "실시간 협업", "우선 고객 지원";
  a CTA pill 720 × 140 at (180, 1430) with a horizontal gradient #FF8A3C → #FF3C8C and "지금 시작하기" (800, 48 px, white) centred;
  under the card "14일 무료 체험 · 언제든 해지" (500, 30 px, white 40 %) centred at y 1740.

Motion (0–5 s)
- Two beams travel clockwise along the border, half a perimeter apart, each going round exactly once per loop. Find positions by arc length along the rounded rectangle (straight sides plus quarter-circle corners), so the speed is constant around the corners too.
- Beam 1: head rgb(255,150,60) orange fading to rgb(255,60,140) pink at the tail. Beam 2: head rgb(60,220,255) cyan to rgb(150,90,255) violet.
- Each trail is 150 short segments of 7 px of arc (about 1050 px long): width 10 px at the head tapering to 3 px, opacity (1 − k)^1.3 along it (k = 0 at the head), butt caps; a hot white dot (r 5, 95 %) on the head.
- The card surface under each head glows: a radial gradient of the head colour at 16 % opacity, radius 420, clipped to the card.

Technique
- Canvas 2D. Draw the trails on an off-screen canvas, then composite with "lighter": two copies blurred 36 px, two copies blurred 12 px, then the sharp copy on top. The trail is computed from the current time each frame, so it is clean and loops seamlessly.

Output and rules
- One self-contained HTML file with no external assets (three.js from a CDN is fine if you use it), drawing on a 1080 × 1920 canvas (9:16) scaled to fit the window.
- Write a function renderFrame(t) that draws the frame for time t in seconds, and preview it with requestAnimationFrame. Everything must be a pure function of t and fixed seeds: no Math.random(), Date or state carried between frames, so frame i = renderFrame(i / 30) can be exported to a 30 fps video.
- Loop seamlessly every 5 seconds: renderFrame(5) must look exactly like renderFrame(0).
- No flicker of any kind: no noise or grain that changes from frame to frame, no strobing or blinking, no z-fighting, no shimmering 1 px lines. Any grain or texture stays fixed to the screen or to the object.
- Keep the top 280 px free of important content (a title label goes there) and fill the whole frame with a designed background.
```

## 프롬프트 (한국어)

```text
"보더 빔" 모션 효과를 만들어 줘: 움직이는 그라디언트 테두리. 빛나는 꼬리 두 개가 카드의 둥근 테두리를 일정한 속도로 돌고, 선명한 선과 흐린 사본으로 빛을 내며, 머리 부분이 아래 카드 표면을 밝히는 효과.

모양
- 배경 #07080F, 부드러운 보라 빛(원형, 중심 (540, 1060), 반지름 900, rgba(90,70,200,0.22) → 0).
- 카드: (110, 470), 860 × 1180, 모서리 반지름 56, 채움 #10121F, 2 px 테두리 rgba(255,255,255,0.09).
- 요금제 내용(한글은 Apple SD Gothic Neo, 숫자는 Helvetica Neue), 왼쪽 x 180:
  배지 알약 190 × 64(반지름 32) (180, 550), 채움 rgba(255,120,100,0.14), 글자 "★ 인기"(800, 32 px)는 #FF9A3C → #FF3C8C 그라디언트로 채움.
  "Pro 플랜"(800, 70 px, 흰색) 기준선 720, "팀을 위한 모든 기능"(500, 34 px, 55 % 흰색) 776.
  "₩19,900"(Helvetica Neue 800, 120 px, 흰색) 기준선 940, 뒤에 "/ 월"(500, 40 px, 50 % 흰색).
  기능 네 줄, 기준선 1060, 1152, 1244, 1336. 줄마다 체크 배지(반지름 26 원, rgba(90,230,170,0.16), #5AE6AA 체크 6 px 둥근 선)와 글자(500, 38 px, 88 % 흰색): "무제한 프로젝트", "AI 요약 · 번역", "실시간 협업", "우선 고객 지원".
  CTA 알약 720 × 140 (180, 1430), 가로 그라디언트 #FF8A3C → #FF3C8C, 가운데 "지금 시작하기"(800, 48 px, 흰색).
  카드 아래 "14일 무료 체험 · 언제든 해지"(500, 30 px, 40 % 흰색) y 1740 가운데.

움직임 (0–5초)
- 빛줄기 두 개가 테두리를 따라 시계 방향으로, 둘레의 절반 간격을 두고 루프마다 정확히 한 바퀴 돈다. 위치는 둥근 사각형(직선 변 + 사분원 모서리)의 호 길이로 구해서 모서리에서도 속도가 같다.
- 빛줄기 1: 머리 rgb(255,150,60) 주황 → 꼬리 rgb(255,60,140) 분홍. 빛줄기 2: 머리 rgb(60,220,255) 하늘색 → rgb(150,90,255) 보라.
- 꼬리마다 호 길이 7 px짜리 짧은 조각 150개(길이 약 1050 px): 두께는 머리 10 px에서 3 px로 가늘어지고, 불투명도 (1 − k)^1.3(머리에서 k = 0), 각진 끝. 머리에 뜨거운 흰 점(반지름 5, 95 %).
- 머리 아래 카드 표면이 빛난다: 머리 색의 16 % 방사형 그라디언트, 반지름 420, 카드 안에 클립.

기법
- Canvas 2D. 꼬리는 오프스크린 캔버스에 그린 뒤 "lighter"로 합성한다: 36 px 블러 사본 두 번, 12 px 블러 사본 두 번, 그 위에 선명한 사본. 꼬리는 매 프레임 지금 시각으로 계산하므로 깨끗하고 끊김 없이 반복된다.

출력과 규칙
- 외부 파일 없는 HTML 파일 하나(three.js를 쓴다면 CDN은 괜찮다). 1080 × 1920(9:16) 캔버스에 그리고 창 크기에 맞춰 보이게 한다.
- 시간 t(초)의 프레임을 그리는 renderFrame(t) 함수를 만들고, 미리보기는 requestAnimationFrame으로 돌린다. 모든 것은 t와 고정 시드만으로 정해진다: Math.random(), Date, 프레임 사이에 쌓이는 상태 금지. 그래야 i번째 프레임 = renderFrame(i / 30)으로 30fps 영상을 뽑을 수 있다.
- 5초마다 끊김 없이 반복: renderFrame(5)는 renderFrame(0)과 똑같아 보여야 한다.
- 어떤 깜빡임도 금지: 프레임마다 바뀌는 노이즈·그레인, 번쩍임·깜빡임, z-fighting, 반짝이며 떨리는 1px 선 모두 금지. 그레인·질감은 화면이나 물체에 고정한다.
- 위쪽 280px에는 중요한 내용을 두지 않고(제목 라벨 자리), 화면 전체를 디자인된 배경으로 채운다.
```
