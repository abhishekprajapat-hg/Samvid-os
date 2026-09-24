import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_THRESHOLD = 220;

const getScrollTop = (target) => {
  if (!target) return 0;
  if (target === window) {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
  return target.scrollTop || 0;
};

const getScrollHeight = (target) => {
  if (!target) return 0;
  if (target === window) {
    return Math.max(
      document.documentElement.scrollHeight || 0,
      document.body.scrollHeight || 0,
    );
  }
  return target.scrollHeight || 0;
};

const getClientHeight = (target) => {
  if (!target) return 0;
  if (target === window) return window.innerHeight || document.documentElement.clientHeight || 0;
  return target.clientHeight || 0;
};

const canScroll = (target) => getScrollHeight(target) - getClientHeight(target) > SCROLL_THRESHOLD;

const getScrollTargets = () => {
  if (typeof document === "undefined") return [];

  const selectors = [
    ".workspace-main-content-mobile-nav",
    ".workspace-main-content:not(.workspace-main-content-chat) > .ui-page-shell",
    ".workspace-main-content:not(.workspace-main-content-chat)",
    ".workspace-main",
    ".ui-page-shell",
  ];
  const targets = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

  return [window, ...targets].filter((target, index, list) => (
    target && list.indexOf(target) === index && canScroll(target)
  ));
};

const BackToTopButton = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [scrollTargets, setScrollTargets] = useState([]);

  const refreshTargets = useCallback(() => {
    const targets = getScrollTargets();
    setScrollTargets(targets);
    setVisible(targets.some((target) => getScrollTop(target) > SCROLL_THRESHOLD));
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(refreshTargets);
    const timerId = window.setTimeout(refreshTargets, 350);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [location.pathname, refreshTargets]);

  useEffect(() => {
    if (!scrollTargets.length) return undefined;

    const handleScroll = () => {
      setVisible(scrollTargets.some((target) => getScrollTop(target) > SCROLL_THRESHOLD));
    };

    scrollTargets.forEach((target) => target.addEventListener("scroll", handleScroll, { passive: true }));
    window.addEventListener("resize", refreshTargets, { passive: true });
    handleScroll();

    return () => {
      scrollTargets.forEach((target) => target.removeEventListener("scroll", handleScroll));
      window.removeEventListener("resize", refreshTargets);
    };
  }, [refreshTargets, scrollTargets]);

  const handleBackToTop = useCallback(() => {
    const activeTargets = scrollTargets.length ? scrollTargets : getScrollTargets();
    activeTargets.forEach((target) => {
      target.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }, [scrollTargets]);

  const className = useMemo(
    () => `back-to-top-button${visible ? " is-visible" : ""}`,
    [visible],
  );

  return (
    <button
      type="button"
      className={className}
      aria-label="Back to top"
      onClick={handleBackToTop}
    >
      <svg className="back-to-top-icon" viewBox="0 0 384 512" aria-hidden="true">
        <path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z" />
      </svg>
    </button>
  );
};

export default BackToTopButton;
