// YouTube Ad Skipper — content script
//
// Watches the YouTube player and gets rid of video ads the moment they appear:
//   1. clicks any "Skip" button that is present
//   2. otherwise mutes the ad and jumps straight to its end
//   3. plays the ad at 16x if YouTube refuses to let us jump
//   4. closes overlay ads and the "ad blockers are not allowed" pop-up
//
// Static ads (feed, banner, sidebar) are hidden by hide-ads.css.

(() => {
  "use strict";

  // Avoid double-injection (YouTube uses SPA navigation)
  if (window.__ytAdSkipperLoaded) return;
  window.__ytAdSkipperLoaded = true;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const TICK_MS = 200;
  const FAST_RATE = 16;

  const SKIP_BUTTON_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-slot button",
    ".ytp-ad-skip-button-container button",
    "button[id^='skip-button']",
    ".videoAdUiSkipButton",
    ".ytp-ad-survey-answer-button",
  ].join(",");

  const OVERLAY_CLOSE_SELECTORS = [
    ".ytp-ad-overlay-close-button",
    ".ytp-ad-overlay-close-container",
    ".ytp-ad-image-overlay .ytp-ad-overlay-close-button",
  ].join(",");

  const OVERLAY_SLOT_SELECTORS = [
    ".ytp-ad-overlay-slot",
    ".ytp-ad-image-overlay",
    ".ytp-ad-overlay-container",
  ].join(",");

  // "Ad blockers violate YouTube's Terms of Service" enforcement pop-up
  const ENFORCEMENT_SELECTORS = [
    "ytd-enforcement-message-view-model",
    "yt-playability-error-supported-renderers ytd-enforcement-message-view-model",
    "#enforcement-message",
  ].join(",");

  // Ads that CSS may miss because they are injected late
  const FEED_AD_SELECTORS = [
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-ad-slot-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-ad-slot-renderer",
    "ytm-promoted-sparkles-web-renderer",
    "#masthead-ad",
    "#player-ads",
  ].join(",");

  let enabled = true;
  let inAd = false;
  let mutedByUs = false;
  let savedVolume = 1;
  let savedMuted = false;
  let savedRate = 1;
  // True only while *we* changed playbackRate to rush through an ad.
  // Never touch the rate otherwise — the user may have picked 1.5x / 2x.
  let weChangedRate = false;
  let countedThisAd = false;
  let lastAdEnd = 0;
  let debug = false;

  // ---------------------------------------------------------------- logging
  function log(...args) {
    if (debug) console.log("[YT Ad Skipper]", ...args);
  }

  // --------------------------------------------------------------- settings
  const store = api.storage && (api.storage.local || api.storage.sync);

  function applyEnabled(value) {
    enabled = value !== false;
    // documentElement can be null at document_start inside iframes
    const root = document.documentElement;
    if (root && root.classList) {
      root.classList.toggle("yt-ad-skipper-off", !enabled);
    }
  }

  try {
    store.get({ enabled: true, debug: false }).then((s) => {
      applyEnabled(s.enabled);
      debug = s.debug === true;
    });
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" && area !== "sync") return;
      if (changes.enabled) applyEnabled(changes.enabled.newValue);
      if (changes.debug) debug = changes.debug.newValue === true;
    });
  } catch (_) {
    applyEnabled(true);
  }

  function countSkippedAd() {
    if (countedThisAd) return;
    countedThisAd = true;
    try {
      store.get({ skipped: 0 }).then((s) => {
        store.set({ skipped: (s.skipped || 0) + 1 });
      });
    } catch (_) {
      /* counter is nice-to-have only */
    }
  }

  // ---------------------------------------------------------------- helpers
  function q(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (_) {
      return null;
    }
  }

  function qa(sel, root) {
    try {
      return Array.from((root || document).querySelectorAll(sel));
    } catch (_) {
      return [];
    }
  }

  function getPlayer() {
    return q("#movie_player") || q(".html5-video-player");
  }

  function getVideo() {
    const player = getPlayer();
    if (player) {
      const v = player.querySelector("video.html5-main-video") || player.querySelector("video");
      if (v) return v;
    }
    return q("video.html5-main-video") || q("video");
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01;
  }

  // ------------------------------------------------------------- detection
  function isAdShowing() {
    const player = getPlayer();
    if (player) {
      if (player.classList.contains("ad-showing")) return true;
      if (player.classList.contains("ad-interrupting")) return true;
    }
    // Fallback signals used when the class is missing
    if (q(".ytp-ad-player-overlay-layout")) return true;
    if (q(".ytp-ad-duration-remaining")) return true;
    if (q(".ytp-ad-simple-ad-badge")) return true;
    if (q(".ytp-ad-preview-text")) return true;
    return false;
  }

  // --------------------------------------------------------------- actions
  function muteForAd(video) {
    if (!mutedByUs) {
      savedVolume = video.volume;
      savedMuted = video.muted;
      mutedByUs = true;
    }
    if (!video.muted) video.muted = true;
  }

  // Put back the playback speed the user had, but only if we were the ones
  // who changed it. A user-chosen 1.5x / 2x is left completely alone.
  function restoreRate(video) {
    if (!weChangedRate || !video) return;
    try {
      video.playbackRate = savedRate > 0 ? savedRate : 1;
    } catch (_) {
      /* ignore */
    }
    weChangedRate = false;
  }

  function restoreAudio(video) {
    if (!mutedByUs || !video) return;
    try {
      video.muted = savedMuted;
      if (!savedMuted) video.volume = savedVolume;
    } catch (_) {
      /* ignore */
    }
    mutedByUs = false;
  }

  function restoreVideo(video) {
    restoreRate(video);
    restoreAudio(video);
  }

  function clickSkipButtons() {
    let clicked = false;
    for (const btn of qa(SKIP_BUTTON_SELECTORS)) {
      if (btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;
      if (!isVisible(btn)) continue;
      try {
        btn.click();
        clicked = true;
        log("clicked skip button");
      } catch (_) {
        /* ignore */
      }
    }
    return clicked;
  }

  function closeOverlays() {
    for (const btn of qa(OVERLAY_CLOSE_SELECTORS)) {
      if (!isVisible(btn)) continue;
      try {
        btn.click();
      } catch (_) {
        /* ignore */
      }
    }
    for (const slot of qa(OVERLAY_SLOT_SELECTORS)) {
      try {
        slot.style.setProperty("display", "none", "important");
      } catch (_) {
        /* ignore */
      }
    }
  }

  function jumpToEnd(video) {
    const d = video.duration;
    if (!isFinite(d) || d <= 0) return false;
    const target = Math.max(0, d - 0.15);
    if (video.currentTime < target - 0.5) {
      try {
        video.currentTime = target;
        log(`jumped ${target.toFixed(2)}s`);
        return true;
      } catch (_) {
        /* ignore */
      }
    }
    return false;
  }

  function speedUp(video) {
    if (video.playbackRate >= FAST_RATE) return;
    // Remember the speed to go back to, but never overwrite it while we are
    // already the ones controlling the rate (that would save 16x as "ours").
    if (!weChangedRate) {
      savedRate = video.playbackRate;
      weChangedRate = true;
    }
    try {
      video.playbackRate = FAST_RATE;
      log("fast-forwarding at", FAST_RATE, "x");
    } catch (_) {
      /* ignore */
    }
  }

  function hideFeedAds() {
    for (const ad of qa(FEED_AD_SELECTORS)) {
      try {
        ad.style.setProperty("display", "none", "important");
        ad.setAttribute("data-yt-ads-skipper-hidden", "1");
      } catch (_) {
        /* ignore */
      }
    }
  }

  function dismissEnforcement() {
    const el = q(ENFORCEMENT_SELECTORS);
    if (!el) return false;
    log("enforcement pop-up detected");

    const dialog = el.closest("tp-yt-paper-dialog") || el.parentElement;
    if (dialog) {
      for (const b of qa("button, tp-yt-paper-button", dialog)) {
        try {
          b.click();
        } catch (_) {
          /* ignore */
        }
      }
      try {
        dialog.style.setProperty("display", "none", "important");
      } catch (_) {
        /* ignore */
      }
    }
    try {
      el.style.setProperty("display", "none", "important");
    } catch (_) {
      /* ignore */
    }

    // The pop-up usually pauses playback — resume it.
    const video = getVideo();
    if (video && video.paused) {
      const playBtn = q(".ytp-play-button");
      if (playBtn) {
        try {
          playBtn.click();
        } catch (_) {
          /* ignore */
        }
      }
    }
    return true;
  }

  function resumeIfPaused(video) {
    if (!video || !video.paused) return;
    const playBtn = q(".ytp-play-button");
    if (playBtn) {
      try {
        playBtn.click();
      } catch (_) {
        /* ignore */
      }
    }
  }

  // ------------------------------------------------------------------ tick
  function tick() {
    if (!enabled) return;

    if (dismissEnforcement()) return;

    hideFeedAds();
    closeOverlays();

    const adOn = isAdShowing();
    const video = getVideo();

    if (adOn && video) {
      if (!inAd) {
        inAd = true;
        countedThisAd = false;
        log("ad started", { duration: video.duration });
      }
      muteForAd(video);
      const clicked = clickSkipButtons();
      const jumped = jumpToEnd(video);
      if (clicked || jumped) countSkippedAd();
      if (!clicked && !jumped) speedUp(video);
    } else if (!adOn && inAd) {
      inAd = false;
      countedThisAd = false;
      lastAdEnd = Date.now();
      log("ad finished");
      restoreVideo(video);
      resumeIfPaused(video);
    } else if (!adOn && video && weChangedRate) {
      // Safety net: we sped an ad up but never saw the ad-end transition
      // (for example YouTube swapped the player). Only undo our own change —
      // a playback speed chosen by the user is never touched.
      restoreRate(video);
    }
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    setInterval(tick, TICK_MS);

    const obs = new MutationObserver(() => tick());
    const observe = () => {
      try {
        obs.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style"],
        });
      } catch (_) {
        /* ignore */
      }
    };

    if (document.documentElement) observe();
    else document.addEventListener("DOMContentLoaded", observe, { once: true });

    // React to SPA navigation
    window.addEventListener("yt-navigate-finish", () => {
      inAd = false;
      countedThisAd = false;
      tick();
    });

    tick();
    log("loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
    boot();
  } else {
    boot();
  }
})();
