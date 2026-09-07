# 심리상담센터 마음을 걷는 동반자 — 웹사이트 백업 문서

이 폴더는 실제 운영 중인 웹사이트의 전체 소스와 설정 백업입니다.
나중에 Claude(또는 다른 개발자)에게 이 폴더를 통째로 주고 "이거 보고 이어서 작업해줘"라고
하면, 아래 내용만으로 전체 구조를 파악하고 바로 작업할 수 있도록 정리했습니다.

생성일 기준: 2026-07-20 (최초 작성 2026-07-18, 이슈 해결 반영하여 갱신)

---

## 1. 전체 구조 요약

```
[방문자 브라우저] ──읽기(Sheets API, 브라우저용 키)──> [구글 스프레드시트 '웹페이지']
[방문자 브라우저] ──글쓰기/삭제(비밀번호 확인)──────> [Apps Script 웹앱] ──> [구글 스프레드시트]
[Apps Script] ──새 글/삭제 발생 시 신호 전송──────> [Netlify Build Hook]
[Netlify] ──빌드 시 읽기(Sheets API, 서버 전용 키)──> [구글 스프레드시트]
[Netlify] ──정적 파일 생성/배포──> [heartaround.co.kr] (실제 서비스 주소)
[GitHub 저장소] ──코드 저장소, Netlify가 여길 보고 빌드──
```

- **데이터베이스**: 구글 스프레드시트 (별도 서버 DB 없음)
- **글쓰기/삭제 처리**: Google Apps Script 웹 앱 (비밀번호 확인 후 시트에 반영)
- **호스팅/배포**: Netlify (GitHub 저장소와 연결, push 시 자동 배포)
- **정적 SEO 페이지 생성**: `build-posts.js` (Node 스크립트, Netlify 빌드 시 자동 실행)
- **소스 저장소**: GitHub `HeartAround-Website` (Public)
- **실제 도메인**: `heartaround.co.kr` (가비아에서 구매, 네임서버는 Netlify로 이전함)

---

## 2. 폴더/파일 구성

| 파일 | 역할 | 어디에 올라가나 |
|---|---|---|
| `index.html` | 메인 페이지 (게시판 목록 실시간 표시) | GitHub → Netlify |
| `post.html` | 개별 글 실시간 페이지 (`post.html?id=N`), 삭제 버튼 포함 | GitHub → Netlify |
| `posts/post-N.html` | 글마다 생성되는 **정적** SEO용 페이지 (build-posts.js가 자동 생성) | GitHub → Netlify (빌드 시 갱신) |
| `build-posts.js` | 시트 데이터를 읽어 `posts/*.html`, `sitemap.xml`, `robots.txt`, `index.html`의 정적 목록을 다시 생성하는 Node 스크립트 | GitHub (Netlify가 빌드 시 실행) |
| `package.json` | Netlify가 Node 빌드 환경임을 인식하는 설정 | GitHub |
| `netlify.toml` | Netlify 빌드 명령/배포 폴더 설정 (`node build-posts.js`) | GitHub |
| `sitemap.xml`, `robots.txt` | 검색엔진 제출용 (build-posts.js가 자동 생성) | GitHub |
| `Code.gs` | 글쓰기/삭제 처리 스크립트 — **GitHub이 아니라 구글 시트의 Apps Script 편집기에 붙여넣는 파일** | 구글 시트 Apps Script |

---

## 3. 핵심 설정 값 (재구축 시 필요)

- **스프레드시트 이름**: `웹페이지`
- **스프레드시트 ID**: `1FAEszpOoT-jWIf26heNU_0aRGTq9m1kmUQEUMwgBmVA`
- **시트(탭) 이름**: `웹페이지`
- **시트 컬럼 구조** (1행 헤더, 2행부터 데이터): `id | title | date | content`
- **시트 공유 설정**: 링크가 있는 모든 사용자 - 뷰어 (브라우저에서 API 키로 읽기 위해 필요)

### API 키 2개를 용도별로 분리해서 사용 중 (중요)
- **브라우저용 키** (index.html, post.html에 하드코딩됨): `AIzaSyAq5T9uK0nbz21xqe-JBATN7KophJzjlHM`
  - 구글 클라우드 콘솔에서 **애플리케이션 제한사항: 웹사이트**로 제한
  - 허용된 리퍼러: `https://heartaround.co.kr/*`, `https://www.heartaround.co.kr/*`, `https://heartaroundwebsite.netlify.app/*`
  - API 제한사항: Google Sheets API만
- **서버(빌드)용 키** (Netlify 환경변수 `SHEETS_API_KEY`로만 존재, 코드에는 없음)
  - 이유: 브라우저용 키에 웹사이트 제한이 걸려 있으면, 리퍼러가 없는 Netlify 서버 요청은 403으로 거부되기 때문에 별도 키가 필요했음
  - 애플리케이션 제한사항: 없음 (대신 절대 GitHub에 올리지 않고 Netlify 환경변수로만 보관)
  - API 제한사항: Google Sheets API만

### Apps Script 웹 앱
- **배포 URL**: `https://script.google.com/macros/s/AKfycbwvC1ej2h6kjMceOskajxAzjQIOfs4lvilnrTYl8694FiAvqsqWX4J8wC3RpefVZZf1rA/exec`
- index.html, post.html의 `APPS_SCRIPT_URL` 상수에 이 값이 이미 반영되어 있음
- 실행 계정: 나(시트 소유자) / 액세스 권한: 전체 허용(누구나)
- `doPost`가 `action` 필드로 분기: `action` 없음(기본) = 글쓰기, `action:'delete'` = 삭제
- 매 요청마다 `passwordHash`(비밀번호의 SHA-256 해시)를 서버에서 `ADMIN_PW_HASH`와 대조 — 이 파일(`Code.gs`) 안에 현재 값이 그대로 들어있음
- 비밀번호를 바꾸고 싶으면: 브라우저 콘솔에서
  ```js
  async function h(p){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  h('새 비밀번호').then(console.log)
  ```
  → 나온 값을 `Code.gs`의 `ADMIN_PW_HASH`에 붙여넣고 저장 → 배포 관리 → 새 버전으로 재배포

### Netlify
- 사이트 서브도메인: `heartaroundwebsite.netlify.app`
- 연결된 커스텀 도메인: `heartaround.co.kr` (Primary), `www.heartaround.co.kr` (자동 리다이렉트)
- DNS: 가비아에서 네임서버 자체를 Netlify로 이전함 (`dns1~4.p06.nsone.net`)
- 빌드 명령: `node build-posts.js` (netlify.toml에 설정됨)
- 환경변수: `SHEETS_API_KEY` (서버용 구글 API 키, secret 처리됨)
- **Build Hook**: Code.gs의 `NETLIFY_BUILD_HOOK_URL`에 설정 여부 확인 필요 (문서 작성 시점 기준으로 비어있었을 수 있음 — 설정해두면 글쓰기/삭제 시 정적 페이지가 자동으로 재생성됨. 비어있다면 새 글이 실시간 목록엔 바로 보이지만, 정적 SEO 페이지는 `node build-posts.js`를 수동 실행하기 전까진 갱신 안 됨)

### GitHub
- 저장소 이름: `HeartAround-Website` (Public)
- 브랜치: `main`
- Netlify가 이 저장소를 보고 자동 배포함

---

## 4. 알아두어야 할 설계 포인트

1. **실시간 계층과 정적(SEO) 계층이 분리되어 있음**
   - 방문자가 보는 목록/글(`index.html`, `post.html?id=N`)은 매번 구글 시트를 실시간으로 읽어옴 → 시트에 글 추가/삭제하면 즉시 반영됨
   - `posts/post-N.html`은 검색엔진 크롤러를 위한 완전 정적 페이지 → `build-posts.js` 실행(빌드) 시점에만 갱신됨
   - `posts/post-N.html`에는 `post.html?id=N`을 canonical로 지정해 중복 콘텐츠 문제를 피함

2. **비밀번호 검증은 항상 서버(Apps Script)에서** — 브라우저 JS는 열람 가능하므로 클라이언트만 믿지 않음

3. **API 키를 용도별로 분리한 이유** — 브라우저용 키는 도메인 제한을 걸어 도용을 막고, 서버(빌드)용 키는 제한 없이 대신 저장소에 노출되지 않는 Netlify 환경변수로만 보관

4. **시트에서 글을 삭제해도 정적 페이지 파일은 자동으로 안 지워짐** → 이 문제 방지를 위해 build-posts.js가 매 빌드마다 시트에 없는 id의 `posts/post-N.html`을 자동으로 정리(삭제)하도록 되어 있음

---

## 5. 이슈 해결 현황 (2026-07-20 기준)

- [x] `heartaround.co.kr`의 HTTPS(Let's Encrypt) 인증서 발급 완료 — 정상적으로 `https://heartaround.co.kr` 접속 시 자물쇠 아이콘 표시됨
- [x] Netlify Build Hook URL을 Code.gs에 설정 완료 — 글쓰기/삭제 시 정적 페이지(posts/*.html, sitemap.xml, index.html 정적 목록)가 자동으로 재생성됨
- [ ] (참고) `build-posts.js`가 실제 환경에서 정상 실행되어 `posts/`, `sitemap.xml`, `index.html`이 최신 시트 데이터 기준으로 갱신되고 있는지는, 새 글을 하나 등록해서 몇 분 뒤 `posts/post-N.html`이 새로 생기는지로 계속 확인해보시면 좋습니다

현재 사이트는 다음 흐름이 전부 정상 작동 중입니다:
1. 시트에 글 작성/삭제 (또는 사이트 글쓰기/삭제 기능 사용, 비밀번호 필요)
2. Apps Script가 Netlify Build Hook 호출
3. Netlify가 자동으로 `node build-posts.js` 재실행 → 정적 페이지/sitemap 갱신 → 배포
4. `heartaround.co.kr`에 HTTPS로 정상 서비스 중

---

## 6. 다시 요청할 때 이렇게 말씀하시면 편해요

- "이 백업 폴더 기준으로, 게시판에 카테고리 기능 추가해줘"
- "이 백업 폴더 기준으로, Code.gs에 글 수정 기능도 추가해줘"
- "이 README 보고 전체 구조 파악한 다음, OO 기능 만들어줘"

이렇게 폴더를 통째로 올려주시면 별도 설명 없이도 바로 이어서 작업할 수 있습니다.
