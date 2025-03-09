// 初始化擴充功能的默認設置
chrome.runtime.onInstalled.addListener(() => {
  // 設置默認的廣告加速倍數和影片播放速度
  chrome.storage.sync.get(["adSpeed", "videoSpeed"], (data) => {
    // 只有在設置不存在時才設置默認值
    const settings = {
      adSpeed: data.adSpeed !== undefined ? data.adSpeed : 2.0,
      videoSpeed: data.videoSpeed !== undefined ? data.videoSpeed : 1.0,
    };

    chrome.storage.sync.set(settings, () => {
      console.log("設置已初始化:", settings);
    });
  });
});

// 監聽來自內容腳本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getSettings") {
    // 當內容腳本請求設置時，返回當前設置
    chrome.storage.sync.get(["adSpeed", "videoSpeed"], (data) => {
      // 確保返回有效的設置值，如果不存在則使用默認值
      sendResponse({
        adSpeed: data.adSpeed !== undefined ? data.adSpeed : 2.0,
        videoSpeed: data.videoSpeed !== undefined ? data.videoSpeed : 1.0,
      });
    });
    return true; // 表示將異步發送回應
  }
});

// 監聽標籤頁更新事件，確保在頁面重新加載時內容腳本能夠正確運行
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只在頁面完成加載且是 YouTube 頁面時執行
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("youtube.com")
  ) {
    // 向標籤頁發送消息，通知頁面已重新加載
    chrome.tabs.sendMessage(tabId, { type: "pageReloaded" }).catch(() => {
      // 忽略錯誤，這可能是因為內容腳本尚未加載
    });
  }
});
