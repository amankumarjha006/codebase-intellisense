/**
 * Global Keyboard Shortcut Utilities
 * Guards shortcuts from triggering while the user is typing in inputs, textareas,
 * comboboxes, or modal dialogs.
 */
export function isInputFocused(e?: KeyboardEvent): boolean {
  const target = (e?.target || (typeof document !== 'undefined' ? document.activeElement : null)) as HTMLElement | null;
  if (!target) return false;

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable ||
    Boolean(target.closest('[role="combobox"]')) ||
    Boolean(target.closest('[role="dialog"]'))
  );
}

