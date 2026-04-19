/**
 * Prevents Radix Dialog/Sheet from closing when the user clicks
 * a Sonner toast or other transient notification overlays.
 */
export const ignoreToastInteractOutside = (e: Event) => {
  const target = e.target as Element | null;
  if (!target) return;
  const isToast =
    target.closest("[data-sonner-toast]") ||
    target.closest("[data-sonner-toaster]") ||
    target.closest('[role="status"]') ||
    target.closest('[role="alert"]');
  if (isToast) {
    e.preventDefault();
  }
};
