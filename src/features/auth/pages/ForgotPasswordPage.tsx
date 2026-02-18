import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button/Button';
import { Input } from '@/shared/ui/input/Input';
import { Icon } from '@/shared/icons/Icon';

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

    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <div className="bg-[#001219] p-8 rounded-lg shadow-xl border border-[#0A4D66]/50 backdrop-blur-sm text-center">
        <div className="mx-auto w-16 h-16 bg-primary-med/10 rounded-full flex items-center justify-center mb-6">
          <Icon icon="mdi:email-check" className="text-primary-med" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-gray-400 mb-8">
          We have sent a password reset link to <br />
          <span className="text-white font-medium">{email}</span>
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
        <p className="text-gray-400">Enter your email to receive reset instructions</p>
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
          Send Reset Link
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
