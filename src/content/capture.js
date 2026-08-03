import { ERROR_CODES, ExportError } from '../shared/errors.js';
import { aggregateAttachments, prefetchEphemeralAttachments } from './attachments.js';
import { dedupeMessages, mergeCapturedMessage, sortMessagesChronologically } from './model.js';
import {
  captureScrollState, clickLoadEarlierButton, clickVisibleMessageExpanders, extractMessageElement, findMessageNodes,
  restoreScrollState, setScrollTop, shouldClickLoaderForState,
} from './teams-adapter.js';
import { sleep, throwIfAborted } from './utils.js';

export async function captureChatHistory(scroller, overlay, signal, config) {
  const messageMap = new Map();
  const ephemeralMap = new Map();
  const clickedExpanders = new WeakSet();
  const initialScrollState = captureScrollState(scroller);
  let captureOrder = 0;
  let lastLoaderState = '';
  let stableTopCycles = 0;
  let previousTopSignature = '';
  let previousScrollHeight = -1;
  let cycles = 0;
  let limitReached = false;

  try {
    setScrollTop(scroller, scroller.scrollHeight);
    await sleep(config.topLoadDelayMs, signal);
    while (cycles < config.maxScrollCycles) {
      throwIfAborted(signal);
      const visible = findMessageNodes(scroller);
      const expanded = clickVisibleMessageExpanders(visible, clickedExpanders);
      if (expanded) await sleep(60, signal);
      const currentNodes = findMessageNodes(scroller);
      const batchMessages = currentNodes.map((node, domIndex) => ({
        ...extractMessageElement(node, captureOrder + domIndex), captureBatch: cycles, domIndex,
      })).filter((message) => message.text || message.attachments.length || message.links.length || message.reactions.length);
      captureOrder += batchMessages.length;
      let newlyCaptured = 0;
      for (const message of batchMessages) if (mergeCapturedMessage(messageMap, message)) newlyCaptured += 1;
      await prefetchEphemeralAttachments(batchMessages, ephemeralMap, signal, config.includeAttachments);

      const top = Math.max(0, Number(scroller.scrollTop) || 0);
      const height = Math.max(0, Number(scroller.scrollHeight) || 0);
      const signature = batchMessages.slice(0, 4).map((message) => message.id).join('|');
      overlay.update({
        phase: overlay.text('phaseReadingHistory'),
        status: overlay.text('statusCaptureStep', { step: cycles + 1, top: Math.round(top), height: Math.round(height) }),
        messages: messageMap.size,
        attachments: aggregateAttachments([...messageMap.values()]).length,
      });

      if (top <= 3) {
        const loaderState = `${signature}|${Math.round(height)}|${messageMap.size}`;
        if (shouldClickLoaderForState(loaderState, lastLoaderState)) {
          const clickedLoader = clickLoadEarlierButton(scroller) || clickLoadEarlierButton(document);
          if (clickedLoader) {
            lastLoaderState = loaderState;
            overlay.log(overlay.text('logEarlierMessages'));
            stableTopCycles = 0;
            await sleep(config.topLoadDelayMs, signal);
            cycles += 1;
            continue;
          }
        }
        const sameTop = signature === previousTopSignature && Math.abs(height - previousScrollHeight) < 3;
        stableTopCycles = newlyCaptured === 0 && sameTop ? stableTopCycles + 1 : 0;
        if (stableTopCycles >= config.topStableCycles) break;
        setScrollTop(scroller, 0);
        await sleep(config.topLoadDelayMs, signal);
      } else {
        stableTopCycles = 0;
        const step = Math.max(280, (Number(scroller.clientHeight) || 700) * config.scrollStepRatio);
        const target = Math.max(0, top - step);
        setScrollTop(scroller, target);
        await sleep(config.scrollDelayMs, signal);
        if (Math.abs((Number(scroller.scrollTop) || 0) - top) < 2 && top > 3) {
          try {
            scroller.scrollBy(0, -step);
            scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: -step, bubbles: true }));
          } catch {
            setScrollTop(scroller, target);
          }
          await sleep(config.scrollDelayMs, signal);
        }
      }
      previousTopSignature = signature;
      previousScrollHeight = height;
      cycles += 1;
    }
    limitReached = cycles >= config.maxScrollCycles;
  } finally {
    restoreScrollState(scroller, initialScrollState);
  }

  if (limitReached) throw new ExportError(ERROR_CODES.CAPTURE_LIMIT_REACHED, overlay.text('errorCaptureLimit'), { cycles, capturedMessages: messageMap.size });
  const messages = sortMessagesChronologically(dedupeMessages([...messageMap.values()]));
  return { messages, ephemeralMap, cycles };
}
