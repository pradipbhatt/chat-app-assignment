import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const NEAR_BOTTOM_PX = 80;

export function useAutoScroll(messages) {
  const containerRef = useRef(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const nearBottom = useRef(true);
  const previousCount = useRef(messages.length);
  const prependAnchor = useRef(null);

  const isNearBottom = useCallback((element) => {
    if (!element) return true;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    return distance <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const element = containerRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    nearBottom.current = true;
    setHasNewBelow(false);
  }, []);

  const onScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    nearBottom.current = isNearBottom(element);
    if (nearBottom.current) setHasNewBelow(false);
  }, [isNearBottom]);

  const captureBeforePrepend = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    prependAnchor.current = { height: element.scrollHeight, top: element.scrollTop };
  }, []);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (prependAnchor.current) {
      const { height, top } = prependAnchor.current;
      element.scrollTop = element.scrollHeight - height + top;
      prependAnchor.current = null;
      previousCount.current = messages.length;
      return;
    }

    const grew = messages.length > previousCount.current;
    previousCount.current = messages.length;
    if (!grew) return;

    if (nearBottom.current) {
      element.scrollTop = element.scrollHeight;
    } else {
      setHasNewBelow(true);
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  return { containerRef, onScroll, hasNewBelow, scrollToBottom, captureBeforePrepend };
}
