import React, { useState } from "react";
import { useLocation, useNavigate, Navigate, Link } from "react-router-dom";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { useAppDispatch } from "@/shared/hooks/redux";
import { setCredentials } from "../authSlice";
import { showToast } from "@/shared/store/toastSlice";
import { useTheme } from "@/context/ThemeContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface LocationState {
  login?: string;
}

const extractErrorMessage = (raw: unknown): string | null => {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item))
      .filter((item) => item.length > 0)
      .join(" ");
  }
  if (typeof raw === "object") {
    const parts: string[] = [];
    Object.values(raw as Record<string, unknown>).forEach((value) => {
      const part = extractErrorMessage(value);
      if (part) parts.push(part);
    });
    if (parts.length > 0) return parts.join(" ");
  }
  return null;
};

export const VerifyOtpPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { isDark } = useTheme();
  const state = (location.state as LocationState | null) ?? null;
  const login = state?.login ?? "";

  const inputClass = isDark
    ? "text-white placeholder:font-semibold placeholder:text-gray-300"
    : "text-gray-900 placeholder:font-semibold placeholder:text-gray-800";
  const labelClass = isDark
    ? "font-semibold text-gray-200"
    : "font-semibold text-gray-800";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  if (!login) {
    return <Navigate to="/auth/login" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otp.trim()) {
      setError("OTP is required");
      return;
    }
    setError(undefined);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, otp: otp.trim() }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          message?: unknown;
          error?: unknown;
        } | null;
        const extracted =
          errorBody &&
          extractErrorMessage(
            "error" in errorBody && errorBody.error != null
              ? errorBody.error
              : errorBody.message,
          );
        dispatch(
          showToast({
            message: extracted || "Invalid or expired OTP. Please try again.",
            type: "error",
          }),
        );
        return;
      }

      const data = (await response.json()) as {
        token: string;
        data: {
          id: number;
          firstname: string;
          lastname: string;
          username: string;
          email: string;
          roles?: Array<{ id?: number; name: string; guard_name?: string }>;
          role_names?: string[];
        };
      };

      dispatch(
        setCredentials({
          user: {
            id: String(data.data.id),
            firstname: data.data.firstname,
            lastname: data.data.lastname,
            username: data.data.username,
            name: `${data.data.firstname} ${data.data.lastname}`,
            email: data.data.email,
            roles: Array.isArray(data.data.roles) ? data.data.roles : [],
            role_names: Array.isArray(data.data.role_names)
              ? data.data.role_names
              : Array.isArray(data.data.roles)
                ? data.data.roles.map((role) => role.name)
                : [],
          },
          token: data.token,
        }),
      );

      navigate("/dashboard");
    } catch {
      dispatch(
        showToast({
          message: "Network error. Please check your connection and try again.",
          type: "error",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-4 mt-6">
        <div
          className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center ${
            isDark ? "bg-[#001219]" : "bg-gray-100"
          }`}
        >
          <img
            src="/images/logo.png"
            alt="Nigerian Army Aviation logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1
          className={`text-xl sm:text-2xl font-semibold ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Two-step Verification
        </h1>
        <p
          className={`text-sm text-center max-w-md ${
            isDark ? "text-gray-300" : "text-gray-700"
          }`}
        >
          We sent a one-time code to{" "}
          <span className="font-semibold">{login}</span>. Enter it below to
          complete sign-in.
        </p>
      </div>

      <div
        className={`w-full max-w-md rounded-lg px-8 py-10 border ${
          isDark
            ? "bg-[#001219] border-[#0A4D66]/50"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="One-time Code"
            placeholder="Enter 6-digit code"
            value={otp}
            inputMode="numeric"
            autoComplete="one-time-code"
            className={inputClass}
            labelClassName={labelClass}
            onChange={(event) => setOtp(event.target.value)}
            error={error}
          />

          <Button
            type="submit"
            className="w-full bg-[#0369A1] text-white hover:bg-[#0369A1]/90"
            isLoading={isLoading}
          >
            Verify &amp; Continue
          </Button>

          <div className="text-center">
            <Link
              to="/auth/login"
              className="text-sm text-primary-med hover:text-primary-med/80 transition-colors"
            >
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
