'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            cfg: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
              logo_alignment?: string;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function googleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
}

let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS_LOAD')));
      if (window.google?.accounts?.id) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GIS_LOAD'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  onCredential: (idToken: string) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
};

/** Google Identity Services button. Hidden when client ID is not configured. */
export function GoogleSignInButton({
  onCredential,
  disabled,
  label = 'Continue with Google',
}: Props) {
  const clientId = googleClientId();
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

  const mount = useCallback(async () => {
    if (!clientId || !hostRef.current) return;
    try {
      await loadGis();
      if (!window.google?.accounts?.id || !hostRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => {
          if (res.credential) void cbRef.current(res.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      hostRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(hostRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360,
        logo_alignment: 'left',
      });
      setReady(true);
    } catch {
      setFailed(true);
    }
  }, [clientId]);

  useEffect(() => {
    void mount();
  }, [mount]);

  if (!clientId) {
    if (process.env.NODE_ENV === 'development') {
      return (
        <button
          type="button"
          disabled={disabled}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border text-[13px] font-medium disabled:opacity-50"
          style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
          onClick={() => {
            void cbRef.current('dev-google');
          }}
        >
          <GoogleMark />
          {label} (dev)
        </button>
      );
    }
    return null;
  }

  if (failed) {
    return (
      <p className="text-center text-[12px]" style={{ color: 'var(--text-3)' }}>
        Google sign-in unavailable
      </p>
    );
  }

  return (
    <div
      className="relative flex w-full justify-center overflow-hidden rounded-md"
      style={{ opacity: disabled || !ready ? 0.55 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <div ref={hostRef} className="min-h-[44px] w-full [&>div]:!w-full" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21 21-9.3 21-21c0-1.4-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 36.3 26.8 37 24 37c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 40.6 16.2 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.0.0 6.2 5.2C39.2 36.3 45 31 45 24c0-1.4-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
