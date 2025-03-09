// 存儲用戶設置
let settings = {
  adSpeed: 4.0, // 廣告默認加速 4 倍
  videoSpeed: 1.0, // 影片默認正常速度
};

// 當前是否正在播放廣告
let isPlayingAd = false;

// 上次檢測到的視頻 ID
let lastVideoId = "";

// 獲取用戶設置
function getSettings() {
  chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
    if (response) {
      settings.adSpeed = response.adSpeed;
      settings.videoSpeed = response.videoSpeed;
      console.log("已獲取設置:", settings);

      // 立即應用設置
      if (isPlayingAd) {
        setVideoSpeed(settings.adSpeed);
      } else {
        setVideoSpeed(settings.videoSpeed);
      }
    }
  });
}

// 檢查是否有廣告正在播放
function checkForAd() {
  // YouTube 廣告有幾種不同的標識方式，我們需要檢查多個元素

  // 檢查跳過廣告按鈕
  const skipButton =
    document.querySelector(".ytp-ad-skip-button") ||
    document.querySelector(".ytp-ad-skip-button-modern");

  // 檢查廣告覆蓋層
  const adOverlay = document.querySelector(".ytp-ad-player-overlay");

  // 檢查廣告文本標籤
  const adText = document.querySelector(".ytp-ad-text");

  // 檢查廣告進度條
  const adProgressBar = document.querySelector(".ytp-ad-progress-list");

  // 檢查廣告資訊面板
  const adInfoPanel = document.querySelector(".ytp-ad-info-panel-container");

  // 檢查廣告徽章
  const adBadge = document.querySelector(".ytp-ad-badge");

  // 檢查廣告倒計時
  const adCountdown = document.querySelector(".ytp-ad-duration-remaining");

  return !!(
    skipButton ||
    adOverlay ||
    adText ||
    adProgressBar ||
    adInfoPanel ||
    adBadge ||
    adCountdown
  );
}

// 獲取當前 YouTube 視頻 ID
function getCurrentVideoId() {
  const url = window.location.href;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : "";
}

// 設置視頻播放速度
function setVideoSpeed(speed) {
  const video = document.querySelector("video");
  if (video) {
    video.playbackRate = speed;
    console.log(`播放速度已設置為 ${speed}x`);
  }
}

// 主要處理函數
function handleAdPlayback() {
  const video = document.querySelector("video");
  if (!video) return;

  const currentlyPlayingAd = checkForAd();

  // 檢查視頻 ID 是否變更（用戶切換了視頻）
  const currentVideoId = getCurrentVideoId();
  if (currentVideoId && currentVideoId !== lastVideoId) {
    lastVideoId = currentVideoId;
    console.log("檢測到視頻切換，重新應用設置");
    isPlayingAd = false; // 重置廣告狀態
  }

  // 如果狀態發生變化
  if (currentlyPlayingAd !== isPlayingAd) {
    isPlayingAd = currentlyPlayingAd;

    if (isPlayingAd) {
      // 廣告開始播放，加速
      console.log("檢測到廣告，加速播放");
      setVideoSpeed(settings.adSpeed);
    } else {
      // 廣告結束，恢復正常速度
      console.log("廣告結束，恢復正常速度");
      setVideoSpeed(settings.videoSpeed);
    }
  } else if (isPlayingAd && video.playbackRate !== settings.adSpeed) {
    // 確保廣告始終以設定的速度播放（防止 YouTube 重置速度）
    setVideoSpeed(settings.adSpeed);
  }
}

// 重置並重新初始化
function resetAndReinitialize() {
  console.log("重置並重新初始化");
  isPlayingAd = false;
  lastVideoId = getCurrentVideoId();
  getSettings();
  handleAdPlayback();
}

// 更新設置
function updateSettings(newSettings) {
  if (newSettings.adSpeed !== undefined) {
    settings.adSpeed = newSettings.adSpeed;
  }
  if (newSettings.videoSpeed !== undefined) {
    settings.videoSpeed = newSettings.videoSpeed;
  }

  console.log("設置已更新:", settings);

  // 立即應用新設置
  if (isPlayingAd) {
    setVideoSpeed(settings.adSpeed);
  } else {
    setVideoSpeed(settings.videoSpeed);
  }
}

// 初始化
function initialize() {
  // 獲取用戶設置
  getSettings();

  // 獲取當前視頻 ID
  lastVideoId = getCurrentVideoId();

  // 設置定期檢查廣告的間隔（降低到 500ms 以提高響應速度）
  setInterval(handleAdPlayback, 500);

  // 監聽設置變更
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.adSpeed) {
      settings.adSpeed = changes.adSpeed.newValue;

      // 如果當前是廣告，則立即應用新的廣告速度
      if (isPlayingAd) {
        setVideoSpeed(settings.adSpeed);
      }
    }
    if (changes.videoSpeed) {
      settings.videoSpeed = changes.videoSpeed.newValue;

      // 如果當前不是廣告，則立即應用新的視頻速度
      if (!isPlayingAd) {
        setVideoSpeed(settings.videoSpeed);
      }
    }
  });

  // 監聽頁面導航事件，以便在用戶切換視頻時重新檢查
  const observer = new MutationObserver((mutations) => {
    // 只在有意義的 DOM 變化時執行檢查，減少不必要的處理
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
        handleAdPlayback();
        break;
      }
    }
  });

  // 觀察 DOM 變化，特別是視頻播放器區域
  const playerContainer = document.querySelector("#player") || document.body;
  observer.observe(playerContainer, {
    childList: true,
    subtree: true,
  });

  // 監聽 URL 變化（用於 SPA 頁面切換）
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        lastVideoId = getCurrentVideoId();
        handleAdPlayback();
      }, 1000); // 給頁面一些時間加載
    }
  }).observe(document, { subtree: true, childList: true });

  // 監聽來自背景腳本和彈出窗口的消息
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "pageReloaded") {
      // 頁面重新加載時重置並重新初始化
      resetAndReinitialize();
    } else if (message.type === "settingsUpdated" && message.settings) {
      // 設置更新時更新本地設置並應用
      updateSettings(message.settings);
    }
  });
}

// 當頁面加載完成後初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
