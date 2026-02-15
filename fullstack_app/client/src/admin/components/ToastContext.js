import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext({
  pushToast: () => {},
});

const typeStyles = {
  info: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
  success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[120] grid gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-72 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${typeStyles[toast.type] || typeStyles.info}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
