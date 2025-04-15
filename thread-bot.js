const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { argv } = require('process');

// 명령줄 인수 파싱
const args = argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--link' && args[i + 1]) {
    options.link = args[i + 1];
    i++;
  } else if (args[i] === '--url' && args[i + 1]) {
    options.url = args[i + 1];
    i++;
  } else if (args[i] === '--help') {
    console.log(`
사용법:
  node thread-bot.js [옵션]

옵션:
  --link "댓글 내용"       작성할 댓글 내용 지정
  --url "URL"             댓글을 달 게시물 URL 지정
  --help                  도움말 표시
    `);
    process.exit(0);
  }
}

// 설정 파일 읽기
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (error) {
  console.error('설정 파일을 읽을 수 없습니다:', error.message);
  process.exit(1);
}

// 기본값 설정
const DEFAULT_COMMENT = config.commentLink || '좋은 게시물이네요!';
const DEFAULT_URL = config.targetPostUrl || 'https://www.threads.net/';
const comment = options.link || DEFAULT_COMMENT;
const postUrl = options.url || DEFAULT_URL;

// 스크린샷 저장 디렉토리
const screenshotDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

// 로그 저장 디렉토리
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// 로그 파일에 기록
const logOperation = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(path.join(logsDir, 'bot-activity.log'), logMessage);
  console.log(message);
};

(async () => {
  logOperation('댓글 봇 시작');
  logOperation(`사용할 댓글: ${comment}`);
  logOperation(`대상 URL: ${postUrl}`);
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    logOperation('로그인 중...');
    
    // Threads/Instagram 로그인 페이지로 이동
    await page.goto('https://www.threads.net/login');
    
    // 로그인 폼 작성
    await page.waitForSelector('input[name="username"]');
    await page.fill('input[name="username"]', config.username);
    await page.fill('input[name="password"]', config.password);
    
    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    logOperation('로그인 성공!');
    
    // 쿠키 저장
    const cookies = await context.cookies();
    fs.writeFileSync(
      path.join(__dirname, 'instagram_cookies.json'),
      JSON.stringify(cookies, null, 2)
    );
    
    // 특정 게시물로 이동
    logOperation(`게시물로 이동 중: ${postUrl}`);
    await page.goto(postUrl);
    
    // 댓글 작성 영역 찾기
    logOperation('댓글 작성 중...');
    await page.waitForSelector('[aria-label="Add a comment..."]');
    await page.click('[aria-label="Add a comment..."]');
    await page.fill('[aria-label="Add a comment..."]', comment);
    
    // 게시 버튼 클릭
    await page.waitForSelector('button:has-text("Post")');
    await page.click('button:has-text("Post")');
    
    // 댓글이 게시될 때까지 대기
    await page.waitForTimeout(3000);
    
    logOperation('댓글이 성공적으로 게시되었습니다!');
    
    // 결과 저장
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      comment,
      postUrl
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'result.json'),
      JSON.stringify(result, null, 2)
    );
    
  } catch (error) {
    const errorMessage = `오류 발생: ${error.message}`;
    logOperation(errorMessage);
    
    // 오류 발생 시 스크린샷 저장
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    await page.screenshot({
      path: path.join(screenshotDir, `error-${timestamp}.png`)
    });
    
    // 오류 정보 저장
    const result = {
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      comment,
      postUrl
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'result.json'),
      JSON.stringify(result, null, 2)
    );
  } finally {
    await browser.close();
    logOperation('브라우저 종료 및 작업 완료');
  }
})(); 