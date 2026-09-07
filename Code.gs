/**
 * 마음을 걷는 동반자 — 게시판 글쓰기용 Apps Script
 * -----------------------------------------------------------
 * 사용 방법
 * 1) 구글 스프레드시트('웹페이지' 탭이 있는 시트)를 엽니다.
 * 2) 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 3) 기본으로 열린 코드를 모두 지우고 이 파일 내용을 붙여넣기
 * 4) 저장 후 우측 상단 [배포] > [새 배포]
 *    - 유형: 웹 앱
 *    - 실행 계정: 나(본인)
 *    - 액세스 권한: 전체 허용(누구나) — 익명 사용자도 새 글을 쓸 수 있어야 하므로 필요
 * 5) 배포 후 나오는 "웹 앱 URL"을 복사해서
 *    index.html의 APPS_SCRIPT_URL 값에 붙여넣기
 *
 * 시트 구조 (1행은 헤더, 2행부터 데이터)
 *   A열: id (숫자)   B열: title   C열: date   D열: content
 * -----------------------------------------------------------
 */

var SHEET_NAME = '웹페이지';

// Netlify 사이트 설정 > Build & deploy > Build hooks 에서 발급받은 URL을 붙여넣으세요.
// 비워두면(빈 문자열) 자동 재빌드 신호를 보내지 않고 글쓰기만 동작합니다.
var NETLIFY_BUILD_HOOK_URL = '';

// 글쓰기 권한 확인용 비밀번호의 SHA-256 해시값입니다.
// 아래 기본값은 "walkingtogether2026"의 해시입니다. 반드시 본인만의 비밀번호로 바꿔서 사용하세요.
// 바꾸는 방법: 브라우저 아무 페이지에서 F12(개발자 도구) > Console 탭을 열고 아래를 붙여넣어 실행
//   async function h(p){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
//   h('새 비밀번호').then(console.log)
// 출력된 값을 아래 ADMIN_PW_HASH 자리에 그대로 붙여넣으면 됩니다.
var ADMIN_PW_HASH = '339347af4ef526a1ba12972ccc0abd78a5eefb179be6c6ceeb066a6e4c7b664c';

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOutput({ result: 'error', message: "'" + SHEET_NAME + "' 탭을 찾을 수 없습니다." });
    }

    var data = JSON.parse(e.postData.contents);

    // ----- 비밀번호(해시) 확인: 이 값이 일치하지 않으면 절대 시트를 건드리지 않음 -----
    var providedHash = (data.passwordHash || '').toString().trim().toLowerCase();
    if (providedHash !== ADMIN_PW_HASH) {
      return jsonOutput({ result: 'error', message: '비밀번호가 올바르지 않습니다.' });
    }
    // --------------------------------------------------------------------

    var action = (data.action || 'create').toString();

    if (action === 'delete') {
      return handleDelete(sheet, data);
    }
    return handleCreate(sheet, data);
  } catch (err) {
    return jsonOutput({ result: 'error', message: err.message });
  }
}

function handleCreate(sheet, data) {
  var title = (data.title || '').toString().trim();
  var content = (data.content || '').toString().trim();

  if (!title || !content) {
    return jsonOutput({ result: 'error', message: '제목과 내용을 모두 입력해 주세요.' });
  }
  if (title.length > 60) title = title.slice(0, 60);

  // 기존 id 중 최댓값 + 1을 새 id로 사용 (중간에 글이 삭제되어도 안전)
  var lastRow = sheet.getLastRow();
  var newId = 1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
      .map(function (row) { return Number(row[0]); })
      .filter(function (n) { return !isNaN(n); });
    if (ids.length > 0) newId = Math.max.apply(null, ids) + 1;
  }

  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  sheet.appendRow([newId, title, today, content]);

  triggerStaticRebuild();

  return jsonOutput({ result: 'success', id: newId, date: today });
}

function handleDelete(sheet, data) {
  var id = Number(data.id);
  if (!id || isNaN(id)) {
    return jsonOutput({ result: 'error', message: '삭제할 글 번호(id)가 올바르지 않습니다.' });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonOutput({ result: 'error', message: '삭제할 글이 없습니다.' });
  }

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === id) {
      targetRow = i + 2; // 시트 실제 행 번호 (1행은 헤더)
      break;
    }
  }

  if (targetRow === -1) {
    return jsonOutput({ result: 'error', message: '해당 번호의 글을 찾을 수 없습니다. (이미 삭제되었을 수 있습니다)' });
  }

  sheet.deleteRow(targetRow);

  triggerStaticRebuild();

  return jsonOutput({ result: 'success', id: id });
}

// 새 글이 저장된 직후, Netlify에 "지금 시트 내용으로 정적 페이지를 다시 만들어줘"
// 라는 신호를 보냅니다. 이 요청 하나로 build-posts.js가 Netlify 서버에서 실행되고,
// posts/*.html, sitemap.xml, index.html이 전부 자동으로 최신 글 기준으로 갱신됩니다.
function triggerStaticRebuild() {
  if (!NETLIFY_BUILD_HOOK_URL) return; // 아직 설정 전이면 조용히 건너뜀
  try {
    UrlFetchApp.fetch(NETLIFY_BUILD_HOOK_URL, {
      method: 'post',
      muteHttpExceptions: true,
    });
  } catch (err) {
    // 재빌드 신호 실패는 글쓰기 자체를 막을 이유가 아니므로 로그만 남김
    Logger.log('Netlify build hook 호출 실패: ' + err.message);
  }
}

function doGet(e) {
  return jsonOutput({ status: 'ok', message: '이 주소는 글 등록(POST) 전용입니다.' });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
