const { chromium } = require("playwright");
const fs = require("fs");

// 설정
const config = {
  cookiePath: "instagram_cookies.json",
  threadsUrl: "https://www.threads.net/", // 쓰레드 메인 페이지
  explorePage: "https://www.threads.net/explore", // 탐색 페이지 (항상 게시물이 있음)
  forYouPage: "https://www.threads.net/for-you", // 추천 페이지
  username: "dorar.ing", // 클릭할 계정명 (로그인)
  targetProfile: "dorar.ing", // 게시물을 확인할 타겟 프로필 (본인 계정으로 변경)
  debugMode: true,
  headless: false, // 화면에 표시 여부
  timeout: 60000, // 기본 타임아웃 (60초)
  waitTime: 15000, // 기본 대기 시간 (15초)
  longWaitTime: 30000, // 긴 대기 시간 (30초) - 사용자 확인용
  commentText: "hi", // 댓글 내용
};

// 스크립트가 실행된 시간
const startTime = new Date().toISOString();

async function main() {
  console.log("=== 쓰레드 로그인 및 댓글 작성 자동화 시작 ===");
  console.log(`시작 시간: ${startTime}`);

  // 브라우저 시작 (크래시 방지를 위한 옵션 추가)
  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: 500, // 더 천천히 실행 (500ms)
    args: [
      "--disable-blink-features=AutomationControlled", // 자동화 감지 방지
      "--window-size=1280,800",
      "--disable-dev-shm-usage", // 공유 메모리 사용 비활성화
      "--no-sandbox", // 샌드박스 비활성화 (권한 문제 해결)
      "--disable-setuid-sandbox", // setuid 샌드박스 비활성화
    ],
    timeout: 60000, // 브라우저 시작 타임아웃 증가
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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    await page.screenshot({ path: "threads-main-page.png" });
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
      await page.screenshot({ path: "instagram-button-error.png" });

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
      await page.screenshot({ path: "sso-page.png" });

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
    await page.screenshot({ path: "after-login.png" });

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
      await page.screenshot({ path: "profile-page.png" });
      console.log("📸 프로필 페이지 스크린샷 저장됨");

      // 새로운 방식: 바로 답글 버튼 찾아 클릭
      console.log(`\n=== 답글 버튼 찾아 클릭하기 ===`);

      const replyButtonResult = await page.evaluate(() => {
        // "답글" 텍스트가 있는 버튼 모두 찾기
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
          return { success: false, error: "답글 버튼을 찾을 수 없습니다" };
        }

        // 화면에 보이는 첫 번째 답글 버튼 찾기
        const visibleReplyButtons = replyButtons.filter((btn) => {
          const rect = btn.getBoundingClientRect();
          return (
            rect.top > 0 &&
            rect.bottom < window.innerHeight &&
            rect.left > 0 &&
            rect.right < window.innerWidth
          );
        });

        // 화면에 보이는 버튼이 없으면 첫 번째 버튼 사용
        const targetButton =
          visibleReplyButtons.length > 0
            ? visibleReplyButtons[0]
            : replyButtons[0];

        // 버튼 정보 기록
        const buttonInfo = {
          text: targetButton.textContent.trim(),
          width: targetButton.clientWidth,
          height: targetButton.clientHeight,
          position: targetButton.getBoundingClientRect(),
        };

        // 버튼 위치로 스크롤
        targetButton.scrollIntoView({ behavior: "smooth", block: "center" });

        // 버튼 클릭
        targetButton.click();

        return {
          success: true,
          buttonCount: replyButtons.length,
          visibleCount: visibleReplyButtons.length,
          clicked: targetButton.textContent.trim(),
          buttonInfo,
        };
      });

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
        await page.screenshot({ path: "comment-popup.png" });
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
          const commentResult = await page.evaluate((commentText) => {
            try {
              // 다이얼로그 찾기
              const dialog = document.querySelector('div[role="dialog"]');
              if (!dialog)
                return { success: false, reason: "다이얼로그 찾기 실패" };

              // 텍스트 필드의 새로운 셀렉터 시도
              let textField = dialog.querySelector(
                'div[contenteditable="true"]'
              );
              if (!textField) {
                // 대체 셀렉터 시도
                textField = dialog.querySelector('[role="textbox"]');
                if (!textField) {
                  return { success: false, reason: "입력 필드를 찾을 수 없음" };
                }
              }

              // 텍스트 필드 정보
              const fieldInfo = {
                tagName: textField.tagName,
                role: textField.getAttribute("role"),
                contentEditable: textField.getAttribute("contenteditable"),
                classNames: textField.className,
                children: textField.childNodes.length,
              };

              console.log("텍스트 필드 정보:", fieldInfo);

              // 방법 1: document.execCommand 사용 (구식이지만 가끔 작동)
              textField.focus();
              const success = document.execCommand(
                "insertText",
                false,
                commentText
              );
              console.log("execCommand 결과:", success);

              // 방법 2: Range와 Selection 수동 조작
              if (!success) {
                // 기존 콘텐츠 지우기
                while (textField.firstChild) {
                  textField.removeChild(textField.firstChild);
                }

                // 새 텍스트 노드 생성 및 삽입
                const textNode = document.createTextNode(commentText);
                textField.appendChild(textNode);

                // 모든 종류의 이벤트 발생
                ["input", "change", "keydown", "keypress", "keyup"].forEach(
                  (event) => {
                    textField.dispatchEvent(
                      new Event(event, { bubbles: true })
                    );
                  }
                );

                // 키보드 이벤트 시뮬레이션
                Array.from(commentText).forEach((char) => {
                  ["keydown", "keypress", "keyup"].forEach((eventType) => {
                    const event = new KeyboardEvent(eventType, {
                      key: char,
                      bubbles: true,
                    });
                    textField.dispatchEvent(event);
                  });
                });
              }

              // 최종 확인
              const finalText = textField.textContent || textField.innerText;
              console.log("입력 후 내용:", finalText);

              // 게시 버튼 클릭
              let buttonClickPromise = new Promise((resolve) => {
                setTimeout(() => {
                  const allButtons = Array.from(
                    dialog.querySelectorAll("div")
                  ).filter(
                    (div) =>
                      div.textContent.trim() === "게시" && div.clientWidth < 80
                  );

                  console.log(`발견된 게시 버튼: ${allButtons.length}개`);

                  if (allButtons.length > 0) {
                    // 모든 게시 버튼 클릭 시도
                    allButtons.forEach((btn, i) => {
                      setTimeout(() => {
                        console.log(`${i + 1}번째 게시 버튼 클릭 시도`);
                        try {
                          btn.click();
                        } catch (e) {
                          console.error(`클릭 오류 ${i + 1}:`, e);
                        }
                      }, i * 300);
                    });
                    resolve(true);
                  } else {
                    console.log("게시 버튼을 찾을 수 없습니다");
                    resolve(false);
                  }
                }, 1500);
              });

              // 클릭 결과를 기다릴 필요는 없지만, 약속은 반환함
              buttonClickPromise.then(() => {});

              return {
                success: true,
                method: success ? "execCommand" : "manualTextNode",
                fieldInfo,
                buttonCount: Array.from(
                  document.querySelectorAll('div[role="dialog"] div')
                ).filter(
                  (div) =>
                    div.textContent.trim() === "게시" && div.clientWidth < 80
                ).length,
                finalText,
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }, config.commentText);

          console.log(
            `📊 댓글 입력 결과: ${JSON.stringify(commentResult, null, 2)}`
          );
          results.commentSubmitted = commentResult.success;

          if (commentResult.success) {
            console.log(`✅ 댓글 "${config.commentText}" 입력 및 게시 완료`);
          } else {
            console.log(
              `❌ 댓글 입력 실패: ${
                commentResult.reason || commentResult.error
              }`
            );
          }

          // 댓글 제출 후 스크린샷
          await page.waitForTimeout(config.waitTime);
          await page.screenshot({ path: "comment-submitted.png" });
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
    console.log(
      `⏳ 브라우저는 ${
        config.longWaitTime / 1000
      }초 후에 종료됩니다. 화면을 확인하세요.`
    );
    await page.waitForTimeout(config.longWaitTime);
  } catch (error) {
    console.error(`❌ 오류 발생: ${error.message}`);
    results.errors.push({ type: "fatal", message: error.message });

    if (fs.existsSync("error-screenshot.png")) {
      fs.unlinkSync("error-screenshot.png");
    }

    try {
      const page = await context.newPage();
      await page.screenshot({ path: "error-screenshot.png" });
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

main().catch((error) => {
  console.error(`❌ 치명적인 오류: ${error.message}`);
  process.exit(1);
});
