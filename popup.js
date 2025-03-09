// 當彈出窗口加載完成時執行
document.addEventListener("DOMContentLoaded", () => {
  // 獲取 DOM 元素
  const adSpeedSlider = document.getElementById("adSpeed");
  const adSpeedValue = document.getElementById("adSpeedValue");
  const videoSpeedSlider = document.getElementById("videoSpeed");
  const videoSpeedValue = document.getElementById("videoSpeedValue");
  const statusElement = document.getElementById("status");
  const resetButton = document.getElementById("resetButton");

  // 預設設置值
  const defaultSettings = {
    adSpeed: 4.0,
    videoSpeed: 1.0,
  };

  // 防抖函數，用於減少保存操作的頻率
  function debounce(func, wait) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }

  // 從存儲中獲取當前設置
  chrome.storage.sync.get(["adSpeed", "videoSpeed"], (data) => {
    // 設置滑塊的初始值
    if (data.adSpeed !== undefined) {
      adSpeedSlider.value = data.adSpeed;
      adSpeedValue.textContent = `${data.adSpeed.toFixed(1)}x`;
    }

    if (data.videoSpeed !== undefined) {
      videoSpeedSlider.value = data.videoSpeed;
      videoSpeedValue.textContent = `${data.videoSpeed.toFixed(2)}x`;
    }
  });

  // 顯示保存狀態的函數
  function showStatus(message) {
    statusElement.textContent = message;
    statusElement.style.opacity = "1";
    setTimeout(() => {
      statusElement.style.opacity = "0";
    }, 2000);
  }

  // 保存設置的函數
  const saveSettings = debounce(function () {
    const adSpeed = parseFloat(adSpeedSlider.value);
    const videoSpeed = parseFloat(videoSpeedSlider.value);

    chrome.storage.sync.set(
      {
        adSpeed: adSpeed,
        videoSpeed: videoSpeed,
      },
      () => {
        showStatus("設置已保存");

        // 嘗試將設置應用到當前活動的 YouTube 標籤頁
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (
            tabs.length > 0 &&
            tabs[0].url &&
            tabs[0].url.includes("youtube.com")
          ) {
            chrome.tabs
              .sendMessage(tabs[0].id, {
                type: "settingsUpdated",
                settings: { adSpeed, videoSpeed },
              })
              .catch(() => {
                // 忽略錯誤
              });
          }
        });
      }
    );
  }, 300); // 300ms 的延遲

  // 恢復預設設置的函數
  function resetToDefaults() {
    // 更新滑塊和顯示值
    adSpeedSlider.value = defaultSettings.adSpeed;
    adSpeedValue.textContent = `${defaultSettings.adSpeed.toFixed(1)}x`;

    videoSpeedSlider.value = defaultSettings.videoSpeed;
    videoSpeedValue.textContent = `${defaultSettings.videoSpeed.toFixed(2)}x`;

    // 保存預設設置
    chrome.storage.sync.set(
      {
        adSpeed: defaultSettings.adSpeed,
        videoSpeed: defaultSettings.videoSpeed,
      },
      () => {
        showStatus("已恢復預設設置");

        // 嘗試將設置應用到當前活動的 YouTube 標籤頁
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (
            tabs.length > 0 &&
            tabs[0].url &&
            tabs[0].url.includes("youtube.com")
          ) {
            chrome.tabs
              .sendMessage(tabs[0].id, {
                type: "settingsUpdated",
                settings: defaultSettings,
              })
              .catch(() => {
                // 忽略錯誤
              });
          }
        });
      }
    );
  }

  // 監聽廣告速度滑塊變化
  adSpeedSlider.addEventListener("input", () => {
    const value = parseFloat(adSpeedSlider.value);
    adSpeedValue.textContent = `${value.toFixed(1)}x`;
  });

  // 監聽廣告速度滑塊變化結束
  adSpeedSlider.addEventListener("change", saveSettings);

  // 監聽視頻速度滑塊變化
  videoSpeedSlider.addEventListener("input", () => {
    const value = parseFloat(videoSpeedSlider.value);
    videoSpeedValue.textContent = `${value.toFixed(2)}x`;
  });

  // 監聽視頻速度滑塊變化結束
  videoSpeedSlider.addEventListener("change", saveSettings);

  // 添加即時保存功能，使用戶在拖動滑塊時也能看到效果
  adSpeedSlider.addEventListener("input", saveSettings);
  videoSpeedSlider.addEventListener("input", saveSettings);

  // 監聽恢復預設按鈕點擊事件
  resetButton.addEventListener("click", resetToDefaults);
});
