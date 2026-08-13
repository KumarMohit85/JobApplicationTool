chrome.runtime.onInstalled.addListener(() => {
  console.info('[ApplyKit] Extension installed.');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true, version: '0.1.0' });
    return true;
  }
  return false;
});
