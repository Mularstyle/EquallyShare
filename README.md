**English** | [ภาษาไทย (Thai version)](README.th.md)

<p align="center">
  <img src="docs/images/logo.png" alt="EquallyShare — Share means divide" width="480">
</p>

# EquallyShare — Share Means Divide

A sharing website that takes **sharing** literally: divide your content among everyone who opens the link. The more people join, the less each person gets!

Built for **Stupid Hackathon 2026**, with a Windows XP-inspired interface. Supports text, images, MP3 audio, MP4 video, and PDFs.

**[Try it →](https://equally-share.vercel.app/)**

## How does it work?

Suppose you share `ABCDEFGH`:

| Recipients | What each person receives |
| --- | --- |
| 1 | `ABCDEFGH` |
| 2 | `ABCD` · `EFGH` |
| 4 | `AB` · `CD` · `EF` · `GH` |

Whenever someone new joins, the original content is divided again. Existing recipients see their portions update automatically. The creator counts as recipient #1.

## How to use

### 1. Choose your content

Select **TEXT, IMAGE, MP3, MP4, or PDF**, then enter your text or upload a file. Click **สร้าง Share** (Create Share).

![Choose content and create a share](docs/images/eqs1.png)

### 2. Pass it on

Your share page shows your portion, a QR code, and a **COPY URL** button. Send the link to friends or let them scan the QR code to join. No account needed.

![Creator's portion, share link, and QR code](docs/images/eqs2.png)

### 3. Watch your portion shrink

As more people join, everyone's portion changes. An image, for example, is split into separate regions, and each recipient receives only their own region.

![An original image divided among three recipients](docs/images/image-sharing.png)

## What gets divided?

| Content | How it is split |
| --- | --- |
| Text | Consecutive sections, preserving whole emoji and character clusters |
| Images | Rectangular regions of the original image |
| MP3 | Consecutive audio segments |
| MP4 | Consecutive video segments cut at keyframes |
| PDF | Consecutive page ranges, with each recipient receiving only their pages |

## A few ground rules

- Up to **64 recipients per share** by default.
- The recipient count is cumulative. Closing a tab does not give anyone their portion back.
- Reopening a share in the same browser keeps you as the same recipient.
- If there is not enough content to go around, some recipients get an empty portion. For text, the page displays **“คุณได้รับข้อมูล 0 ตัวอักษร”** (You received 0 characters).
- Shares expire after **24 hours**. The creator can also click **End share** to finish earlier.
- Content cannot be edited after creation. Create a new share to change it.

## Run locally

Requires **Node.js 22** and npm.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See the [setup guide](docs/setup.md) for Supabase, Vercel, and supported file sizes.

Built with React, TypeScript, Vite, and Express, using Supabase for the database, file storage, and realtime updates.
