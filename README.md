# 쓰레드 자동 댓글 봇

이 프로젝트는 Threads.net에서 특정 게시물에 자동으로 댓글을 다는 봇입니다.

## 설치 방법

```bash
# 필요한 패키지 설치
npm install

# Playwright 브라우저 설치
npx playwright install chromium
```

## 사용 방법

기본 실행:

```bash
npm start
```

명령줄 옵션 사용:

```bash
# 특정 링크를 댓글로 달기
node thread-bot.js --link "여기 확인해보세요: https://example.com"

# 특정 게시물에 댓글 달기
node thread-bot.js --url "https://www.threads.net/@username/post/..."

# 특정 게시물에 특정 링크 댓글 달기
node thread-bot.js --link "새로운 소식: https://example.com" --url "https://www.threads.net/@username/post/..."

# 도움말 보기
node thread-bot.js --help
```

## 기능

- 쓰레드/인스타그램 계정으로 자동 로그인
- 특정 게시물 찾기 또는 URL로 직접 접근
- 사용자 지정 댓글 자동 작성
- 오류 발생 시 스크린샷 저장

## 주의사항

- 계정 정보는 코드에 하드코딩되어 있습니다. 실제 사용 시 보안에 주의하세요.
- 과도한 자동화는 계정 제한을 받을 수 있으니 주의하세요.
- 소셜 미디어 플랫폼 정책에 위배되는 사용은 피하세요.
