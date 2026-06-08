# Live-Log - 실시간 과몰입 중계 SNS

## 프로젝트 소개

**Live-Log**는 영화, 드라마, 소설, 웹툰, 만화, 애니메이션, 공연, 게임을 감상하면서  
작품명과 현재 진도를 기준으로 감상을 기록하고 다른 사용자와 실시간으로 공유하는 SNS입니다.

일반 SNS의 자유로운 게시물 구조에 `[카테고리]`, `[작품명]`, `[진도]`를 결합하여  
같은 작품을 감상하는 사용자들이 현재 감상 지점을 쉽게 파악할 수 있도록 설계했습니다.

또한 Google Gemini를 이용해 게시물의 스포일러 가능성을 자동 분석하고,  
다른 사용자가 작성한 스포일러 게시물은 사용자가 직접 열기 전까지 내용을 가립니다.

- 작품과 진도 중심의 구조화된 감상 기록
- 팔로우 관계 및 사용자 반응을 기반으로 구성되는 타임라인
- 댓글, 인용, 리포스트, 좋아요, 북마크 등 SNS 상호작용
- 이미지·동영상 첨부와 전용 미디어 뷰어
- Socket.IO 기반 실시간 알림 및 1:1 채팅
- Gemini 기반 스포일러 자동 판별
- 신고 게시물 처리를 위한 관리자 전용 페이지

---

## 프로젝트 기간

**2026.05.29 ~ 2026.06.08**

| 기간 | 작업 내용 |
|------|-----------|
| 05.29 ~ 05.31 | 서비스 기획, 데이터베이스 및 인증 구조 설계 |
| 06.01 ~ 06.03 | 메인 레이아웃, 게시물 CRUD, 미디어 업로드 구현 |
| 06.04 ~ 06.05 | 소셜 기능, 프로필, 검색, 스포일러 처리 구현 |
| 06.06 ~ 06.07 | 실시간 알림, 채팅, 관리자 기능 구현 |
| 06.08 | 통합 테스트, 오류 수정, 시연 데이터 구성 |

---

## 개발 인원

### 김현동

- **GitHub**: [Medo-skb](https://github.com/Medo-skb)
- **Email**: [kiryto0912@gmail.com](mailto:kiryto0912@gmail.com)
- 개인 포트폴리오 프로젝트
- 서비스 기획, UI/UX 설계, 데이터베이스 설계, 프론트엔드 및 백엔드 전체 구현

---

## 사용 기술

### Frontend

<img src="https://img.shields.io/badge/React 18-61DAFB?style=for-the-badge&logo=react&logoColor=black"> <img src="https://img.shields.io/badge/React Router-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white"> <img src="https://img.shields.io/badge/Material UI-007FFF?style=for-the-badge&logo=mui&logoColor=white"> <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"> <img src="https://img.shields.io/badge/Socket.IO Client-010101?style=for-the-badge&logo=socketdotio&logoColor=white">

### Backend

<img src="https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white"> <img src="https://img.shields.io/badge/Express 5-000000?style=for-the-badge&logo=express&logoColor=white"> <img src="https://img.shields.io/badge/Oracle Database-F80000?style=for-the-badge&logo=oracle&logoColor=white"> <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white"> <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white">

### APIs & Tools

<img src="https://img.shields.io/badge/Google Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white"> <img src="https://img.shields.io/badge/Google OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white"> <img src="https://img.shields.io/badge/Nodemailer-22B573?style=for-the-badge&logo=gmail&logoColor=white"> <img src="https://img.shields.io/badge/Multer-333333?style=for-the-badge"> <img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white"> <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white">

---

## 주요 기능

### 회원 및 인증

- 아이디, 비밀번호, 이메일, 닉네임 기반 회원가입
- 이메일 인증 링크 발송 및 인증 완료 처리
- JWT 기반 로그인 인증과 보호된 라우팅
- Google OAuth 로그인
- 로그인 세션 만료 시 로그인 페이지로 이동
- 일반 사용자와 관리자 역할 분리
- 관리자 계정의 일반 검색, 팔로우, DM 등 사용자 상호작용 차단
- 최초 로그인 시 관심 카테고리 선택 및 저장

### 메인 피드

- 관심 카테고리별 상단 탭 제공
- 내 게시물, 팔로우한 사용자의 게시물, 인기 게시물을 조합한 피드
- 최신 게시물과 리포스트 기준 타임라인 정렬
- 커서 기반 무한 스크롤
- 새로운 게시물 감지 및 피드 갱신
- 왼쪽 메뉴와 오른쪽 정보 영역을 고정한 3단 레이아웃
- 라이트 모드와 다크 모드 지원

### 게시물

- 카테고리, 작품명, 진도, 내용, 태그를 포함한 구조화된 게시물 작성
- 게시물 등록, 조회, 수정, 소프트 삭제
- 댓글 및 스레드 작성
- 인용 게시물 작성
- 일반 리포스트 및 리포스트 취소
- 좋아요 및 북마크
- 게시물 URL 복사 및 신고
- 본인 게시물과 타인 게시물에 따른 메뉴 분기
- 사용자 작성 태그 및 태그 피드 이동

### 미디어

- 이미지와 동영상 업로드
- 이미지 최대 10MB, 동영상 최대 30MB 제한
- 업로드 전 파일 형식 및 용량 검증
- 게시물 작성 전 미디어 미리보기
- 원본 비율을 고려한 피드 미디어 표시
- `/{username}/status/{postId}/photo/{index}` 형식의 미디어 전용 주소
- 미디어 뷰어 내 댓글, 리포스트, 좋아요, 북마크 상호작용

### AI 스포일러 필터

- 게시물 등록 및 수정 시 Gemini API 자동 호출
- 카테고리, 작품명, 진도, 본문을 바탕으로 스포일러 여부 분석
- 분석 결과를 `IS_SPOILER`에 저장
- 작성자 본인에게는 게시물 원문 표시
- 다른 사용자의 스포일러 게시물은 본문, 태그, 미디어, 인용 영역을 숨김
- 사용자가 `게시물 보기`를 선택한 경우에만 전체 내용 공개
- 사용자 설정에서 스포일러 필터 사용 여부 관리

### 프로필 및 소셜

- 사용자별 `/{username}` 프로필 주소
- 프로필 이미지, 배너 이미지, 닉네임, 자기소개 수정
- 작성 게시물 및 좋아요한 게시물 조회
- 팔로우 및 팔로우 취소
- 팔로워·팔로잉 목록 조회
- 추천 사용자 및 사용자 전용 검색
- 사용자 차단 및 차단 해제
- 다른 사용자 프로필에서 바로 DM 시작

### 검색

- 작품명, 본문, 사용자, 태그 통합 검색
- 일반 검색어와 사용자 검색 결과 추천
- `#` 입력 시 태그 전용 자동완성
- 태그 클릭 시 태그 피드로 이동
- 실제 게시물 언급량을 기준으로 인기 태그 집계
- 관리자 계정 검색 결과 제외

### 실시간 알림

- 댓글, 좋아요, 리포스트, 인용, 팔로우 알림
- Socket.IO 사용자별 Room 기반 실시간 전달
- 전체 알림 및 읽지 않은 알림 조회
- 개별 읽음 및 전체 읽음 처리
- 읽지 않은 알림 수 표시
- 알림 클릭 시 관련 게시물 또는 사용자 프로필로 이동

### 1:1 채팅

- Socket.IO 기반 실시간 DM
- 사용자 검색 및 추천 사용자에서 새 채팅 시작
- 대화 목록과 읽지 않은 메시지 수 표시
- 전체 및 읽지 않은 대화 필터
- 팔로우 관계가 없는 사용자 메시지를 분리하는 쪽지 보관함
- 메시지 읽음 처리 및 삭제
- 차단 관계에서 메시지 전송 제한
- 관리자 계정의 DM 대상 제외

### 관리자

- 관리자 로그인 시 `/admin` 전용 페이지로 이동
- JWT와 역할 검증을 통한 관리자 API 보호
- 접수된 게시물 신고 목록 조회
- 신고 승인 및 반려
- 관리자 메모와 처리 시각 저장
- 신고 승인 시 대상 게시물 소프트 삭제
- 관리자 계정과 일반 사용자 기능 분리

---

## 핵심 구현 내용

### 피드 조회 정책

메인 피드는 모든 게시물을 단순 노출하지 않고 다음 조건을 조합합니다.

1. 현재 사용자가 작성한 게시물
2. 현재 사용자가 팔로우한 사용자의 게시물
3. 좋아요, 리포스트, 댓글 합계가 기준 이상인 인기 게시물
4. 현재 사용자의 팔로우 관계에 포함된 사용자의 리포스트

### 게시물 소프트 삭제

게시물 삭제 시 실제 행을 제거하지 않고 다음 값을 갱신합니다.

```sql
IS_DELETED = 1
DELETED_AT = CURRENT_TIMESTAMP
```

조회 쿼리에서는 `IS_DELETED = 0`인 게시물만 노출하여 사용자 화면에서는 삭제하되,  
신고 처리와 운영 기록을 위해 데이터는 유지합니다.

### 실시간 통신

- JWT를 이용해 Socket.IO 연결 사용자 인증
- 사용자 ID를 기준으로 개인 Room 생성
- 알림과 DM 발생 시 대상 사용자의 Room으로 이벤트 전송
- REST API를 데이터 저장과 초기 조회에 사용하고 Socket.IO를 실시간 갱신에 사용

---

## 주요 데이터베이스 테이블

| 구분 | 테이블 | 설명 |
|------|--------|------|
| 회원 | `USERS` | 계정, 프로필, 이메일 인증, 역할, 스포일러 설정 |
| 회원 미디어 | `USER_MEDIA` | 프로필 및 배너 이미지 이력 |
| 관심사 | `CATEGORY`, `USER_CATEGORY` | 카테고리와 사용자 관심 카테고리 |
| 작품 | `WORKS` | 카테고리별 작품 정보 |
| 게시물 | `POSTS` | 게시물, 댓글, 인용, 스포일러, 소프트 삭제 |
| 게시물 미디어 | `POST_MEDIA` | 이미지 및 동영상 파일 정보 |
| 태그 | `POST_TAG` | 게시물별 사용자 작성 태그 |
| 상호작용 | `POST_LIKE`, `REPOST`, `POST_BOOKMARK` | 좋아요, 리포스트, 북마크 |
| 소셜 | `FOLLOWS`, `USER_BLOCK` | 팔로우 및 차단 관계 |
| 알림 | `NOTICE` | 사용자 활동 알림 |
| 채팅 | `DM` | 1:1 메시지와 읽음 상태 |
| 신고 | `REPORT` | 게시물 신고와 관리자 처리 상태 |
| AI | `AI_ANALYSIS_LOG` | AI 스포일러 분석 결과 |

---

## 화면 경로

| 경로 | 화면 |
|------|------|
| `/` | 로그인 |
| `/join` | 회원가입 |
| `/verify-email` | 이메일 인증 |
| `/home` | 메인 피드 |
| `/onboarding` | 관심 카테고리 선택 |
| `/explore` | 통합 검색 |
| `/alerts` | 알림 |
| `/follow` | 사용자 검색 및 추천 |
| `/chat` | 1:1 채팅 |
| `/bookmark` | 북마크 |
| `/settings` | 사용자 설정 |
| `/{username}` | 사용자 프로필 |
| `/{username}/following` | 팔로잉 목록 |
| `/{username}/followers` | 팔로워 목록 |
| `/{username}/status/{postId}` | 게시물 상세 |
| `/{username}/status/{postId}/photo/{index}` | 미디어 뷰어 |
| `/admin` | 관리자 전용 페이지 |

---

## 실행 방법

### 1. 저장소 복제

```bash
git clone https://github.com/Medo-skb/live-log.git
cd live-log
git checkout dev
```

### 2. Oracle Database 준비

- Oracle Database 21c XE
- 기본 리스너 포트: `1521`
- 프로젝트 테이블과 초기 데이터 생성
- 애플리케이션 계정에 필요한 테이블 및 시퀀스 권한 부여

### 3. Backend 환경 변수

`express-back/.env`

```env
jwt_key=YOUR_JWT_SECRET
JWT_EXPIRES_IN=1h
SALT_ROUNDS=10
EMAIL_VERIFY_EXPIRY_MIN=30
API_PUBLIC_URL=http://localhost:3010

db_user=YOUR_ORACLE_USER
db_pwd=YOUR_ORACLE_PASSWORD
db_address=localhost:1521/XE

EMAIL_USER=YOUR_EMAIL
EMAIL_PASS=YOUR_EMAIL_APP_PASSWORD
EMAIL_SERVICE=gmail

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
REACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID

AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash-lite
```

### 4. Frontend 환경 변수

`react-front/.env`

```env
REACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
REACT_APP_SOCKET_URL=http://localhost:3010
```

### 5. Backend 실행

```bash
cd express-back
npm install
node app.js
```

Backend: `http://localhost:3010`

### 6. Frontend 실행

```bash
cd react-front
npm install
npm start
```

Frontend: `http://localhost:3000`

---

## 프로젝트 구조

```text
live-log/
├── express-back/
│   ├── app.js                    # Express 및 Socket.IO 서버 진입점
│   ├── auth.js                   # JWT 인증 미들웨어
│   ├── db.js                     # Oracle Connection Pool
│   ├── socket.js                 # Socket.IO 연결 및 사용자 Room 관리
│   ├── routes/
│   │   ├── auth.js               # 회원가입, 로그인, 이메일 및 Google 인증
│   │   ├── categories.js         # 카테고리 조회
│   │   ├── userCategories.js     # 사용자 관심 카테고리
│   │   ├── users.js              # 프로필, 검색, 추천, 팔로우, 차단
│   │   ├── posts.js              # 게시물 CRUD 및 상호작용
│   │   ├── search.js             # 검색어 추천 및 인기 태그
│   │   ├── notices.js            # 알림 조회 및 읽음 처리
│   │   ├── dms.js                # 1:1 채팅
│   │   └── admin.js              # 관리자 신고 처리
│   ├── services/
│   │   ├── aiAnalysis.js         # Gemini 스포일러 분석
│   │   └── noticeSocket.js       # 실시간 알림 전송
│   └── uploads/                  # 게시물 및 사용자 업로드 파일
│
└── react-front/
    ├── public/
    └── src/
        ├── api/                   # 기능별 REST API 모듈
        ├── components/
        │   ├── common/            # 인증 라우트 및 공통 모달
        │   ├── menu/              # 피드, 검색, 알림, 채팅, 프로필 등
        │   ├── post/              # 게시물, 작성 모달, 미디어 미리보기
        │   └── user/              # 로그인, 회원가입, 이메일 인증
        ├── css/                   # 레이아웃 및 다크 모드 스타일
        ├── utils/                 # 인증, 미디어, 게시물 유틸리티
        ├── App.js                 # React Router 구성
        └── index.js               # React 진입점
```

---

## 향후 개선 사항

- 대용량 피드 조회를 위한 복합 인덱스 및 쿼리 성능 개선
- 이미지 리사이징 및 썸네일 생성
- 채팅 파일 첨부와 메시지 전달 상태
- 신고 대상과 관리자 제재 범위 확장
- AI 분석 실패 시 재처리 큐와 분석 결과 모니터링
- 단위 테스트 및 통합 테스트 자동화
- 배포 환경 구성과 CI/CD 적용

---

## 문의

프로젝트 관련 문의는 [kiryto0912@gmail.com](mailto:kiryto0912@gmail.com)으로 연락해주세요.

