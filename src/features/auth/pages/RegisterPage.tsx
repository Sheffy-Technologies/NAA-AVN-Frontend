import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/button/Button';
import { Input } from '@/shared/ui/input/Input';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const calculatePasswordStrength = (password: string) => {
    if (!password) return 0;
    let score = 0;
    if (password.length > 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };

  const strength = calculatePasswordStrength(formData.password);
  
  const validate = () => {
    const newErrors: typeof errors = {};
    if (!formData.fullName) newErrors.fullName = 'Full Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      navigate('/auth/login'); // Or verification page
    }, 1500);
  };

  return (
    <div className="bg-[#001219] p-8 rounded-lg shadow-xl border border-[#0A4D66]/50 backdrop-blur-sm">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 font-primary">Create Account</h1>
        <p className="text-gray-400">Join us to get started</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Full Name"
          placeholder="John Doe"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          error={errors.fullName}
          leftIcon="mdi:account"
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          leftIcon="mdi:email"
        />

        <div>
            <Input
            label="Password"
            type="password"
            placeholder="Create a password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={errors.password}
            leftIcon="mdi:lock"
            />
            {formData.password && (
                <div className="mt-2 flex gap-1">
                    {[...Array(4)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`h-1 flex-1 rounded-full transition-colors ${
                                i < strength ? (strength < 2 ? 'bg-red-500' : strength < 3 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-gray-700'
                            }`} 
                        />
                    ))}
                </div>
            )}
        </div>

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
          leftIcon="mdi:lock-check"
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create Account
        </Button>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-primary-med hover:text-primary-med/80 transition-colors">
              Login
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};
