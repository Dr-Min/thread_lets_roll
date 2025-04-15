const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 요청을 파싱하기 위한 미들웨어
app.use(express.json());

// 웹훅 엔드포인트 정의
app.post('/webhook', (req, res) => {
  // 웹훅 요청에서 URL 추출
  const url = req.body.url;
  
  if (!url) {
    return res.status(400).json({ error: '유효한 URL이 제공되지 않았습니다.' });
  }
  
  console.log(`웹훅 수신: ${url}`);
  
  // config.json 업데이트 - commentText 값 변경
  try {
    // simple-sso-clicker.js 파일 읽기
    const ssoPath = path.join(__dirname, 'simple-sso-clicker.js');
    let ssoContent = fs.readFileSync(ssoPath, 'utf8');
    
    // commentText 부분 수정 (정규식 사용)
    const commentTextRegex = /(commentText\s*:\s*)["']([^"']*)["']/;
    const updatedContent = ssoContent.replace(commentTextRegex, `$1"${url}"`);
    
    // 파일 쓰기
    fs.writeFileSync(ssoPath, updatedContent);
    console.log('simple-sso-clicker.js의 commentText 업데이트 완료');
    
    // 설정 파일도 업데이트
    try {
      const configPath = path.join(__dirname, 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 댓글 내용을 받은 URL로 업데이트
      config.commentLink = url;
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('config.json 업데이트 완료');
    } catch (configError) {
      console.error('config.json 업데이트 실패:', configError);
      // config.json 업데이트 실패해도 계속 진행
    }
    
    // simple-sso-clicker.js 실행
    const ssoBot = spawn('node', ['simple-sso-clicker.js']);
    
    ssoBot.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    
    ssoBot.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
    
    ssoBot.on('close', (code) => {
      console.log(`simple-sso-clicker.js 프로세스 종료, 코드: ${code}`);
    });
    
    return res.status(200).json({ 
      success: true, 
      message: '웹훅 수신 및 처리 중', 
      received_url: url 
    });
    
  } catch (error) {
    console.error('simple-sso-clicker.js 업데이트 실패:', error);
    return res.status(500).json({ 
      error: 'simple-sso-clicker.js 업데이트 중 오류 발생',
      details: error.message
    });
  }
});

// 서버 상태 확인 엔드포인트
app.get('/status', (req, res) => {
  return res.status(200).json({
    status: 'running',
    message: '웹훅 서버가 정상적으로 실행 중입니다.'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`웹훅 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log('POST /webhook 엔드포인트로 URL을 보내세요.');
}); 