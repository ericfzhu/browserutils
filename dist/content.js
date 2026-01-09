let b=null,E=!document.hidden,n=null,w=null,i=!1,o=null;function l(){return window.location.hostname==="www.youtube.com"&&(window.location.pathname==="/watch"||window.location.pathname.startsWith("/shorts/"))}function Y(){var m,h,v,y;if(!l())return null;if(console.log("[YouTube Content] Media Session metadata:",(m=navigator.mediaSession)==null?void 0:m.metadata),(v=(h=navigator.mediaSession)==null?void 0:h.metadata)!=null&&v.artist){const c=navigator.mediaSession.metadata.artist;console.log("[YouTube Content] Got channel from Media Session:",c);const t=document.querySelector("ytd-channel-name #text a, #owner ytd-channel-name a, #owner #channel-name a");let f,g;if(t!=null&&t.href){g=t.href;const r=t.href.match(/\/@([^/]+)/),s=t.href.match(/\/channel\/([^/]+)/);f=(r==null?void 0:r[1])||(s==null?void 0:s[1])}return{name:c,id:f,url:g}}console.log("[YouTube Content] Media Session not available, trying DOM scraping");let e=null;if(window.location.pathname==="/watch"?e=document.querySelector("ytd-channel-name #text a, #owner ytd-channel-name a, ytd-video-owner-renderer ytd-channel-name a, #owner #channel-name a"):window.location.pathname.startsWith("/shorts/")&&(e=document.querySelector("ytd-reel-video-renderer[is-active] #channel-name a, ytd-reel-video-renderer[is-active] ytd-channel-name a, #shorts-container ytd-channel-name a, ytd-shorts .ytd-channel-name a")),console.log("[YouTube Content] DOM channel element found:",!!e),e){const c=(y=e.textContent)==null?void 0:y.trim(),t=e.getAttribute("href");console.log("[YouTube Content] DOM channel name:",c,"href:",t);let f,g;if(t){g=t.startsWith("http")?t:`https://www.youtube.com${t}`;const r=t.match(/\/@([^/]+)/),s=t.match(/\/channel\/([^/]+)/);f=(r==null?void 0:r[1])||(s==null?void 0:s[1])}if(c)return{name:c,id:f,url:g}}return console.log("[YouTube Content] Could not find channel info"),null}function p(){if(console.log("[YouTube Content] Play event fired"),!l()){console.log("[YouTube Content] Not on video page, ignoring");return}i=!0;const e=Y();console.log("[YouTube Content] Channel info:",e),e?(n=e,console.log("[YouTube Content] Sending YOUTUBE_CHANNEL_UPDATE for:",e.name),a("YOUTUBE_CHANNEL_UPDATE",{channelName:e.name,channelId:e.id,channelUrl:e.url,url:window.location.href,timestamp:Date.now()})):console.log("[YouTube Content] Could not get channel info")}function u(){console.log("[YouTube Content] Pause/ended event fired, isYouTubePlaying:",i),i&&(i=!1,n&&(console.log("[YouTube Content] Sending YOUTUBE_VISIBILITY_CHANGE (pause) for:",n.name),a("YOUTUBE_VISIBILITY_CHANGE",{visible:!1,channelName:n.name,channelId:n.id,channelUrl:n.url,url:window.location.href,timestamp:Date.now()})))}function d(){const e=document.querySelector("video.html5-main-video, video.video-stream");console.log("[YouTube Content] setupVideoListeners, found video:",!!e,"current:",!!o),e&&e!==o&&(console.log("[YouTube Content] Setting up new video element listeners"),o&&(o.removeEventListener("play",p),o.removeEventListener("pause",u),o.removeEventListener("ended",u)),o=e,e.addEventListener("play",p),e.addEventListener("pause",u),e.addEventListener("ended",u),console.log("[YouTube Content] Video state - paused:",e.paused,"ended:",e.ended),!e.paused&&!e.ended&&(console.log("[YouTube Content] Video already playing, triggering play handler"),p()))}function C(){if(!l()||(d(),!i))return;const e=Y();e&&((!n||n.name!==e.name||n.id!==e.id)&&(n&&a("YOUTUBE_VISIBILITY_CHANGE",{visible:!1,channelName:n.name,channelId:n.id,channelUrl:n.url,url:window.location.href,timestamp:Date.now()}),n=e),a("YOUTUBE_CHANNEL_UPDATE",{channelName:e.name,channelId:e.id,channelUrl:e.url,url:window.location.href,timestamp:Date.now()}))}function T(){i&&n&&a("YOUTUBE_VISIBILITY_CHANGE",{visible:!1,channelName:n.name,channelId:n.id,channelUrl:n.url,url:window.location.href,timestamp:Date.now()}),i=!1,o=null,n=null,l()&&(setTimeout(d,500),setTimeout(d,1500),setTimeout(d,3e3))}function U(){document.addEventListener("yt-navigate-finish",T),window.addEventListener("popstate",()=>{setTimeout(T,100)}),l()&&(d(),setTimeout(d,1e3),setTimeout(d,3e3))}function A(){k(),document.removeEventListener("yt-navigate-finish",T),o&&(o.removeEventListener("play",p),o.removeEventListener("pause",u),o.removeEventListener("ended",u),o=null),i&&n&&a("YOUTUBE_VISIBILITY_CHANGE",{visible:!1,channelName:n.name,channelId:n.id,channelUrl:n.url,url:window.location.href,timestamp:Date.now()}),n=null,i=!1}function N(){w||(w=window.setInterval(()=>{l()&&C()},15e3))}function k(){w&&(clearInterval(w),w=null)}async function S(){try{const e=await chrome.runtime.sendMessage({type:"CHECK_SITE",payload:{url:window.location.href}});if(e!=null&&e.blocked&&(e!=null&&e.site))return chrome.runtime.sendMessage({type:"INCREMENT_BLOCKED_ATTEMPT",payload:{domain:e.site.pattern}}),_(e.site.pattern,e.site.id),!0}catch{}return!1}function _(e,m){window.stop();const h=()=>{document.documentElement.innerHTML=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Site Blocked - BrowserUtils</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            max-width: 400px;
            width: 100%;
            padding: 32px;
            text-align: center;
          }
          .icon {
            width: 64px;
            height: 64px;
            background: #fee2e2;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
          }
          .icon svg {
            width: 32px;
            height: 32px;
            color: #dc2626;
          }
          h1 {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 8px;
          }
          .pattern {
            color: #6b7280;
            margin-bottom: 24px;
          }
          .pattern strong {
            color: #374151;
          }
          .message {
            color: #6b7280;
            margin-bottom: 24px;
          }
          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #6b7280;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 8px;
            transition: background 0.2s;
            cursor: pointer;
            border: none;
            background: none;
            font-size: 14px;
          }
          .back-btn:hover {
            background: #f3f4f6;
            color: #111827;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1>Site Blocked</h1>
          <p class="pattern"><strong>${e}</strong> is blocked</p>
          <p class="message">This site has been blocked by BrowserUtils.</p>
          <button class="back-btn" onclick="history.back()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
        </div>
      </body>
      </html>
    `};document.documentElement?h():document.addEventListener("DOMContentLoaded",h)}function a(e,m){try{chrome.runtime.sendMessage({type:e,payload:m})}catch{D()}}function I(){document.hidden||(a("HEARTBEAT",{url:window.location.href,timestamp:Date.now()}),l()&&C())}function x(){const e=!document.hidden;e!==E&&(E=e,a("VISIBILITY_CHANGE",{visible:e,url:window.location.href,timestamp:Date.now()}),e?(B(),k()):(L(),l()&&N()))}function B(){b||(I(),b=window.setInterval(I,15e3))}function L(){b&&(clearInterval(b),b=null)}function D(){L(),A(),document.removeEventListener("visibilitychange",x)}async function H(){await S()||(document.addEventListener("visibilitychange",x),document.hidden||B(),window.location.hostname==="www.youtube.com"&&U(),a("CONTENT_SCRIPT_READY",{visible:!document.hidden,url:window.location.href,timestamp:Date.now()}))}H();
