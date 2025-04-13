#!/bin/bash

# 색상 설정
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 시작 메시지
echo -e "${BLUE}=== 쓰레드 자동화 스크립트 설치 시작 ===${NC}"
echo -e "${YELLOW}이 스크립트는 필요한 모든 의존성을 설치합니다.${NC}"

# 작업 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo -e "${GREEN}작업 디렉토리: ${SCRIPT_DIR}${NC}"
cd "$SCRIPT_DIR"

# 스크린샷 디렉토리 생성
mkdir -p screenshots
echo -e "${GREEN}✅ 스크린샷 디렉토리 생성 완료${NC}"

# Node.js 및 npm 확인
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${RED}Node.js 또는 npm이 설치되어 있지 않습니다.${NC}"
    echo -e "${YELLOW}Node.js와 npm을 먼저 설치해주세요:${NC}"
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 및 npm 확인 완료${NC}"
echo "Node.js 버전: $(node -v)"
echo "npm 버전: $(npm -v)"

# 필요한 시스템 패키지 설치 (Ubuntu/Debian 기준)
echo -e "${YELLOW}필요한 시스템 패키지 설치 중...${NC}"
if command -v apt-get &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y wget curl ca-certificates libglib2.0-0 libnss3 libnspr4 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 libxi6 libx11-6 \
    libxcb1 libxext6 libxcursor1 libxtst6 libxss1 xvfb
    echo -e "${GREEN}✅ 시스템 패키지 설치 완료${NC}"
else
    echo -e "${YELLOW}apt-get을 찾을 수 없습니다. 수동으로 필요한 패키지를 설치해주세요.${NC}"
fi

# npm 의존성 설치
echo -e "${YELLOW}npm 의존성 설치 중...${NC}"
npm install --no-audit --no-fund

# Playwright 설치 (브라우저 포함)
echo -e "${YELLOW}Playwright 및 브라우저 설치 중...${NC}"
npx playwright install chromium
npx playwright install-deps

# 크롬 경로 확인 및 설정
CHROME_PATH=$(which google-chrome 2>/dev/null || which chromium-browser 2>/dev/null || which chromium 2>/dev/null)
if [ -n "$CHROME_PATH" ]; then
    echo -e "${GREEN}✅ 크롬 브라우저 경로 설정: ${CHROME_PATH}${NC}"
    echo "export CHROME_PATH=\"$CHROME_PATH\"" > .env
else
    echo -e "${YELLOW}크롬이나 크로미움 브라우저를 찾을 수 없습니다. Playwright가 내장 브라우저를 사용합니다.${NC}"
fi

# 완료 메시지
echo -e "${GREEN}=== 설치가 완료되었습니다! ===${NC}"
echo -e "${YELLOW}쓰레드 자동화 스크립트를 실행하려면:${NC}"
echo -e "${BLUE}node simple-sso-clicker.js${NC}"
echo -e "${YELLOW}도움이 필요하면 README.md 파일을 참조하세요.${NC}"

# 실행 권한 부여
chmod +x simple-sso-clicker.js
echo -e "${GREEN}✅ 실행 권한 부여 완료${NC}" 