let listeners = [];
let toasts = [];

export function showToast(message, type = 'info', duration = 4000) {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, message, type }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
}

export function dismissToast(id) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

function emit() {
  for (const fn of listeners) {
    fn(toasts);
  }
}

export function subscribe(fn) {
  listeners.push(fn);
  fn(toasts);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}
