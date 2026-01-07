let t=null,r=!document.hidden;async function l(){try{const e=await chrome.runtime.sendMessage({type:"CHECK_SITE",payload:{url:window.location.href}});if(e!=null&&e.blocked&&(e!=null&&e.site))return chrome.runtime.sendMessage({type:"INCREMENT_BLOCKED_ATTEMPT",payload:{domain:e.site.pattern}}),h(e.site.pattern,e.site.id),!0}catch{}return!1}function h(e,i){window.stop();const o=()=>{document.documentElement.innerHTML=`
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
    `};document.documentElement?o():document.addEventListener("DOMContentLoaded",o)}function n(e,i){try{chrome.runtime.sendMessage({type:e,payload:i})}catch{u()}}function a(){document.hidden||n("HEARTBEAT",{url:window.location.href,timestamp:Date.now()})}function s(){const e=!document.hidden;e!==r&&(r=e,n("VISIBILITY_CHANGE",{visible:e,url:window.location.href,timestamp:Date.now()}),e?d():c())}function d(){t||(a(),t=window.setInterval(a,15e3))}function c(){t&&(clearInterval(t),t=null)}function u(){c(),document.removeEventListener("visibilitychange",s)}async function m(){await l()||(document.addEventListener("visibilitychange",s),document.hidden||d(),n("CONTENT_SCRIPT_READY",{visible:!document.hidden,url:window.location.href,timestamp:Date.now()}))}m();
