// Keeps the pointer on the element while it is dragged, even when it leaves it. A pointer the browser does not know (a
// synthesized one, as in automated tests) cannot be captured, which only means the drag ends when the pointer leaves.
export function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture?.(pointerId)
  } catch {
    // Not an active pointer
  }
}
