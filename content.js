// 存儲用戶設置
let settings = {
  adSpeed: 4.0, // 廣告默認加速 4 倍
  videoSpeed: 1.0, // 影片默認正常速度
};

// 當前是否正在播放廣告
let isPlayingAd = false;

// 上次檢測到的視頻 ID
let lastVideoId = "";

// 上次應用的播放速度
let lastAppliedSpeed = null;

// 是否由插件控制播放速度
let isControlledByExtension = false;

// 上次廣告狀態
let lastAdState = false;

// 獲取當前 YouTube 播放速度
function getCurrentYouTubeSpeed() {
  try {
    const video = document.querySelector("video");
    if (video) {
      return video.playbackRate;
    }
  } catch (error) {
    console.error("獲取 YouTube 播放速度時發生錯誤:", error);
  }
  return 1.0; // 默認返回 1.0
}

// 獲取用戶設置
function getSettings() {
  chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
    if (response) {
      settings.adSpeed = response.adSpeed;
      settings.videoSpeed = response.videoSpeed;
      console.log("已獲取設置:", settings);

      // 立即應用設置，但只在廣告播放時或明確由插件控制時
      if (isPlayingAd) {
        setVideoSpeed(settings.adSpeed, true);
      } else if (isControlledByExtension) {
        setVideoSpeed(settings.videoSpeed, true);
      }
    }
  });
}

// 向彈出窗口發送當前 YouTube 播放速度
function sendCurrentSpeedToPopup() {
  try {
    const currentSpeed = getCurrentYouTubeSpeed();

    // 檢查 chrome.runtime 是否存在
    if (chrome && chrome.runtime) {
      chrome.runtime.sendMessage(
        {
          type: "currentYouTubeSpeed",
          speed: currentSpeed,
          isPlayingAd: isPlayingAd,
          isControlledByExtension: isControlledByExtension,
          settings: {
            adSpeed: settings.adSpeed,
            videoSpeed: settings.videoSpeed,
          },
        },
        (response) => {
          // 檢查是否有錯誤
          if (chrome.runtime.lastError) {
            // 忽略錯誤，這是正常的，當彈出窗口未打開時會發生
            console.log(
              "發送消息時出現錯誤（彈出窗口可能未打開）:",
              chrome.runtime.lastError.message
            );
            return;
          }

          // 如果成功，記錄響應
          if (response) {
            console.log("彈出窗口已接收消息:", response);
          }
        }
      );

      console.log("已嘗試發送當前播放狀態:", {
        currentSpeed,
        isPlayingAd,
        isControlledByExtension,
        adSpeed: settings.adSpeed,
        videoSpeed: settings.videoSpeed,
      });
    } else {
      console.warn("無法發送消息：chrome.runtime 不可用");
    }
  } catch (error) {
    console.error("發送當前速度到彈出窗口時出錯:", error);
  }
}

// 檢查是否有廣告正在播放
function checkForAd() {
  // 添加詳細日誌，記錄檢查開始
  console.log("開始檢查是否有廣告播放...");

  // 檢查是否有明確的廣告標記（這是最可靠的指標）
  const hasAdMarker = document.querySelector(".ad-showing") !== null;
  const hasAdText = document.querySelector(".ytp-ad-text") !== null;
  const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;
  const hasAdSimpleBadge =
    document.querySelector(".ytp-ad-simple-ad-badge") !== null;
  const hasAdInfoButton =
    document.querySelector(".ytp-ad-info-dialog-btn") !== null;
  const hasAdSkipButton =
    document.querySelector(".ytp-ad-skip-button") !== null ||
    document.querySelector(".ytp-ad-skip-button-modern") !== null;
  const hasAdOverlay =
    document.querySelector(".ytp-ad-player-overlay") !== null;

  // 記錄檢測到的廣告元素
  const adElements = {
    hasAdMarker: hasAdMarker,
    hasAdText: hasAdText,
    hasAdBadge: hasAdBadge,
    hasAdSimpleBadge: hasAdSimpleBadge,
    hasAdInfoButton: hasAdInfoButton,
    hasAdSkipButton: hasAdSkipButton,
    hasAdOverlay: hasAdOverlay,
  };

  // 檢查是否有明確的影片元素（通常廣告沒有）
  const hasVideoTitle = document.querySelector(".ytp-title-link") !== null;
  const hasVideoTime = document.querySelector(".ytp-time-display") !== null;
  const hasVideoProgress = document.querySelector(".ytp-progress-bar") !== null;

  // 記錄檢測到的影片元素
  const videoElements = {
    hasVideoTitle: hasVideoTitle,
    hasVideoTime: hasVideoTime,
    hasVideoProgress: hasVideoProgress,
  };

  // 只有在有明確的廣告標記時才判定為廣告
  if (
    hasAdMarker ||
    hasAdText ||
    hasAdBadge ||
    hasAdSimpleBadge ||
    hasAdSkipButton
  ) {
    console.log("檢測到明確的廣告元素:", adElements);
    return true;
  }

  // 如果有明確的影片元素但沒有廣告元素，則判定為非廣告
  if (
    hasVideoTitle &&
    hasVideoTime &&
    !hasAdMarker &&
    !hasAdText &&
    !hasAdBadge &&
    !hasAdSimpleBadge
  ) {
    console.log("檢測到明確的影片元素，判定為非廣告:", videoElements);
    return false;
  }

  // 如果無法確定，則默認為非廣告
  console.log("無法確定是否為廣告，默認為非廣告");
  return false;
}

// 獲取當前 YouTube 視頻 ID
function getCurrentVideoId() {
  const url = window.location.href;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : "";
}

// 設置視頻播放速度
function setVideoSpeed(speed, forceControl = false) {
  const video = document.querySelector("video");
  if (!video) {
    console.warn("未找到視頻元素，無法設置播放速度");
    return;
  }

  // 添加詳細日誌，記錄調用信息
  console.log(
    `setVideoSpeed 被調用 - 目標速度: ${speed}, 強制控制: ${forceControl}, 當前速度: ${video.playbackRate}, 是否為廣告: ${isPlayingAd}, 是否由插件控制: ${isControlledByExtension}`
  );

  // 如果是強制控制或已經由插件控制，則設置速度
  if (forceControl || isControlledByExtension) {
    // 檢查速度是否已經應用，避免重複設置
    if (lastAppliedSpeed !== speed) {
      // 添加詳細日誌，記錄當前狀態和設置的速度
      console.log(
        `設置播放速度 - 當前狀態: isPlayingAd=${isPlayingAd}, isControlledByExtension=${isControlledByExtension}, 當前速度=${video.playbackRate}, 目標速度=${speed}, 廣告速度=${settings.adSpeed}, 影片速度=${settings.videoSpeed}`
      );

      // 檢查是否是廣告速度被錯誤應用到非廣告影片
      if (!isPlayingAd && speed === settings.adSpeed) {
        console.warn("警告：嘗試將廣告速度應用到非廣告影片，這可能是錯誤的");
        // 如果不是廣告但嘗試應用廣告速度，則應用影片速度
        if (forceControl) {
          console.log("強制應用影片速度而非廣告速度:", settings.videoSpeed);
          video.playbackRate = settings.videoSpeed;
          lastAppliedSpeed = settings.videoSpeed;
          isControlledByExtension = true;
          return;
        }
      }

      // 檢查是否是影片速度被錯誤應用到廣告
      if (isPlayingAd && speed === settings.videoSpeed) {
        console.warn("警告：嘗試將影片速度應用到廣告，這可能是錯誤的");
        // 如果是廣告但嘗試應用影片速度，則應用廣告速度
        if (forceControl) {
          console.log("強制應用廣告速度而非影片速度:", settings.adSpeed);
          video.playbackRate = settings.adSpeed;
          lastAppliedSpeed = settings.adSpeed;
          isControlledByExtension = true;
          return;
        }
      }

      // 正常設置速度
      try {
        video.playbackRate = speed;
        lastAppliedSpeed = speed;
        isControlledByExtension = true;
        console.log(`播放速度已設置為 ${speed}x (由插件控制)`);
      } catch (error) {
        console.error("設置播放速度時發生錯誤:", error);
      }

      // 設置多次重試，確保速度被正確設置
      let retryCount = 0;
      const maxRetries = 5;
      const retryInterval = 200; // 200ms

      const checkAndRetry = () => {
        const currentVideo = document.querySelector("video");
        if (!currentVideo) {
          console.warn("重試時未找到視頻元素");
          return;
        }

        if (currentVideo.playbackRate !== speed) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(
              `警告：播放速度設置失敗，當前速度為 ${currentVideo.playbackRate}x，目標速度為 ${speed}x，重試 (${retryCount}/${maxRetries})`
            );
            try {
              currentVideo.playbackRate = speed;
              // 再次檢查是否設置成功
              setTimeout(checkAndRetry, retryInterval);
            } catch (error) {
              console.error("重試設置播放速度時發生錯誤:", error);
            }
          } else {
            console.error(
              `播放速度設置失敗，已重試 ${maxRetries} 次，當前速度為 ${currentVideo.playbackRate}x，目標速度為 ${speed}x`
            );
          }
        } else {
          console.log(
            `播放速度設置成功，當前速度為 ${currentVideo.playbackRate}x`
          );
        }
      };

      // 延遲檢查速度是否真的被設置
      setTimeout(checkAndRetry, retryInterval);
    }
  } else {
    console.log(`保留 YouTube 原生播放速度: ${video.playbackRate}x`);
  }
}

// 強制應用當前設置
function forceApplyCurrentSettings() {
  // 嘗試獲取視頻元素
  const video = document.querySelector("video");
  if (!video) {
    // 如果找不到視頻元素，不輸出錯誤，靜默返回
    return;
  }

  try {
    // 再次檢查是否有明確的廣告標記
    const hasAdMarker = document.querySelector(".ad-showing") !== null;
    const hasAdText = document.querySelector(".ytp-ad-text") !== null;
    const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;
    const hasAdSkipButton =
      document.querySelector(".ytp-ad-skip-button") !== null ||
      document.querySelector(".ytp-ad-skip-button-modern") !== null;

    // 只有在有明確廣告標記時才設置為廣告
    const currentlyPlayingAd =
      hasAdMarker || hasAdText || hasAdBadge || hasAdSkipButton;

    // 如果廣告狀態與當前記錄不符，則更新
    if (currentlyPlayingAd !== isPlayingAd) {
      console.log(
        `強制應用設置時檢測到廣告狀態不一致: ${isPlayingAd} -> ${currentlyPlayingAd}`
      );
      isPlayingAd = currentlyPlayingAd;
    }

    console.log(
      `強制應用當前設置 - 當前播放速度: ${video.playbackRate}x, 是否為廣告: ${isPlayingAd}, 是否由插件控制: ${isControlledByExtension}, 廣告速度: ${settings.adSpeed}, 影片速度: ${settings.videoSpeed}`
    );

    // 如果是廣告且速度不正確，則應用廣告速度
    if (isPlayingAd && video.playbackRate !== settings.adSpeed) {
      console.log("強制應用廣告速度");
      video.playbackRate = settings.adSpeed;
      lastAppliedSpeed = settings.adSpeed;
      console.log(`廣告播放速度已設置為 ${settings.adSpeed}x`);
    }
    // 如果不是廣告且由插件控制，則應用影片速度
    else if (
      !isPlayingAd &&
      isControlledByExtension &&
      video.playbackRate !== settings.videoSpeed
    ) {
      console.log("強制應用影片速度");
      video.playbackRate = settings.videoSpeed;
      lastAppliedSpeed = settings.videoSpeed;
      console.log(`影片播放速度已設置為 ${settings.videoSpeed}x`);
    }
    // 如果不是廣告且不由插件控制，但速度等於廣告速度，則重置為 YouTube 默認速度
    else if (
      !isPlayingAd &&
      !isControlledByExtension &&
      video.playbackRate === settings.adSpeed
    ) {
      console.log("檢測到非廣告影片以廣告速度播放，重置為 YouTube 默認速度");
      video.playbackRate = 1.0;
      lastAppliedSpeed = 1.0;
      console.log("影片播放速度已重置為 YouTube 默認速度: 1.0x");
    }
  } catch (error) {
    // 捕獲並記錄任何錯誤，但不中斷執行
    console.error("強制應用設置時發生錯誤:", error);
  }
}

// 主要處理函數
function handleAdPlayback() {
  // 嘗試獲取視頻元素
  const video = document.querySelector("video");
  if (!video) {
    // 如果找不到視頻元素，不輸出錯誤，靜默返回
    // 這是因為這個函數會被頻繁調用，我們不希望控制台被錯誤信息淹沒
    return;
  }

  try {
    // 獲取當前視頻 ID
    const currentVideoId = getCurrentVideoId();

    // 如果視頻 ID 變化，表示用戶切換了視頻
    if (currentVideoId && currentVideoId !== lastVideoId) {
      console.log(`視頻 ID 變化: ${lastVideoId} -> ${currentVideoId}`);
      lastVideoId = currentVideoId;

      // 視頻切換時，重置廣告狀態為非廣告
      isPlayingAd = false;
      lastAdState = false;

      // 檢查是否有明確的廣告標記
      const hasAdMarker = document.querySelector(".ad-showing") !== null;
      const hasAdText = document.querySelector(".ytp-ad-text") !== null;
      const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;
      const hasAdSkipButton =
        document.querySelector(".ytp-ad-skip-button") !== null ||
        document.querySelector(".ytp-ad-skip-button-modern") !== null;

      // 只有在有明確廣告標記時才設置為廣告
      if (hasAdMarker || hasAdText || hasAdBadge || hasAdSkipButton) {
        isPlayingAd = true;
        console.log("視頻切換後檢測到廣告");
      }
    }

    // 使用更嚴格的標準檢查當前是否為廣告
    const currentlyPlayingAd = checkForAd();

    // 如果廣告狀態發生變化
    if (currentlyPlayingAd !== isPlayingAd) {
      console.log(`廣告狀態變化: ${isPlayingAd} -> ${currentlyPlayingAd}`);
      isPlayingAd = currentlyPlayingAd;

      // 如果從非廣告變為廣告，則由插件控制
      if (isPlayingAd) {
        isControlledByExtension = true;
      }
    }

    // 記錄當前狀態
    console.log(
      `處理廣告播放 - 當前播放速度: ${video.playbackRate}x, 是否為廣告: ${isPlayingAd}, 是否由插件控制: ${isControlledByExtension}, 廣告速度: ${settings.adSpeed}, 影片速度: ${settings.videoSpeed}`
    );

    // 如果廣告狀態發生變化
    if (isPlayingAd !== lastAdState) {
      console.log(`廣告狀態變化: ${lastAdState} -> ${isPlayingAd}`);

      if (isPlayingAd) {
        // 廣告開始播放
        console.log("廣告開始播放，應用廣告速度");
        // 直接設置廣告速度，不經過 setVideoSpeed 函數
        video.playbackRate = settings.adSpeed;
        lastAppliedSpeed = settings.adSpeed;
        console.log(`廣告播放速度已設置為 ${settings.adSpeed}x`);
      } else {
        // 廣告結束
        console.log("廣告結束，恢復影片速度");

        if (isControlledByExtension) {
          // 直接設置影片速度，不經過 setVideoSpeed 函數
          video.playbackRate = settings.videoSpeed;
          lastAppliedSpeed = settings.videoSpeed;
          console.log(`影片播放速度已設置為 ${settings.videoSpeed}x`);
        } else {
          console.log("保留 YouTube 原生播放速度");

          // 但是，如果當前速度等於廣告速度，則重置為 YouTube 默認速度
          if (video.playbackRate === settings.adSpeed) {
            console.log("檢測到影片仍以廣告速度播放，重置為 YouTube 默認速度");
            video.playbackRate = 1.0;
            lastAppliedSpeed = 1.0;
          }
        }
      }

      // 更新上一次的廣告狀態
      lastAdState = isPlayingAd;
    } else if (isPlayingAd && video.playbackRate !== settings.adSpeed) {
      // 確保廣告始終以設定的速度播放（防止 YouTube 重置速度）
      console.log("檢測到廣告播放速度被重置，重新應用廣告速度");
      // 直接設置廣告速度，不經過 setVideoSpeed 函數
      video.playbackRate = settings.adSpeed;
      lastAppliedSpeed = settings.adSpeed;
      console.log(`廣告播放速度已重新設置為 ${settings.adSpeed}x`);
    } else if (
      isControlledByExtension &&
      !isPlayingAd &&
      video.playbackRate !== settings.videoSpeed
    ) {
      // 只有在由插件控制且非廣告播放時，才檢查速度是否被重置
      console.log("檢測到視頻播放速度被重置，重新應用視頻速度");
      // 直接設置影片速度，不經過 setVideoSpeed 函數
      video.playbackRate = settings.videoSpeed;
      lastAppliedSpeed = settings.videoSpeed;
      console.log(`影片播放速度已重新設置為 ${settings.videoSpeed}x`);
    } else if (
      !isPlayingAd &&
      lastAdState &&
      video.playbackRate === settings.adSpeed
    ) {
      // 特殊情況：廣告剛結束，但速度仍然是廣告速度
      console.log("檢測到廣告結束但速度未恢復，強制應用正確速度");
      lastAppliedSpeed = null; // 強制重置上次應用的速度

      if (isControlledByExtension) {
        // 直接設置影片速度，不經過 setVideoSpeed 函數
        video.playbackRate = settings.videoSpeed;
        lastAppliedSpeed = settings.videoSpeed;
        console.log(`影片播放速度已強制設置為 ${settings.videoSpeed}x`);
      } else {
        // 重置為 YouTube 默認速度
        video.playbackRate = 1.0;
        lastAppliedSpeed = 1.0;
        console.log("影片播放速度已重置為 YouTube 默認速度: 1.0x");
      }
    }

    // 手動檢查一次廣告狀態，確保判斷正確
    if (isPlayingAd) {
      // 再次檢查是否真的是廣告
      const hasAdMarker = document.querySelector(".ad-showing") !== null;
      const hasAdText = document.querySelector(".ytp-ad-text") !== null;
      const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;
      const hasAdSkipButton =
        document.querySelector(".ytp-ad-skip-button") !== null ||
        document.querySelector(".ytp-ad-skip-button-modern") !== null;

      const doubleCheck =
        hasAdMarker || hasAdText || hasAdBadge || hasAdSkipButton;

      if (!doubleCheck) {
        console.warn("廣告狀態可能錯誤，重新檢查...");
        // 如果沒有明確的廣告標記，但我們認為是廣告，可能是誤判
        const videoTitle = document.querySelector(".ytp-title-link");
        const videoTime = document.querySelector(".ytp-time-display");

        if (videoTitle && videoTime) {
          console.log("檢測到影片元素，但當前狀態為廣告，可能是誤判");
          // 強制更正狀態
          isPlayingAd = false;
          lastAdState = false;
          // 應用正確的速度
          if (isControlledByExtension) {
            video.playbackRate = settings.videoSpeed;
            lastAppliedSpeed = settings.videoSpeed;
            console.log(
              `已強制更正狀態並設置影片速度為 ${settings.videoSpeed}x`
            );
          } else {
            video.playbackRate = 1.0;
            lastAppliedSpeed = 1.0;
            console.log(
              "已強制更正狀態並設置影片速度為 YouTube 默認速度: 1.0x"
            );
          }
        }
      }
    }
  } catch (error) {
    // 捕獲並記錄任何錯誤，但不中斷執行
    console.error("處理廣告播放時發生錯誤:", error);
  }
}

// 重置並重新初始化
function resetAndReinitialize() {
  console.log("重置並重新初始化");
  isPlayingAd = false;
  lastAdState = false;
  lastVideoId = getCurrentVideoId();
  lastAppliedSpeed = null;

  // 檢查是否有廣告
  const hasAd = checkForAd();

  // 只有在有廣告時才由插件控制，否則保持當前控制狀態
  if (hasAd) {
    isPlayingAd = true;
    isControlledByExtension = true;
  }

  getSettings();
  handleAdPlayback();

  // 檢查是否有影片以廣告速度播放的情況
  checkVideoPlaybackRate();
}

// 更新設置
function updateSettings(newSettings) {
  console.log("收到新設置:", newSettings);

  // 記錄舊設置，用於比較
  const oldSettings = { ...settings };

  // 記錄是否有更改
  let adSpeedChanged = false;
  let videoSpeedChanged = false;
  let controlStatusChanged = false;

  if (newSettings.adSpeed !== undefined) {
    adSpeedChanged = settings.adSpeed !== newSettings.adSpeed;
    settings.adSpeed = newSettings.adSpeed;
  }
  if (newSettings.videoSpeed !== undefined) {
    videoSpeedChanged = settings.videoSpeed !== newSettings.videoSpeed;
    settings.videoSpeed = newSettings.videoSpeed;
  }
  if (newSettings.isControlledByExtension !== undefined) {
    controlStatusChanged =
      isControlledByExtension !== newSettings.isControlledByExtension;
    isControlledByExtension = newSettings.isControlledByExtension;
  }

  console.log("設置已更新:", settings);
  console.log("設置變更比較 - 舊設置:", oldSettings, "新設置:", settings);
  console.log(
    "變更狀態 - 廣告速度已變更:",
    adSpeedChanged,
    "影片速度已變更:",
    videoSpeedChanged,
    "控制狀態已變更:",
    controlStatusChanged
  );

  // 是否強制應用設置
  const forceApply = newSettings.forceApply === true;

  // 檢查當前視頻元素
  const video = document.querySelector("video");
  if (!video) {
    console.warn("未找到視頻元素，無法應用設置");
    return;
  }

  // 記錄當前播放速度
  const currentSpeed = video.playbackRate;
  console.log(
    `當前播放速度: ${currentSpeed}x, 是否為廣告: ${isPlayingAd}, 是否由插件控制: ${isControlledByExtension}`
  );

  // 如果不由插件控制，則不應用設置
  if (!isControlledByExtension && !forceApply) {
    console.log("不由插件控制且非強制應用，保留 YouTube 原生播放速度");
    return;
  }

  // 立即應用新設置
  if (isPlayingAd) {
    // 如果是廣告，應用廣告速度
    if (adSpeedChanged || forceApply || currentSpeed !== settings.adSpeed) {
      console.log("當前是廣告，應用廣告速度:", settings.adSpeed);
      video.playbackRate = settings.adSpeed;
      lastAppliedSpeed = settings.adSpeed;
      console.log(`廣告播放速度已設置為 ${settings.adSpeed}x`);
    }
  } else {
    // 如果不是廣告，應用影片速度
    if (
      videoSpeedChanged ||
      forceApply ||
      currentSpeed !== settings.videoSpeed
    ) {
      console.log("當前不是廣告，應用影片速度:", settings.videoSpeed);
      video.playbackRate = settings.videoSpeed;
      lastAppliedSpeed = settings.videoSpeed;
      console.log(`影片播放速度已設置為 ${settings.videoSpeed}x`);
    }
  }

  // 如果強制應用，則確保設置生效
  if (forceApply) {
    // 延遲 100ms 再次應用設置，確保設置生效
    setTimeout(() => {
      const videoAfterDelay = document.querySelector("video");
      if (videoAfterDelay) {
        if (isPlayingAd && videoAfterDelay.playbackRate !== settings.adSpeed) {
          console.log("強制應用廣告播放速度:", settings.adSpeed);
          videoAfterDelay.playbackRate = settings.adSpeed;
          lastAppliedSpeed = settings.adSpeed;
        } else if (
          !isPlayingAd &&
          videoAfterDelay.playbackRate !== settings.videoSpeed
        ) {
          console.log("強制應用影片播放速度:", settings.videoSpeed);
          videoAfterDelay.playbackRate = settings.videoSpeed;
          lastAppliedSpeed = settings.videoSpeed;
        }
      }
    }, 100);

    // 再次延遲 500ms 檢查設置是否生效
    setTimeout(() => {
      const videoAfterLongDelay = document.querySelector("video");
      if (videoAfterLongDelay) {
        if (
          isPlayingAd &&
          videoAfterLongDelay.playbackRate !== settings.adSpeed
        ) {
          console.log(
            "500ms 後檢測到廣告播放速度仍不正確，再次強制應用:",
            settings.adSpeed
          );
          videoAfterLongDelay.playbackRate = settings.adSpeed;
          lastAppliedSpeed = settings.adSpeed;
        } else if (
          !isPlayingAd &&
          videoAfterLongDelay.playbackRate !== settings.videoSpeed
        ) {
          console.log(
            "500ms 後檢測到影片播放速度仍不正確，再次強制應用:",
            settings.videoSpeed
          );
          videoAfterLongDelay.playbackRate = settings.videoSpeed;
          lastAppliedSpeed = settings.videoSpeed;
        } else {
          console.log(
            "500ms 後確認播放速度正確:",
            videoAfterLongDelay.playbackRate
          );
        }
      }
    }, 500);
  }

  // 保存設置到本地存儲
  chrome.storage.local.set({ settings: settings }, () => {
    console.log("設置已保存到本地存儲");
  });
}

// 監聽 YouTube 原生播放速度變更
function setupYouTubeSpeedChangeListener() {
  const video = document.querySelector("video");
  if (video) {
    // 使用 MutationObserver 監聽 playbackRate 屬性變更
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "playbackRate"
        ) {
          // 如果不是由插件控制且不是廣告，則記錄 YouTube 原生速度變更
          if (!isControlledByExtension && !isPlayingAd) {
            console.log("檢測到 YouTube 原生播放速度變更:", video.playbackRate);
            // 同步 YouTube 原生播放速度到插件設置
            syncYouTubeSpeedToSettings(video.playbackRate);
          }
        }
      }
    });

    // 監聽 video 元素的屬性變更
    observer.observe(video, { attributes: true });

    // 監聽 ratechange 事件
    video.addEventListener("ratechange", () => {
      // 如果不是由插件控制且不是廣告，則記錄 YouTube 原生速度變更
      if (!isControlledByExtension && !isPlayingAd) {
        console.log(
          "檢測到 YouTube 原生播放速度變更 (ratechange):",
          video.playbackRate
        );
        // 同步 YouTube 原生播放速度到插件設置
        syncYouTubeSpeedToSettings(video.playbackRate);
      }
    });

    // 初始化時，檢查並同步 YouTube 原生播放速度
    if (!isPlayingAd) {
      console.log("初始檢查 YouTube 原生播放速度:", video.playbackRate);
      syncYouTubeSpeedToSettings(video.playbackRate);
    }
  }
}

// 同步 YouTube 原生播放速度到插件設置
function syncYouTubeSpeedToSettings(speed) {
  try {
    // 確保速度是有效的數字
    if (typeof speed === "number" && !isNaN(speed) && speed > 0) {
      // 只更新影片速度，不更新廣告速度
      if (settings.videoSpeed !== speed) {
        console.log(`同步 YouTube 原生播放速度到插件設置: ${speed}x`);
        settings.videoSpeed = speed;

        // 檢查 chrome.storage 是否存在
        if (chrome && chrome.storage && chrome.storage.local) {
          // 保存設置到本地存儲
          chrome.storage.local.set({ settings: settings }, () => {
            // 檢查是否有錯誤
            if (chrome.runtime.lastError) {
              console.warn(
                "保存設置時出現錯誤:",
                chrome.runtime.lastError.message
              );
              return;
            }
            console.log("已保存同步的播放速度設置:", settings);
          });

          // 通知彈出窗口更新 UI
          try {
            sendCurrentSpeedToPopup();
          } catch (popupError) {
            console.warn("通知彈出窗口時出現錯誤:", popupError);
          }
        } else {
          console.warn("無法保存設置：chrome.storage.local 不可用");
        }
      }
    }
  } catch (error) {
    console.error("同步 YouTube 播放速度到設置時出錯:", error);
  }
}

// 初始化
function initialize() {
  console.log("初始化擴充功能...");

  // 檢查當前頁面是否為 YouTube 視頻頁面
  const isYouTubeVideoPage = () => {
    // 檢查 URL 是否包含 youtube.com/watch
    const isWatchPage = window.location.href.includes("youtube.com/watch");

    // 檢查是否存在視頻播放器容器
    const hasPlayerContainer = document.querySelector("#movie_player") !== null;

    return isWatchPage && hasPlayerContainer;
  };

  // 如果不是 YouTube 視頻頁面，則不進行初始化
  if (!isYouTubeVideoPage()) {
    console.log("當前頁面不是 YouTube 視頻頁面，不進行初始化");

    // 設置一個監聽器，當 URL 變化時重新檢查
    let lastUrl = window.location.href;
    const urlChangeObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log("檢測到 URL 變化，重新檢查頁面類型");

        // 延遲檢查，確保頁面已加載
        setTimeout(() => {
          if (isYouTubeVideoPage()) {
            console.log("當前頁面是 YouTube 視頻頁面，開始初始化");
            initialize();
          }
        }, 1000);
      }
    });

    // 觀察 document 的變化
    urlChangeObserver.observe(document, { subtree: true, childList: true });

    return;
  }

  // 獲取用戶設置
  getSettings();

  // 獲取當前視頻 ID
  lastVideoId = getCurrentVideoId();

  // 初始化時，默認為非廣告狀態
  isPlayingAd = false;
  console.log("初始化時默認為非廣告狀態");

  // 進行廣告檢查，但使用更嚴格的標準
  const hasAdMarker = document.querySelector(".ad-showing") !== null;
  const hasAdText = document.querySelector(".ytp-ad-text") !== null;
  const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;
  const hasAdSkipButton =
    document.querySelector(".ytp-ad-skip-button") !== null ||
    document.querySelector(".ytp-ad-skip-button-modern") !== null;

  // 只有在有明確廣告標記時才設置為廣告
  if (hasAdMarker || hasAdText || hasAdBadge || hasAdSkipButton) {
    isPlayingAd = true;
    console.log("檢測到明確的廣告標記，設置為廣告狀態");
  }

  console.log(
    "初始廣告狀態:",
    isPlayingAd,
    "廣告標記:",
    hasAdMarker,
    "廣告文字:",
    hasAdText,
    "廣告徽章:",
    hasAdBadge,
    "跳過按鈕:",
    hasAdSkipButton
  );

  lastAdState = false;

  // 默認由插件控制播放速度，除非用戶明確設置不控制
  isControlledByExtension = true;
  console.log(
    "初始控制狀態:",
    isControlledByExtension ? "由插件控制" : "由 YouTube 控制"
  );

  // 檢查當前視頻元素
  let video = document.querySelector("video");

  // 如果找不到視頻元素，設置一個輪詢來等待它
  if (!video) {
    console.log("初始化時未找到視頻元素，設置輪詢等待...");

    // 設置一個輪詢，每 200ms 檢查一次視頻元素是否存在
    let waitAttempts = 0;
    const maxWaitAttempts = 50; // 最多等待 10 秒 (50 * 200ms)

    const waitForVideoElement = setInterval(() => {
      waitAttempts++;

      // 再次檢查是否為視頻頁面
      if (!isYouTubeVideoPage()) {
        console.log("頁面不再是 YouTube 視頻頁面，停止等待視頻元素");
        clearInterval(waitForVideoElement);
        return;
      }

      video = document.querySelector("video");
      if (video) {
        console.log(
          `視頻元素已載入，初始化播放速度 (嘗試次數: ${waitAttempts})`
        );
        clearInterval(waitForVideoElement);

        // 檢查 YouTube 原生播放速度
        const youtubeSpeed = video.playbackRate;
        console.log("檢測到 YouTube 原生播放速度:", youtubeSpeed);

        // 如果不是廣告，同步 YouTube 原生播放速度到插件設置
        if (!isPlayingAd && !isControlledByExtension) {
          syncYouTubeSpeedToSettings(youtubeSpeed);
        }

        // 根據當前是否為廣告設置正確的播放速度
        if (isPlayingAd) {
          // 如果是廣告，應用廣告速度
          console.log("初始化時檢測到廣告，應用廣告速度");
          try {
            video.playbackRate = settings.adSpeed;
            lastAppliedSpeed = settings.adSpeed;
          } catch (error) {
            console.error("設置廣告播放速度時發生錯誤:", error);
          }
        } else if (isControlledByExtension) {
          // 如果不是廣告且由插件控制，應用插件設置的影片速度
          console.log("初始化時檢測到非廣告，應用插件設置的影片速度");
          try {
            video.playbackRate = settings.videoSpeed;
            lastAppliedSpeed = settings.videoSpeed;
          } catch (error) {
            console.error("設置影片播放速度時發生錯誤:", error);
          }
        } else {
          // 如果不是廣告且不由插件控制，保留 YouTube 原生播放速度
          console.log(
            "初始化時檢測到非廣告，保留 YouTube 原生播放速度:",
            youtubeSpeed
          );
        }

        // 設置定期檢查和監聽器
        setupIntervals();
      } else if (waitAttempts >= maxWaitAttempts) {
        console.warn(
          `等待視頻元素超時 (${waitAttempts} 次嘗試)，可能在非視頻頁面或視頻尚未準備好`
        );
        clearInterval(waitForVideoElement);

        // 即使超時，也設置定期檢查，以便在視頻元素出現時能夠處理
        setupIntervals();
      }
    }, 200);
  } else {
    console.log(
      `初始化 - 當前播放速度: ${video.playbackRate}x, 是否為廣告: ${isPlayingAd}, 是否由插件控制: ${isControlledByExtension}, 廣告速度: ${settings.adSpeed}, 影片速度: ${settings.videoSpeed}`
    );

    // 檢查 YouTube 原生播放速度
    const youtubeSpeed = video.playbackRate;
    console.log("檢測到 YouTube 原生播放速度:", youtubeSpeed);

    // 如果不是廣告，同步 YouTube 原生播放速度到插件設置
    if (!isPlayingAd && !isControlledByExtension) {
      syncYouTubeSpeedToSettings(youtubeSpeed);
    }

    // 根據當前是否為廣告設置正確的播放速度
    if (isPlayingAd) {
      // 如果是廣告，應用廣告速度
      console.log("初始化時檢測到廣告，應用廣告速度");
      try {
        video.playbackRate = settings.adSpeed;
        lastAppliedSpeed = settings.adSpeed;
      } catch (error) {
        console.error("設置廣告播放速度時發生錯誤:", error);
      }
    } else if (isControlledByExtension) {
      // 如果不是廣告且由插件控制，應用插件設置的影片速度
      console.log("初始化時檢測到非廣告，應用插件設置的影片速度");
      try {
        video.playbackRate = settings.videoSpeed;
        lastAppliedSpeed = settings.videoSpeed;
      } catch (error) {
        console.error("設置影片播放速度時發生錯誤:", error);
      }
    } else {
      // 如果不是廣告且不由插件控制，保留 YouTube 原生播放速度
      console.log(
        "初始化時檢測到非廣告，保留 YouTube 原生播放速度:",
        youtubeSpeed
      );
    }

    // 設置定期檢查和監聽器
    setupIntervals();
  }

  // 設置所有定期檢查和監聽器的函數
  function setupIntervals() {
    // 設置定期檢查廣告的間隔（降低到 500ms 以提高響應速度）
    setInterval(handleAdPlayback, 500);

    // 每 5 秒強制應用一次當前設置，確保設置不會被 YouTube 覆蓋
    setInterval(forceApplyCurrentSettings, 5000);

    // 每 3 秒檢查一次是否有影片以廣告速度播放的情況
    setInterval(checkVideoPlaybackRate, 3000);

    // 每 10 秒進行一次廣告狀態的強制檢查，確保狀態正確
    setInterval(() => {
      // 檢查是否有明確的廣告標記
      const hasAdMarker = document.querySelector(".ad-showing") !== null;
      const hasAdText = document.querySelector(".ytp-ad-text") !== null;
      const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;

      // 檢查是否有明確的影片元素
      const hasVideoTitle = document.querySelector(".ytp-title-link") !== null;
      const hasVideoTime = document.querySelector(".ytp-time-display") !== null;

      // 如果當前狀態是廣告，但沒有廣告標記且有影片元素，則可能是誤判
      if (
        isPlayingAd &&
        !hasAdMarker &&
        !hasAdText &&
        !hasAdBadge &&
        hasVideoTitle &&
        hasVideoTime
      ) {
        console.warn("強制檢查：廣告狀態可能錯誤，強制更正");
        isPlayingAd = false;

        // 應用正確的速度
        const video = document.querySelector("video");
        if (video && isControlledByExtension) {
          try {
            video.playbackRate = settings.videoSpeed;
            lastAppliedSpeed = settings.videoSpeed;
            console.log(
              `已強制更正狀態並設置影片速度為 ${settings.videoSpeed}x`
            );
          } catch (error) {
            console.error("強制更正狀態時設置播放速度發生錯誤:", error);
          }
        }
      }
    }, 10000);

    // 嘗試設置 YouTube 原生播放速度變更監聽器
    setupYouTubeSpeedChangeListener();

    // 每秒檢查一次視頻元素，確保監聽器設置成功
    const checkVideoInterval = setInterval(() => {
      const videoElement = document.querySelector("video");
      if (
        videoElement &&
        !videoElement.hasAttribute("data-extension-monitored")
      ) {
        setupYouTubeSpeedChangeListener();
        videoElement.setAttribute("data-extension-monitored", "true");
        clearInterval(checkVideoInterval);
      }
    }, 1000);

    // 監聽設置變更
    chrome.storage.onChanged.addListener((changes) => {
      console.log("檢測到設置變更:", changes);

      if (changes.adSpeed) {
        const oldAdSpeed = settings.adSpeed;
        settings.adSpeed = changes.adSpeed.newValue;
        console.log(`廣告速度已更新: ${oldAdSpeed} -> ${settings.adSpeed}`);

        // 如果當前是廣告，則立即應用新的廣告速度
        if (isPlayingAd) {
          setVideoSpeed(settings.adSpeed, true);
        } else {
          // 如果不是廣告，但當前速度等於舊的廣告速度，則可能需要更新
          const currentVideo = document.querySelector("video");
          if (currentVideo && currentVideo.playbackRate === oldAdSpeed) {
            console.log("檢測到非廣告影片以舊廣告速度播放，嘗試修正");
            if (isControlledByExtension) {
              setVideoSpeed(settings.videoSpeed, true);
            } else {
              try {
                currentVideo.playbackRate = 1.0;
                lastAppliedSpeed = 1.0;
              } catch (error) {
                console.error("重置播放速度時發生錯誤:", error);
              }
            }
          }
        }
      }
      if (changes.videoSpeed) {
        settings.videoSpeed = changes.videoSpeed.newValue;
        console.log("視頻速度已更新:", settings.videoSpeed);

        // 如果當前不是廣告且由插件控制，則立即應用新的視頻速度
        if (!isPlayingAd && isControlledByExtension) {
          // 強制重置上次應用的速度，確保新設置能夠生效
          lastAppliedSpeed = null;
          setVideoSpeed(settings.videoSpeed, true);
        }
      }
    });

    // 監聽頁面導航事件，以便在用戶切換視頻時重新檢查
    const observer = new MutationObserver((mutations) => {
      // 只在有意義的 DOM 變化時執行檢查，減少不必要的處理
      for (const mutation of mutations) {
        if (
          mutation.addedNodes.length > 0 ||
          mutation.removedNodes.length > 0
        ) {
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
        console.log("檢測到 URL 變化:", location.href);
        setTimeout(() => {
          lastVideoId = getCurrentVideoId();
          lastAppliedSpeed = null;
          lastAdState = false;

          // URL 變化時，重新檢查廣告狀態
          const hasAdMarker = document.querySelector(".ad-showing") !== null;
          const hasAdText = document.querySelector(".ytp-ad-text") !== null;
          const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;

          // 只有在有明確廣告標記時才設置為廣告
          isPlayingAd = hasAdMarker || hasAdText || hasAdBadge;
          console.log("URL 變化後廣告狀態:", isPlayingAd);

          // 只有在有廣告時才由插件控制，否則保持當前控制狀態
          if (isPlayingAd) {
            isControlledByExtension = true;
          }

          handleAdPlayback();

          // 檢查是否有影片以廣告速度播放的情況
          checkVideoPlaybackRate();
        }, 1000); // 給頁面一些時間加載
      }
    }).observe(document, { subtree: true, childList: true });

    // 監聽來自背景腳本和彈出窗口的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("收到消息:", message);

      if (message.type === "ping") {
        // 簡單的 ping 消息，用於檢查內容腳本是否已載入
        sendResponse({ success: true });
      } else if (message.type === "pageReloaded") {
        // 頁面重新加載時重置並重新初始化
        resetAndReinitialize();
        sendResponse({ success: true });
      } else if (message.type === "settingsUpdated" && message.settings) {
        // 設置更新時更新本地設置並應用
        updateSettings(message.settings);
        sendResponse({ success: true });
      } else if (message.type === "getYouTubeSpeed") {
        // 彈出窗口請求當前 YouTube 播放速度
        const currentSpeed = getCurrentYouTubeSpeed();
        sendResponse({ speed: currentSpeed });
      } else if (message.type === "isControlledByExtension") {
        // 彈出窗口請求檢查是否由插件控制
        sendResponse({ isControlled: isControlledByExtension });
      } else if (message.type === "takeControl") {
        // 彈出窗口請求接管控制
        isControlledByExtension = true;
        if (!isPlayingAd) {
          // 強制重置上次應用的速度，確保新設置能夠生效
          lastAppliedSpeed = null;
          setVideoSpeed(settings.videoSpeed, true);
        }
        sendResponse({ success: true });
      } else if (message.type === "releaseControl") {
        // 彈出窗口請求釋放控制
        if (!isPlayingAd) {
          isControlledByExtension = false;
          console.log("已釋放控制，保留 YouTube 原生播放速度");
        }
        sendResponse({ success: true });
      } else if (message.type === "forceCheckAdStatus") {
        // 強制檢查廣告狀態
        const hasAdMarker = document.querySelector(".ad-showing") !== null;
        const hasAdText = document.querySelector(".ytp-ad-text") !== null;
        const hasAdBadge = document.querySelector(".ytp-ad-badge") !== null;

        // 只有在有明確廣告標記時才設置為廣告
        const newAdStatus = hasAdMarker || hasAdText || hasAdBadge;

        // 如果狀態變更，則更新
        if (newAdStatus !== isPlayingAd) {
          console.log(`強制更新廣告狀態: ${isPlayingAd} -> ${newAdStatus}`);
          isPlayingAd = newAdStatus;
          handleAdPlayback();
        }

        sendResponse({
          isPlayingAd: isPlayingAd,
          hasAdMarker: hasAdMarker,
          hasAdText: hasAdText,
          hasAdBadge: hasAdBadge,
        });
      }

      return true; // 表示將異步發送回應
    });

    console.log("擴充功能初始化完成");
  }
}

// 檢查影片播放速度是否錯誤地使用了廣告速度
function checkVideoPlaybackRate() {
  // 嘗試獲取視頻元素
  const video = document.querySelector("video");
  if (!video) {
    // 如果找不到視頻元素，不輸出錯誤，靜默返回
    return;
  }

  try {
    // 如果不是廣告，但播放速度等於廣告速度，則可能是錯誤的
    if (!isPlayingAd && video.playbackRate === settings.adSpeed) {
      console.log("檢測到非廣告影片以廣告速度播放，嘗試修正");

      // 如果由插件控制，則應用影片速度
      if (isControlledByExtension) {
        console.log("由插件控制，應用影片速度:", settings.videoSpeed);
        lastAppliedSpeed = null; // 強制重置
        setVideoSpeed(settings.videoSpeed, true);
      } else {
        // 否則重置為 YouTube 默認速度
        console.log("不由插件控制，重置為 YouTube 默認速度: 1.0x");
        video.playbackRate = 1.0;
        lastAppliedSpeed = 1.0;
      }
    }
  } catch (error) {
    // 捕獲並記錄任何錯誤，但不中斷執行
    console.error("檢查視頻播放速度時發生錯誤:", error);
  }
}

// 當頁面加載完成後初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
