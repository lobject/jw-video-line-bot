import fetch from 'node-fetch';
import { load } from 'cheerio';

// 環境変数から読み取り
const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;
const LAST_VIDEO_URL = process.env.NOTIFIED_LINKS || '';

const TARGET_URL = 'https://www.jw.org/ja/ライブラリー/ビデオ/#ja/mediaitems/StudioMonthlyPrograms';

const sendToLine = async (message) => {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({
      to: LINE_USER_ID,
      messages: [{ type: "text", text: message }]
    })
  });

  const result = await res.json();
  console.log("LINE response:", result);
};

const main = async () => {
  console.log("▶️ スクレイピング開始");

  const res = await fetch(TARGET_URL);
  const html = await res.text();
  const $ = load(html);

  const items = $('.media-item');
  const results = [];

  items.each((i, el) => {
    const href = $(el).find('a').attr('href');
    const title = $(el).find('.title').text().trim();

    if (href && title) {
      const fullUrl = `https://www.jw.org${href}`;
      results.push({ title, url: fullUrl });
    }
  });

  if (results.length === 0) {
    console.log("🛑 ビデオ項目が見つかりませんでした");
    return;
  }

  const latest = results[0];

  if (latest.url === LAST_VIDEO_URL) {
    console.log("🔁 既に通知済みのビデオです");
    return;
  }

  // LINE通知
  await sendToLine(`🆕 新しいビデオが公開されました:\n${latest.title}\n${latest.url}`);

  // 通知済みURLをログ出力（Secrets更新は自動ではできない）
  console.log("🔗 このURLを NOTIFIED_LINKS にセットしてください：", latest.url);
};

main().catch(err => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
