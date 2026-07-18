/**
 * build-posts.js
 * -----------------------------------------------------------
 * 구글 스프레드시트의 글을 읽어서, 글마다 "완전히 정적인" HTML 파일을
 * posts/post-1.html, posts/post-2.html ... 형태로 직접 생성합니다.
 * 동시에 index.html 게시판 목록도 정적 링크로 다시 구워넣고,
 * sitemap.xml / robots.txt 도 함께 만들어줍니다.
 *
 * 이렇게 만들어진 정적 파일은 자바스크립트를 실행하지 않는 크롤러도
 * 바로 전체 내용을 읽을 수 있어 검색 색인에 훨씬 유리합니다.
 *
 * 실행 방법
 *   1) Node.js 18 이상 설치 (https://nodejs.org)
 *   2) 아래 CONFIG 값을 본인 것으로 채우기
 *   3) 이 파일과 같은 폴더에 index.html이 있는 상태에서 터미널에서:
 *        node build-posts.js
 *   4) posts/ 폴더, sitemap.xml, robots.txt, 갱신된 index.html이 생깁니다.
 *   5) 새 글을 등록했거나 글을 수정/삭제했을 때마다 다시 실행해서
 *      정적 버전을 최신 상태로 맞춰주세요.
 *      (매일 자동 실행하고 싶다면 GitHub Actions의 스케줄 트리거로
 *       이 스크립트를 돌리고 결과를 커밋/배포하는 방식도 가능합니다.)
 * -----------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

// ----------------- 반드시 본인 값으로 채워주세요 -----------------
const CONFIG = {
  SHEET_ID: '1FAEszpOoT-jWIf26heNU_0aRGTq9m1kmUQEUMwgBmVA',
  SHEET_NAME: '웹페이지',
  // 서버(빌드) 전용 API 키: Netlify 환경변수 SHEETS_API_KEY 값을 우선 사용합니다.
  // (브라우저용 키와 분리하는 이유: 브라우저용 키에 "웹사이트 제한"을 걸어두면
  //  Netlify 서버에서 보내는 요청은 리퍼러가 없어 거부(HTTP 403)되기 때문입니다.
  //  아래 하드코딩 값은 환경변수를 아직 설정하지 않았을 때를 위한 임시 대체값입니다.)
  API_KEY: process.env.SHEETS_API_KEY || 'AIzaSyAq5T9uK0nbz21xqe-JBATN7KophJzjlHM',
  // 실제 서비스 중인 도메인 주소 (마지막에 슬래시(/) 없이). 배포 전이라면 임시로 두고 나중에 교체해도 됩니다.
  SITE_URL: 'https://heartaround.co.kr',
  SITE_NAME: '심리상담센터 마음을 걷는 동반자',
};
// -----------------------------------------------------------

const OUT_DIR = __dirname;
const POSTS_DIR = path.join(OUT_DIR, 'posts');
const INDEX_HTML_PATH = path.join(OUT_DIR, 'index.html');

async function fetchPosts() {
  const range = encodeURIComponent(`'${CONFIG.SHEET_NAME}'!A2:D`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${range}?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`시트를 읽지 못했습니다 (HTTP ${res.status}). 공유 설정과 API 키를 확인해 주세요.`);
  }
  const data = await res.json();
  const rows = data.values || [];
  return rows
    .filter((r) => r[0] !== undefined && r[0] !== '')
    .map((r) => ({ id: Number(r[0]), title: r[1] || '', date: r[2] || '', content: r[3] || '' }))
    .sort((a, b) => b.id - a.id);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildPostPage(post) {
  const title = escapeHtml(post.title);
  const desc = escapeHtml((post.content || '').replace(/\s+/g, ' ').trim().slice(0, 120));
  const canonicalUrl = `${CONFIG.SITE_URL}/post.html?id=${post.id}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | ${CONFIG.SITE_NAME}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonicalUrl}">
<script type="application/ld+json">
${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    author: { '@type': 'Organization', name: CONFIG.SITE_NAME },
    publisher: { '@type': 'Organization', name: CONFIG.SITE_NAME },
    mainEntityOfPage: canonicalUrl,
  },
  null,
  2
)}
</script>
<style>
  @font-face { font-family:'SeoulHangang'; src:url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/SeoulHangangM.woff') format('woff'); font-weight:normal; font-display:swap; }
  :root{ --cream:#F6F1E8; --linen:#ECE2D3; --ink:#2B241D; --ink-soft:#5B5044; --terracotta:#AE5A3C; --hairline:rgba(43,36,29,0.14); --serif:'SeoulHangang', serif; --sans:'SeoulHangang', -apple-system, sans-serif; }
  *{ margin:0; padding:0; box-sizing:border-box; }
  body{ background:var(--cream); color:var(--ink); font-family:var(--sans); -webkit-font-smoothing:antialiased; }
  a{ text-decoration:none; color:inherit; }
  .nav{ display:flex; justify-content:space-between; align-items:center; gap:24px; padding:24px 6vw; background:var(--cream); border-bottom:1px solid var(--hairline); }
  .nav-logo{ font-family:var(--serif); font-size:18px; letter-spacing:0.06em; }
  .nav-back{ font-size:13px; color:var(--ink-soft); border-bottom:1px solid var(--hairline); padding-bottom:2px; }
  .nav-back:hover{ color:var(--terracotta); border-color:var(--terracotta); }
  main{ max-width:760px; margin:0 auto; padding:64px 6vw 120px; }
  .post-eyebrow{ font-size:12px; letter-spacing:0.32em; text-transform:uppercase; color:var(--terracotta); font-weight:600; display:block; margin-bottom:18px; }
  h1{ font-family:var(--serif); font-weight:400; font-size:clamp(26px,3.6vw,38px); line-height:1.4; margin-bottom:16px; }
  .post-date{ font-size:13px; color:var(--ink-soft); padding-bottom:28px; margin-bottom:28px; border-bottom:1px solid var(--hairline); }
  .post-content{ font-size:16px; line-height:2.05; color:var(--ink-soft); white-space:pre-wrap; word-break:keep-all; }
  .post-live-note{ margin-top:40px; padding:16px 20px; background:rgba(174,90,60,0.08); border:1px solid rgba(174,90,60,0.28); border-radius:4px; font-size:13px; color:var(--ink-soft); }
  .post-live-note a{ color:var(--terracotta); font-weight:600; }
  .post-footer-nav{ margin-top:32px; padding-top:28px; border-top:1px solid var(--hairline); }
  .post-footer-nav a{ font-size:13px; color:var(--ink-soft); border-bottom:1px solid var(--hairline); padding-bottom:2px; }
  .post-footer-nav a:hover{ color:var(--terracotta); border-color:var(--terracotta); }
</style>
</head>
<body>
  <nav class="nav">
    <a class="nav-logo" href="../index.html">${CONFIG.SITE_NAME}</a>
    <a class="nav-back" href="../index.html#board">← 게시판 목록으로</a>
  </nav>
  <main>
    <span class="post-eyebrow">NOTICE &amp; STORY</span>
    <h1>${title}</h1>
    <div class="post-date">${escapeHtml(post.date)}</div>
    <div class="post-content">${escapeHtml(post.content)}</div>

    <div class="post-live-note">
      이 페이지는 검색엔진 수집을 위해 생성된 정적 페이지입니다.
      최신 댓글이나 실시간 업데이트는 <a href="${canonicalUrl}">실시간 버전 보기</a>에서 확인하실 수 있습니다.
    </div>

    <div class="post-footer-nav">
      <a href="../index.html#board">← 게시판 목록으로</a>
    </div>
  </main>
</body>
</html>
`;
}

function buildStaticListHtml(posts) {
  return posts
    .map((post, idx) => {
      return `<a class="board-item" href="posts/post-${post.id}.html">
        <div class="board-item-left">
          <span class="board-badge">${String(idx + 1).padStart(2, '0')}</span>
          <span class="board-item-title">${escapeHtml(post.title)}</span>
        </div>
        <div class="board-item-right">
          <span class="board-item-date">${escapeHtml(post.date)}</span>
        </div>
      </a>`;
    })
    .join('\n');
}

function updateIndexHtml(posts) {
  let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const startMarker = '<!--STATIC_BOARD_LIST_START-->';
  const endMarker = '<!--STATIC_BOARD_LIST_END-->';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.warn('index.html에서 STATIC_BOARD_LIST 마커를 찾지 못해 목록을 굽지 못했습니다.');
    return;
  }

  const listHtml = buildStaticListHtml(posts);
  const before = html.slice(0, startIdx + startMarker.length);
  const after = html.slice(endIdx);
  html = `${before}\n${listHtml}\n${after}`;

  fs.writeFileSync(INDEX_HTML_PATH, html, 'utf8');
}

function buildSitemap(posts) {
  const urls = [
    { loc: `${CONFIG.SITE_URL}/index.html`, lastmod: new Date().toISOString().slice(0, 10) },
    ...posts.map((p) => ({ loc: `${CONFIG.SITE_URL}/posts/post-${p.id}.html`, lastmod: p.date })),
  ];
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${CONFIG.SITE_URL}/sitemap.xml\n`;
}

async function main() {
  console.log('구글 시트에서 글 목록을 가져오는 중...');
  const posts = await fetchPosts();
  console.log(`총 ${posts.length}개 글을 찾았습니다.`);

  fs.mkdirSync(POSTS_DIR, { recursive: true });

  // 시트에서 이미 삭제된 글의 정적 파일이 남아있으면 정리
  const validFileNames = new Set(posts.map((p) => `post-${p.id}.html`));
  fs.readdirSync(POSTS_DIR).forEach((fileName) => {
    if (fileName.endsWith('.html') && !validFileNames.has(fileName)) {
      fs.unlinkSync(path.join(POSTS_DIR, fileName));
      console.log('삭제(정리):', path.join('posts', fileName));
    }
  });

  posts.forEach((post) => {
    const filePath = path.join(POSTS_DIR, `post-${post.id}.html`);
    fs.writeFileSync(filePath, buildPostPage(post), 'utf8');
    console.log('생성:', path.relative(OUT_DIR, filePath));
  });

  updateIndexHtml(posts);
  console.log('index.html 게시판 목록을 정적 내용으로 갱신했습니다.');

  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), buildSitemap(posts), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), buildRobotsTxt(), 'utf8');
  console.log('sitemap.xml, robots.txt 생성 완료.');

  console.log('\n완료되었습니다. posts/, index.html, sitemap.xml, robots.txt를 함께 서버에 업로드해 주세요.');
}

main().catch((err) => {
  console.error('빌드 중 오류가 발생했습니다:', err.message);
  process.exit(1);
});
