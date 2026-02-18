import authReducer, { setCredentials, logout } from '../features/auth/authSlice';

describe('auth reducer', () => {
  const initialState = {
    user: null,
    token: null,
    isAuthenticated: false,
  };

  it('should handle initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle setCredentials', () => {
    const user = { id: '1', name: 'Test User', email: 'test@example.com' };
    const token = 'fake-token';
    const actual = authReducer(initialState, setCredentials({ user, token }));
    expect(actual.user).toEqual(user);
    expect(actual.token).toEqual(token);
    expect(actual.isAuthenticated).toEqual(true);
  });

  it('should handle logout', () => {
    const loggedInState = {
      user: { id: '1', name: 'Test User', email: 'test@example.com' },
      token: 'fake-token',
      isAuthenticated: true,
    };
    const actual = authReducer(loggedInState, logout());
    expect(actual).toEqual(initialState);
  });
});
