import { useEffect, useRef, useState } from "react";
import { loadPublicAuthConfig } from "../lib/api.js";

let googleLibraryPromise;
let initializedClientId = "";
let activeCredentialHandler = null;

function loadGoogleLibrary() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleLibraryPromise) {
    googleLibraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      const script = existing || document.createElement("script");
      script.addEventListener("load", () => resolve(window.google), { once: true });
      script.addEventListener("error", () => reject(new Error("Google sign-in could not be loaded.")), { once: true });
      if (!existing) {
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }
  return googleLibraryPromise;
}

export default function GoogleIdentityButton({ mode = "signin", onCredential, disabled = false, hideWhenUnavailable = false }) {
  const containerRef = useRef(null);
  const handlerRef = useRef(onCredential);
  const [unavailable, setUnavailable] = useState(false);
  handlerRef.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    if (disabled) return undefined;
    Promise.all([loadPublicAuthConfig(), loadGoogleLibrary()])
      .then(([config, google]) => {
        if (cancelled || !containerRef.current) return;
        const clientId = String(config.googleClientId || "").trim();
        if (!clientId) {
          setUnavailable(true);
          return;
        }
        activeCredentialHandler = (response) => handlerRef.current?.(response?.credential || "");
        if (initializedClientId !== clientId) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => activeCredentialHandler?.(response),
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true,
            use_fedcm_for_button: true,
          });
          initializedClientId = clientId;
        }
        containerRef.current.replaceChildren();
        google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(360, Math.max(240, containerRef.current.clientWidth || 320)),
        });
      })
      .catch(() => { if (!cancelled) setUnavailable(true); });
    return () => {
      cancelled = true;
      if (activeCredentialHandler) activeCredentialHandler = null;
    };
  }, [disabled, mode]);

  if (unavailable) return hideWhenUnavailable ? null : <p className="google-auth-unavailable">Google sign-in is temporarily unavailable. Continue with email instead.</p>;
  return <div className="google-auth-button" ref={containerRef} aria-label={mode === "signup" ? "Sign up with Google" : "Sign in with Google"} />;
}
