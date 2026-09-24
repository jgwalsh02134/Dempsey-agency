type ToastListener = (message: string) => void;

let listener: ToastListener | null = null;

export function subscribeToast(fn: ToastListener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function toast(message: string): void {
  listener?.(message);
}
