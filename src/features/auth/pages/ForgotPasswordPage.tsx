import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button/Button';
import { Input } from '@/shared/ui/input/Input';
import { Icon } from '@/shared/icons/Icon';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const extractErrorMessage = (raw: unknown): string | null => {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item))
      .filter((item) => item.length > 0)
      .join(' ');
  }
  if (typeof raw === 'object') {
    const parts: string[] = [];
    Object.values(raw as Record<string, unknown>).forEach((value) => {
      const part = extractErrorMessage(value);
      if (part) parts.push(part);
    });
    if (parts.length > 0) return parts.join(' ');
  }
  return null;
};

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          message?: unknown;
          error?: unknown;
        } | null;

        const extracted =
          errorBody &&
          extractErrorMessage(
            'error' in (errorBody ?? {}) && errorBody?.error != null
              ? errorBody.error
              : errorBody?.message,
          );

        setError(extracted || 'Unable to send reset email. Please try again.');
        return;
      }

      setIsSubmitted(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-[#001219] p-8 rounded-lg shadow-xl border border-[#0A4D66]/50 backdrop-blur-sm text-center">
        <div className="mx-auto w-16 h-16 bg-primary-med/10 rounded-full flex items-center justify-center mb-6">
          <Icon icon="mdi:email-check" className="text-primary-med" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-gray-400 mb-8">
          If an account exists for <br />
          <span className="text-white font-medium">{email}</span>, we have sent
          a temporary password. Use it to log in and then change your password
          from your account settings.
        </p>
        <Link to="/auth/login">
          <Button className="w-full">Back to Login</Button>
        </Link>
        <div className="mt-4">
            <button
                onClick={() => setIsSubmitted(false)}
                className="text-sm text-primary-med hover:text-primary-med/80"
            >
                Didn't receive the email? Try again
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#001219] p-8 rounded-lg shadow-xl border border-[#0A4D66]/50 backdrop-blur-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-gray-400">
          Enter your email and we'll send you a temporary password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Email Address"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          error={error}
          leftIcon="mdi:email"
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Send Temporary Password
        </Button>

        <div className="text-center">
          <Link to="/auth/login" className="text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-colors">
            <Icon icon="mdi:arrow-left" size={16} />
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
};
