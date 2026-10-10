# Share แปลว่าหาร

Last updated: 2026-10-10 (Asia/Bangkok)

## Project Overview

เว็บแชร์ข้อมูลสำหรับ Stupid Hackathon 2026 ที่ตีความคำว่า Share เป็นการหารข้อมูลตามจำนวนผู้รับ เจ้าของเพิ่มข้อความหรือภาพ แล้วได้รับ URL และ QR code สำหรับส่งต่อ เมื่อผู้รับใหม่เข้ามา ระบบแบ่งต้นฉบับใหม่และอัปเดตส่วนของผู้รับทุกคนแบบ real time โดยไม่ต้องรีเฟรช

มุกหลัก: **ยิ่งมีคนรับข้อมูลมาก แต่ละคนยิ่งได้ข้อมูลน้อยลง** ผู้ชมที่สแกน QR เป็นผู้ทำให้ข้อมูลบนหน้าของผู้รับเดิมเปลี่ยนไปเอง

เอกสารนี้เป็นบริบทของโปรเจกต์สำหรับมนุษย์และเครื่องมือพัฒนาใด ๆ โดยไม่ต้องอ่านประวัติการสนทนา ข้อเสนอที่ยังไม่ยืนยันมีป้ายกำกับชัดเจน และไม่ใช่ข้อเท็จจริงเกี่ยวกับ implementation ที่มีอยู่

## Goal and Intent

- สร้างเว็บที่เดโมกับผู้ชมบนมือถือและจอหลักได้จริงในงาน hackathon
- ทำให้ผู้รับเห็นข้อมูลของตัวเองถูกแบ่งใหม่ทันทีที่คนใหม่เข้ามา
- รองรับข้อความและภาพเป็น MVP แรก และเพลง MP3 วิดีโอ MP4 กับ PDF (เพิ่ม 2026-10-10)
- ให้กฎเพี้ยนหนึ่งข้อสร้างเหตุการณ์ต่อเนื่อง โดยไม่ต้องพึ่ง AI หรือ animation

โปรเจกต์นี้สร้างประสบการณ์ขำและชวนทดลอง ไม่ได้มีเป้าหมายเป็นบริการส่งไฟล์ครบถ้วนหรือระบบแบ่งความลับทาง cryptography

## Target Users

- **Creator:** ผู้เพิ่มต้นฉบับและนำ URL หรือ QR ไปให้คนอื่นเปิด
- **Recipient:** ผู้เปิด URL เพื่อรับส่วนหนึ่งของข้อมูล และเห็นส่วนของตัวเองเปลี่ยนตามจำนวนผู้รับ
- **Demo audience:** ผู้ชมที่เข้าร่วมผ่าน browser ระหว่างการนำเสนอ

## Confirmed Requirements

1. Creator เพิ่มข้อมูลที่ต้องการแชร์ได้: ข้อความ ภาพ ไฟล์เสียง MP3 วิดีโอ MP4 หรือ PDF
2. ระบบสร้าง URL และ QR code สำหรับเข้าถึงการแชร์นั้น
3. ผู้รับแต่ละคนได้ข้อมูลคนละส่วนตามจำนวนผู้รับ
4. เมื่อมีผู้รับใหม่ ระบบแบ่งต้นฉบับใหม่สำหรับผู้รับทุกคน รวมถึงคนที่เข้ามาก่อน
5. หน้า Recipient ที่เปิดอยู่เปลี่ยนข้อมูลอัตโนมัติแบบ real time ไม่ต้องรีเฟรช
6. MVP ไม่จำเป็นต้องมี animation; ความถูกต้องของการแบ่งและการอัปเดตสำคัญกว่า visual polish
7. นับผู้รับสะสม ปิดเว็บแล้วจำนวนผู้รับไม่ลดและไม่คืนส่วนแบ่ง
8. ผู้รับเดิม refresh หรือเปิด share เดิมหลายแท็บใน browser เดิมไม่เพิ่มตัวหาร
9. Creator ถูกนับเป็นผู้รับตั้งแต่สร้าง share
10. ภาพถูกแบ่งเป็นตาราง (grid) ผู้รับแต่ละคนได้ภาพหนึ่งบล็อกสี่เหลี่ยมต่อกันเป็นชิ้นเดียว ไม่สลับตำแหน่ง (เปลี่ยนจาก collage เศษกระจาย ยืนยัน 2026-10-10)
11. แก้ต้นฉบับหลังสร้าง share ไม่ได้; หากต้องการเปลี่ยนข้อมูลให้สร้าง share ใหม่
12. Share หมดอายุ 24 ชั่วโมงนับจากเวลาสร้าง
13. หากข้อความไม่พอแบ่ง ยังรับผู้รับเพิ่มตามปกติ ผู้รับที่ได้ส่วนว่างเห็นข้อความระบบ **“คุณได้รับข้อมูล 0 ตัวอักษร”** ไม่ถือเป็น error และไม่หยุดการแชร์
14. Creator มีปุ่ม **End share** เพื่อปิด share ก่อนหมดอายุ 24 ชั่วโมง หลังปิดแล้วไม่รับผู้รับใหม่และหน้าที่เปิดอยู่เปลี่ยนเป็นสถานะ ended (ยืนยัน 2026-10-10)
15. รับข้อความด้วยช่องพิมพ์/วางเท่านั้น ยังไม่รองรับการอัปโหลด `.txt` (ยืนยัน 2026-10-10)
16. ผู้ชมที่คาดว่าจะเข้าร่วมในเดโมคือ 64 คน; ค่าเริ่มต้นของ `MAX_RECIPIENTS` เป็น 64 (ยืนยัน 2026-10-10)
17. Hosting target คือ **Vercel** (ยืนยัน 2026-10-10) ดูข้อขัดแย้งกับ architecture ปัจจุบันใน Open Decisions

### Canonical Example

ต้นฉบับ: `ABCDEFGH`

| Recipient | 2 recipients | 4 recipients |
| --- | --- | --- |
| #1 | `ABCD` | `AB` |
| #2 | `EFGH` | `CD` |
| #3 | — | `EF` |
| #4 | — | `GH` |

การแบ่งใหม่ไม่ได้แค่ตัดท้ายส่วนเก่า: Recipient #2 เปลี่ยนจาก `EFGH` เป็น `CD` ด้วย แต่ละรอบต้องคำนวณจากต้นฉบับทั้งชุด ไม่แบ่งต่อจากข้อมูลที่ผู้รับถืออยู่ในรอบก่อน

## MVP Scope

### Must Have

- เพิ่มต้นฉบับชนิด text, image, audio (MP3), video (MP4) หรือ PDF หนึ่งรายการต่อ share
- สร้าง share URL ที่มือถือคนอื่นเปิดได้ และ QR ของ URL เดียวกัน
- ลงทะเบียน Recipient และกำหนดส่วนข้อมูลให้แต่ละคน
- แบ่งข้อมูลใหม่เมื่อจำนวนผู้รับเพิ่ม
- ส่ง update ให้ทุกหน้าที่เชื่อมต่ออยู่
- แสดงหมายเลขผู้รับ จำนวนผู้รับ และส่วนข้อมูลปัจจุบัน
- รองรับ browser บน desktop และ mobile
- แสดงสถานะ loading, connection lost, reconnecting, share not found และ invalid input ที่เกี่ยวข้อง
- รองรับส่วนแบ่งว่างเมื่อข้อมูลไม่พอแจกทุกคน

### Suggested Input UX — Not Yet Approved

- Text: เริ่มจากช่องพิมพ์หรือวางข้อความ; การอัปโหลด `.txt` เป็นส่วนเพิ่มเติมหากจำเป็น
- Image: เลือกไฟล์ภาพจากเครื่อง
- Creator เป็น Recipient #1 ตั้งแต่สร้าง share และหน้าหลังสร้างแสดงส่วนข้อมูลปัจจุบันพร้อม URL/QR ส่วนต้นฉบับที่ใช้เตรียม upload ไม่ควรเป็นภาพหลักของเดโมหลังเริ่มแชร์
- Recipient เปิด URL แล้วเข้าร่วมอัตโนมัติ ไม่ต้องสร้างบัญชี

### Out of Scope for Initial MVP

- Animation, เสียงฉีกข้อมูล และเอฟเฟกต์ฟิสิกส์
- PDF ที่ใส่รหัสผ่าน, วิดีโอที่ไม่ใช่ MP4 (MOV, WebM ฯลฯ) และไฟล์เสียงที่ไม่ใช่ MP3 (WAV, AAC, OGG ฯลฯ)
- AI/ML หรือ model API
- บัญชีผู้ใช้ โปรไฟล์ ห้องแชต และระบบชำระเงิน
- รวมชิ้นส่วนกลับหรือดาวน์โหลดต้นฉบับจากหน้า Recipient
- อัปโหลดไฟล์ `.txt`
- แก้ต้นฉบับหลังมีผู้รับเข้าร่วม
- ระบบระดับ production เช่น multi-region deployment และระบบจัดการองค์กร

## Domain Rules and Decisions

Counting policy, การจำผู้รับเดิมใน browser, การนับ Creator, ภาพแบบ grid หนึ่งบล็อกต่อคน, ต้นฉบับคงที่, อายุ 24 ชั่วโมง และการให้ส่วนว่างเมื่อข้อความไม่พอแบ่งเป็นพฤติกรรมที่ยืนยันแล้ว รายละเอียดแบ่งเศษและ layout ที่มีป้ายกำกับเป็นข้อเสนอทาง implementation

### Recipient Identity and Counting

- นับผู้รับ **สะสมต่อ share** ไม่ใช่จำนวน connection ที่ยังเปิดอยู่
- Creator เป็น Recipient #1 และตัวหารเริ่มต้นเป็น 1 ตั้งแต่สร้าง share
- ผู้รับมี `recipientId` และลำดับเข้าร่วมที่ server กำหนด
- Refresh หรือ reconnect ด้วย identity เดิมไม่เพิ่มจำนวนผู้รับ
- Identity ของ browser เดียวกันใช้ร่วมกันระหว่างแท็บของ share เดียวกัน
- ปิดหน้าแล้วจำนวนผู้รับไม่ลด และส่วนที่หายไม่คืน
- การกลับมาด้วย browser ใหม่หรือหลังล้าง identity อาจถูกนับเป็นผู้รับใหม่ นี่ไม่ใช่ระบบตรวจว่าเป็นมนุษย์คนเดิมจริง ๆ

ผลของ policy นี้: ความสูญเสียสะสมตลอดเดโม และการ reconnect ไม่เพิ่มผู้รับโดยไม่ตั้งใจ การคืนส่วนเมื่อคนออกไม่อยู่ในพฤติกรรมที่เลือก

### Content and Share Lifetime

- ต้นฉบับของ share คงที่หลังสร้าง ไม่สามารถเปลี่ยนข้อความหรือภาพใน URL เดิม
- Share หมดอายุ 24 ชั่วโมงหลังเวลาสร้าง โดยใช้เวลา server เป็นหลัก
- การมีผู้รับใหม่หรือกลับมาเปิดซ้ำไม่ต่ออายุ share
- เมื่อหมดอายุ หน้าเว็บแสดงสถานะ share expired และไม่ให้เข้าร่วมหรือรับเนื้อหาเพิ่ม
- หน้า Recipient ที่ยังเปิดอยู่ต้องรับทราบว่า share หมดอายุและเปลี่ยนเป็นสถานะ expired
- นโยบายล้างข้อมูลจาก storage ต้องสอดคล้องกับอายุ share; วิธี cleanup ยังขึ้นกับ stack ที่เลือก
- การหมดอายุไม่สามารถลบข้อมูลหรือภาพที่ผู้รับบันทึกไว้ก่อนหน้าได้

### Text Partitioning

พฤติกรรมการแบ่งใหม่จากต้นฉบับตามลำดับผู้รับยืนยันผ่าน canonical example แล้ว กฎแบ่งเศษและ Unicode ด้านล่างเป็น implementation defaults ที่เสนอ

- แบ่งตามลำดับต้นฉบับเป็นช่วงติดกัน และเรียงผู้รับตามลำดับเข้าร่วม
- หน่วยแบ่งคือ Unicode grapheme cluster เพื่อไม่ตัด emoji หรืออักขระที่ต้องแสดงร่วมกันกลางกลุ่ม
- เก็บช่องว่างและ newline ไม่เปลี่ยนข้อความก่อนแบ่ง
- สำหรับจำนวนหน่วย `L` และผู้รับ `N > 0`: แต่ละคนได้อย่างน้อย `q = floor(L / N)` หน่วย และผู้รับ `r = L % N` คนแรกได้เพิ่มคนละหนึ่งหน่วย
- ลำดับแบบ zero-based `i` มี `start = i * q + min(i, r)` และ `length = q + (i < r ? 1 : 0)`
- ตัวอย่างที่เสนอเมื่อมี 3 คน: `ABC`, `DEF`, `GH`
- เมื่อนำส่วนทุกคนมาเรียงต่อกัน ต้องได้ต้นฉบับครบ ไม่มีส่วนซ้ำหรือส่วนตกหล่น
- **Confirmed empty-state behavior:** ถ้า `N > L` ผู้รับบางคนได้ข้อความว่าง และเห็นข้อความระบบ “คุณได้รับข้อมูล 0 ตัวอักษร” พร้อมหมายเลขและจำนวนผู้รับ ระบบยังรับผู้รับใหม่ตามปกติ
- ข้อความ empty state เป็น UI ของระบบ ไม่ใช่ส่วนหนึ่งของต้นฉบับ และไม่นำไปแบ่งต่อ
- Empty allocation ของข้อความไม่ใช่ application error และไม่ปิดการเข้าร่วมโดยอัตโนมัติ ขีดจำกัดผู้รับเพื่อรองรับโหลดทางเทคนิคยังเป็นอีก decision หนึ่ง

### PDF Partitioning (เพิ่ม 2026-10-10)

- รับ PDF ไม่เกิน 4 MiB ที่ไม่ได้เข้ารหัส; server ตรวจด้วย pdf-lib รวมถึงโครงสร้างหน้า
- หน่วยแบ่งคือหน้า แบ่งเป็นช่วงหน้าต่อกันตามลำดับผู้รับด้วยกฎเดียวกับข้อความ (เช่น 10 หน้า 3 คน = 1–4, 5–7, 8–10) คำนวณจากต้นฉบับทุกครั้ง
- ผู้รับได้ PDF ใหม่ที่มีเฉพาะหน้าของตัวเอง (`GET /api/shares/:id/pdf?revision=`) หน้าเว็บ render ด้วย pdf.js (โหลดเฉพาะเมื่อเปิด share PDF) จึงแสดงได้บนมือถือที่เปิด PDF ในหน้าไม่ได้ และมีปุ่มเปิด/ดาวน์โหลด PDF ของตัวเอง
- ถ้ามีผู้รับมากกว่าจำนวนหน้า ผู้รับบางคนได้ “คุณได้รับข้อมูล 0 หน้า”

### Video Partitioning (เพิ่ม 2026-10-10)

- รับเฉพาะ MP4 ที่มี video track ไม่เกิน 50 MB; browser อัปโหลดตรงไป Supabase Storage ผ่าน signed upload URL (ไม่ผ่าน Vercel ที่จำกัด request 4.5 MB) แล้ว server อ่าน keyframe จากตาราง `stss`/`stts` ของไฟล์
- หน่วยแบ่งคือช่วงระหว่าง keyframe (GOP) แบ่งเป็นช่วงเวลาต่อกันตามลำดับผู้รับด้วยกฎเดียวกับข้อความ คำนวณจากต้นฉบับทุกครั้ง
- ตัดด้วย ffmpeg แบบ stream copy (ไม่ re-encode) และจำกัดจำนวนเฟรมให้ตรงช่วงพอดี; ชิ้นที่ตัดแล้ว cache ใน storage ต่อช่วง GOP และลบชิ้นที่ไม่ตรงกับจำนวนผู้รับปัจจุบัน ผู้รับได้ลิงก์ signed ที่หมดอายุใน 10 นาทีสำหรับช่วงของตัวเองเท่านั้น
- ความละเอียดของการแบ่งขึ้นกับระยะห่าง keyframe (มือถือมัก 1–2 วินาที) ถ้าผู้รับมากกว่าจำนวน GOP ผู้รับบางคนได้ส่วนว่าง “คุณได้รับข้อมูล 0 วินาที”
- วิดีโอ HEVC (ค่าเริ่มต้นของ iPhone) อาจเล่นไม่ได้ในบาง browser เพราะไม่ re-encode; H.264 เล่นได้ทุกที่

### Audio Partitioning (เพิ่ม 2026-10-10)

- รับเฉพาะ MP3 (MPEG audio Layer III) ไม่เกิน 4 MiB; server ตรวจ frame header จริง ตัด ID3 tag และ Xing/Info frame ออก แล้วเก็บเฉพาะ audio frames ใน private storage
- แบ่งเหมือนข้อความ: หน่วยแบ่งคือ MP3 frame (~26 ms) แบ่งเป็นช่วงเวลาต่อกันตามลำดับผู้รับ (`floor(F/N)` และ `F % N` คนแรกได้เพิ่มคนละ 1 frame) คำนวณจากต้นฉบับทุกครั้ง
- ผู้รับได้เฉพาะ MP3 ของช่วงตัวเอง (`GET /api/shares/:id/audio?revision=`) ไม่มีต้นฉบับเต็มในหน้าเว็บ หน้าแสดง player และแถบตำแหน่งช่วงเวลาในเพลงทั้งเพลง
- ถ้ามีผู้รับมากกว่าจำนวน frame ผู้รับที่ได้ส่วนว่างเห็น “คุณได้รับข้อมูล 0 วินาที”
- ตัดที่ขอบ frame โดยไม่ decode จึงอาจมีเสียงสะดุดเล็กน้อยที่ต้นช่วง (bit reservoir ของ MP3) ซึ่งยอมรับได้สำหรับเดโม

### Image Partitioning

- **Confirmed (2026-10-10, แทนแบบ collage เศษกระจาย):** ภาพถูกแบ่งเป็นตาราง N ช่อง ผู้รับแต่ละคนได้หนึ่งบล็อกสี่เหลี่ยมทึบตามตำแหน่งจริงของภาพ ไม่สลับหรือกระจายเศษ ผู้รับ #1 คือช่องซ้ายบน แล้วเรียงตามลำดับการอ่าน (ซ้าย→ขวา บน→ล่าง)
- เมื่อมีผู้รับใหม่ ระบบ repartition ต้นฉบับให้ทุกคน และแทนที่ภาพที่เปิดอยู่แบบ real time โดยไม่ต้องใช้ animation
- ปริมาณข้อมูลภาพต่อคนลดลงตามจำนวนผู้รับ; ไม่ใช้การย่อภาพต้นฉบับเต็มเป็นตัวแทนของการหารข้อมูล
- Creator อยู่ในกฎแบ่งเดียวกับผู้รับอื่น หากมีเพียง Creator คนเดียวจะได้ข้อมูลภาพครบทั้งหมด
- แต่ละ Recipient ได้เฉพาะบล็อกปัจจุบันของตัวเอง ไม่มีต้นฉบับเต็มซ่อนอยู่ในหน้าเว็บ

Implementation (`src/core/collage.ts`, `allocateGridCell`):

- จำนวนแถว = `round(sqrt(N × height / width))` (จำกัด 1..N) เพื่อให้แต่ละช่องใกล้สี่เหลี่ยมจัตุรัส เช่น ภาพจัตุรัส 4 คน = 2×2, 9 คน = 3×3
- ถ้า N ไม่เต็มตาราง แถวบน `N % rows` แถวได้ช่องเพิ่มหนึ่งช่อง (เช่น 3 คน = 2 ช่องบน + 1 ช่องกว้างล่าง) ทุก pixel จึงมีเจ้าของคนเดียวเสมอ ไม่มีช่องที่ไม่มีเจ้าของ
- ขอบช่องคำนวณจากขนาดภาพเต็มแบบปัดขึ้น ผู้รับลำดับต้นได้ pixel ที่เหลือก่อน เหมือนการแบ่งข้อความ
- ใน revision เดียวกัน บล็อกของแต่ละคนไม่ซ้อนกันและรวมกันครอบคลุมต้นฉบับพอดี
- สร้าง crop จากต้นฉบับเสมอ และแสดงจำนวนผู้รับกับพื้นที่ภาพที่ได้รับ เพื่อสื่อว่าข้อมูลลดลง
- Deterministic: refresh ที่ revision เดิมได้บล็อกเดิม
- หากข้อมูลไม่พอแจกทุกคน บาง Recipient อาจได้ส่วนว่าง และต้องแสดงสถานะนั้นตามปกติ

## Architecture Summary — Implemented foundation (Tasks 1–3)

```text
Creator browser
  → Submit text or image
  → Backend stores original and creates share
  ← Share URL and QR code

Recipient browser
  → Join share with recipient identity
  → Backend registers recipient once and assigns stable order
  → Backend increments share revision and repartitions original
  ← Current recipient-specific snapshot

New recipient joins
  → Backend recomputes all allocations
  → Realtime connection sends new snapshots to connected recipients
  → Each browser replaces its text or image automatically
```

- Server เป็นแหล่งข้อมูลหลักของจำนวนผู้รับ ลำดับ และการแบ่งข้อมูล
- HTTP ใช้สร้าง share รับต้นฉบับ และขอ snapshot ปัจจุบัน
- Realtime transport ที่เลือกใน implementation plan คือ WebSocket; งาน WebSocket/reconnect ยังอยู่ใน Task 4 และยังไม่ถูก implement
- Join ของ share เดียวกันต้องประมวลผลอย่างมีลำดับ และมี idempotency ตาม `recipientId` เพื่อป้องกันการลงทะเบียนซ้ำและลำดับชนกัน
- Snapshot มี `revision` ที่เพิ่มขึ้น หน้าเว็บไม่ใช้ update เก่าทับ revision ใหม่
- Reconnect ต้องขอสถานะล่าสุดด้วย identity เดิม และไม่อาศัยว่าได้รับทุก event ระหว่างหลุด connection
- HTTP collage render ผูกกับ revision และตรวจ stale/expiry ก่อนและหลัง render แล้ว; การ broadcast ให้หน้าที่เชื่อมต่ออยู่ยังอยู่ใน Task 4
- ส่งให้ผู้รับเฉพาะข้อมูลที่เขาได้รับ ไม่ส่งต้นฉบับทั้งหมดแล้วซ่อนด้วย CSS

## Important Data Concepts

ชื่อด้านล่างเป็นแนวทางสำหรับออกแบบ ไม่ใช่ schema หรือ API contract ที่ implementation มีอยู่แล้ว

| Concept | Essential fields / meaning |
| --- | --- |
| `Share` | `shareId`, `contentType`, original content reference, `createdAt`, `expiresAt`, `recipientCount`, `revision` |
| `Recipient` | `recipientId`, `shareId`, stable `joinOrder` |
| `Allocation` | `shareId`, `recipientId`, `revision`; text range (`start`, `length`) or one image grid cell |
| `RecipientSnapshot` | current `revision`, recipient number, total recipients, content type, allocated content, empty-state flag |

ต้นฉบับเป็น canonical source ของข้อมูล การเปลี่ยนจำนวนผู้รับสร้าง allocation ใหม่แต่ไม่แก้ต้นฉบับ

## Tech Stack and External Dependencies

**อัปเดต 2026-10-10:** deployment เปลี่ยนเป็น Vercel Functions + Supabase (Postgres, Storage, Realtime Broadcast) บน free plan; `node:sqlite`, `ws` และ persistent volume ด้านล่างเป็นของ Task 1–3 และจะถูกแทนที่ Upload limit ลดเป็น 4 MiB เพราะ Vercel จำกัด request body 4.5 MB

Implementation plan เลือก stack ต่อไปนี้ และ Task 1–3 ได้ติดตั้ง/สร้างส่วนที่ระบุแล้ว:

- Node.js 22 และ TypeScript
- React + Vite สำหรับ frontend
- Express 5 + `ws` สำหรับ HTTP และ WebSocket
- Node `node:sqlite` (`DatabaseSync`) สำหรับ state และ local persistent data directory สำหรับภาพ
- Sharp สำหรับ decode/normalize/render ภาพ, Multer 2 สำหรับ upload และ `qrcode` สำหรับ QR
- Vitest สำหรับ unit/integration tests และ Playwright สำหรับ multi-browser E2E
- Production shape ที่วางไว้ยังเป็น Node process เดียวพร้อม persistent volume; multi-instance อยู่นอก MVP

ตรวจ environment วันที่ 2026-10-10 พบ Node `v22.23.2`, npm `10.9.8` และทดลองเปิด in-memory `DatabaseSync` สำเร็จ โมดูล `node:sqlite` ใน Node 22 ยังมีสถานะ experimental จึงต้อง pin runtime และตรวจ persistence ด้วย tests ก่อนถือว่าใช้ได้จริง

ไม่ต้องใช้ AI provider หรือ paid API เพื่อให้ mechanic หลักทำงาน การเลือกบริการที่มีค่าใช้จ่ายยังไม่ได้รับอนุมัติ

## Constraints and Risks

### Product and Demo

- ทำงานบน browser; ผู้ชมไม่ต้องติดตั้งแอป
- Real time หมายถึงอัปเดตอัตโนมัติหลัง server รับผู้รับใหม่ ไม่รับประกันว่าทุกเครื่องแสดงพร้อมกันโดยไม่มี network latency
- ไม่ต้องรอ animation เพื่อให้ข้อมูลใหม่ปรากฏ
- ข้อมูลที่แชร์ควรเป็นข้อมูลสำหรับเดโม ไม่ใช่ความลับที่ต้องการระบบรักษาความลับโดยเฉพาะ
- ผู้รับอาจจำ บันทึก หรือถ่ายภาพข้อมูลที่เคยเห็นได้ การแบ่งใหม่ไม่สามารถเพิกถอนสำเนาที่บันทึกไปแล้ว

### Technical

- ต้องตรวจ input ที่ backend: ข้อความว่าง ไฟล์ที่ไม่ใช่ภาพ และขนาด/มิติที่เกินขีดจำกัด
- ค่าเริ่มต้นใน implementation plan คือ JSON body 256 KiB, text 20,000 grapheme clusters, upload 5 MiB, decoded image 12 megapixels, normalized longest edge 1024 px และ 64 Recipients ต่อ share (ตามขนาดผู้ชมที่คาดไว้); ค่าเหล่านี้เป็น operational limits ที่ปรับผ่าน environment ได้ ไม่ใช่กติกาที่บอกว่าข้อมูลหมดแล้วห้ามคนใหม่
- ต้องแสดง text เป็นข้อความ ไม่ตีความเป็น HTML หรือ script
- ข้อเสนอชนิดภาพสำหรับเริ่มต้น: PNG, JPEG, WebP โดยไม่รับ SVG หรือ animated image ในรอบแรก
- Concurrent joins และ reconnect ต้องไม่ทำให้จำนวนผู้รับเพี้ยน
- Crop หลายชิ้นต่อ join อาจมีต้นทุนเพิ่มเมื่อผู้รับมาก ต้องทดสอบตามจำนวนผู้ชมเป้าหมายก่อนเพิ่มระบบ cache หรือ optimization
- ผู้รับที่ได้ส่วนว่างถือเป็นผลของ mechanic ไม่ใช่ application error

### Deployment

- QR ต้องชี้ไปที่ URL ที่มือถือคนอื่นเข้าถึงได้ ไม่ใช่ `localhost` ของเครื่องเดโม
- Public deployment ควรใช้ HTTPS และ realtime connection ที่สอดคล้องกับ HTTPS
- ถ้าใช้ storage ใน memory หรือ local disk การ restart หรือเปลี่ยน instance อาจทำให้ share หาย ต้องกำหนดอายุข้อมูลและข้อจำกัดนี้ก่อนใช้งานจริง
- ระบบหลาย backend instances ต้องแชร์ state หรือมีวิธีให้ join ของห้องเดียวกันไปแหล่งข้อมูลเดียวกัน มิฉะนั้นจำนวนผู้รับอาจไม่ตรงกัน

## Current State

Status: **Tasks 1–3 complete and reviewed; realtime/UI/production work remains.**

ตรวจ workspace วันที่ 2026-10-10: source code, package manifest, tests และ build configuration มีอยู่แล้ว การตรวจ Task 3 รอบแรกพบการเปิดไฟล์ต้นฉบับผ่าน Vite และแก้แล้วโดยย้าย default `DATA_DIR` ออกนอก Vite root พร้อม deny rule และ regression test ผลงาน checkpoint นี้ถูก commit และ push แล้วที่ `origin/master` (`9e206c1`)

### Defined

- Project concept และตัวอย่างแบ่งข้อความ 2 → 4 คน
- MVP รองรับข้อความ ภาพ MP3 MP4 และ PDF
- URL และ QR สำหรับส่งต่อ
- Requirement ให้อัปเดตผู้รับเดิมแบบ real time
- Animation ไม่จำเป็นใน MVP
- ผู้รับสะสม, browser เดิมเป็นผู้รับเดิม, Creator ถูกนับเป็น #1
- ภาพแบ่งเป็น grid หนึ่งบล็อกต่อคน (เปลี่ยนจาก collage เศษกระจาย 2026-10-10)
- ต้นฉบับแก้ไม่ได้ และ share หมดอายุ 24 ชั่วโมงหลังสร้าง
- ข้อความไม่พอแบ่งยังรับคนเพิ่ม ผู้รับที่ได้ส่วนว่างเห็น “คุณได้รับข้อมูล 0 ตัวอักษร”
- Implementation plan พร้อม task order, interfaces, failure tests และ acceptance run ที่ `docs/superpowers/plans/2026-10-10-share-division.md`
- Task 1: Node 22/TypeScript/Vite/Vitest scaffold และ grapheme-aware text partitioning
- Task 2: SQLite persistence, HttpOnly session identity, text share HTTP APIs, idempotent joins, expiry/status validation และ QR fallback contract
- Task 3: deterministic image collage, image validation/storage/rendering, recipient-only collage route และ original-image isolation
- Verification ผ่าน: `npm test` 31 tests, `npm run typecheck`, `npm run build`; Task 3 targeted storage/image review ผ่าน 8/8

- Backend port (2026-10-10): Postgres ผ่าน `Sql` interface (Supabase ใน production, PGlite ใน tests/dev), ภาพต้นฉบับเป็น PNG ใน private Supabase Storage bucket, RLS ทุกตาราง, realtime signal `{ revision, status }` เมื่อมีผู้รับใหม่, Vercel entry `api/index.ts` + `vercel.json`, upload 4 MiB; ผ่าน 34 tests, typecheck และ server build วิธีตั้งค่าอยู่ใน `docs/setup.md`

- Web UI (2026-10-10): `src/web/` ใช้ดีไซน์ Windows XP จาก branch `frontend` แต่ต่อกับ API จริง หน้า Creator (TEXT/IMAGE) และหน้า `/s/:id` แสดงส่วนของผู้รับแบบ live, URL + QR, ปุ่ม End share สำหรับผู้รับ #1, สถานะ ended/expired/not found/limit/offline และ layout มือถือ; End share API และ daily cleanup cron เสร็จแล้ว ตรวจด้วยมือใน browser ผ่าน

### Not Implemented or Verified

- `postgres` driver กับ Supabase จริงยังไม่ได้ทดสอบ (tests ใช้ PGlite)
- Realtime ผ่าน Supabase จริงยังไม่ได้ทดสอบ (local ใช้ polling ทุก 2 วินาที)
- React Creator/Recipient UI, Web Locks bootstrap, responsive/loading/error states และ QR fallback display
- Playwright multi-browser/restart checks และ bounded demo load test
- Production static serving, Docker packaging, setup/demo documentation และ public HTTPS/mobile flow
- Browser-level verification ของ end-to-end Creator → Recipient experience

ข้อจำกัดที่เหลือ: backend HTTP และ server-side image isolation ผ่านการตรวจแล้ว แต่ยังไม่มี browser UI และ realtime transport ให้ทดลองเดโมเต็มรูปแบบ

## Open Decisions

ตัดสินแล้ว 2026-10-10: hosting = Vercel, ผู้ชม 64 คน, ยังไม่รับ `.txt`, เพิ่ม End share (ดู Confirmed Requirements 14–17)

1. **ตัดสินแล้ว:** รันบน Vercel Functions + Supabase free plan (Postgres, Storage แบบ private, Realtime Broadcast) แทน SQLite/`ws`/`DATA_DIR` รายละเอียดอยู่ใน `docs/decisions.md` หัวข้อ *Vercel + Supabase Free Tier* ยังต้องให้ผู้ใช้สร้าง Supabase project และ Vercel project แล้วตั้ง environment variables
2. Reset ผู้รับใน URL เดิมยังไม่ได้ตกลง (End share แล้วสร้าง share ใหม่ใช้แทนได้)

Code ปัจจุบันแบ่งภาพเป็น grid หนึ่งบล็อกต่อคน (แทน 32×32 tile stream และ shelf-packed collage เดิม); ใช้ HttpOnly browser session cookie และ SQLite/local persistent storage บน single instance ส่วน Web Locks ยังรอ Task 5/6 การเลือกเหล่านี้เป็น implementation decisions ที่บันทึกไว้ใน `docs/decisions.md`

## Current Milestone and Direction

**Milestone: Backend text-and-image foundation complete; next milestone is realtime and browser demo.**

ลำดับงานที่เสนอ:

1. Scaffold TypeScript app และล็อก text partitioning ด้วย tests
2. ทำ SQLite state, browser identity และ idempotent join
3. ทำ deterministic image collage และตรวจว่า pixel ไม่ซ้ำ/ไม่หาย
4. เพิ่ม revision-safe WebSocket และ exact 24-hour expiration
5. ทำ Creator/Recipient UI และ reconnect states
6. ตรวจ multi-browser, restart, delayed response และ load ถึง operational limit
7. สร้าง production/container artifact และค่อยตรวจ public/mobile เมื่อมี hosting target

Task 1–3 เสร็จและรีวิวแล้ว ส่วน Task 4–7 ยังไม่เริ่ม รายละเอียดและ checkbox อยู่ใน `docs/superpowers/plans/2026-10-10-share-division.md`

## Success Criteria and Definition of Done

- Creator แชร์ข้อความและภาพได้ และได้ URL กับ QR ที่เปิดจากมือถืออีกเครื่องได้
- ตัวอย่าง `ABCDEFGH` ให้ผลตามตาราง 2 และ 4 recipients
- Creator เป็นผู้รับ #1 ตั้งแต่สร้าง และตัวหารเริ่มต้นที่ 1
- การปิดหน้าไม่ลดตัวหาร; refresh/หลายแท็บด้วย identity เดิมไม่เพิ่มตัวหาร
- ภาพแบ่งเป็น grid หนึ่งบล็อกต่อคน และแต่ละคนได้รับพื้นที่ลดลงเมื่อผู้รับเพิ่ม
- ต้นฉบับแก้ไม่ได้ และ share หมดอายุ 24 ชั่วโมงหลังสร้าง ทั้งหน้าที่เปิดใหม่และหน้าที่ยังเชื่อมต่ออยู่
- เมื่อ share ข้อความ `ABCDEFGH` มีผู้รับ 9 คน (รวม Creator) จะมีผู้รับที่ได้ส่วนว่างและเห็น “คุณได้รับข้อมูล 0 ตัวอักษร” โดยการเข้าร่วมยังทำงานตามปกติ
- กฎแบ่งเศษ, Unicode และภาพเป็นไปตาม domain policy ที่เลือก และมี targeted tests
- ผู้รับใหม่เข้าแล้วทุกหน้าที่เชื่อมต่ออยู่ได้รับส่วนใหม่อัตโนมัติโดยไม่ refresh
- Refresh/reconnect/concurrent join ทำงานตาม counting policy ที่ยืนยัน และไม่มี update ย้อน revision
- Recipient ไม่ได้รับต้นฉบับเต็มโดยซ่อนอยู่หลัง UI
- Empty share, invalid image, missing share, disconnected connection และ allocation ว่างมีพฤติกรรมชัดเจน
- ภาพแต่ละชิ้นมาจากต้นฉบับ และการแบ่งไม่มีช่องว่างหรือชิ้นซ้ำเมื่อรวมทุก allocation
- ตรวจ flow 1 → 2 → 3 → 4 recipients ทั้งข้อความและภาพบน browser แยกกัน รวมถึงมือถือ
- Build และ checks ที่เกี่ยวข้องผ่าน และ public deployment ถูกตรวจจริง
- Current State, stack, commands และข้อจำกัดในเอกสารอัปเดตตรงกับสิ่งที่ทำและตรวจแล้ว

## Repository Structure and Development Commands

สถานะปัจจุบัน:

```text
Project.md       Project context and current state (canonical document)
AGENTS.md        Provider-neutral agent and handoff rules
TODO.md          Actionable remaining work
CHANGELOG.md     Verified task-level changes
src/core         Text partition and image grid allocation
src/server       SQLite, identity, share APIs, image storage/rendering
src/shared       Wire contracts
tests             Unit and integration coverage
docs/             Decisions, implementation plan and SDD handoff reports
outputs/         User-facing exported snapshots
```

คำสั่งที่ตรวจสอบแล้วใน Node `v22.23.2` / npm `10.9.8`: `npm install`, `npm test`, `npm run typecheck`, `npm run build` โดยชุดทดสอบปัจจุบันผ่าน 31 tests ข้อควรระวังคือ Vitest ต้องรันใน environment ที่อนุญาตการอ่านไฟล์ dependency บนเครื่องนี้

Implementation plan ระบุ architecture, API contract, file map, TDD steps และ final acceptance run; SDD reports อยู่ใต้ `.superpowers/sdd/2026-10-10-share-division/`
