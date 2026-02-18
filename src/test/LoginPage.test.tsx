import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { vi } from 'vitest';

// Mock the useNavigate hook
const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

const renderWithProviders = (component: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
  });

  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('LoginPage Integration', () => {
  beforeEach(() => {
    mockedNavigate.mockReset();
  });

  it('renders login form correctly', () => {
    renderWithProviders(<LoginPage />);
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', () => {
    renderWithProviders(<LoginPage />);
    
    const loginButton = screen.getByRole('button', { name: /Login/i });
    fireEvent.click(loginButton);

    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('navigates to dashboard on successful login', async () => {
    renderWithProviders(<LoginPage />);
    
    const usernameInput = screen.getByLabelText(/Username or Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const loginButton = screen.getByRole('button', { name: /Login/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    fireEvent.click(loginButton);

    // Wait for the async login simulation (setTimeout in component)
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 2000 });
  });
});
