// 初始化擴充功能的默認設置
chrome.runtime.onInstalled.addListener(() => {
  console.log("擴充功能已安裝或更新");

  // 設置默認的廣告加速倍數和影片播放速度
  chrome.storage.local.get(["settings"], (data) => {
    // 只有在設置不存在時才設置默認值
    const settings = data.settings || {
      adSpeed: 4.0,
      videoSpeed: 1.0,
    };

    chrome.storage.local.set({ settings: settings }, () => {
      console.log("設置已初始化:", settings);
    });
  });
});

// 監聽標籤頁更新事件，確保在頁面重新加載時內容腳本能夠正確運行
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只在頁面完成加載且是 YouTube 頁面時執行
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("youtube.com")
  ) {
    console.log("YouTube 頁面已加載完成:", tab.url);

    // 向標籤頁發送消息，通知頁面已重新加載
    chrome.tabs
      .sendMessage(tabId, { type: "pageReloaded" })
      .then((response) => {
        console.log("頁面重新加載消息已發送，回應:", response);
      })
      .catch((error) => {
        // 這可能是因為內容腳本尚未加載，不需要處理錯誤
        console.log(
          "發送頁面重新加載消息時出錯 (可能是內容腳本尚未加載):",
          error
        );
      });
  }
});

// 監聽來自內容腳本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("背景腳本收到消息:", message, "來自:", sender);

  if (message.type === "getSettings") {
    // 當內容腳本請求設置時，返回當前設置
    chrome.storage.local.get(["settings"], (data) => {
      // 確保返回有效的設置值，如果不存在則使用默認值
      const settings = data.settings || {
        adSpeed: 4.0,
        videoSpeed: 1.0,
      };

      console.log("返回設置:", settings);
      sendResponse(settings);
    });
    return true; // 表示將異步發送回應
  } else if (message.type === "currentYouTubeSpeed") {
    // 當內容腳本發送當前 YouTube 播放速度時，轉發給彈出窗口
    console.log("收到當前 YouTube 播放速度:", message);

    // 不需要轉發，彈出窗口會直接從內容腳本接收消息
    sendResponse({ success: true });
    return true;
  } else if (message.type === "checkContentScriptLoaded") {
    // 當彈出窗口請求檢查內容腳本是否已載入時
    if (sender.tab) {
      // 如果消息來自標籤頁，則不處理
      sendResponse({ error: "此消息應由彈出窗口發送" });
      return true;
    }

    // 獲取當前活動的標籤頁
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (
        tabs.length > 0 &&
        tabs[0].url &&
        tabs[0].url.includes("youtube.com")
      ) {
        const tabId = tabs[0].id;

        // 直接嘗試發送 ping 消息檢查內容腳本是否已載入
        // 不再檢查標籤頁是否在活動的 YouTube 標籤頁集合中
        chrome.tabs
          .sendMessage(tabId, { type: "ping" })
          .then((response) => {
            if (response && response.success) {
              console.log("內容腳本已載入");
              sendResponse({ loaded: true, tabId: tabId });
            } else {
              console.log("內容腳本未正確響應");
              sendResponse({
                loaded: false,
                tabId: tabId,
                error: "內容腳本未正確響應",
              });
            }
          })
          .catch((error) => {
            console.log("內容腳本未載入或發生錯誤:", error);

            // 檢查是否是連接錯誤
            if (
              error.message &&
              error.message.includes("Receiving end does not exist")
            ) {
              sendResponse({
                loaded: false,
                tabId: tabId,
                error: "內容腳本未載入，請重新載入頁面",
              });
            } else {
              sendResponse({
                loaded: false,
                tabId: tabId,
                error: error.message,
              });
            }
          });
      } else {
        console.log("當前沒有活動的 YouTube 標籤頁");
        sendResponse({
          loaded: false,
          error: "請在 YouTube 視頻頁面使用此擴充功能",
        });
      }
    });

    return true; // 表示將異步發送回應
  }
});
