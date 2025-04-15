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

또는 직접 스크립트 실행:

```bash
node simple-sso-clicker.js
```

## 웹훅 서버 사용법

웹훅 서버를 통해 URL을 받아 자동으로 댓글을 달 수 있습니다.

### 웹훅 서버 실행

```bash
npm run webhook
```

또는:

```bash
node webhook-server.js
```

웹훅 서버는 기본적으로 3000 포트에서 실행됩니다. 환경 변수 PORT를 설정하여 다른 포트를 사용할 수 있습니다.

### 웹훅 요청 보내기

웹훅 엔드포인트로 POST 요청을 보냅니다:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/my-link"}'
```

요청을 받으면 자동으로 simple-sso-clicker.js가 실행되어 지정된 URL을 댓글로 달게 됩니다.

### 서버 상태 확인

웹훅 서버의 상태를 확인하려면:

```bash
curl http://localhost:3000/status
```

## 기능

- 쓰레드/인스타그램 계정으로 자동 로그인
- 특정 게시물 찾기 또는 URL로 직접 접근
- 사용자 지정 댓글 자동 작성
- 웹훅을 통한 자동화된 URL 댓글 작성
- 오류 발생 시 스크린샷 저장
- 상세한 로그 기록

## 주의사항

- 계정 정보는 코드에 하드코딩되어 있습니다. 실제 사용 시 보안에 주의하세요.
- 과도한 자동화는 계정 제한을 받을 수 있으니 주의하세요.
- 소셜 미디어 플랫폼 정책에 위배되는 사용은 피하세요.
