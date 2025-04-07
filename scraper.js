import fetch from 'node-fetch';
import cheerio from 'cheerio';

const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;
const USER_ID = process.env.LINE_USER_ID;
const MAX_HISTORY = 20;

const TARGET_URL = 'https://www.jw.org/ja/ライブラリー/ビデオ/#ja/mediaitems/StudioMonthlyPrograms';

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  });
  return await res.text();
}

function extractVideos(html) {
  const $ = cheerio.load(html);
  const videos = [];

  $('.media-item').each((_, elem) => {
    const title = $(elem).find('.title').text().trim();
    const href = $(elem).find('a').attr('href');

    if (title && href) {
      videos.push({
        title,
        url: new URL(href, 'https://www.jw.org').href,
      });
    }
  });

  return videos;
}

async function sendToLine(text) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LINE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: USER_ID,
      messages: [{ type: 'text', text }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('LINE送信失敗:', data);
  }
}

async function run() {
  console.log('🔍 ビデオ一覧を取得中...');
  const html = await fetchHTML(TARGET_URL);
  const videos = extractVideos(html);

  if (videos.length === 0) {
    console.log('⚠️ ビデオが見つかりませんでした。');
    return;
  }

  const notifiedRaw = process.env.NOTIFIED_LINKS || '';
  const notified = notifiedRaw.split(',').filter(Boolean);

  const newVideos = videos.filter(v => !notified.includes(v.url));

  if (newVideos.length === 0) {
    console.log('✅ 新着ビデオはありません。');
    return;
  }

  for (const v of newVideos.reverse()) {
    const message = `🆕 新着ビデオ：${v.title}\n🔗 ${v.url}`;
    console.log('📤 通知:', message);
    await sendToLine(message);
  }

  // 新しい履歴として保持（最新MAX_HISTORY件）
  const updated = [...newVideos.map(v => v.url), ...notified].slice(0, MAX_HISTORY);
  const encoded = updated.join(',');

  // GitHub Actions の output に保存（再利用しやすい）
  console.log(`::add-mask::${encoded}`);
  console.log(`::set-output name=UPDATED_LINKS::${encoded}`);
}

run().catch(err => {
  console.error('❌ エラー発生:', err);
  process.exit(1);
});
