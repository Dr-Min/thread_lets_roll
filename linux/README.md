# 리눅스 서버용 쓰레드(Threads) 자동화 스크립트

이 스크립트는 리눅스 서버 환경에서 쓰레드(Threads) 웹사이트에 자동으로 로그인하고 댓글을 작성하는 기능을 제공합니다.

## 주요 기능

- 인스타그램 SSO 로그인 처리
- 프로필 페이지 방문
- 게시물에 자동 댓글 작성
- 헤드리스 모드 지원 (서버 환경 최적화)
- 오류 발생 시 복구 매커니즘

## 설치 방법

### 필수 요구사항

- Node.js 16 이상
- Playwright 의존성
- Linux 환경 (Ubuntu, CentOS 등)
- Chrome 또는 Chromium 브라우저

### 설치 단계

1. 의존성 설치:

```bash
npm install
```

2. Playwright 브라우저 설치:

```bash
npx playwright install chromium
```

### 환경 설정

리눅스 서버에서 실행하기 위한 추가 설정:

```bash
# Chrome 또는 Chromium 브라우저 설치 (Ubuntu 기준)
sudo apt update
sudo apt install -y chromium-browser

# 필요한 시스템 의존성 설치
sudo apt install -y libatk-bridge2.0-0 libgtk-3-0 libgbm1
```

## 설정 방법

`simple-sso-clicker.js` 파일 내의 config 객체를 수정하여 설정을 변경할 수 있습니다:

```javascript
const config = {
  cookiePath: "instagram_cookies.json", // 쿠키 파일 경로
  username: "your_username", // 인스타그램 계정명
  targetProfile: "your_profile", // 댓글을 달 타겟 프로필
  headless: true, // 헤드리스 모드 활성화 (서버에서는 true 권장)
  commentText: "hello", // 작성할 댓글 내용
  // 기타 설정...
};
```

## 실행 방법

```bash
node simple-sso-clicker.js
```

## 환경 변수 설정

특정 Chrome 경로를 지정하려면 환경 변수를 사용합니다:

```bash
CHROME_PATH=/usr/bin/chromium-browser node simple-sso-clicker.js
```

## 오류 해결

### 권한 문제 발생 시

리눅스 서버에서 실행 시 권한 문제가 발생할 경우:

```bash
# 실행 권한 부여
chmod +x simple-sso-clicker.js

# 또는 root 권한 필요 시
sudo node simple-sso-clicker.js
```

### 메모리 부족 오류

서버에서 메모리 부족 오류가 발생하는 경우:

```bash
NODE_OPTIONS="--max-old-space-size=4096" node simple-sso-clicker.js
```

## 주의사항

- 헤드리스 모드로 실행 시 GUI가 표시되지 않습니다.
- 서버에서 실행 시 `--no-sandbox` 플래그가 필요할 수 있습니다(스크립트 내 기본 포함).
- 장시간 실행 시 메모리 사용량을 모니터링하세요.
