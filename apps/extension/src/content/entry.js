import { Picker, createChromeAdapter } from '@web-to-svg/engine';

// Toggle guard — if already active, deactivate
if (window.__webToSvgActive) {
  window.__webToSvgCleanup?.();
} else {
  const adapter = createChromeAdapter();
  const picker = new Picker({
    adapter,
    onCleanup: () => {
      window.__webToSvgActive = false;
      window.__webToSvgCleanup = undefined;
    },
  });
  window.__webToSvgActive = true;
  window.__webToSvgCleanup = () => picker.deactivate();
  picker.activate();
}
