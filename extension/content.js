// YouTube Ad Skipper — content script
// Watches the YouTube player and gets rid of video ads the moment they appear:
//   1. clicks any "Skip" button that is present
//   2. otherwise mutes the ad and jumps straight to its end (fast-forwarding as a fallback)
//   3. closes overlay ads and the "ad blockers are not allowed" pop-up
// Static ads (feed, banner, sidebar) are hidden by hide-ads.css.

(() => {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  const SKIP_BUTTON_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-slot button",
    ".ytp-ad-skip-button-container button",
    "button[id^='skip-button']",
    ".videoAdUiSkipButton",
  ].join(",");

  const OVERLAY_CLOSE_SELECTORS = [
    ".ytp-ad-overlay-close-button",
    ".ytp-ad-overlay-close-container",
  ].join(",");

  let enabled = true;
  let inAd = false;
  let mutedByUs = false;
  let savedRate = 1;
  let countedThisAd = false;

  // ---------- settings ----------
  try {
    api.storage.local.get({ enabled: true }).then((s) => {
      enabled = s.enabled !== false;
      document.documentElement.classList.toggle("yt-ad-skipper-off", !enabled);
    });
    api.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.enabled) {
        enabled = changes.enabled.newValue !== false;
        document.documentElement.classList.toggle("yt-ad-skipper-off", !enabled);
      }
    });
  } catch (_) {
    /* storage unavailable — stay enabled */
  }

  function bumpCounter() {
    try {
      api.storage.local.get({ skipped: 0 }).then((s) => {
        api.storage.local.set({ skipped: (s.skipped || 0) + 1 });
      });
    } catch (_) {}
  }

  // ---------- helpers ----------
  function getPlayer() {
    return (
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player")
    );
  }

  function isAdShowing(player) {
    return (
      !!player &&
      (player.classList.contains("ad-showing") ||
        player.classList.contains("ad-interrupting"))
    );
  }

  function clickAll(selector, root = document) {
    let clicked = false;
    root.querySelectorAll(selector).forEach((el) => {
      if (el.offsetParent !== null || el.getClientRects().length) {
        el.click();
        clicked = true;
      }
    });
    return clicked;
  }

  // ---------- video ads ----------
  function handleVideoAd(player) {
    const video = player.querySelector("video");
    if (!video) return;

    if (!inAd) {
      inAd = true;
      countedThisAd = false;
      savedRate = video.playbackRate && video.playbackRate <= 4 ? video.playbackRate : 1;
      if (!video.muted) {
        video.muted = true;
        mutedByUs = true;
      }
    }

    if (!countedThisAd) {
      countedThisAd = true;
      bumpCounter();
    }

    // 1. Use the real skip button when YouTube offers one.
    if (clickAll(SKIP_BUTTON_SELECTORS, player)) return;

    // 2. Otherwise jump to the end of the ad.
    if (video.muted === false) video.muted = true;
    const d = video.duration;
    if (Number.isFinite(d) && d > 0 && video.currentTime < d - 0.25) {
      try {
        video.currentTime = d - 0.1;
      } catch (_) {}
    }
    // 3. And fast-forward in case the seek is ignored.
    try {
      video.playbackRate = 16;
    } catch (_) {}
    if (video.paused) video.play().catch(() => {});
  }

  function afterAd(player) {
    if (!inAd) return;
    inAd = false;
    const video = player && player.querySelector("video");
    if (!video) return;
    try {
      video.playbackRate = savedRate;
    } catch (_) {}
    if (mutedByUs) {
      video.muted = false;
      mutedByUs = false;
    }
  }

  // ---------- "ad blockers are not allowed" pop-up ----------
  function dismissEnforcementDialog() {
    const msg = document.querySelector("ytd-enforcement-message-view-model");
    if (!msg) return;
    const dialog = msg.closest("tp-yt-paper-dialog, ytd-popup-container") || msg;
    if (dialog.tagName.toLowerCase() === "ytd-popup-container") {
      msg.remove();
    } else {
      dialog.remove();
    }
    document.querySelectorAll("tp-yt-iron-overlay-backdrop").forEach((b) => b.remove());
    document.body && (document.body.style.overflow = "");
    const video = document.querySelector("#movie_player video");
    if (video && video.paused) video.play().catch(() => {});
  }

  // ---------- main loop ----------
  function tick() {
    if (!enabled) return;
    const player = getPlayer();
    if (isAdShowing(player)) {
      handleVideoAd(player);
    } else {
      afterAd(player);
    }
    clickAll(OVERLAY_CLOSE_SELECTORS);
    dismissEnforcementDialog();
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      tick();
    });
  });

  function start() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    // Safety net: the observer can miss changes inside the player.
    setInterval(tick, 300);
    tick();
  }

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
