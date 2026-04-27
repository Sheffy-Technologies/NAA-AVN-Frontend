import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { useAppDispatch } from "@/shared/hooks/redux";
import { setCredentials } from "../authSlice";
import { showToast } from "@/shared/store/toastSlice";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const DEVICE_ID_KEY = "naavn_device_id";

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
    const values = Object.values(raw as Record<string, unknown>);
    const parts: string[] = [];

    values.forEach((value) => {
      const part = extractErrorMessage(value);
      if (part) parts.push(part);
    });

    if (parts.length > 0) return parts.join(" ");
  }

  return null;
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [formData, setFormData] = useState({
    login: "",
    password: "",
  });
  const [errors, setErrors] = useState<{ login?: string; password?: string }>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!formData.login) newErrors.login = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const deviceId =
        typeof window === "undefined"
          ? null
          : window.localStorage.getItem(DEVICE_ID_KEY);

      const payload: Record<string, unknown> = {
        login: formData.login,
        password: formData.password,
      };

      if (deviceId) {
        payload.device_id = deviceId;
      }

      const response = await fetch(`${API_BASE_URL}/auth/login/user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

        dispatch(showToast({ message: extracted || "Unable to login. Please try again.", type: "error" }));
        return;
      }

      const data = (await response.json()) as {
        message: string;
        token: string;
        expired_at: string | null;
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
      dispatch(showToast({ message: "Network error. Please check your connection and try again.", type: "error" }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-10">

      <div className="flex flex-col items-center gap-4 mt-6">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-[#001219] flex items-center justify-center">
          <img
            src="/images/logo.png"
            alt="Nigerian Army Aviation logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">
          Nigerian Army Aviation Database
        </h1>
      </div>

      <div className="w-full max-w-md bg-[#001219] border border-[#0A4D66]/50 rounded-lg px-8 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Username or Email"
            placeholder="Enter Username or Email"
            value={formData.login}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, login: e.target.value }))
            }
            error={errors.login}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter Password"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            error={errors.password}
          />

          <div className="flex items-center justify-end">
            <Link
              to="/auth/forgot-password"
              className="text-sm text-primary-med hover:text-primary-med/80 transition-colors"
            >
              Forgot Password
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#7FD5FF] text-black hover:bg-[#7FD5FF]/90"
            isLoading={isLoading}
          >
            Login
          </Button>
        </form>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="flex items-start gap-3 bg-[#7f1d1d] bg-opacity-80 text-red-100 px-4 py-3 rounded-md border border-red-500/60">
          <span className="mt-0.5 text-xl">⚠️</span>
          <p className="text-xs sm:text-sm">
            This system is for authorised Nigerian Army personnel only.
            Unauthorised access is prohibited and monitored.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-[#7FD5FF]">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[#7FD5FF] text-[11px]">
            ?
          </span>
          <button
            type="button"
            className="underline underline-offset-2 hover:text-[#b3e6ff]"
          >
            Help &amp; Support
          </button>
        </div>
      </div>
    </div>
  );
};
