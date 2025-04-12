const { chromium } = require("playwright");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

// 설정 로드 또는 생성
let config = {};
const configPath = path.join(__dirname, "config.json");

// 설정 파일 존재 여부 확인 및 로드
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log("저장된 설정을 로드했습니다.");
  } catch (error) {
    console.log(
      "설정 파일을 읽는 중 오류가 발생했습니다. 기본 설정을 사용합니다."
    );
    config = {
      username: "dorar.ing",
      password: "space0527",
      commentLink: "여기 확인해보세요: https://example.com",
      targetPostUrl: null,
      lastProfileUrl: null,
    };
  }
} else {
  // 기본 설정
  config = {
    username: "dorar.ing",
    password: "space0527",
    commentLink: "여기 확인해보세요: https://example.com",
    targetPostUrl: null,
    lastProfileUrl: null,
  };
}

// 커맨드 라인 인자 파싱
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--link" && i + 1 < args.length) {
      config.commentLink = args[i + 1];
      i++;
    } else if (args[i] === "--url" && i + 1 < args.length) {
      config.targetPostUrl = args[i + 1];
      i++;
    } else if (args[i] === "--reset") {
      // 설정 초기화 플래그
      config.commentLink = "여기 확인해보세요: https://example.com";
      config.targetPostUrl = null;
      config.lastProfileUrl = null;
      console.log("설정이 초기화되었습니다.");
    } else if (args[i] === "--help") {
      console.log(`
사용법: node thread-bot.js [옵션]

옵션:
  --link <댓글>     게시물에 달 댓글 내용 (기본값: "${config.commentLink}")
  --url <URL>       댓글을 달 특정 게시물의 URL
  --reset           저장된 설정 초기화
  --help            도움말 표시
      `);
      process.exit(0);
    }
  }
}

// 사용자 입력을 받는 함수
async function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// 쿠키 저장 함수
async function saveCookies(context, filename) {
  const cookies = await context.cookies();
  fs.writeFileSync(filename, JSON.stringify(cookies, null, 2));
  console.log(`쿠키가 ${filename}에 저장되었습니다.`);

  // 쿠키 상태 추가 로깅
  const instagramCookies = cookies.filter((c) =>
    c.domain.includes("instagram")
  );
  const threadsCookies = cookies.filter((c) => c.domain.includes("threads"));
  console.log(`인스타그램 관련 쿠키: ${instagramCookies.length}개`);
  console.log(`쓰레드 관련 쿠키: ${threadsCookies.length}개`);

  // 세션 쿠키 확인
  const sessionCookies = cookies.filter(
    (c) =>
      c.name.includes("sessionid") ||
      c.name.includes("session") ||
      c.name.includes("csrf")
  );

  if (sessionCookies.length > 0) {
    console.log(
      "세션 관련 쿠키가 발견되었습니다. 로그인 상태가 유효할 가능성이 높습니다."
    );
  } else {
    console.log(
      "세션 관련 쿠키가 발견되지 않았습니다. 로그인 상태가 유효하지 않을 수 있습니다."
    );
  }
}

// 쿠키 로드 함수
async function loadCookies(context, filename) {
  try {
    if (fs.existsSync(filename)) {
      const cookies = JSON.parse(fs.readFileSync(filename, "utf8"));
      await context.addCookies(cookies);
      console.log(`${filename}에서 쿠키를 불러왔습니다.`);

      // 쿠키 상태 추가 로깅
      const instagramCookies = cookies.filter((c) =>
        c.domain.includes("instagram")
      );
      const threadsCookies = cookies.filter((c) =>
        c.domain.includes("threads")
      );
      console.log(`인스타그램 관련 쿠키: ${instagramCookies.length}개`);
      console.log(`쓰레드 관련 쿠키: ${threadsCookies.length}개`);

      // 세션 쿠키 확인
      const sessionCookies = cookies.filter(
        (c) =>
          c.name.includes("sessionid") ||
          c.name.includes("session") ||
          c.name.includes("csrf")
      );

      if (sessionCookies.length > 0) {
        console.log(
          "세션 관련 쿠키가 발견되었습니다. 로그인 상태가 유효할 가능성이 높습니다."
        );
        return true;
      } else {
        console.log(
          "세션 관련 쿠키가 발견되지 않았습니다. 로그인 상태가 유효하지 않을 수 있습니다."
        );
        return false;
      }
    }
  } catch (error) {
    console.error("쿠키 로드 중 오류:", error);
  }
  return false;
}

// 보안 인증 코드 입력 처리 함수
async function handleSecurityCheck(page) {
  try {
    // 보안 코드 확인 화면이 나타났는지 확인
    if (
      await page.isVisible(
        'input[aria-label="보안 코드"], input[aria-label="Security code"]'
      )
    ) {
      console.log("보안 인증 코드 입력이 필요합니다.");

      // 사용자에게 코드 요청
      const securityCode = await getUserInput(
        "이메일로 받은 보안 코드를 입력하세요: "
      );

      // 코드 입력
      await page.fill(
        'input[aria-label="보안 코드"], input[aria-label="Security code"]',
        securityCode
      );

      // 확인 버튼 클릭
      await page.click('button:has-text("확인"), button:has-text("Confirm")');
      console.log("보안 코드를 입력하고 확인 버튼을 클릭했습니다.");

      // 처리 대기
      await page.waitForTimeout(5000);
      return true;
    }
  } catch (error) {
    console.log("보안 인증 화면 확인 중 오류:", error.message);
  }
  return false;
}

// 인스타그램 로그인 상태 확인 함수
async function checkInstagramLoggedIn(page) {
  try {
    // 현재 페이지 URL 확인
    const currentUrl = page.url();
    console.log(`현재 URL: ${currentUrl}`);

    // 페이지 HTML 구조를 파일로 저장
    const pageHtml = await page.content();
    const debugFilename = "instagram-debug-html.txt";
    fs.writeFileSync(debugFilename, pageHtml);
    console.log(`인스타그램 페이지 HTML이 ${debugFilename}에 저장되었습니다.`);

    // 로그인 버튼이 있는지 확인 (로그인 버튼이 없으면 로그인됨)
    const loginButton = await page.$(
      'a[href="/accounts/login/"], button:has-text("로그인"), button:has-text("Log in")'
    );

    // 사용자 프로필 요소 확인 (로그인된 상태에서만 표시됨)
    const profileElement = await page.$(
      'img[data-testid="user-avatar"], [aria-label="프로필"], [aria-label="Profile"]'
    );

    if (loginButton) {
      console.log("로그인 버튼이 발견되었습니다 - 로그인되지 않은 상태");
      return false;
    }

    if (profileElement) {
      console.log("프로필 요소가 발견되었습니다 - 로그인된 상태");
      return true;
    }

    // 로그인 상태에서 보이는 다른 요소 확인
    const feedElement = await page.$(
      '[aria-label="홈"], [aria-label="Home"], [aria-label="피드"], [aria-label="Feed"]'
    );
    if (feedElement) {
      console.log("피드 요소가 발견되었습니다 - 로그인된 상태");
      return true;
    }

    console.log(
      "로그인 상태를 명확히 판단할 수 없습니다. 스크린샷을 확인하세요."
    );
    return false;
  } catch (error) {
    console.error("로그인 상태 확인 중 오류:", error);
    return false;
  }
}

// URL 유효성 검사 함수
function isValidUrl(string) {
  try {
    new URL(string);
    return string.startsWith("http://") || string.startsWith("https://");
  } catch (_) {
    return false;
  }
}

// URL 유형 확인 함수
function getUrlType(url) {
  // 프로필 URL 패턴 (예: https://www.threads.net/@username)
  if (url.match(/threads\.net\/@[\w\.-]+\/?$/)) {
    return "profile";
  }
  // 게시물 URL 패턴 (예: https://www.threads.net/@username/post/123456789)
  else if (url.match(/threads\.net\/@[\w\.-]+\/post\/[\w\d]+/)) {
    return "post";
  }
  // 기타 URL의 경우 unknown 반환
  return "unknown";
}

// 계정 선택 함수 개선
async function handleAccountSelection(page, username) {
  console.log(`\n🔍 SSO 페이지에서 계정 "${username}" 선택 시도...`);

  try {
    // 현재 URL 확인 및 로깅
    const currentUrl = page.url();
    console.log(`📌 현재 URL: ${currentUrl}`);

    // 1. instagram SSO iframe 찾기 - 핵심 포인트!!
    console.log("1️⃣ SSO iframe 찾기 시도...");

    // 모든 iframe 정보 수집 (디버깅용)
    const allFrames = page.frames();
    console.log(`📊 페이지 내 총 프레임 수: ${allFrames.length}`);

    // 각 프레임의 URL 로깅
    allFrames.forEach((frame, idx) => {
      console.log(`프레임 ${idx}: ${frame.url()}`);
    });

    // instagram.com/threads/sso URL 패턴을 가진 프레임 찾기
    const ssoFrame = page
      .frames()
      .find(
        (f) =>
          f.url().includes("instagram.com/threads/sso") ||
          f.url().includes("instagram.com/accounts")
      );

    if (!ssoFrame) {
      console.log("❌ Instagram SSO iframe을 찾지 못했습니다.");

      // 대안: 메인 페이지 내에서 직접 찾기 시도
      console.log("⚠️ 메인 프레임에서 계정 카드 찾기 시도...");
      await page.waitForTimeout(5000);

      // 스크린샷 찍기
      await page.screenshot({ path: "sso-page-no-frame.png" });

      // 메인 페이지에서 직접 계정 선택 시도
      const mainPageAttempt = await handleDirectAccountSelection(
        page,
        username
      );
      return mainPageAttempt;
    }

    console.log("✅ SSO iframe 발견!");
    console.log(`📌 iframe URL: ${ssoFrame.url()}`);

    // iframe 로딩 대기
    console.log("⏳ iframe 콘텐츠 로딩 대기...");
    await ssoFrame.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // iframe 스크린샷 찍기 (가능한 경우)
    try {
      const frameElement = await page.$("iframe");
      if (frameElement) {
        await frameElement.screenshot({ path: "sso-iframe.png" });
        console.log("✅ iframe 스크린샷 저장됨");
      }
    } catch (err) {
      console.log(`⚠️ iframe 스크린샷 실패: ${err.message}`);
    }

    // 2. Locator API로 계정 카드 찾기
    console.log(`2️⃣ Locator API로 "${username}" 계정 카드 찾기...`);

    // 다양한 locator 시도 (순서대로 시도)
    const locators = [
      ssoFrame.getByRole("button", { name: new RegExp(username, "i") }),
      ssoFrame.getByText(new RegExp(username, "i"), { exact: false }),
      ssoFrame.locator(`[role="button"]:has-text("${username}")`),
      ssoFrame.locator("button").filter({ hasText: new RegExp(username, "i") }),
      ssoFrame.locator('div[role="button"]').nth(1), // 두 번째 버튼 (인덱스 1)
    ];

    // 각 locator 존재 여부 확인 (디버깅용)
    for (let i = 0; i < locators.length; i++) {
      const locator = locators[i];
      const count = await locator.count();
      console.log(`locator ${i + 1}: ${count}개 요소 발견`);

      if (count > 0) {
        try {
          // 요소 정보 출력
          const isVisible = await locator.isVisible();
          console.log(`- 가시성: ${isVisible ? "보임 ✓" : "안 보임 ✗"}`);

          // trial 옵션으로 클릭 가능 여부 테스트 (디버깅용)
          try {
            await locator.click({ timeout: 1000, trial: true });
            console.log("- 클릭 가능 ✓");
          } catch (e) {
            console.log(`- 클릭 불가능 ✗: ${e.message}`);
          }
        } catch (e) {
          console.log(`- 요소 정보 확인 실패: ${e.message}`);
        }
      }
    }

    // 3. navigation 이벤트와 함께 클릭 시도
    console.log(`3️⃣ 계정 카드 클릭 및 navigation 대기...`);

    // 각 locator에 대해 클릭 시도
    for (let i = 0; i < locators.length; i++) {
      const locator = locators[i];
      const count = await locator.count();

      if (count > 0) {
        try {
          console.log(`🔹 locator ${i + 1} 클릭 시도...`);

          // waitForNavigation과 함께 클릭
          await Promise.all([
            page.waitForNavigation({ timeout: 30000 }).catch((e) => {
              console.log(`⚠️ Navigation 대기 중 타임아웃: ${e.message}`);
              return null; // 오류가 나도 계속 진행
            }),
            locator.click({ timeout: 10000, force: true }).catch((e) => {
              console.log(`⚠️ 클릭 실패: ${e.message}`);
              throw e; // 클릭 실패는 다시 던져서 다음 locator 시도
            }),
          ]);

          // 네비게이션 이후 URL 확인
          const newUrl = page.url();
          console.log(`📌 클릭 후 URL: ${newUrl}`);

          if (newUrl !== currentUrl) {
            console.log("🎉 계정 선택 성공! URL이 변경되었습니다.");
            return true;
          } else {
            console.log("⚠️ 클릭은 되었지만 URL이 변경되지 않았습니다.");
            // 다음 locator 시도
          }
        } catch (e) {
          console.log(`⚠️ locator ${i + 1} 클릭 시도 실패: ${e.message}`);
          // 다음 locator 시도
        }
      }
    }

    // 4. 마지막 수단: JavaScript 직접 실행
    console.log(`4️⃣ 마지막 시도: JavaScript로 직접 클릭...`);

    try {
      const jsResult = await ssoFrame.evaluate((username) => {
        // 함수: 텍스트로 클릭 가능한 요소 찾기
        function findClickableByText(text) {
          // 1. 모든 버튼 요소 검색
          const allButtons = Array.from(
            document.querySelectorAll('[role="button"], button, a, .x1i10hfl')
          );
          console.log(`총 ${allButtons.length}개 버튼 요소 발견`);

          // 2. 사용자명 포함된 버튼 찾기
          const matchingButtons = allButtons.filter(
            (el) =>
              el.textContent &&
              el.textContent.toLowerCase().includes(text.toLowerCase())
          );
          console.log(`'${text}' 포함된 버튼: ${matchingButtons.length}개`);

          if (matchingButtons.length > 0) {
            // 첫 번째 일치 버튼 클릭
            matchingButtons[0].click();
            console.log(`'${text}' 포함된 첫 번째 버튼 클릭됨`);
            return true;
          }

          // 3. 인덱스 기반으로 시도 (두 번째 버튼)
          if (allButtons.length > 1) {
            console.log(
              `인덱스 1 버튼 텍스트: ${allButtons[1].textContent.substring(
                0,
                30
              )}`
            );
            allButtons[1].click();
            console.log("두 번째 버튼(인덱스 1) 클릭됨");
            return true;
          }

          return false;
        }

        return findClickableByText(username);
      }, username);

      console.log(
        `📊 JavaScript 직접 클릭 결과: ${jsResult ? "성공 ✓" : "실패 ✗"}`
      );

      // 클릭 후 URL 변경 대기
      await page.waitForTimeout(5000);
      const finalUrl = page.url();

      if (finalUrl !== currentUrl) {
        console.log("🎉 JavaScript 방식으로 계정 선택 성공!");
        return true;
      }
    } catch (e) {
      console.log(`⚠️ JavaScript 직접 클릭 실패: ${e.message}`);
    }

    console.log("❌ 모든 계정 선택 시도 실패");
    return false;
  } catch (error) {
    console.error(`❌ 계정 선택 중 오류 발생: ${error.message}`);
    await page.screenshot({ path: "account-selection-error.png" });
    return false;
  }
}

// 메인 페이지에서 직접 계정 선택 시도하는 보조 함수
async function handleDirectAccountSelection(page, username) {
  console.log("🔍 메인 페이지에서 계정 카드 직접 찾기...");

  try {
    // 다양한 선택자 시도
    const selectors = [
      `[role="button"]:has-text("${username}")`,
      `text=${username}`,
      'div[role="button"]',
      "button",
      '[role="button"]',
      ".x1i10hfl",
    ];

    for (const selector of selectors) {
      try {
        console.log(`🔹 선택자 시도: ${selector}`);

        const exists = await page.isVisible(selector);
        if (exists) {
          console.log(`✅ 선택자 발견: ${selector}`);

          // waitForNavigation과 함께 클릭
          const currentUrl = page.url();

          await Promise.all([
            page.waitForNavigation({ timeout: 30000 }).catch(() => null),
            page.click(selector, { force: true, timeout: 5000 }),
          ]);

          const newUrl = page.url();
          if (newUrl !== currentUrl) {
            console.log("🎉 메인 페이지에서 계정 선택 성공!");
            return true;
          }
        }
      } catch (e) {
        console.log(`⚠️ 선택자 ${selector} 실패: ${e.message}`);
      }
    }

    console.log("❌ 메인 페이지에서 계정 선택 실패");
    return false;
  } catch (e) {
    console.log(`❌ 직접 계정 선택 중 오류: ${e.message}`);
    return false;
  }
}

// 인스타그램으로 계속 버튼 처리 함수
async function handleContinueWithInstagram(page) {
  try {
    console.log("'Instagram으로 계속' 버튼 확인 중...");

    // 버튼 확인 전 스크린샷
    await page.screenshot({ path: "before-instagram-button.png" });
    console.log("'Instagram으로 계속' 버튼 확인 전 스크린샷이 저장되었습니다.");

    // 페이지 HTML 내용 저장 (디버깅용)
    const pageHtml = await page.content();
    fs.writeFileSync("instagram-button-html.txt", pageHtml);
    console.log("버튼 검색 전 페이지 HTML을 저장했습니다.");

    // 버튼이 있는지 확인
    if (
      pageHtml.includes("Continue with Instagram") ||
      pageHtml.includes("Instagram으로 계속") ||
      pageHtml.includes("Instagram으로 로그인") ||
      pageHtml.includes("Continue with")
    ) {
      console.log("'Instagram으로 계속' 관련 텍스트가 감지되었습니다.");

      // 1. 최신 CSS 선택자로 버튼 찾기 시도
      console.log("최신 CSS 선택자로 버튼 찾기 시도 중...");
      const cssSelectors = [
        // 인스타그램 계속 버튼에 자주 사용되는 CSS 클래스 선택자
        '.x1i10hfl:has-text("Instagram")',
        '.x9f619:has-text("Instagram")',
        '.xjbqb8w:has-text("Instagram")',
        'div[role="button"]:has-text("Instagram")',
        // 일반적인 버튼 선택자
        'button:has-text("Instagram으로 계속")',
        'button:has-text("Continue with Instagram")',
        'a:has-text("Instagram으로 계속")',
        'a:has-text("Continue with Instagram")',
        'button[type="button"]:has-text("Instagram")',
        'a[role="button"]:has-text("Instagram")',
      ];

      let clicked = false;

      // 모든 CSS 선택자 시도
      for (const selector of cssSelectors) {
        try {
          const count = await page.locator(selector).count();
          console.log(`선택자 '${selector}'로 찾은 요소: ${count}개`);

          if (count > 0) {
            // 첫 번째 발견된 요소 클릭
            const button = page.locator(selector).first();
            const isVisible = await button.isVisible();

            if (isVisible) {
              console.log(
                `선택자 '${selector}'로 버튼을 찾았습니다. 클릭합니다.`
              );
              await button.click();
              clicked = true;

              // 버튼 클릭 후 스크린샷
              await page.waitForTimeout(2000);
              await page.screenshot({
                path: "after-instagram-button-click.png",
              });
              console.log(
                "'Instagram으로 계속' 버튼 클릭 후 스크린샷이 저장되었습니다."
              );
              break;
            } else {
              console.log(
                `선택자 '${selector}'로 요소를 찾았으나 보이지 않습니다.`
              );
            }
          }
        } catch (error) {
          console.log(
            `선택자 '${selector}'로 버튼 클릭 시도 중 오류: ${error.message}`
          );
        }
      }

      // 2. CSS 선택자 시도 실패 시 XPath 사용 (최신 Playwright 문법으로)
      if (!clicked) {
        console.log(
          "CSS 선택자로 버튼을 찾을 수 없습니다. XPath로 시도합니다."
        );

        const xpaths = [
          "//button[contains(., 'Instagram')]",
          "//div[@role='button' and contains(., 'Instagram')]",
          "//a[contains(., 'Instagram')]",
          "//button[contains(text(), 'Instagram')]",
          "//a[contains(text(), 'Instagram')]",
          "//div[contains(text(), 'Instagram')]",
        ];

        for (const xpath of xpaths) {
          try {
            // 최신 Playwright XPath 문법 사용
            const locator = page.locator(`xpath=${xpath}`);
            const count = await locator.count();
            console.log(`XPath '${xpath}'로 찾은 요소: ${count}개`);

            if (count > 0) {
              for (let i = 0; i < Math.min(count, 3); i++) {
                // 최대 3개 요소만 시도
                const element = locator.nth(i);
                const isVisible = await element.isVisible();

                if (isVisible) {
                  console.log(
                    `XPath '${xpath}' (${
                      i + 1
                    }번째 요소)로 버튼을 찾았습니다. 클릭합니다.`
                  );
                  await element.click();

                  // 버튼 클릭 후 스크린샷
                  await page.waitForTimeout(2000);
                  await page.screenshot({
                    path: `after-instagram-button-xpath-${i + 1}.png`,
                  });
                  console.log(
                    `XPath로 '${
                      i + 1
                    }번째 Instagram으로 계속' 버튼 클릭 후 스크린샷이 저장되었습니다.`
                  );
                  clicked = true;
                  break;
                }
              }

              if (clicked) break;
            }
          } catch (error) {
            console.log(
              `XPath '${xpath}'로 버튼 클릭 시도 중 오류: ${error.message}`
            );
          }
        }
      }

      // 3. 텍스트 내용으로 모든 버튼 검색 (더 포괄적인 검색)
      if (!clicked) {
        console.log(
          "다양한 방법을 시도해도 버튼을 클릭할 수 없습니다. 텍스트 내용으로 찾아 직접 클릭을 시도합니다."
        );

        try {
          // 페이지의 모든 클릭 가능한 요소 가져오기
          const clickableSelectors = [
            "button",
            "a",
            '[role="button"]',
            'div[tabindex="0"]',
            'div[class*="x1i10hfl"]',
          ];

          for (const selector of clickableSelectors) {
            const elements = await page.$$(selector);
            console.log(
              `선택자 '${selector}'로 찾은 요소: ${elements.length}개`
            );

            // 각 요소의 내용 검사
            for (const element of elements) {
              if (await element.isVisible()) {
                const elementText = await element.evaluate(
                  (el) => el.textContent || ""
                );

                if (
                  elementText.includes("Instagram") ||
                  elementText.includes("인스타그램")
                ) {
                  // 버튼 관련 정보 출력
                  const elementHTML = await element.evaluate((el) =>
                    el.outerHTML.substring(0, 100)
                  );
                  console.log(
                    `Instagram 텍스트가 포함된 버튼 발견: ${elementText.substring(
                      0,
                      30
                    )}`
                  );
                  console.log(`버튼 HTML: ${elementHTML}...`);

                  // 클릭 시도
                  try {
                    await element.click();
                    console.log(
                      `텍스트 '${elementText.substring(
                        0,
                        20
                      )}'을 포함한 버튼을 클릭했습니다.`
                    );

                    // 버튼 클릭 후 스크린샷
                    await page.waitForTimeout(2000);
                    await page.screenshot({
                      path: "after-instagram-button-text-click.png",
                    });
                    console.log(
                      "텍스트 내용으로 'Instagram으로 계속' 버튼 클릭 후 스크린샷이 저장되었습니다."
                    );
                    clicked = true;
                    break;
                  } catch (clickError) {
                    console.log(
                      `버튼 클릭 실패. 다른 방법 시도: ${clickError.message}`
                    );

                    try {
                      // JavaScript로 직접 클릭 시도
                      await element.evaluate((el) => el.click());
                      console.log(
                        `JavaScript로 '${elementText.substring(
                          0,
                          20
                        )}'을 포함한 버튼을 클릭했습니다.`
                      );

                      // 버튼 클릭 후 스크린샷
                      await page.waitForTimeout(2000);
                      await page.screenshot({
                        path: "after-instagram-button-js-click.png",
                      });
                      console.log(
                        "JavaScript로 'Instagram으로 계속' 버튼 클릭 후 스크린샷이 저장되었습니다."
                      );
                      clicked = true;
                      break;
                    } catch (jsClickError) {
                      console.log(
                        `JavaScript 클릭도 실패: ${jsClickError.message}`
                      );
                      continue;
                    }
                  }
                }
              }
            }

            if (clicked) break;
          }
        } catch (error) {
          console.log(
            `텍스트 내용으로 버튼 찾기 시도 중 오류: ${error.message}`
          );
        }
      }

      // 4. 이미지 버튼을 찾아 클릭 시도
      if (!clicked) {
        console.log(
          "텍스트 버튼을 찾을 수 없습니다. 인스타그램 이미지 버튼을 찾아 클릭합니다."
        );

        try {
          // 인스타그램 로고 이미지 찾기
          const images = await page.$$("img");

          for (const img of images) {
            if (await img.isVisible()) {
              // 이미지 속성 확인
              const imgSrc = await img.evaluate(
                (el) => el.getAttribute("src") || ""
              );
              const imgAlt = await img.evaluate(
                (el) => el.getAttribute("alt") || ""
              );

              // 인스타그램 이미지인지 확인
              if (
                imgSrc.includes("instagram") ||
                imgAlt.includes("Instagram") ||
                imgAlt.includes("인스타그램")
              ) {
                console.log(
                  `인스타그램 이미지 발견: ${imgSrc.substring(0, 50)}...`
                );

                // 이미지 클릭 시도
                try {
                  // 이미지 자체 클릭
                  await img.click();
                  console.log("인스타그램 이미지를 클릭했습니다.");
                  clicked = true;
                } catch (imgClickError) {
                  console.log(`이미지 클릭 실패: ${imgClickError.message}`);

                  // 이미지 부모 요소 클릭 시도
                  try {
                    await page.evaluate((img) => {
                      // 부모 요소 찾기
                      let parent = img.parentElement;
                      let level = 0;

                      // 3단계 부모까지만 시도
                      while (parent && level < 3) {
                        try {
                          parent.click();
                          return true;
                        } catch (e) {
                          parent = parent.parentElement;
                          level++;
                        }
                      }
                      return false;
                    }, img);

                    console.log(
                      "인스타그램 이미지의 부모 요소를 클릭했습니다."
                    );
                    clicked = true;
                  } catch (parentClickError) {
                    console.log(
                      `이미지 부모 클릭 실패: ${parentClickError.message}`
                    );
                  }
                }

                if (clicked) {
                  await page.waitForTimeout(2000);
                  await page.screenshot({
                    path: "after-instagram-image-click.png",
                  });
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.log(`이미지 버튼 찾기 중 오류: ${error.message}`);
        }
      }

      // 모든 방법 실패 시 메시지 출력
      if (!clicked) {
        console.error(
          "모든 방법으로 'Instagram으로 계속' 버튼을 클릭할 수 없습니다. 스크린샷을 확인하세요."
        );
      }
    } else {
      console.log("'Instagram으로 계속' 버튼이 감지되지 않았습니다.");
    }
  } catch (error) {
    console.error("'Instagram으로 계속' 버튼 처리 중 오류:", error);
  }
}

// 쓰레드 로그인 상태 확인 함수 개선
async function checkThreadsLoggedIn(page) {
  try {
    // 현재 URL 확인
    const currentUrl = page.url();
    console.log(`로그인 상태 확인 중... 현재 URL: ${currentUrl}`);

    // 스크린샷 저장
    await page.screenshot({ path: "login-status-check.png" });

    // 페이지 HTML 내용 가져오기
    const pageContent = await page.content();
    fs.writeFileSync("threads-login-check-html.txt", pageContent);
    console.log(
      "현재 페이지 HTML을 저장했습니다: threads-login-check-html.txt"
    );

    // 로그인 상태 확인을 위한 여러 지표 분석
    const hasLoginButton =
      pageContent.includes("로그인") ||
      pageContent.includes("Login") ||
      pageContent.includes("Sign in");

    const hasLogoutOption =
      pageContent.includes("로그아웃") ||
      pageContent.includes("Logout") ||
      pageContent.includes("Log out");

    const hasProfileElements =
      pageContent.includes("프로필") ||
      pageContent.includes("Profile") ||
      pageContent.includes("계정");

    // 피드 요소 확인 (로그인된 상태일 때만 표시됨)
    const hasFeedElements =
      pageContent.includes("피드") ||
      pageContent.includes("Feed") ||
      pageContent.includes("홈") ||
      pageContent.includes("Home");

    // 작성 버튼 확인 (로그인된 상태일 때만 표시됨)
    const hasCreateButton =
      pageContent.includes("만들기") ||
      pageContent.includes("Create") ||
      pageContent.includes("New") ||
      pageContent.includes("글쓰기") ||
      pageContent.includes("Post");

    // 알림 요소 확인 (로그인된 상태일 때만 표시됨)
    const hasNotificationElements =
      pageContent.includes("알림") ||
      pageContent.includes("Notification") ||
      pageContent.includes("Activity");

    // Instagram 로그인 페이지나 계정 선택 화면인지 확인
    const isInstagramLoginPage =
      currentUrl.includes("instagram.com") &&
      (currentUrl.includes("login") ||
        pageContent.includes("로그인") ||
        pageContent.includes("Login"));

    const isAccountSelectionPage =
      pageContent.includes("Threads로 이동") ||
      pageContent.includes("Move to Threads") ||
      pageContent.includes("계정 선택") ||
      pageContent.includes("다른 Instagram 계정으로");

    // UI 요소를 사용한 추가 로그인 상태 확인
    let hasProfileIcon = false;
    let hasMainNavigation = false;
    let hasSearchBox = false;

    try {
      // 프로필 아이콘 확인 (로그인된 상태에서만 나타남)
      hasProfileIcon = await page.isVisible(
        'a[href*="profile"], [aria-label*="profile"], [aria-label*="프로필"]'
      );
      console.log(`프로필 아이콘 존재 여부: ${hasProfileIcon}`);

      // 메인 네비게이션 확인
      hasMainNavigation = await page.isVisible('nav, [role="navigation"]');
      console.log(`메인 네비게이션 존재 여부: ${hasMainNavigation}`);

      // 검색 상자 확인 (로그인된 상태에서만 나타남)
      hasSearchBox = await page.isVisible(
        '[placeholder*="Search"], [placeholder*="검색"], [aria-label*="Search"], [aria-label*="검색"]'
      );
      console.log(`검색 상자 존재 여부: ${hasSearchBox}`);
    } catch (error) {
      console.log(`UI 요소 확인 중 오류: ${error.message}`);
    }

    // 로그인 상태 평가 (복합적인 조건 사용)
    if (isInstagramLoginPage || isAccountSelectionPage) {
      console.log(
        "Instagram 로그인 페이지 또는 계정 선택 화면이 감지되었습니다. 아직 로그인되지 않았습니다."
      );
      return false;
    }

    // 로그인 실패 조건 (로그인 버튼 있고, 로그인 상태 요소 없음)
    if (
      hasLoginButton &&
      !hasLogoutOption &&
      !hasProfileElements &&
      !hasProfileIcon
    ) {
      console.log(
        "로그인 버튼이 감지되었고 로그인 상태 요소가 없습니다. 로그인되지 않은 상태입니다."
      );
      return false;
    }

    // 로그인 성공 조건 (로그인된 상태에서만 나타나는 여러 요소 확인)
    if (
      hasLogoutOption ||
      hasProfileIcon ||
      (hasMainNavigation &&
        (hasProfileElements || hasFeedElements || hasNotificationElements))
    ) {
      console.log("로그인 상태 요소가 감지되었습니다. 로그인된 상태입니다.");
      return true;
    }

    // 검색 상자나 CREATE 버튼도 로그인된 상태를 나타낼 수 있음
    if (hasSearchBox || hasCreateButton) {
      console.log(
        "검색 상자 또는 만들기 버튼이 감지되었습니다. 로그인된 상태로 추정합니다."
      );
      return true;
    }

    // threads.net 도메인에 있고 로그인 버튼이 없으면 로그인된 것으로 가정
    if (currentUrl.includes("threads.net") && !hasLoginButton) {
      console.log(
        "threads.net 도메인에 있고 로그인 버튼이 없습니다. 로그인된 것으로 추정합니다."
      );
      return true;
    }

    // 위의 조건에 해당하지 않는 경우 보수적으로 로그인되지 않은 것으로 판단
    console.log(
      "로그인 상태를 확신할 수 없습니다. 로그인되지 않은 것으로 간주합니다."
    );
    return false;
  } catch (error) {
    console.error(`로그인 상태 확인 중 오류 발생: ${error.message}`);
    return false;
  }
}

// 쓰레드 로그인 함수: 계정 선택 화면을 처리하는 로직 포함
async function loginToThreads(page, config) {
  console.log("쓰레드 로그인 프로세스 시작...");

  try {
    // 초기 스크린샷
    await page.screenshot({ path: "login-process-start.png" });

    // 현재 URL 확인
    const initialUrl = page.url();
    console.log(`시작 URL: ${initialUrl}`);

    let maxAttempts = 3;
    let attempts = 0;
    let isLoggedIn = false;

    // 로그인 상태 확인
    isLoggedIn = await checkThreadsLoggedIn(page);
    if (isLoggedIn) {
      console.log("✅ 이미 로그인 상태입니다!");
      return true;
    }

    // 로그인 시도 반복
    while (!isLoggedIn && attempts < maxAttempts) {
      attempts++;
      console.log(`\n⭐ 로그인 시도 ${attempts}/${maxAttempts}...`);

      // 현재 URL 및 페이지 상태 분석
      const currentUrl = page.url();
      console.log(`현재 URL: ${currentUrl}`);

      const pageContent = await page.content();

      // 1. 쓰레드 메인 화면에서 "Instagram으로 계속" 버튼 존재 확인
      const hasInstagramButton =
        pageContent.includes("Instagram으로 계속") ||
        pageContent.includes("Continue with Instagram");

      // 2. SSO 페이지(계정 선택 화면)에 있는지 확인
      const isOnSsoPage = currentUrl.includes("instagram.com/threads/sso");

      // 3. 로그인 폼에 있는지 확인
      const hasLoginForm = await page.isVisible(
        'input[name="username"], input[type="password"]'
      );

      console.log(
        `📊 진단: "Instagram으로 계속" 버튼 존재: ${
          hasInstagramButton ? "예 ✓" : "아니오 ✗"
        }`
      );
      console.log(
        `📊 진단: SSO 계정 선택 페이지: ${isOnSsoPage ? "예 ✓" : "아니오 ✗"}`
      );
      console.log(
        `📊 진단: 로그인 폼 존재: ${hasLoginForm ? "예 ✓" : "아니오 ✗"}`
      );

      // 단계별 처리
      if (hasInstagramButton) {
        // 1단계: "Instagram으로 계속" 버튼 클릭
        console.log("🔍 'Instagram으로 계속' 버튼을 클릭합니다...");
        await page.screenshot({
          path: `instagram-button-before-${attempts}.png`,
        });

        const buttonSuccess = await handleContinueWithInstagram(page);
        console.log(
          `📊 Instagram 버튼 클릭 ${buttonSuccess ? "성공 ✓" : "실패 ✗"}`
        );

        await page.waitForTimeout(10000);
        await page.screenshot({
          path: `instagram-button-after-${attempts}.png`,
        });

        // URL 체크하여 SSO 페이지로 이동했는지 확인
        const newUrl = page.url();
        if (newUrl.includes("instagram.com/threads/sso")) {
          console.log("✅ SSO 계정 선택 페이지로 이동 성공!");
        } else {
          console.log("⚠️ 예상치 못한 URL로 이동했습니다:", newUrl);
        }
      } else if (isOnSsoPage) {
        // 2단계: SSO 페이지에서 계정 선택
        console.log("🔍 SSO 페이지에서 계정을 선택합니다...");
        await page.screenshot({
          path: `account-selection-before-${attempts}.png`,
        });

        const accountSuccess = await handleAccountSelection(
          page,
          config.username
        );
        console.log(`📊 계정 선택 ${accountSuccess ? "성공 ✓" : "실패 ✗"}`);

        await page.waitForTimeout(5000);
        await page.screenshot({
          path: `account-selection-after-${attempts}.png`,
        });

        // 로그인 상태 확인
        isLoggedIn = await checkThreadsLoggedIn(page);
        if (isLoggedIn) {
          console.log("🎉 계정 선택 후 로그인 성공!");
          break;
        }

        // 계정 선택 실패 시 쓰레드 메인으로 강제 이동 시도
        if (!accountSuccess && attempts < maxAttempts) {
          console.log(
            "🔄 계정 선택 실패. 쓰레드 메인으로 이동 후 다시 시도합니다."
          );
          await page.goto("https://www.threads.net/");
          await page.waitForTimeout(5000);
        }
      } else if (hasLoginForm) {
        // 3단계: 로그인 폼 처리
        console.log("🔍 로그인 폼에 사용자 정보를 입력합니다...");
        await page.screenshot({ path: `login-form-before-${attempts}.png` });

        // 사용자명 입력
        await page.fill(
          'input[name="username"], input[type="text"]',
          config.username
        );
        console.log(`✅ 사용자명 '${config.username}' 입력 완료`);

        // 비밀번호 입력
        await page.fill(
          'input[name="password"], input[type="password"]',
          config.password
        );
        console.log("✅ 비밀번호 입력 완료");

        // 로그인 버튼 클릭
        await page.click(
          'button[type="submit"], button:has-text("로그인"), button:has-text("Login")'
        );
        console.log("✅ 로그인 버튼 클릭 완료");

        await page.waitForTimeout(10000);
        await page.screenshot({ path: `login-form-after-${attempts}.png` });
      } else {
        // 알 수 없는 상태 - 쓰레드 메인으로 이동
        console.log(
          "⚠️ 알 수 없는 페이지 상태입니다. 쓰레드 메인으로 이동합니다."
        );
        await page.goto("https://www.threads.net/");
        await page.waitForTimeout(5000);
      }

      // 각 시도 후 로그인 상태 확인
      isLoggedIn = await checkThreadsLoggedIn(page);
      console.log(
        `📊 현재 로그인 상태: ${
          isLoggedIn ? "로그인됨 ✓" : "로그인되지 않음 ✗"
        }`
      );

      // 로그인 성공 시 처리
      if (isLoggedIn) {
        console.log("🎉 로그인 성공!");
        await page.screenshot({ path: "login-success.png" });

        // 쿠키 저장
        console.log("📣 로그인 쿠키 저장 중...");
        await saveCookies(page.context(), "instagram_cookies.json");
        return true;
      }
    }

    if (!isLoggedIn) {
      console.log(
        `❌ 최대 시도 횟수(${maxAttempts})에 도달했습니다. 로그인 실패.`
      );
      await page.screenshot({ path: "login-failure.png" });
    }

    return isLoggedIn;
  } catch (error) {
    console.error(`❌ 로그인 프로세스 중 오류: ${error.message}`);
    await page.screenshot({ path: "login-error.png" });
    return false;
  }
}

async function main() {
  try {
    // 커맨드 라인 인자 파싱
    parseCommandLineArgs();

    // 댓글 링크가 기본값인 경우만 사용자에게 물어봄
    if (config.commentLink === "여기 확인해보세요: https://example.com") {
      const userLink = await getUserInput("댓글로 달 링크를 입력하세요: ");
      if (userLink && userLink.trim()) {
        // 'PS C:' 등의 명령어 프롬프트 텍스트가 포함된 경우 제거
        if (userLink.includes("PS C:") || userLink.includes("npm start")) {
          console.log(
            "입력값에 명령어가 포함되어 있습니다. 기본값을 사용합니다."
          );
        } else {
          config.commentLink = userLink.trim();
        }
      }
    } else {
      console.log(`저장된 댓글 내용을 사용합니다: "${config.commentLink}"`);

      // 변경 원할 경우 안내
      const changeComment = await getUserInput(
        "이 댓글 내용을 변경하시겠습니까? (y/n, 기본값: n): "
      );
      if (changeComment && changeComment.toLowerCase() === "y") {
        const newComment = await getUserInput("새 댓글 내용을 입력하세요: ");
        if (newComment && newComment.trim()) {
          config.commentLink = newComment.trim();
          console.log(
            `댓글 내용이 업데이트되었습니다: "${config.commentLink}"`
          );
        }
      }
    }

    // 대상 URL이 없는 경우 사용자에게 물어볼 수 있음
    let profileUrl = config.lastProfileUrl;
    let isProfileMode = false;

    if (!config.targetPostUrl && !profileUrl) {
      const userUrl = await getUserInput(
        "특정 게시물 또는 프로필 URL을 입력하세요 (없으면 엔터): "
      );

      // 입력값이 있는 경우만 처리
      if (userUrl && userUrl.trim()) {
        // 'PS C:' 등의 명령어 프롬프트 텍스트가 포함된 경우 무시
        if (userUrl.includes("PS C:") || userUrl.includes("npm start")) {
          console.log("입력값에 명령어가 포함되어 있습니다. URL을 무시합니다.");
        }
        // URL 검증
        else if (isValidUrl(userUrl.trim())) {
          const urlType = getUrlType(userUrl.trim());

          if (urlType === "profile") {
            console.log(
              "프로필 URL이 감지되었습니다. 최근 게시글을 찾아 댓글을 작성합니다."
            );
            profileUrl = userUrl.trim();
            config.lastProfileUrl = profileUrl; // 프로필 URL 저장
            isProfileMode = true;
          } else if (urlType === "post") {
            console.log(
              "게시물 URL이 감지되었습니다. 해당 게시물에 댓글을 작성합니다."
            );
            config.targetPostUrl = userUrl.trim();
          } else {
            console.log(
              "인식할 수 없는 URL 형식입니다. 자신의 프로필을 탐색합니다."
            );
          }
        } else {
          console.log(
            "유효하지 않은 URL입니다. 자동으로 프로필 페이지를 탐색합니다."
          );
        }
      }
    } else {
      // 저장된 URL 사용
      if (config.targetPostUrl) {
        console.log(`저장된 게시물 URL을 사용합니다: ${config.targetPostUrl}`);
        // URL 검증 생략 (이미 저장된 URL은 검증됨)
      } else if (profileUrl) {
        console.log(`저장된 프로필 URL을 사용합니다: ${profileUrl}`);
        isProfileMode = true;
      }

      // 변경 원할 경우 안내
      const changeUrl = await getUserInput(
        "이 URL을 변경하시겠습니까? (y/n, 기본값: n): "
      );
      if (changeUrl && changeUrl.toLowerCase() === "y") {
        const newUrl = await getUserInput("새 URL을 입력하세요: ");
        if (newUrl && newUrl.trim() && isValidUrl(newUrl.trim())) {
          const urlType = getUrlType(newUrl.trim());
          if (urlType === "profile") {
            profileUrl = newUrl.trim();
            config.lastProfileUrl = profileUrl;
            config.targetPostUrl = null;
            isProfileMode = true;
            console.log(`프로필 URL이 업데이트되었습니다: ${profileUrl}`);
          } else if (urlType === "post") {
            config.targetPostUrl = newUrl.trim();
            config.lastProfileUrl = null;
            profileUrl = null;
            isProfileMode = false;
            console.log(
              `게시물 URL이 업데이트되었습니다: ${config.targetPostUrl}`
            );
          }
        } else {
          console.log("유효하지 않은 URL입니다. 기존 URL을 유지합니다.");
        }
      }
    }

    // 설정 저장
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("설정이 저장되었습니다.");

    console.log("=== 자동화 설정 ===");
    console.log("계정:", config.username);
    console.log("댓글:", config.commentLink);
    if (isProfileMode) {
      console.log("대상 모드: 프로필에서 최근 게시글 찾기");
      console.log(
        "프로필 URL:",
        profileUrl || `https://www.threads.net/@${config.username}`
      );
    } else {
      console.log(
        "대상 URL:",
        config.targetPostUrl || "자신의 프로필 페이지 탐색"
      );
    }
    console.log("===================");

    // 브라우저 시작 - 지속적인 컨텍스트 유지를 위한 설정
    const browser = await chromium.launch({
      headless: false, // 브라우저를 화면에 표시
      slowMo: 250, // 작업 간 지연 시간 (더 느리게 설정)
    });

    // 지속적인 컨텍스트와 스토리지 상태를 유지하기 위한 설정
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
    });

    // 저장된 쿠키 불러오기 시도
    const cookiesLoaded = await loadCookies(context, "instagram_cookies.json");

    const page = await context.newPage();

    try {
      // 1. 인스타그램 로그인 처리
      let isLoggedIn = false;

      // 인스타그램 메인 페이지로 먼저 접속
      await page.goto("https://www.instagram.com/");
      console.log("인스타그램 메인 페이지에 접속했습니다.");

      // 페이지 로딩 대기
      await page.waitForTimeout(3000);

      // 로그인 상태 확인
      isLoggedIn = await checkInstagramLoggedIn(page);

      // 로그인 필요시 로그인 진행
      if (!isLoggedIn) {
        console.log("인스타그램에 로그인이 필요합니다.");

        // 로그인 버튼 클릭 또는 로그인 페이지로 이동
        if (await page.isVisible('a[href="/accounts/login/"]')) {
          await page.click('a[href="/accounts/login/"]');
        } else {
          await page.goto("https://www.instagram.com/accounts/login/");
        }
        console.log("로그인 페이지로 이동했습니다.");

        // 로그인 폼 대기
        await page.waitForSelector('input[name="username"]', {
          timeout: 30000,
        });

        // 로그인 폼 입력
        await page.fill('input[name="username"]', config.username);
        await page.fill('input[name="password"]', config.password);
        console.log("로그인 정보를 입력했습니다.");

        // 로그인 버튼 클릭
        await page.click('button[type="submit"]');
        console.log("로그인 버튼을 클릭했습니다.");

        // 페이지 변경 대기
        await page.waitForTimeout(5000);

        // 보안 인증 확인
        const securityCheckNeeded = await handleSecurityCheck(page);
        if (securityCheckNeeded) {
          console.log("보안 인증을 처리했습니다.");
          await page.waitForTimeout(5000);
        }

        // "나중에 하기" 버튼 처리
        try {
          if (
            await page.isVisible(
              'button:has-text("나중에 하기"), button:has-text("Not Now")'
            )
          ) {
            await page.click(
              'button:has-text("나중에 하기"), button:has-text("Not Now")'
            );
            console.log("'나중에 하기' 버튼을 클릭했습니다.");
            await page.waitForTimeout(2000);
          }
        } catch (error) {
          console.log("'나중에 하기' 버튼 처리 중 오류:", error.message);
        }

        // 쿠키 저장
        await saveCookies(context, "instagram_cookies.json");

        // 로그인 상태 다시 확인
        isLoggedIn = await checkInstagramLoggedIn(page);
      }

      if (isLoggedIn) {
        console.log("인스타그램에 성공적으로 로그인되었습니다.");
      } else {
        console.log(
          "인스타그램 로그인에 문제가 있을 수 있습니다. 계속 진행합니다."
        );
      }

      // 인스타그램 상태 스크린샷 저장
      try {
        await page.screenshot({ path: "instagram-status.png" });
        console.log("인스타그램 상태 스크린샷을 저장했습니다.");
      } catch (error) {
        console.log("스크린샷 저장 실패:", error.message);
      }

      // 2. 쓰레드로 이동
      console.log("쓰레드로 이동을 시작합니다...");
      await page.goto("https://www.threads.net/");
      console.log("쓰레드에 접속했습니다.");

      // 쓰레드 로그인 성공 여부 추적
      let threadLoginSuccess = false;

      // 충분한 로딩 시간
      await page.waitForTimeout(5000);
      await page.screenshot({ path: "threads-initial-page.png" });
      console.log("쓰레드 초기 페이지 스크린샷을 저장했습니다.");

      // HTML 구조 분석 및 로깅
      const htmlContent = await page.content();
      fs.writeFileSync("threads-page-html.txt", htmlContent);
      console.log("쓰레드 페이지 HTML 구조를 저장했습니다.");

      // 현재 URL 확인
      console.log("현재 페이지 URL:", page.url());

      // 쓰레드 페이지 스크린샷
      await page.screenshot({ path: "threads-initial.png" });

      // 계정 선택 관련 키워드 확인
      const isAccountSelectionPage =
        htmlContent.includes("계정을 선택") ||
        htmlContent.includes("Choose an account") ||
        htmlContent.includes("Continue as") ||
        htmlContent.includes("계속 진행");

      // "Instagram으로 계속" 버튼 관련 키워드 확인
      const hasInstagramContinueButton =
        htmlContent.includes("Instagram으로 계속") ||
        htmlContent.includes("Continue with Instagram");

      if (hasInstagramContinueButton) {
        console.log("'Instagram으로 계속' 버튼이 발견되었습니다.");

        // Instagram으로 계속 버튼 처리 함수 호출
        await handleContinueWithInstagram(page);
        await page.waitForTimeout(5000); // 버튼 클릭 후 충분한 대기시간
      } else {
        // 기존 버튼 처리 코드는 스킵 (중복 방지)
        console.log("'Instagram으로 계속' 버튼이 발견되지 않았습니다.");
      }

      if (isAccountSelectionPage) {
        console.log("계정 선택 화면이 감지되었습니다.");

        // 계정 선택 함수 호출
        await handleAccountSelection(page, config.username);
        await page.waitForTimeout(3000); // 계정 선택 후 충분한 대기시간
      } else {
        // 기존 계정 선택 처리 코드는 스킵 (중복 방지)
        console.log("계정 선택 화면이 감지되지 않았습니다.");
      }

      // 일반적인 로그인 처리 시도
      if (await page.isVisible('a[href="/login?show_choice_screen=false"]')) {
        console.log("쓰레드에 로그인이 필요합니다. 로그인 링크를 클릭합니다.");
        await page.screenshot({ path: "before-login-link.png" });
        await page.click('a[href="/login?show_choice_screen=false"]');
        console.log("로그인 링크를 클릭했습니다.");

        // 로그인 처리 대기
        await page.waitForTimeout(8000);

        // 로그인 프로세스 스크린샷
        await page.screenshot({ path: "threads-login-process.png" });
        console.log("로그인 프로세스 화면 스크린샷을 저장했습니다.");

        // 로그인 완료 여부 확인
        await page.waitForTimeout(5000);
        await page.screenshot({ path: "after-login-process.png" });

        // 로그인 상태 확인 (URL에 login이 없으면 로그인된 것으로 간주)
        threadLoginSuccess = !page.url().includes("/login");
        console.log(
          "쓰레드 로그인 상태:",
          threadLoginSuccess ? "성공" : "실패"
        );
      } else {
        console.log("쓰레드에 이미 로그인된 상태입니다.");
        threadLoginSuccess = true;
        await page.screenshot({ path: "threads-already-logged-in.png" });
      }

      // 계정 선택 화면 확인 (로그인 이후에도 나타날 수 있음)
      try {
        // 모든 페이지 요소 검사
        const pageHtml = await page.content();
        fs.writeFileSync("current-page-html.txt", pageHtml);
        console.log("현재 페이지 HTML을 저장했습니다.");

        // 인스타그램 로그인 화면이 다시 나타날 경우
        if (page.url().includes("instagram.com/accounts/login")) {
          console.log("인스타그램 로그인 화면으로 이동했습니다.");
          await page.screenshot({ path: "instagram-login-redirect.png" });

          // 로그인 폼 확인
          if (await page.isVisible('input[name="username"]')) {
            // 로그인 폼 입력
            await page.fill('input[name="username"]', config.username);
            await page.fill('input[name="password"]', config.password);
            console.log("로그인 정보를 다시 입력했습니다.");
            await page.screenshot({ path: "instagram-login-form-filled.png" });

            // 로그인 버튼 클릭
            await page.click('button[type="submit"]');
            console.log("로그인 버튼을 클릭했습니다.");

            // 페이지 변경 대기
            await page.waitForTimeout(5000);
            await page.screenshot({ path: "after-instagram-login.png" });
          } else {
            console.log("이미 인스타그램에 로그인된 상태입니다.");
            await page.screenshot({ path: "instagram-already-logged-in.png" });
          }

          // 쓰레드로 다시 이동
          await page.goto("https://www.threads.net/");
          console.log("쓰레드로 다시 이동했습니다.");
          await page.waitForTimeout(5000);
          await page.screenshot({ path: "threads-after-redirect.png" });
        }

        // 계정 선택 관련 키워드 확인
        const isAccountSelectionPage =
          pageHtml.includes("계정을 선택") ||
          pageHtml.includes("Choose an account") ||
          pageHtml.includes("Continue as") ||
          pageHtml.includes("계속 진행");

        if (isAccountSelectionPage) {
          console.log("계정 선택 화면으로 추정됩니다. 모든 버튼을 확인합니다.");
          await page.screenshot({ path: "account-selection-screen.png" });

          // 모든 버튼 찾기
          const allButtons = await page.$$('button, [role="button"]');
          console.log(
            `계정 선택 화면에서 ${allButtons.length}개의 버튼/상호작용 요소를 찾았습니다.`
          );

          // 각 버튼 분석 및 클릭 시도
          let clicked = false;
          for (const button of allButtons) {
            try {
              // 버튼 정보 수집
              const buttonText = await button.evaluate((btn) =>
                btn.textContent.trim()
              );
              const buttonHTML = await button.evaluate((btn) =>
                btn.outerHTML.substring(0, 150)
              );
              const buttonVisible = await button.isVisible();

              console.log(
                `버튼 텍스트: "${buttonText}", 보임 상태: ${buttonVisible}`
              );
              console.log(`버튼 HTML: ${buttonHTML}...`);

              // 계정 연결된 버튼 확인
              if (
                buttonVisible &&
                (buttonText.includes(config.username) ||
                  buttonText.includes("dorar.ing") ||
                  buttonText.includes("계속") ||
                  buttonText.includes("Continue"))
              ) {
                console.log(`계정 관련 버튼을 찾았습니다: "${buttonText}"`);
                await page.screenshot({
                  path: "before-account-button-click.png",
                });

                await button.click();
                console.log(`"${buttonText}" 버튼을 클릭했습니다.`);
                clicked = true;

                await page.waitForTimeout(5000);
                await page.screenshot({
                  path: "after-account-button-click.png",
                });
                break;
              }
            } catch (error) {
              console.log("버튼 분석 중 오류:", error.message);
            }
          }

          // 클릭에 실패한 경우 재시도
          if (!clicked) {
            console.log(
              "계정 선택 버튼을 찾지 못했습니다. 첫 번째 버튼을 시도합니다."
            );

            try {
              // 첫 번째 보이는 버튼 클릭
              const visibleButtons = await page.$$(
                'button:visible, [role="button"]:visible'
              );
              if (visibleButtons.length > 0) {
                await visibleButtons[0].click();
                console.log("첫 번째 보이는 버튼을 클릭했습니다.");
                await page.waitForTimeout(5000);
                await page.screenshot({
                  path: "after-first-visible-button.png",
                });
              }
            } catch (error) {
              console.log("첫 번째 버튼 클릭 실패:", error.message);
            }
          }
        }
      } catch (error) {
        console.log("계정 선택 화면 처리 중 오류:", error.message);
      }

      // 최종 쓰레드 페이지 스크린샷
      await page.screenshot({ path: "threads-logged-in.png" });

      // 로그인에 실패했으면 오류 표시
      if (!threadLoginSuccess) {
        console.log(
          "쓰레드 로그인에 실패했습니다. 수동으로 로그인해야 할 수 있습니다."
        );
        throw new Error("쓰레드 로그인 실패");
      }

      // 3. 댓글 작업 수행
      console.log("댓글 작업을 시작합니다...");

      if (config.targetPostUrl) {
        // 특정 게시물로 이동
        await page.goto(config.targetPostUrl);
        console.log("지정된 게시물로 이동했습니다:", config.targetPostUrl);
        await page.waitForTimeout(3000);
      } else {
        // 프로필로 이동 - 사용자가 지정한 프로필 또는 기본 프로필
        const targetProfileUrl =
          profileUrl || `https://www.threads.net/@${config.username}`;
        await page.goto(targetProfileUrl);
        console.log(`프로필로 이동했습니다: ${targetProfileUrl}`);

        // 프로필 페이지 로딩 대기
        await page.waitForTimeout(8000);

        // 프로필 페이지 스크린샷
        await page.screenshot({ path: "profile-page.png" });

        // 게시물 찾기
        console.log("프로필 페이지에서 게시물을 찾고 있습니다...");

        // 게시물 요소 선택자 (좀 더 넓은 범위의 선택자 사용)
        const postSelectors = [
          "article",
          "[role='article']",
          ".x1j85h84", // 쓰레드 게시물의 클래스명 중 하나
        ];

        let posts = [];

        // 여러 선택자로 게시물 찾기 시도
        for (const selector of postSelectors) {
          posts = await page.$$(selector);
          if (posts.length > 0) {
            console.log(
              `'${selector}' 선택자로 ${posts.length}개의 게시물을 찾았습니다.`
            );
            break;
          }
        }

        if (posts.length === 0) {
          // 스크롤을 내려 더 많은 게시물 로드 시도
          console.log(
            "게시물을 찾을 수 없어 스크롤을 통해 컨텐츠를 로드합니다..."
          );
          await page.evaluate(() => window.scrollBy(0, 500));
          await page.waitForTimeout(3000);

          // 다시 게시물 찾기 시도
          for (const selector of postSelectors) {
            posts = await page.$$(selector);
            if (posts.length > 0) {
              console.log(
                `스크롤 후 '${selector}' 선택자로 ${posts.length}개의 게시물을 찾았습니다.`
              );
              break;
            }
          }
        }

        if (posts.length > 0) {
          // 첫 번째 게시물 클릭
          await posts[0].click();
          console.log("최근 게시물을 클릭했습니다.");
          await page.waitForTimeout(5000); // 더 긴 대기 시간 설정
        } else {
          throw new Error(
            "게시물을 찾을 수 없습니다. 프로필에 게시물이 있는지 확인하세요."
          );
        }
      }

      // 게시물 페이지 스크린샷
      await page.screenshot({ path: "post-page.png" });

      // 현재 URL 저장
      const postUrl = page.url();
      console.log("게시물 URL:", postUrl);

      // 댓글 입력 필드 찾기를 위한 다양한 선택자
      const selectors = [
        'textarea[placeholder*="댓글"]',
        'textarea[aria-label*="댓글"]',
        'textarea[placeholder*="Comment"]',
        'textarea[aria-label*="Comment"]',
        'textarea[placeholder*="Reply"]',
        'textarea[aria-label*="Reply"]',
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        "form textarea",
        'form input[type="text"]',
      ];

      // 페이지가 완전히 로드될 때까지 대기
      await page.waitForTimeout(5000);

      // 댓글 입력 필드 찾기
      console.log("댓글 입력 필드를 찾는 중...");
      let commentInput = null;

      // 기본 선택자로 시도
      for (const selector of selectors) {
        commentInput = await page.$(selector);
        if (commentInput) {
          console.log(`댓글 입력 필드를 찾았습니다: ${selector}`);
          break;
        }
      }

      // 기본 선택자로 찾지 못한 경우 DOM 구조 분석
      if (!commentInput) {
        console.log(
          "기본 선택자로 댓글 입력 필드를 찾지 못했습니다. DOM 구조를 분석합니다..."
        );

        // 모든 인터랙티브 요소 확인
        const interactiveElements = await page.$$(
          'button, textarea, input, [role="button"], [role="textbox"], [contenteditable="true"]'
        );
        console.log(
          `페이지에서 ${interactiveElements.length}개의 인터랙티브 요소를 찾았습니다.`
        );

        for (const element of interactiveElements) {
          // 요소의 역할, 라벨, 텍스트 등 확인
          const elementInfo = await element.evaluate((el) => ({
            tagName: el.tagName.toLowerCase(),
            role: el.getAttribute("role"),
            ariaLabel: el.getAttribute("aria-label"),
            placeholder: el.getAttribute("placeholder"),
            text: el.textContent.trim(),
            isVisible:
              el.offsetWidth > 0 &&
              el.offsetHeight > 0 &&
              getComputedStyle(el).visibility !== "hidden",
          }));

          // 댓글 관련 요소 탐지
          if (elementInfo.isVisible) {
            const isCommentField =
              elementInfo.role === "textbox" ||
              (elementInfo.ariaLabel &&
                (elementInfo.ariaLabel.includes("댓글") ||
                  elementInfo.ariaLabel.includes("Comment") ||
                  elementInfo.ariaLabel.includes("Reply"))) ||
              (elementInfo.placeholder &&
                (elementInfo.placeholder.includes("댓글") ||
                  elementInfo.placeholder.includes("Comment") ||
                  elementInfo.placeholder.includes("Reply"))) ||
              elementInfo.tagName === "textarea";

            if (isCommentField) {
              commentInput = element;
              console.log(
                `DOM 분석을 통해 댓글 입력 필드를 찾았습니다:`,
                elementInfo
              );
              break;
            }
          }
        }

        // 여전히 댓글 입력 필드를 찾지 못한 경우 댓글 버튼 클릭 시도
        if (!commentInput) {
          console.log(
            "댓글 입력 필드를 찾지 못했습니다. 댓글 버튼을 찾아 클릭합니다..."
          );

          // 댓글 버튼 찾기
          const commentButtonSelectors = [
            '[aria-label*="댓글"]',
            '[aria-label*="Comment"]',
            '[aria-label*="Reply"]',
            'svg[aria-label*="댓글"]',
            'svg[aria-label*="Comment"]',
            'button:has(svg[aria-label*="Comment"])',
            'button:has(svg[aria-label*="댓글"])',
          ];

          for (const buttonSelector of commentButtonSelectors) {
            const commentButton = await page.$(buttonSelector);
            if (commentButton) {
              console.log(`댓글 버튼을 찾았습니다: ${buttonSelector}`);
              await commentButton.click();
              console.log("댓글 버튼을 클릭했습니다.");

              // 댓글 입력 필드가 나타날 때까지 대기
              await page.waitForTimeout(2000);

              // 다시 댓글 입력 필드 찾기 시도
              for (const selector of selectors) {
                commentInput = await page.$(selector);
                if (commentInput) {
                  console.log(
                    `댓글 버튼 클릭 후 입력 필드를 찾았습니다: ${selector}`
                  );
                  break;
                }
              }

              if (commentInput) break;
            }
          }
        }
      }

      // 댓글 입력 필드를 찾지 못한 경우 스크린샷 저장
      if (!commentInput) {
        const screenshotPath = path.join(__dirname, "error-screenshot.png");
        await page.screenshot({ path: screenshotPath });
        throw new Error(
          `댓글 입력 필드를 찾지 못했습니다. 스크린샷이 저장되었습니다: ${screenshotPath}`
        );
      }

      // 댓글 입력
      console.log("댓글을 입력합니다...");
      try {
        // 방법 1: fill 메소드 사용 (가장 선호되는 방법)
        await commentInput.fill(config.commentLink);
      } catch (fillError) {
        console.log("fill 메소드 실패, type 메소드 시도:", fillError.message);
        try {
          // 방법 2: type 메소드 사용
          await commentInput.click({ clickCount: 3 }); // 현재 내용 전체 선택
          await commentInput.type(config.commentLink);
        } catch (typeError) {
          console.log(
            "type 메소드 실패, evaluate 메소드 시도:",
            typeError.message
          );
          try {
            // 방법 3: evaluate 메소드 사용 (contenteditable 요소 등에 유용)
            await commentInput.evaluate((el, comment) => {
              if (
                el.tagName.toLowerCase() === "div" &&
                el.hasAttribute("contenteditable")
              ) {
                el.textContent = comment;
                // 변경 이벤트 발생
                const event = new Event("input", { bubbles: true });
                el.dispatchEvent(event);
              } else if (
                el.tagName.toLowerCase() === "textarea" ||
                el.tagName.toLowerCase() === "input"
              ) {
                el.value = comment;
                // 변경 이벤트 발생
                const inputEvent = new Event("input", { bubbles: true });
                el.dispatchEvent(inputEvent);
                const changeEvent = new Event("change", { bubbles: true });
                el.dispatchEvent(changeEvent);
              }
            }, config.commentLink);
          } catch (evaluateError) {
            console.error("모든 입력 방법이 실패했습니다:", evaluateError);
            throw new Error("댓글을 입력할 수 없습니다.");
          }
        }
      }

      console.log("댓글 입력이 완료되었습니다.");

      // 약간의 지연 추가 (필요한 경우)
      await page.waitForTimeout(2000);

      // 게시 버튼 찾기
      console.log("게시 버튼을 찾는 중...");
      const postButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("게시")',
        'button:has-text("Post")',
        'button:has-text("Reply")',
        'button:has-text("Send")',
        'button:has-text("댓글")',
        'button:has-text("보내기")',
      ];

      let postButton = null;

      // 텍스트 기반 버튼 찾기
      for (const selector of postButtonSelectors) {
        postButton = await page.$(selector);
        if (postButton) {
          console.log(`게시 버튼을 찾았습니다: ${selector}`);
          break;
        }
      }

      // 텍스트 기반 버튼을 찾지 못한 경우 아이콘 버튼 찾기
      if (!postButton) {
        console.log(
          "텍스트 기반 게시 버튼을 찾지 못했습니다. 아이콘 버튼을 찾습니다..."
        );

        // 인터랙티브 요소 중 댓글 입력 필드 근처의 버튼 찾기
        const buttons = await page.$$("button");

        for (const button of buttons) {
          // 버튼의 위치 및 속성 정보 확인
          const buttonInfo = await button.evaluate((el) => ({
            disabled: el.disabled,
            ariaLabel: el.getAttribute("aria-label"),
            type: el.getAttribute("type"),
            isVisible:
              el.offsetWidth > 0 &&
              el.offsetHeight > 0 &&
              getComputedStyle(el).visibility !== "hidden",
          }));

          // 게시 버튼으로 추정되는 요소 찾기
          if (
            buttonInfo.isVisible &&
            !buttonInfo.disabled &&
            ((buttonInfo.ariaLabel &&
              (buttonInfo.ariaLabel.includes("Post") ||
                buttonInfo.ariaLabel.includes("Send") ||
                buttonInfo.ariaLabel.includes("게시") ||
                buttonInfo.ariaLabel.includes("보내기"))) ||
              buttonInfo.type === "submit")
          ) {
            postButton = button;
            console.log("잠재적인 게시 버튼을 찾았습니다:", buttonInfo);
            break;
          }
        }
      }

      // 게시 버튼을 찾지 못한 경우
      if (!postButton) {
        const screenshotPath = path.join(__dirname, "error-post-button.png");
        await page.screenshot({ path: screenshotPath });
        throw new Error(
          `게시 버튼을 찾지 못했습니다. 스크린샷이 저장되었습니다: ${screenshotPath}`
        );
      }

      // 게시 버튼 클릭
      console.log("게시 버튼을 클릭합니다...");
      try {
        await postButton.click();
        console.log("댓글이 성공적으로 게시되었습니다!");
      } catch (clickError) {
        console.log(
          "일반 클릭 실패, evaluate 메소드로 시도:",
          clickError.message
        );
        try {
          await postButton.evaluate((button) => button.click());
          console.log("evaluate를 통해 댓글이 성공적으로 게시되었습니다!");
        } catch (evaluateError) {
          console.error("모든 클릭 방법이 실패했습니다:", evaluateError);
          throw new Error("게시 버튼을 클릭할 수 없습니다.");
        }
      }

      // 성공 메시지
      console.log("댓글 자동화가 성공적으로 완료되었습니다!");

      // 작업 완료 확인을 위해 잠시 대기
      await page.waitForTimeout(5000);

      // 브라우저 유지
      console.log("5초 동안 브라우저를 유지합니다...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("브라우저 작업 중 오류 발생:", error.message);
      try {
        await page.screenshot({ path: "error-screenshot.png" });
      } catch (screenshotError) {
        console.log("오류 스크린샷 저장 실패:", screenshotError.message);
      }
    } finally {
      // 브라우저 종료
      try {
        await browser.close();
      } catch (error) {
        console.log("브라우저 종료 중 오류:", error.message);
      }
      console.log("브라우저를 종료했습니다.");
    }
  } catch (error) {
    console.error("초기화 과정에서 오류 발생:", error.message);
  }
}

main();
