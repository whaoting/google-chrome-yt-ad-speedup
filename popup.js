// 當彈出窗口加載完成時執行
document.addEventListener("DOMContentLoaded", () => {
  // 獲取 DOM 元素
  const adSpeedSlider = document.getElementById("adSpeed");
  const adSpeedValue = document.getElementById("adSpeedValue");
  const videoSpeedSlider = document.getElementById("videoSpeed");
  const videoSpeedValue = document.getElementById("videoSpeedValue");
  const statusElement = document.getElementById("status");
  const resetButton = document.getElementById("resetButton");
  const adSpeedQuickSelect = document.getElementById("adSpeedQuickSelect");
  const videoSpeedQuickSelect = document.getElementById(
    "videoSpeedQuickSelect"
  );

  // 添加控制切換開關
  let controlSwitch = document.createElement("div");
  controlSwitch.className = "control-switch";
  controlSwitch.innerHTML = `
    <label class="switch">
      <input type="checkbox" id="controlToggle">
      <span class="slider round"></span>
    </label>
    <span class="control-label">由插件控制播放速度</span>
  `;

  // 插入到重置按鈕之前
  resetButton.parentNode.insertBefore(controlSwitch, resetButton);

  const controlToggle = document.getElementById("controlToggle");

  // 添加強制檢查廣告狀態的按鈕
  let checkAdButton = document.createElement("button");
  checkAdButton.className = "reset-button";
  checkAdButton.style.marginTop = "5px";
  checkAdButton.style.width = "160px";
  checkAdButton.textContent = "強制檢查廣告狀態";

  // 插入到狀態元素之前
  statusElement.parentNode.insertBefore(checkAdButton, statusElement);

  // 添加事件監聽器
  checkAdButton.addEventListener("click", () => {
    showStatus("正在檢查廣告狀態...");
    checkContentScriptLoaded(() => {
      forceCheckAdStatus();
    });
  });

  // 預設設置值
  const defaultSettings = {
    adSpeed: 4.0,
    videoSpeed: 1.0,
  };

  // 是否由插件控制播放速度
  let isControlledByExtension = false;

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

  // 檢查內容腳本是否已載入
  function checkContentScriptLoaded(callback) {
    // 發送消息到背景腳本，檢查內容腳本是否已載入
    chrome.runtime.sendMessage(
      { type: "checkContentScriptLoaded" },
      (response) => {
        console.log("檢查內容腳本載入狀態:", response);

        if (response && response.loaded) {
          // 內容腳本已載入，執行回調
          if (typeof callback === "function") {
            callback();
          }
          return true;
        } else {
          // 內容腳本未載入，顯示錯誤
          const errorMessage =
            response && response.error
              ? response.error
              : "無法連接到內容腳本，請確保您在 YouTube 視頻頁面上並重新載入頁面";

          // 如果錯誤消息包含 "內容腳本未載入"，則嘗試直接與標籤頁通信
          if (
            response &&
            response.tabId &&
            errorMessage.includes("內容腳本未載入")
          ) {
            // 嘗試直接發送消息到標籤頁，這可能會觸發內容腳本的載入
            chrome.tabs.sendMessage(
              response.tabId,
              { type: "ping" },
              (pingResponse) => {
                // 檢查是否有錯誤
                if (chrome.runtime.lastError) {
                  console.log(
                    "直接 ping 失敗:",
                    chrome.runtime.lastError.message
                  );
                  showStatus("請重新載入 YouTube 頁面以啟用擴充功能");
                  return;
                }

                // 如果成功，則內容腳本已載入
                if (pingResponse && pingResponse.success) {
                  console.log("直接 ping 成功，內容腳本已載入");
                  if (typeof callback === "function") {
                    callback();
                  }
                  return true;
                } else {
                  console.log("直接 ping 失敗，內容腳本未正確響應");
                  showStatus("請重新載入 YouTube 頁面以啟用擴充功能");
                  return false;
                }
              }
            );
          } else {
            // 顯示錯誤消息
            showStatus(
              errorMessage.includes("Receiving end does not exist")
                ? "請在 YouTube 視頻頁面使用此擴充功能"
                : errorMessage
            );
            return false;
          }
        }
      }
    );
  }

  // 從存儲中獲取當前設置
  chrome.storage.local.get(["settings"], (data) => {
    // 設置滑塊的初始值
    if (data.settings) {
      if (data.settings.adSpeed !== undefined) {
        adSpeedSlider.value = data.settings.adSpeed;
        adSpeedValue.textContent = `${data.settings.adSpeed.toFixed(1)}x`;
      }

      if (data.settings.videoSpeed !== undefined) {
        videoSpeedSlider.value = data.settings.videoSpeed;
        videoSpeedValue.textContent = `${data.settings.videoSpeed.toFixed(2)}x`;
      }
    } else {
      // 如果沒有保存的設置，使用默認值
      adSpeedSlider.value = defaultSettings.adSpeed;
      adSpeedValue.textContent = `${defaultSettings.adSpeed.toFixed(1)}x`;
      videoSpeedSlider.value = defaultSettings.videoSpeed;
      videoSpeedValue.textContent = `${defaultSettings.videoSpeed.toFixed(2)}x`;
    }

    // 嘗試獲取當前 YouTube 播放速度
    checkContentScriptLoaded(() => {
      getCurrentYouTubeSpeed();
      // 強制檢查廣告狀態
      forceCheckAdStatus();
    });
  });

  // 顯示保存狀態的函數
  function showStatus(message) {
    statusElement.textContent = message;
    statusElement.style.opacity = "1";

    // 2 秒後淡出
    setTimeout(() => {
      statusElement.style.opacity = "0";
    }, 2000);
  }

  // 強制檢查廣告狀態的函數
  function forceCheckAdStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (
        tabs.length > 0 &&
        tabs[0].url &&
        tabs[0].url.includes("youtube.com")
      ) {
        // 顯示正在檢查的狀態
        showStatus("正在檢查廣告狀態...");

        // 檢查內容腳本是否已載入
        chrome.tabs
          .sendMessage(tabs[0].id, { type: "ping" })
          .then((pingResponse) => {
            // 確認 ping 響應成功
            if (!pingResponse || !pingResponse.success) {
              console.log("Ping 響應不成功，內容腳本可能未正確載入");
              throw new Error("內容腳本未正確載入");
            }

            // 內容腳本已載入，可以發送檢查廣告狀態的消息
            return chrome.tabs.sendMessage(tabs[0].id, {
              type: "forceCheckAdStatus",
            });
          })
          .then((response) => {
            if (response) {
              console.log("廣告狀態檢查結果:", response);
              showStatus(`廣告狀態: ${response.isPlayingAd ? "是" : "否"}`);

              // 如果不是廣告，確保影片播放速度正確
              if (!response.isPlayingAd) {
                // 強制應用影片播放速度
                if (isControlledByExtension) {
                  const videoSpeed = parseFloat(videoSpeedSlider.value);
                  console.log(`強制應用影片播放速度: ${videoSpeed}x`);

                  // 再次發送消息，應用影片速度
                  return chrome.tabs.sendMessage(tabs[0].id, {
                    type: "settingsUpdated",
                    settings: {
                      videoSpeed: videoSpeed,
                      forceApply: true,
                    },
                  });
                } else {
                  showStatus("插件未控制播放速度，保留 YouTube 原生速度");
                  return null;
                }
              } else {
                // 如果是廣告，確保廣告播放速度正確
                const adSpeed = parseFloat(adSpeedSlider.value);
                console.log(`確認廣告播放速度: ${adSpeed}x`);

                // 再次發送消息，應用廣告速度
                return chrome.tabs.sendMessage(tabs[0].id, {
                  type: "settingsUpdated",
                  settings: {
                    adSpeed: adSpeed,
                    forceApply: true,
                  },
                });
              }
            } else {
              throw new Error("廣告狀態檢查響應無效");
            }
          })
          .then((speedResponse) => {
            if (speedResponse && speedResponse.success) {
              console.log("播放速度已成功應用");
            }
          })
          .catch((error) => {
            console.log("檢查廣告狀態時出錯:", error.message || error);

            // 檢查是否是連接錯誤
            if (
              error.message &&
              error.message.includes("Receiving end does not exist")
            ) {
              showStatus(
                "無法檢查廣告狀態 (請確保您在 YouTube 視頻頁面上並重新載入頁面)"
              );
            } else {
              showStatus("檢查廣告狀態失敗，請重試");
            }
          });
      } else {
        showStatus("請在 YouTube 視頻頁面使用此功能");
      }
    });
  }

  // 獲取當前 YouTube 播放速度
  function getCurrentYouTubeSpeed() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (
        tabs.length > 0 &&
        tabs[0].url &&
        tabs[0].url.includes("youtube.com")
      ) {
        // 檢查內容腳本是否已載入
        chrome.tabs
          .sendMessage(tabs[0].id, { type: "ping" })
          .then((pingResponse) => {
            // 確認 ping 響應成功
            if (!pingResponse || !pingResponse.success) {
              console.log("Ping 響應不成功，內容腳本可能未正確載入");
              throw new Error("內容腳本未正確載入");
            }

            // 內容腳本已載入，可以發送獲取速度的消息
            return chrome.tabs.sendMessage(tabs[0].id, {
              type: "getYouTubeSpeed",
            });
          })
          .then((response) => {
            if (response && response.speed !== undefined) {
              console.log("獲取到 YouTube 當前播放速度:", response.speed);

              // 如果不由插件控制，則更新滑塊顯示 YouTube 的速度
              if (!isControlledByExtension) {
                // 只更新影片速度，不更新廣告速度
                videoSpeedSlider.value = response.speed;
                videoSpeedValue.textContent = `${response.speed.toFixed(2)}x`;
              }

              // 檢查是否由插件控制
              return chrome.tabs.sendMessage(tabs[0].id, {
                type: "isControlledByExtension",
              });
            }

            // 如果沒有有效的響應，不繼續發送消息
            throw new Error("未獲取到有效的播放速度");
          })
          .then((controlResponse) => {
            if (controlResponse && controlResponse.isControlled !== undefined) {
              isControlledByExtension = controlResponse.isControlled;
              controlToggle.checked = isControlledByExtension;
            }
          })
          .catch((error) => {
            // 忽略錯誤，不影響用戶體驗
            console.log(
              "獲取 YouTube 播放速度時出錯，可能是頁面未完全載入或不是 YouTube 頁面:",
              error.message || error
            );

            // 檢查是否是連接錯誤
            if (
              error.message &&
              error.message.includes("Receiving end does not exist")
            ) {
              // 這是正常的，當頁面不是 YouTube 或內容腳本尚未載入時會發生
              showStatus("請在 YouTube 視頻頁面使用此擴充功能");
            }
          });
      } else {
        // 不是 YouTube 頁面
        showStatus("請在 YouTube 視頻頁面使用此擴充功能");
      }
    });
  }

  // 切換控制狀態
  function toggleControl(shouldControl) {
    isControlledByExtension = shouldControl;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (
        tabs.length > 0 &&
        tabs[0].url &&
        tabs[0].url.includes("youtube.com")
      ) {
        const messageType = shouldControl ? "takeControl" : "releaseControl";

        // 檢查內容腳本是否已載入
        chrome.tabs
          .sendMessage(tabs[0].id, { type: "ping" })
          .then((pingResponse) => {
            // 確認 ping 響應成功
            if (!pingResponse || !pingResponse.success) {
              console.log("Ping 響應不成功，內容腳本可能未正確載入");
              throw new Error("內容腳本未正確載入");
            }

            // 內容腳本已載入，可以發送控制消息
            return chrome.tabs.sendMessage(tabs[0].id, { type: messageType });
          })
          .then((response) => {
            if (response && response.success) {
              showStatus(
                shouldControl ? "已接管播放速度控制" : "已釋放播放速度控制"
              );

              // 如果接管控制，則立即應用插件設置
              if (shouldControl) {
                saveSettings(true);
              } else {
                // 如果釋放控制，則更新滑塊顯示 YouTube 的速度
                getCurrentYouTubeSpeed();
              }
            } else {
              // 如果響應不成功，顯示錯誤
              throw new Error("控制切換響應不成功");
            }
          })
          .catch((error) => {
            console.log("切換控制狀態時出錯:", error.message || error);

            // 檢查是否是連接錯誤
            if (
              error.message &&
              error.message.includes("Receiving end does not exist")
            ) {
              showStatus("請確保您在 YouTube 視頻頁面上並重新載入頁面");
            } else {
              showStatus("切換控制狀態失敗，請重試");
            }

            // 重置控制狀態
            controlToggle.checked = isControlledByExtension = !shouldControl;
          });
      } else {
        showStatus("請在 YouTube 視頻頁面使用此功能");
        // 重置控制狀態
        controlToggle.checked = isControlledByExtension = !shouldControl;
      }
    });
  }

  // 保存設置到 Chrome 存儲
  function saveSettings(shouldApply = false) {
    const settings = {
      adSpeed: parseFloat(adSpeedSlider.value),
      videoSpeed: parseFloat(videoSpeedSlider.value),
      isControlledByExtension: isControlledByExtension,
    };

    // 檢查 chrome.storage 是否存在
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      console.error("無法保存設置：chrome.storage.local 不可用");
      showStatus("保存設置失敗：瀏覽器 API 不可用");
      return;
    }

    // 保存到 Chrome 存儲
    chrome.storage.local.set({ settings: settings }, () => {
      // 檢查是否有錯誤
      if (chrome.runtime.lastError) {
        console.error("保存設置時出現錯誤:", chrome.runtime.lastError.message);
        showStatus("保存設置失敗");
        return;
      }

      console.log("設置已保存:", settings);
      showStatus("設置已保存");

      // 如果需要立即應用設置
      if (shouldApply) {
        checkContentScriptLoaded(() => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (
              tabs.length > 0 &&
              tabs[0].url &&
              tabs[0].url.includes("youtube.com")
            ) {
              // 發送設置更新消息
              chrome.tabs
                .sendMessage(tabs[0].id, {
                  type: "settingsUpdated",
                  settings: {
                    ...settings,
                    forceApply: true,
                  },
                })
                .then((response) => {
                  if (response && response.success) {
                    console.log("設置已應用");
                    showStatus("設置已保存並應用");
                  } else {
                    // 如果響應不成功，顯示錯誤
                    throw new Error("設置應用響應不成功");
                  }
                })
                .catch((error) => {
                  console.log("發送消息時出錯:", error.message || error);
                  showStatus("設置已保存，但應用失敗");
                });
            } else {
              showStatus("設置已保存 (請在 YouTube 視頻頁面應用設置)");
            }
          });
        });
      }
    });
  }

  // 恢復預設設置的函數
  function resetToDefaults() {
    // 設置滑塊的值為默認值
    adSpeedSlider.value = defaultSettings.adSpeed;
    adSpeedValue.textContent = `${defaultSettings.adSpeed.toFixed(1)}x`;
    videoSpeedSlider.value = defaultSettings.videoSpeed;
    videoSpeedValue.textContent = `${defaultSettings.videoSpeed.toFixed(2)}x`;

    // 保存設置
    saveSettings(true);
  }

  // 設置廣告播放速度的函數
  function setAdSpeed(speed) {
    const value = parseFloat(speed);
    adSpeedSlider.value = value;
    adSpeedValue.textContent = `${value.toFixed(1)}x`;

    // 接管控制
    controlToggle.checked = true;
    isControlledByExtension = true;

    // 先更新控制狀態
    checkContentScriptLoaded(() => {
      toggleControl(true);

      // 然後強制應用廣告速度設置
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (
          tabs.length > 0 &&
          tabs[0].url &&
          tabs[0].url.includes("youtube.com")
        ) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              type: "settingsUpdated",
              settings: {
                adSpeed: value,
                isControlledByExtension: true,
                forceApply: true,
              },
            })
            .then(() => {
              showStatus(`已設置廣告速度: ${value.toFixed(1)}x`);
            })
            .catch((error) => {
              console.log("發送消息時出錯:", error);
              showStatus("設置廣告速度失敗");
            });
        }
      });
    });
  }

  // 設置影片播放速度的函數
  function setVideoSpeed(speed) {
    const value = parseFloat(speed);
    videoSpeedSlider.value = value;
    videoSpeedValue.textContent = `${value.toFixed(2)}x`;

    // 接管控制
    controlToggle.checked = true;
    isControlledByExtension = true;

    // 先更新控制狀態
    checkContentScriptLoaded(() => {
      toggleControl(true);

      // 然後強制應用影片速度設置
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (
          tabs.length > 0 &&
          tabs[0].url &&
          tabs[0].url.includes("youtube.com")
        ) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              type: "settingsUpdated",
              settings: {
                videoSpeed: value,
                isControlledByExtension: true,
                forceApply: true,
              },
            })
            .then(() => {
              showStatus(`已設置影片速度: ${value.toFixed(2)}x`);
            })
            .catch((error) => {
              console.log("發送消息時出錯:", error);
              showStatus("設置影片速度失敗");
            });
        }
      });
    });
  }

  // 監聽廣告速度滑塊變化
  adSpeedSlider.addEventListener("input", () => {
    const value = parseFloat(adSpeedSlider.value);
    adSpeedValue.textContent = `${value.toFixed(1)}x`;
  });

  // 監聽廣告速度滑塊變化結束
  adSpeedSlider.addEventListener("change", () => {
    // 接管控制
    controlToggle.checked = true;
    isControlledByExtension = true;
    checkContentScriptLoaded(() => {
      toggleControl(true);
      saveSettings(true);
    });
  });

  // 監聽影片速度滑塊變化
  videoSpeedSlider.addEventListener("input", () => {
    const value = parseFloat(videoSpeedSlider.value);
    videoSpeedValue.textContent = `${value.toFixed(2)}x`;
  });

  // 監聽影片速度滑塊變化結束
  videoSpeedSlider.addEventListener("change", () => {
    // 接管控制
    controlToggle.checked = true;
    isControlledByExtension = true;
    checkContentScriptLoaded(() => {
      toggleControl(true);
      saveSettings(true);
    });
  });

  // 監聽控制切換開關變化
  controlToggle.addEventListener("change", () => {
    checkContentScriptLoaded(() => {
      toggleControl(controlToggle.checked);
    });
  });

  // 監聽恢復預設按鈕點擊事件
  resetButton.addEventListener("click", resetToDefaults);

  // 監聽廣告速度快速選擇按鈕點擊事件
  adSpeedQuickSelect.addEventListener("click", (event) => {
    if (event.target.tagName === "BUTTON") {
      const speed = parseFloat(event.target.dataset.speed);
      if (!isNaN(speed)) {
        setAdSpeed(speed);
      }
    }
  });

  // 監聽影片速度快速選擇按鈕點擊事件
  videoSpeedQuickSelect.addEventListener("click", (event) => {
    if (event.target.tagName === "BUTTON") {
      const speed = parseFloat(event.target.dataset.speed);
      if (!isNaN(speed)) {
        setVideoSpeed(speed);
      }
    }
  });

  // 監聽來自內容腳本的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("彈出窗口收到消息:", message);

    if (message.type === "currentYouTubeSpeed") {
      // 更新 UI 顯示當前播放速度和狀態
      console.log("收到當前播放狀態:", message);

      // 更新控制狀態
      if (message.isControlledByExtension !== undefined) {
        isControlledByExtension = message.isControlledByExtension;
        controlToggle.checked = isControlledByExtension;
      }

      // 如果有設置信息，更新滑塊
      if (message.settings) {
        // 更新廣告速度滑塊
        if (message.settings.adSpeed !== undefined) {
          adSpeedSlider.value = message.settings.adSpeed;
          adSpeedValue.textContent = `${message.settings.adSpeed.toFixed(1)}x`;
        }

        // 更新影片速度滑塊
        if (message.settings.videoSpeed !== undefined) {
          videoSpeedSlider.value = message.settings.videoSpeed;
          videoSpeedValue.textContent = `${message.settings.videoSpeed.toFixed(
            2
          )}x`;
        }
      }

      // 如果不由插件控制，則使用 YouTube 原生速度更新影片速度滑塊
      if (!isControlledByExtension && message.speed) {
        videoSpeedSlider.value = message.speed;
        videoSpeedValue.textContent = `${message.speed.toFixed(2)}x`;
      }

      // 顯示當前狀態
      if (message.isPlayingAd) {
        showStatus(`當前播放廣告，速度: ${message.speed}x`);
      } else {
        showStatus(`當前播放影片，速度: ${message.speed}x`);
      }
    }
  });
});
