// 설치 가능한 웹앱을 위한 최소 서비스 워커. 지금은 캐시도 푸시도 하지 않고 모든 요청을 그대로 네트워크에 맡긴다.
// (오래된 화면이 남는 문제를 피하려고 일부러 아무것도 가로채지 않는다. 웹 푸시는 서버가 필요해 별도 단계에서 추가한다.)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
