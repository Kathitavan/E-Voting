// useGestureVote.js
// ------------------------------------------------------------------
// Polls /gesture at ~10 fps.
// Face UP        → move selection one step up   (with cooldown)
// Face DOWN      → move selection one step down (with cooldown)
// Hold BLINK ≥ 1s → confirm → calls onVoteConfirmed(candidate)
// ------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback } from "react";

const API          = "http://127.0.0.1:5000";
const POLL_MS      = 100;
const BLINK_HOLD_S = 1.0;
const NAV_COOLDOWN = 650;

export function useGestureVote({ candidates = [], onVoteConfirmed, webcamRef, active = true }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [blinkProgress, setBlinkProgress] = useState(0);
  const [gestureStatus, setGestureStatus] = useState("idle");

  const blinkStartRef = useRef(null);
  const navCoolRef    = useRef(0);
  const confirmedRef  = useRef(false);
  const intervalRef   = useRef(null);
  const selectedRef   = useRef(0);

  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);

  const captureFrame = useCallback(() => {
    const video = webcamRef?.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, [webcamRef]);

  const poll = useCallback(async () => {
    if (!active || confirmedRef.current) return;
    const frame = captureFrame();
    if (!frame) { setGestureStatus("idle"); return; }

    let res;
    try {
      const r = await fetch(`${API}/gesture`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: frame })
      });
      res = await r.json();
    } catch {
      setGestureStatus("idle");
      return;
    }

    if (res.status === "no_face") {
      setGestureStatus("no_face");
      blinkStartRef.current = null;
      setBlinkProgress(0);
      return;
    }

    const now = Date.now();

    if (res.blink) {
      setGestureStatus("blink");
      if (!blinkStartRef.current) blinkStartRef.current = now;
      const held = (now - blinkStartRef.current) / 1000;
      const pct  = Math.min((held / BLINK_HOLD_S) * 100, 100);
      setBlinkProgress(pct);

      if (held >= BLINK_HOLD_S && !confirmedRef.current) {
        confirmedRef.current = true;
        setBlinkProgress(100);
        clearInterval(intervalRef.current);
        onVoteConfirmed?.(candidates[selectedRef.current]);
      }
    } else {
      blinkStartRef.current = null;
      setBlinkProgress(0);
      setGestureStatus("detecting");

      if (now - navCoolRef.current > NAV_COOLDOWN) {
        if (res.direction === "up") {
          navCoolRef.current = now;
          setGestureStatus("navigating");
          setSelectedIndex(i => Math.max(0, i - 1));
        } else if (res.direction === "down") {
          navCoolRef.current = now;
          setGestureStatus("navigating");
          setSelectedIndex(i => Math.min(candidates.length - 1, i + 1));
        }
      }
    }
  }, [active, captureFrame, candidates, onVoteConfirmed]);

  useEffect(() => {
    if (!active) return;
    confirmedRef.current = false;
    setSelectedIndex(0);
    setBlinkProgress(0);
    setGestureStatus("idle");
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [active, poll]);

  // Auto-scroll selected card into view
  useEffect(() => {
    document
      .querySelector(`[data-candidate-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  return { selectedIndex, setSelectedIndex, blinkProgress, gestureStatus };
}