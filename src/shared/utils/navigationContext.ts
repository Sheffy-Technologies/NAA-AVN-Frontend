import { useLocation, useNavigate, type NavigateOptions } from "react-router-dom";

export interface NavigationContextState {
  from?: string;
  fromLabel?: string;
  tab?: string;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Validates that a return destination is a safe relative in-app path,
 * preventing open-redirect and protocol execution vulnerabilities.
 */
export const isValidReturnPath = (path?: string | null): path is string => {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  // Must start with a single slash and not double slashes or backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }
  // Must not contain scheme or protocol attempts
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false;
  }
  return true;
};

/**
 * Resolves the return destination from router location state, search parameters, or fallback.
 */
export const getReturnDestination = (
  location: { pathname: string; search?: string; state?: unknown },
  fallbackUrl?: string,
): { path: string | null; label?: string; hasExplicitContext: boolean } => {
  const state = (location.state && typeof location.state === "object" ? location.state : {}) as NavigationContextState;

  // 1. Check router state `from`
  if (isValidReturnPath(state.from)) {
    return {
      path: state.from,
      label: state.fromLabel,
      hasExplicitContext: true,
    };
  }

  // 2. Check query parameter `returnTo` or `from`
  if (location.search) {
    try {
      const params = new URLSearchParams(location.search);
      const queryReturn = params.get("returnTo") || params.get("from");
      if (isValidReturnPath(queryReturn)) {
        return {
          path: queryReturn,
          label: state.fromLabel,
          hasExplicitContext: true,
        };
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // 3. Fallback URL if provided and valid
  if (isValidReturnPath(fallbackUrl)) {
    return {
      path: fallbackUrl,
      label: undefined,
      hasExplicitContext: false,
    };
  }

  return {
    path: null,
    label: undefined,
    hasExplicitContext: false,
  };
};

/**
 * React hook to access return destination and context-aware back navigation.
 */
export const useNavigationContext = (fallbackUrl?: string) => {
  const location = useLocation();
  const navigate = useNavigate();

  const destination = getReturnDestination(location, fallbackUrl);

  const navigateBack = (options?: NavigateOptions) => {
    // 1. If browser history has a valid prior step in the current session,
    // navigate(-1) returns to the exact prior URL (including query parameters,
    // active tab/subtab, filters, pagination, and scroll position).
    const canGoBackInHistory = Boolean(
      (typeof window !== "undefined" &&
        window.history.state &&
        typeof window.history.state.idx === "number" &&
        window.history.state.idx > 0) ||
      (location.key && location.key !== "default")
    );

    if (canGoBackInHistory) {
      navigate(-1);
      return;
    }

    // 2. Direct entry / refresh fallback: if user arrived via direct link or refreshed,
    // use explicit return path from location state or query parameter if available
    if (destination.hasExplicitContext && destination.path) {
      navigate(destination.path, options);
      return;
    }

    // 3. Fallback URL
    if (destination.path) {
      navigate(destination.path, options);
      return;
    }

    // 4. Default fallback
    navigate(-1);
  };

  return {
    returnPath: destination.path,
    returnLabel: destination.label,
    hasReturnContext: destination.hasExplicitContext,
    navigateBack,
  };
};
