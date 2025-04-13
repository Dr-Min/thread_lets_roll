const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// 설정
const config = {
  cookiePath: "instagram_cookies.json",
  threadsUrl: "https://www.threads.net/", // 쓰레드 메인 페이지
  explorePage: "https://www.threads.net/explore", // 탐색 페이지 (항상 게시물이 있음)
  forYouPage: "https://www.threads.net/for-you", // 추천 페이지
  username: "dorar.ing", // 클릭할 계정명 (로그인)
  targetProfile: "dorar.ing", // 게시물을 확인할 타겟 프로필 (본인 계정으로 변경)
  debugMode: true,
  headless: true, // 리눅스 서버에서는 headless 모드로 실행
  timeout: 60000, // 기본 타임아웃 (60초)
  waitTime: 15000, // 기본 대기 시간 (15초)
  longWaitTime: 30000, // 긴 대기 시간 (30초) - 사용자 확인용
  commentText: "hi_linux", // 댓글 내용
  screenshotDir: "screenshots", // 스크린샷 저장 디렉토리
  saveScreenshots: false,
};

// 스크립트가 실행된 시간
const startTime = new Date().toISOString();

// 스크린샷 디렉토리 확인 및 생성
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ 디렉토리 생성됨: ${dirPath}`);
  }
}

async function main() {
  console.log("=== 쓰레드 로그인 및 댓글 작성 자동화 시작 ===");
  console.log(`시작 시간: ${startTime}`);

  // 스크린샷 디렉토리 생성
  ensureDirectoryExists(config.screenshotDir);

  // 브라우저 시작 (리눅스 서버 환경에 최적화된 옵션)
  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: 500, // 더 천천히 실행 (500ms)
    args: [
      "--disable-blink-features=AutomationControlled", // 자동화 감지 방지
      "--window-size=1280,800",
      "--disable-dev-shm-usage", // 공유 메모리 사용 비활성화 (중요: 리눅스 서버에서 필요)
      "--no-sandbox", // 샌드박스 비활성화 (중요: 리눅스 서버에서 필요)
      "--disable-setuid-sandbox", // setuid 샌드박스 비활성화
      "--disable-gpu", // GPU 가속 비활성화 (리눅스 서버에서 필요할 수 있음)
      "--disable-software-rasterizer", // 소프트웨어 래스터라이저 비활성화
    ],
    timeout: 60000, // 브라우저 시작 타임아웃 증가
    executablePath: process.env.CHROME_PATH, // 환경 변수에서 Chrome 경로 가져오기 (설정된 경우)
  });

  let context = null;
  let results = {
    startTime: startTime,
    endTime: null,
    loginSuccess: false,
    profileVisited: false,
    replyButtonClicked: false,
    commentDialogOpened: false,
    commentSubmitted: false,
    errors: [],
  };

  try {
    // 컨텍스트 생성
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      hasTouch: false,
      isMobile: false,
    });

    // 쿠키 로드
    if (fs.existsSync(config.cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(config.cookiePath, "utf8"));
      await context.addCookies(cookies);
      console.log(`✅ 쿠키 로드 완료: ${cookies.length}개`);
    } else {
      console.log("⚠️ 쿠키 파일이 없습니다. 로그인이 필요할 수 있습니다.");
    }

    // 페이지 열기
    const page = await context.newPage();

    // 에러 로그 핸들러 추가
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`❌ 브라우저 콘솔 오류: ${msg.text()}`);
        results.errors.push({ type: "console", message: msg.text() });
      }
    });

    page.on("pageerror", (err) => {
      console.log(`❌ 페이지 오류: ${err.message}`);
      results.errors.push({ type: "page", message: err.message });
    });

    // 네트워크 요청/응답 모니터링
    page.on("request", (request) => {
      if (
        request.url().includes("api/") &&
        (request.method() === "POST" || request.method() === "PUT")
      ) {
        console.log(`📡 네트워크 요청: ${request.method()} ${request.url()}`);
      }
    });

    page.on("response", (response) => {
      const request = response.request();
      if (
        request.url().includes("api/") &&
        (request.method() === "POST" || request.method() === "PUT")
      ) {
        console.log(`📡 네트워크 응답: ${response.status()} ${request.url()}`);
      }
    });

    // 1단계: 쓰레드 메인 페이지로 이동
    console.log(`📌 쓰레드 메인 페이지로 이동: ${config.threadsUrl}`);
    await page.goto(config.threadsUrl, {
      waitUntil: "networkidle",
      timeout: config.timeout,
    });
    await page.waitForTimeout(config.waitTime);

    // 디버깅용 스크린샷
    await page.screenshot({
      path: path.join(config.screenshotDir, "threads-main-page.png"),
    });
    console.log("📸 쓰레드 메인 페이지 스크린샷 저장됨");

    // 2단계: 인스타그램 버튼 클릭 (수정된 선택자)
    console.log("🔍 '인스타그램으로 계속' 버튼 찾기...");

    // 올바른 선택자 사용 (Playwright 문법에 맞게 수정)
    try {
      // 방법 1: 역할(role)로 찾기
      const instagramButtonByRole = page.getByRole("button", {
        name: /instagram|인스타그램/i,
      });
      const roleCount = await instagramButtonByRole.count();

      if (roleCount > 0) {
        console.log("✅ 역할(role)로 인스타그램 버튼 발견");
        await instagramButtonByRole.first().click();
        console.log("✅ 인스타그램 버튼 클릭 완료");
      } else {
        // 방법 2: 텍스트로 찾기
        const instagramButtonByText = page.getByText(/instagram|인스타그램/i);
        const textCount = await instagramButtonByText.count();

        if (textCount > 0) {
          console.log("✅ 텍스트로 인스타그램 버튼 발견");
          await instagramButtonByText.first().click();
          console.log("✅ 인스타그램 버튼 클릭 완료");
        } else {
          // 방법 3: CSS 선택자로 찾기
          console.log("🔍 CSS 선택자로 인스타그램 버튼 찾기...");

          // 개별적으로 시도
          const buttonElement = await page.$("button:has-text('Instagram')");
          if (buttonElement) {
            await buttonElement.click();
            console.log("✅ CSS 선택자로 인스타그램 버튼 클릭 완료");
          } else {
            console.log(
              "⚠️ CSS 선택자로 버튼 찾기 실패, JavaScript로 시도합니다."
            );

            // JavaScript로 클릭 시도
            await page.evaluate(() => {
              const buttons = document.querySelectorAll(
                'button, [role="button"]'
              );
              for (const btn of buttons) {
                if (
                  btn.textContent.includes("Instagram") ||
                  btn.textContent.includes("인스타그램")
                ) {
                  btn.click();
                  return true;
                }
              }
              return false;
            });
            console.log("✅ JavaScript로 인스타그램 버튼 클릭 시도");
          }
        }
      }

      // 버튼 클릭 후 대기
      await page.waitForTimeout(config.waitTime);
    } catch (e) {
      console.log(`⚠️ 인스타그램 버튼 처리 중 오류: ${e.message}`);
      results.errors.push({ type: "instagram_button", message: e.message });

      // 오류 발생 시 스크린샷
      await page.screenshot({
        path: path.join(config.screenshotDir, "instagram-button-error.png"),
      });

      // 마지막 시도: 텍스트가 있는 첫 번째 버튼 클릭
      try {
        await page.evaluate(() => {
          const allButtons = Array.from(
            document.querySelectorAll('button, [role="button"]')
          );
          const visibleButtons = allButtons.filter((btn) => {
            const rect = btn.getBoundingClientRect();
            return (
              rect.width > 0 && rect.height > 0 && btn.textContent.trim() !== ""
            );
          });

          if (visibleButtons.length > 0) {
            console.log(
              `첫 번째 가시적 버튼 텍스트: ${visibleButtons[0].textContent}`
            );
            visibleButtons[0].click();
            return true;
          }
          return false;
        });
        console.log("✅ 첫 번째 가시적 버튼 클릭 시도");
        await page.waitForTimeout(config.waitTime);
      } catch (innerErr) {
        console.log(`❌ 최종 버튼 클릭 시도 실패: ${innerErr.message}`);
        results.errors.push({
          type: "instagram_button_final",
          message: innerErr.message,
        });
      }
    }

    // SSO 페이지 확인
    const currentUrl = page.url();
    console.log(`현재 URL: ${currentUrl}`);

    // 3단계: 계정 선택 (수정된 방식으로)
    if (currentUrl.includes("sso") || currentUrl.includes("accounts")) {
      console.log("🔍 계정 선택 화면 처리 중...");

      // 스크린샷
      await page.screenshot({
        path: path.join(config.screenshotDir, "sso-page.png"),
      });

      // 계정 선택 시도 (여러 방법)
      try {
        // 방법 1: 역할(role)과 이름으로 시도
        const accountCard = page.getByRole("button", { name: config.username });
        const cardCount = await accountCard.count();

        if (cardCount > 0) {
          await accountCard.click({ timeout: config.timeout });
          console.log("✅ 역할(role)로 계정 카드 클릭 완료");
        } else {
          // 방법 2: 텍스트로 시도
          const accountText = page.getByText(config.username, { exact: false });
          const textCount = await accountText.count();

          if (textCount > 0) {
            // 텍스트 요소의 부모 요소를 클릭 (계정 카드)
            await accountText.first().click({ timeout: config.timeout });
            console.log("✅ 텍스트로 계정 카드 클릭 완료");
          } else {
            // 방법 3: JavaScript로 시도
            await page.evaluate((username) => {
              // 사용자 이름으로 버튼 찾기
              const buttons = Array.from(
                document.querySelectorAll('button, [role="button"]')
              );
              for (const btn of buttons) {
                if (btn.textContent.includes(username)) {
                  btn.click();
                  return true;
                }
              }

              // 두 번째 버튼 (일반적으로 계정 카드)
              if (buttons.length > 1) {
                buttons[1].click();
                return true;
              }

              return false;
            }, config.username);
            console.log("✅ JavaScript로 계정 카드 클릭 시도");
          }
        }
      } catch (e) {
        console.log(`⚠️ 계정 선택 실패: ${e.message}`);
        results.errors.push({ type: "account_card", message: e.message });

        // 마지막 시도: 화면의 가장 큰 버튼 클릭
        try {
          await page.evaluate(() => {
            const buttons = Array.from(
              document.querySelectorAll('button, [role="button"]')
            );
            if (buttons.length > 0) {
              // 두 번째 버튼이 보통 계정 카드
              if (buttons.length > 1) {
                buttons[1].click();
              } else {
                buttons[0].click();
              }
              return true;
            }
            return false;
          });
          console.log("✅ 최종 시도: 기본 버튼 클릭");
        } catch (finalErr) {
          console.log(`❌ 최종 계정 카드 클릭 시도 실패: ${finalErr.message}`);
          results.errors.push({
            type: "account_card_final",
            message: finalErr.message,
          });
        }
      }

      // 페이지 전환 대기
      await page.waitForTimeout(config.waitTime * 2);
    }

    // 현재 URL 확인
    const finalUrl = page.url();
    console.log(`📌 현재 URL: ${finalUrl}`);
    await page.screenshot({
      path: path.join(config.screenshotDir, "after-login.png"),
    });

    // 로그인 성공 여부 확인
    const loginSuccess = finalUrl !== currentUrl;
    console.log(`로그인 ${loginSuccess ? "성공 ✅" : "실패 ❌"}`);
    results.loginSuccess = loginSuccess;

    if (loginSuccess) {
      // 타겟 사용자 프로필 페이지로 이동
      console.log(`\n=== 사용자 본인 프로필 페이지로 이동 ===`);
      const profileUrl = `https://www.threads.net/@${config.targetProfile}`;
      console.log(`📌 내 프로필 페이지로 이동: ${profileUrl}`);

      await page.goto(profileUrl, {
        waitUntil: "networkidle",
        timeout: config.timeout,
      });
      await page.waitForTimeout(config.waitTime);
      results.profileVisited = true;

      // 프로필 페이지 스크린샷
      await page.screenshot({
        path: path.join(config.screenshotDir, "profile-page.png"),
      });
      console.log("📸 프로필 페이지 스크린샷 저장됨");

      // 새로운 방식: 바로 답글 버튼 찾아 클릭
      console.log(`\n=== 답글 버튼 찾아 클릭하기 ===`);

      const replyButtonResult = await findAndClickReplyButton(page);

      console.log(
        `📊 답글 버튼 결과: ${JSON.stringify(replyButtonResult, null, 2)}`
      );

      if (replyButtonResult.success) {
        console.log(`✅ 답글 버튼 '${replyButtonResult.clicked}' 클릭 완료`);
        results.replyButtonClicked = true;

        // 댓글 팝업창이 열릴 때까지 대기
        console.log(`⏳ 댓글 팝업창 로딩 대기 중... (${config.waitTime}ms)`);
        await page.waitForTimeout(config.waitTime);

        // 댓글 팝업창 스크린샷
        await page.screenshot({
          path: path.join(config.screenshotDir, "comment-popup.png"),
        });
        console.log("📸 댓글 팝업창 스크린샷 저장됨");

        // 댓글 입력 및 제출 (기존 방식 유지)
        console.log(`🔍 댓글 입력 필드 찾는 중...`);

        // 다이얼로그 팝업 확인
        const dialogInfo = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) {
            return { found: false, reason: "다이얼로그를 찾을 수 없음" };
          }
          return {
            found: true,
            width: dialog.clientWidth,
            height: dialog.clientHeight,
          };
        });

        results.commentDialogOpened = dialogInfo.found;

        if (dialogInfo.found) {
          console.log(`✅ 댓글 다이얼로그 발견됨`);

          // 새로운 방식의 댓글 입력 및 제출 (document.execCommand 사용)
          const commentResult = await enterCommentAndSubmit(page);

          console.log(
            `📊 댓글 입력 결과: ${JSON.stringify(commentResult, null, 2)}`
          );
          results.commentSubmitted = commentResult.success;

          if (commentResult.success) {
            console.log(`✅ 댓글 "${config.commentText}" 입력 및 게시 완료`);
          } else {
            console.log(
              `❌ 댓글 입력 실패: ${
                commentResult.error || commentResult.reason
              }`
            );
          }

          // 댓글 제출 후 스크린샷
          await page.waitForTimeout(config.waitTime);
          await page.screenshot({
            path: path.join(config.screenshotDir, "comment-submitted.png"),
          });
          console.log("📸 댓글 제출 후 스크린샷 저장됨");
        } else {
          console.log(
            `❌ 댓글 다이얼로그를 찾을 수 없음: ${dialogInfo.reason}`
          );
        }
      } else {
        console.log(`❌ 답글 버튼 찾기 실패: ${replyButtonResult.error}`);

        // 대안: 다른 페이지로 이동해서 시도
        console.log(
          `\n⚠️ 답글 버튼을 찾지 못했습니다. 탐색 페이지로 이동합니다.`
        );
        console.log(`📌 탐색 페이지로 이동: ${config.explorePage}`);

        await page.goto(config.explorePage, {
          waitUntil: "networkidle",
          timeout: config.timeout,
        });
        await page.waitForTimeout(config.waitTime);

        // 탐색 페이지에서 답글 버튼 다시 시도
        console.log(`🔍 탐색 페이지에서 답글 버튼 찾기 시도...`);

        const exploreReplyResult = await page.evaluate(() => {
          // 동일한 findAndClickReplyButton 로직 적용
          const replyButtons = Array.from(
            document.querySelectorAll('button, [role="button"]')
          ).filter((btn) => {
            const text = btn.textContent.trim();
            return (
              (text === "답글" || text.startsWith("답글")) &&
              btn.clientWidth >= 40 &&
              btn.clientWidth <= 60 &&
              btn.clientHeight >= 30 &&
              btn.clientHeight <= 40
            );
          });

          if (replyButtons.length === 0) {
            return {
              success: false,
              error: "탐색 페이지에서도 답글 버튼을 찾을 수 없습니다",
            };
          }

          const visibleReplyButtons = replyButtons.filter((btn) => {
            const rect = btn.getBoundingClientRect();
            return rect.top > 0 && rect.bottom < window.innerHeight;
          });

          const targetButton =
            visibleReplyButtons.length > 0
              ? visibleReplyButtons[0]
              : replyButtons[0];
          targetButton.scrollIntoView({ behavior: "smooth", block: "center" });
          targetButton.click();

          return {
            success: true,
            buttonCount: replyButtons.length,
            clicked: targetButton.textContent.trim(),
          };
        });

        if (exploreReplyResult.success) {
          console.log(`✅ 탐색 페이지에서 답글 버튼 클릭 성공`);
          results.replyButtonClicked = true;

          // 댓글 입력 로직 진행 (위와 동일)
          // ... (필요시 여기에 댓글 입력 로직 복사)
        } else {
          console.log(`❌ 탐색 페이지에서도 답글 버튼을 찾지 못했습니다`);
        }
      }
    } else {
      console.log("❌ 로그인 실패");
    }

    // 결과 저장
    results.endTime = new Date().toISOString();
    fs.writeFileSync("result.json", JSON.stringify(results, null, 2));
    console.log("📊 결과 저장됨: result.json");

    console.log("\n✅ 작업 완료!");
  } catch (error) {
    console.error(`❌ 오류 발생: ${error.message}`);
    results.errors.push({ type: "fatal", message: error.message });

    try {
      const page = await context.newPage();
      await page.screenshot({
        path: path.join(config.screenshotDir, "error-screenshot.png"),
      });
      console.log("📸 오류 발생 시점 스크린샷 저장됨: error-screenshot.png");
    } catch (screenshotError) {
      console.error(`❌ 스크린샷 저장 실패: ${screenshotError.message}`);
    }
  } finally {
    results.endTime = new Date().toISOString();
    fs.writeFileSync("result.json", JSON.stringify(results, null, 2));

    console.log("🔚 브라우저 종료됨");
    if (browser) await browser.close();
  }
}

// 답글 버튼을 찾고 클릭하는 함수 추가
async function findAndClickReplyButton(page) {
  console.log("\n=== 답글 버튼 찾기 시작 ===");

  let buttonFound = false;
  let success = false;
  let error = null;

  // 페이지가 안정화될 때까지 잠시 대기
  await page.waitForTimeout(2000);

  // 스크린샷 저장
  if (config.saveScreenshots) {
    await page.screenshot({
      path: path.join(config.screenshotDir, "before_finding_reply_button.png"),
    });
  }

  try {
    // 1. 텍스트로 버튼 찾기
    console.log("텍스트로 답글 버튼 찾기 시도...");
    const buttonTexts = ["답글", "댓글", "댓글 달기", "Reply", "Comment"];

    for (const text of buttonTexts) {
      const buttons = await page.$$(`button:has-text("${text}")`);
      console.log(`"${text}" 텍스트가 있는 버튼 ${buttons.length}개 발견`);

      for (const button of buttons) {
        if (await button.isVisible()) {
          console.log(`✅ "${text}" 텍스트가 있는 버튼 클릭`);
          await button.scrollIntoViewIfNeeded();
          await button.click({ force: true });
          buttonFound = true;
          success = true;
          break;
        }
      }

      if (buttonFound) break;
    }

    // 2. SVG 아이콘이 있는 버튼 찾기
    if (!buttonFound) {
      console.log("SVG 아이콘이 있는 버튼 찾기 시도...");

      // 모든 버튼 찾기
      const svgButtons = await page.$$('button svg, [role="button"] svg');
      console.log(`SVG 아이콘이 있는 버튼 ${svgButtons.length}개 발견`);

      for (const svg of svgButtons) {
        const button = await svg.evaluateHandle(
          (node) => node.closest("button") || node.closest('[role="button"]')
        );

        if (button && (await button.isVisible())) {
          // aria-label 확인
          const ariaLabel = await button.evaluate((el) =>
            el.getAttribute("aria-label")
          );

          if (
            ariaLabel &&
            (ariaLabel.includes("댓글") ||
              ariaLabel.includes("답글") ||
              ariaLabel.includes("comment") ||
              ariaLabel.includes("reply"))
          ) {
            console.log(`✅ aria-label "${ariaLabel}"가 있는 SVG 버튼 클릭`);
            await button.scrollIntoViewIfNeeded();
            await button.click({ force: true });
            buttonFound = true;
            success = true;
            break;
          } else {
            // SVG 버튼 클릭 시도 (위치 기반)
            try {
              console.log("SVG 버튼 클릭 시도");
              await button.scrollIntoViewIfNeeded();
              await button.click({ force: true });

              // 클릭 후 대화 상자가 나타나는지 확인
              await page.waitForTimeout(1000);
              const dialog = await page.$('div[role="dialog"]');

              if (dialog) {
                console.log("✅ SVG 버튼 클릭 후 대화 상자 발견");
                buttonFound = true;
                success = true;
                break;
              }
            } catch (e) {
              console.log(`SVG 버튼 클릭 실패: ${e.message}`);
            }
          }
        }
      }
    }

    // 3. 클래스 이름으로 찾기
    if (!buttonFound) {
      console.log("클래스 이름으로 버튼 찾기 시도...");

      const classSelectors = [
        "div._aal0", // Instagram 댓글 버튼 클래스
        "div.x1i10hfl.xjqpnuy.xa49m3k", // 쓰레드 댓글 버튼 클래스
        'div[data-visualcompletion="ignore-dynamic"]', // 동적 요소 클래스
        "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh", // 레이아웃 클래스
      ];

      for (const selector of classSelectors) {
        const elements = await page.$$(selector);
        console.log(`"${selector}" 선택자로 ${elements.length}개 요소 발견`);

        for (const element of elements) {
          if (await element.isVisible()) {
            const text = await element.textContent();

            // 텍스트에 댓글/답글 관련 키워드가 있는지 확인
            if (
              text &&
              (text.includes("댓글") ||
                text.includes("답글") ||
                text.includes("comment") ||
                text.includes("reply"))
            ) {
              console.log(`✅ "${text}" 텍스트가 있는 클래스 요소 클릭`);
              await element.scrollIntoViewIfNeeded();
              await element.click({ force: true });
              buttonFound = true;
              success = true;
              break;
            }
          }
        }

        if (buttonFound) break;
      }
    }

    // 4. JavaScript로 버튼 찾기
    if (!buttonFound) {
      console.log("JavaScript로 버튼 찾기 시도...");

      success = await page.evaluate(() => {
        // 댓글/답글 관련 키워드
        const keywords = ["댓글", "답글", "comment", "reply"];

        // 모든 가능한 버튼 요소 찾기
        const buttonCandidates = [
          ...document.querySelectorAll("button"),
          ...document.querySelectorAll('[role="button"]'),
          ...document.querySelectorAll("div._aal0"),
          ...document.querySelectorAll("div.x1i10hfl"),
        ];

        // 보이는 요소만 필터링
        const visibleButtons = buttonCandidates.filter((btn) => {
          const rect = btn.getBoundingClientRect();
          const style = window.getComputedStyle(btn);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
          );
        });

        console.log(`보이는 버튼 후보 ${visibleButtons.length}개 발견`);

        // SVG가 있는 버튼 우선 시도
        const svgButtons = visibleButtons.filter((btn) =>
          btn.querySelector("svg")
        );

        // 먼저 SVG 버튼 시도
        for (const btn of svgButtons) {
          try {
            btn.click();
            return true;
          } catch (e) {
            console.error("SVG 버튼 클릭 실패:", e);
          }
        }

        // 키워드로 필터링된 버튼 시도
        for (const btn of visibleButtons) {
          const text = (btn.textContent || "").toLowerCase();
          if (keywords.some((keyword) => text.includes(keyword))) {
            try {
              btn.click();
              return true;
            } catch (e) {
              console.error("키워드 버튼 클릭 실패:", e);
              try {
                // 이벤트 발생 방식으로 시도
                btn.dispatchEvent(
                  new MouseEvent("click", {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                  })
                );
                return true;
              } catch (e2) {
                console.error("이벤트 발생 실패:", e2);
              }
            }
          }
        }

        // 모든 보이는 버튼 시도 (마지막 방법)
        for (const btn of visibleButtons) {
          try {
            btn.click();

            // 클릭 후 다이얼로그 확인
            setTimeout(() => {
              const dialog = document.querySelector('div[role="dialog"]');
              return !!dialog;
            }, 500);

            return true;
          } catch (e) {
            console.error("버튼 클릭 실패:", e);
          }
        }

        return false;
      });

      if (success) {
        console.log("✅ JavaScript로 버튼 클릭 성공");
        buttonFound = true;
      }
    }

    // 스크린샷 저장
    if (config.saveScreenshots) {
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(config.screenshotDir, "after_finding_reply_button.png"),
      });
    }

    // 클릭 후 댓글 입력 창이 나타났는지 확인
    if (buttonFound) {
      try {
        // 다이얼로그나 입력 필드가 나타나길 기다림
        const dialogOrInput = await Promise.race([
          page
            .waitForSelector('div[role="dialog"]', { timeout: 3000 })
            .then(() => "dialog"),
          page
            .waitForSelector('[contenteditable="true"]', { timeout: 3000 })
            .then(() => "input"),
          page
            .waitForSelector("[placeholder]", { timeout: 3000 })
            .then(() => "placeholder"),
          new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000)),
        ]);

        if (dialogOrInput === "dialog") {
          console.log("✅ 답글 버튼 클릭 후 다이얼로그 발견");
        } else if (
          dialogOrInput === "input" ||
          dialogOrInput === "placeholder"
        ) {
          console.log("✅ 답글 버튼 클릭 후 입력 필드 발견");
        } else {
          console.log("⚠️ 답글 버튼 클릭 후 입력 필드가 나타나지 않음");
        }
      } catch (e) {
        console.log(`입력 필드 확인 중 오류: ${e.message}`);
      }
    }
  } catch (e) {
    success = false;
    error = e.message;
    console.error(`❌ 답글 버튼 찾기 중 오류 발생: ${e.message}`);
  }

  console.log(`답글 버튼 찾기 ${success ? "성공" : "실패"}: ${error || ""}`);
  return { success, buttonFound, error };
}

async function enterCommentAndSubmit(page) {
  console.log("\n=== 댓글 입력 및 제출 시작 ===");

  let inputFound = false;
  let submitFound = false;
  let success = false;
  let error = null;

  // 스크린샷 저장
  if (config.saveScreenshots) {
    await page.screenshot({
      path: path.join(config.screenshotDir, "before_comment_input.png"),
    });
  }

  try {
    // 1. 다이얼로그가 있는지 확인
    console.log("댓글 다이얼로그 확인 중...");
    await page.waitForTimeout(2000);

    const dialogInfo = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) {
        return { found: false, reason: "다이얼로그를 찾을 수 없음" };
      }
      return {
        found: true,
        width: dialog.clientWidth,
        height: dialog.clientHeight,
      };
    });

    if (dialogInfo.found) {
      console.log(
        `✅ 댓글 다이얼로그 발견됨 (${dialogInfo.width}x${dialogInfo.height})`
      );
    } else {
      console.log(
        `⚠️ ${dialogInfo.reason}, 페이지 내에서 직접 입력 필드 찾기 시도...`
      );
    }

    // 2. placeholder로 입력 필드 찾기
    console.log("placeholder로 입력 필드 찾기 시도...");
    const placeholders = [
      "답글 달기...",
      "댓글 달기...",
      "댓글 작성...",
      "Add a comment...",
      "Reply...",
      "Leave a comment...",
    ];

    for (const placeholder of placeholders) {
      const inputField = await page.$(`[placeholder="${placeholder}"]`);
      if (inputField && (await inputField.isVisible())) {
        console.log(`✅ "${placeholder}" placeholder가 있는 입력 필드 발견`);
        await inputField.click();
        await inputField.fill(config.commentText);
        inputFound = true;
        break;
      }
    }

    // 3. contenteditable 요소 찾기
    if (!inputFound) {
      console.log("contenteditable 요소 찾기 시도...");
      const editableDivs = await page.$$('[contenteditable="true"]');
      console.log(`contenteditable 요소 ${editableDivs.length}개 발견`);

      for (const div of editableDivs) {
        if (await div.isVisible()) {
          console.log("✅ 보이는 contenteditable 요소 발견");
          await div.click();

          // contenteditable 요소에 텍스트 입력 (JavaScript 사용)
          await page.evaluate(
            (element, text) => {
              element.textContent = text;
              element.dispatchEvent(new Event("input", { bubbles: true }));
              element.dispatchEvent(new Event("change", { bubbles: true }));
            },
            div,
            config.commentText
          );

          inputFound = true;
          break;
        }
      }
    }

    // 4. 쓰레드 특화 선택자로 찾기
    if (!inputFound) {
      console.log("쓰레드 특화 선택자로 찾기 시도...");
      const threadSpecificSelectors = [
        "p.xdj266r.x11i5rnm.xat24cr.x1mh8g0r",
        'div[role="textbox"]',
        "div.xzsf02u.x1a2a7pz",
        "div._ab8t",
        "div.x6s0dn4.xnz67gz.x19gtwlf.x1gus47g",
      ];

      for (const selector of threadSpecificSelectors) {
        const element = await page.$(selector);
        if (element && (await element.isVisible())) {
          console.log(`✅ 선택자 '${selector}'로 입력 필드 발견`);
          await element.scrollIntoViewIfNeeded();
          await element.click();

          // 키보드로 직접 텍스트 입력
          await page.keyboard.type(config.commentText);
          inputFound = true;
          break;
        }
      }
    }

    // 5. 마지막 방법: JavaScript로 모든 가능한 요소 찾기
    if (!inputFound) {
      console.log("JavaScript로 입력 필드 찾기 시도...");

      inputFound = await page.evaluate((commentText) => {
        // 가능한 모든 입력 요소 찾기
        const possibleInputs = [
          ...document.querySelectorAll('input[type="text"]'),
          ...document.querySelectorAll('[contenteditable="true"]'),
          ...document.querySelectorAll('[role="textbox"]'),
          ...document.querySelectorAll("textarea"),
        ];

        // 보이는 요소 필터링
        const visibleInputs = possibleInputs.filter((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 0 &&
            rect.height > 0
          );
        });

        if (visibleInputs.length === 0) {
          return false;
        }

        // 가장 적합한 입력 필드 선택 (가시적이고 비어있는)
        const input =
          visibleInputs.find((el) => !el.value && !el.textContent) ||
          visibleInputs[0];

        try {
          // 요소 타입에 따라 다른 방법으로 값 설정
          if (input.tagName === "INPUT" || input.tagName === "TEXTAREA") {
            input.value = commentText;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            // contenteditable 등의 요소
            input.textContent = commentText;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }

          // 포커스 및 키 이벤트 발생
          input.focus();
          return true;
        } catch (e) {
          console.error("입력 필드에 값 설정 실패:", e);
          return false;
        }
      }, config.commentText);

      if (inputFound) {
        console.log("✅ JavaScript로 입력 필드에 텍스트 입력 성공");
      }
    }

    // 스크린샷 저장
    if (config.saveScreenshots) {
      await page.screenshot({
        path: path.join(config.screenshotDir, "after_comment_input.png"),
      });
    }

    if (!inputFound) {
      error = "어떤 방법으로도 댓글 입력 필드를 찾을 수 없습니다";
      console.error(`❌ ${error}`);
      return { success: false, error };
    }

    // 댓글 입력 후 잠시 대기
    await page.waitForTimeout(1000);

    // 6. 제출 버튼 찾기
    console.log("\n댓글 제출 버튼 찾기 시도...");

    // 텍스트로 버튼 찾기
    const submitButtonTexts = ["게시", "답글", "Post", "Reply", "Send"];
    for (const text of submitButtonTexts) {
      const submitButtons = await page.$$(`button:has-text("${text}")`);

      for (const button of submitButtons) {
        if (await button.isVisible()) {
          console.log(`✅ "${text}" 텍스트가 있는 제출 버튼 발견`);
          await button.scrollIntoViewIfNeeded();
          await button.click({ force: true });
          submitFound = true;
          success = true;
          break;
        }
      }

      if (submitFound) break;
    }

    // 역할로 버튼 찾기
    if (!submitFound) {
      const roleButtons = await page.$$('[role="button"]');

      for (const button of roleButtons) {
        const buttonText = await button.textContent();
        if (
          (await button.isVisible()) &&
          (buttonText.includes("게시") ||
            buttonText.includes("Post") ||
            buttonText.includes("Reply") ||
            buttonText.includes("Send"))
        ) {
          console.log(
            `✅ 역할이 button인 제출 버튼 발견 (텍스트: ${buttonText})`
          );
          await button.scrollIntoViewIfNeeded();
          await button.click({ force: true });
          submitFound = true;
          success = true;
          break;
        }
      }
    }

    // 클래스로 버튼 찾기
    if (!submitFound) {
      const classSelectors = [
        "div.xc26acl.x6s0dn4.x78zum5.xl56j7k.x6ikm8r.x10wlt62.x1swvt13.x1pi30zi.xlyipyv.xp07o12",
        "div._aacl._aaco._aacw._aad0._aad6._aade",
        "button._acan._acap._acas._aj1-",
      ];

      for (const selector of classSelectors) {
        const buttons = await page.$$(selector);

        for (const button of buttons) {
          if (await button.isVisible()) {
            console.log(`✅ 클래스 선택자 '${selector}'로 제출 버튼 발견`);
            await button.scrollIntoViewIfNeeded();
            await button.click({ force: true });
            submitFound = true;
            success = true;
            break;
          }
        }

        if (submitFound) break;
      }
    }

    // JavaScript로 버튼 찾기
    if (!submitFound) {
      success = await page.evaluate(() => {
        // 제출 버튼 관련 키워드
        const keywords = ["게시", "답글", "post", "reply", "send"];

        // 버튼 후보 요소들
        const buttonCandidates = [
          ...document.querySelectorAll("button"),
          ...document.querySelectorAll('[role="button"]'),
          ...document.querySelectorAll(".xc26acl"),
        ];

        // 보이는 요소만 필터링
        const visibleButtons = buttonCandidates.filter((btn) => {
          const rect = btn.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        // 키워드 매칭
        for (const btn of visibleButtons) {
          const text = (btn.textContent || "").toLowerCase();
          if (keywords.some((keyword) => text.includes(keyword))) {
            try {
              btn.click();
              return true;
            } catch (e) {
              console.error("버튼 클릭 실패:", e);
              try {
                // 이벤트 발생 방식으로 시도
                btn.dispatchEvent(
                  new MouseEvent("click", {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                  })
                );
                return true;
              } catch (e2) {
                console.error("이벤트 발생 실패:", e2);
                return false;
              }
            }
          }
        }

        return false;
      });

      if (success) {
        console.log("✅ JavaScript로 제출 버튼 클릭 성공");
        submitFound = true;
      }
    }

    // Enter 키로 제출
    if (!submitFound) {
      console.log("제출 버튼을 찾지 못했습니다. Enter 키를 사용합니다.");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
      success = true; // 일단 성공으로 간주
    }

    // 스크린샷 저장
    if (config.saveScreenshots) {
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(config.screenshotDir, "after_comment_submit.png"),
      });
    }
  } catch (e) {
    success = false;
    error = e.message;
    console.error(`❌ 댓글 입력 중 오류 발생: ${e.message}`);
  }

  console.log(`댓글 입력 및 제출 ${success ? "성공" : "실패"}: ${error || ""}`);
  return { success, inputFound, submitFound, error };
}

// 리눅스 서버에서의 실행을 위한 오류 처리
process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 처리되지 않은 거부:", reason);
  // 애플리케이션 중단 방지
});

main().catch((error) => {
  console.error(`❌ 치명적인 오류: ${error.message}`);
  process.exit(1);
});
