# Live-Log - 실시간 중계 SNS

<div align="center">
  <img src="docs/images/01-main-feed.png" width="900" alt="Live-Log 메인 피드">
</div>

<br>

| 게시물 작성 | AI 스포일러 필터 | 실시간 채팅 |
|---|---|---|
| <img src="docs/images/02-post-compose.png" width="100%" alt="게시물 작성"> | <img src="docs/images/03-spoiler-filter.png" width="100%" alt="스포일러 필터"> | <img src="docs/images/08-chat.png" width="100%" alt="실시간 채팅"> |

> 작품명과 현재 진도를 중심으로 감상을 기록하고 실시간으로 공유하는 SNS

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

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [프로젝트 기간](#프로젝트-기간)
- [개발 인원](#개발-인원)
- [사용 기술](#사용-기술)
- [주요 기능](#주요-기능)
- [프로젝트 구조](#프로젝트-구조)
- [향후 개선 사항](#향후-개선-사항)

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

- 이메일 인증을 포함한 회원가입 및 JWT 로그인
- Google OAuth 간편 로그인
- 최초 로그인 시 관심 카테고리 선택
- 일반 사용자와 관리자 권한 및 화면 분리

### 메인 피드

- 관심 카테고리별 피드 제공
- 팔로우 사용자와 인기 게시물을 조합한 타임라인
- 커서 기반 무한 스크롤과 새 게시물 갱신
- 고정 사이드바 및 라이트·다크 모드 지원

<img src="docs/images/01-main-feed.png" width="100%" alt="Live-Log 메인 피드">

### 게시물

- 카테고리, 작품명, 진도, 내용, 태그 기반 게시물 작성
- 게시물 등록, 조회, 수정 및 소프트 삭제
- 댓글, 인용, 리포스트를 통한 상호작용
- 좋아요, 북마크, URL 복사 및 신고

<img src="docs/images/02-post-compose.png" width="100%" alt="게시물 작성 화면">
<img src="docs/images/04-post-detail.png" width="100%" alt="게시물 상세 화면">

### 미디어

- 이미지 및 동영상 업로드와 미리보기
- 파일 형식 및 용량 제한 검증
- 원본 비율을 고려한 피드 미디어 표시
- 고유 주소와 상호작용 기능을 제공하는 미디어 뷰어

<img src="docs/images/05-media-viewer.png" width="100%" alt="미디어 뷰어">

### AI 스포일러 필터

- 게시물 등록 및 수정 시 Gemini API 자동 분석
- 작품 정보와 본문을 기반으로 스포일러 여부 저장
- 다른 사용자의 스포일러 게시물 전체 내용 숨김
- 사용자 선택 시 게시물 공개 및 필터 설정 지원

| 스포일러 숨김 | 게시물 공개 |
|---|---|
| <img src="docs/images/03-spoiler-filter.png" width="100%" alt="스포일러 숨김"> | <img src="docs/images/03-spoiler-revealed.png" width="100%" alt="스포일러 공개"> |

### 프로필 및 소셜

- 사용자별 프로필과 프로필 이미지·배너 수정
- 작성 게시물 및 좋아요한 게시물 조회
- 팔로우, 팔로워·팔로잉 목록 및 사용자 추천
- 사용자 차단과 프로필에서 DM 시작

<img src="docs/images/06-profile.png" width="100%" alt="사용자 프로필">

### 검색

- 작품명, 본문, 사용자, 태그 통합 검색
- 검색어 및 사용자 자동완성
- `#` 기반 태그 검색과 태그 피드 이동
- 게시물 언급량 기반 인기 태그 제공

<img src="docs/images/07-search.png" width="100%" alt="통합 검색">

### 실시간 알림

- 댓글, 좋아요, 리포스트, 인용, 팔로우 알림
- Socket.IO 기반 사용자별 실시간 전달
- 읽지 않은 알림 수와 개별·전체 읽음 처리
- 알림에서 관련 게시물 또는 프로필로 이동

<img src="docs/images/09-notifications.png" width="100%" alt="실시간 알림">

### 1:1 채팅

- Socket.IO 기반 실시간 1:1 메시지
- 사용자 검색과 추천을 통한 새 채팅 시작
- 읽지 않은 대화 필터 및 쪽지 보관함
- 메시지 읽음·삭제와 차단 관계 전송 제한

<img src="docs/images/08-chat.png" width="100%" alt="실시간 채팅">

### 관리자

- 관리자 로그인 시 전용 관리 페이지로 이동
- JWT와 역할 검증을 통한 관리자 API 보호
- 게시물 신고 조회, 승인 및 반려
- 승인된 신고 게시물 소프트 삭제와 처리 기록 저장

<img src="docs/images/10-admin.png" width="100%" alt="관리자 신고 관리">

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

- 외부 API를 통한 작품 검색
- 사용자 개인별 스포일러 필터 상세 설정
- 이미지 리사이징 및 썸네일 생성
- 채팅 파일 첨부와 메시지 전달 상태
- 신고 대상과 관리자 제재 범위 확장
- AI 분석 실패 시 재처리 큐와 분석 결과 모니터링

---

## 문의

프로젝트 관련 문의는 [kiryto0912@gmail.com](mailto:kiryto0912@gmail.com)으로 연락해주세요.
