import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const AuthContext = createContext();

const isNativeApp = Capacitor.isNativePlatform();
const MOBILE_REDIRECT_URL = 'com.manovel.app://login-callback';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const buildUser = async (authUser) => {
    if (!authUser) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Profile loading error:', error);
    }

    return {
      ...authUser,
      id: authUser.id,
      email: authUser.email,

      full_name:
        profile?.display_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split('@')[0] ||
        'User',

      display_name:
        profile?.display_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        '',

      avatar_url:
        profile?.avatar_url ||
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        '',

      banner_url: profile?.banner_url || '',
      bio: profile?.bio || '',
      role: profile?.role || 'user',
    };
  };

  const ensureProfile = async (authUser) => {
    if (!authUser) return null;

    const displayName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'User';

    const avatarUrl =
      authUser.user_metadata?.avatar_url ||
      authUser.user_metadata?.picture ||
      '';

    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile check error:', profileError);
    }

    if (!existingProfile) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email,
          display_name: displayName,
          avatar_url: avatarUrl,
          role: 'user',
        });

      if (insertError) {
        console.error('Profile creation error:', insertError);
      }
    }

    return buildUser(authUser);
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session?.user) {
        const appUser = await ensureProfile(session.user);

        setUser(appUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }

      setAuthChecked(true);
    } catch (error) {
      console.error('Authentication check failed:', error);

      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);

      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to check authentication',
      });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const checkAppState = async () => {
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  useEffect(() => {
    let mounted = true;

    checkUserAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const appUser = await ensureProfile(session.user);

          if (mounted) {
            setUser(appUser);
            setIsAuthenticated(true);
            setAuthChecked(true);
            setIsLoadingAuth(false);
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * Google OAuth callback for Android
   *
   * Handles both:
   *
   * 1. appUrlOpen
   *    When MaNovel is already running.
   *
   * 2. getLaunchUrl
   *    When Android launches MaNovel from the Google callback.
   */
  useEffect(() => {
    if (!isNativeApp) return;

    let listener;
    let handledUrl = null;

    const handleOAuthCallback = async (url) => {
      if (!url) return;

      // Prevent processing the same callback twice.
      if (handledUrl === url) return;
      handledUrl = url;

      console.log('MaNovel: OAuth callback received');

      try {
        const callbackUrl = new URL(url);

        /*
         * Supabase implicit flow:
         *
         * com.manovel.app://login-callback
         * #access_token=...
         * &refresh_token=...
         */
        const hash = callbackUrl.hash || '';

        const hashParams = new URLSearchParams(
          hash.startsWith('#') ? hash.substring(1) : hash
        );

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        /*
         * PKCE flow:
         *
         * com.manovel.app://login-callback?code=...
         */
        const code = callbackUrl.searchParams.get('code');

        setIsLoadingAuth(true);
        setAuthError(null);

        /*
         * OPTION 1:
         * We received access_token + refresh_token.
         */
        if (accessToken && refreshToken) {
          console.log('MaNovel: OAuth tokens detected');

          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          if (!data?.session) {
            throw new Error(
              'Supabase did not create an authentication session.'
            );
          }

          console.log('MaNovel: Supabase session created successfully');
        }

        /*
         * OPTION 2:
         * We received an OAuth authorization code.
         */
        else if (code) {
          console.log('MaNovel: OAuth code detected');

          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          if (!data?.session) {
            throw new Error(
              'Supabase did not create an authentication session.'
            );
          }

          console.log('MaNovel: OAuth code exchanged successfully');
        }

        /*
         * OPTION 3:
         * Nothing was returned.
         */
        else {
          throw new Error(
            'No access token, refresh token, or OAuth code was found.'
          );
        }

        /*
         * Wait briefly so Supabase can finish
         * updating the local authentication state.
         */
        await new Promise((resolve) => setTimeout(resolve, 300));

        /*
         * Reload the current authenticated user.
         */
        await checkUserAuth();

        /*
         * Close the external browser.
         */
        try {
          await Browser.close();
        } catch {
          // Browser may already be closed.
        }

        console.log('MaNovel: Google login completed');
      } catch (error) {
        console.error('MaNovel OAuth callback error:', error);

        setAuthError({
          type: 'login_error',
          message:
            error.message || 'Could not complete Google login',
        });

        try {
          await Browser.close();
        } catch {
          // Browser may already be closed.
        }

        await checkUserAuth();
      } finally {
        setIsLoadingAuth(false);
      }
    };

    const setupOAuthListener = async () => {
      /*
       * Case 1:
       * MaNovel is already running.
       */
      listener = await App.addListener(
        'appUrlOpen',
        async ({ url }) => {
          await handleOAuthCallback(url);
        }
      );

      /*
       * Case 2:
       * Android opened MaNovel directly from
       * the Google OAuth callback.
       */
      try {
        const launchUrlResult = await App.getLaunchUrl();

        if (launchUrlResult?.url) {
          await handleOAuthCallback(launchUrlResult.url);
        }
      } catch (error) {
        console.error(
          'MaNovel: Could not read launch URL:',
          error
        );
      }
    };

    setupOAuthListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }

    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = async () => {
    setAuthError(null);

    try {
      const redirectTo = isNativeApp
        ? MOBILE_REDIRECT_URL
        : window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: isNativeApp,
        },
      });

      if (error) {
        console.error('Google login failed:', error);

        setAuthError({
          type: 'login_error',
          message: error.message || 'Google login failed',
        });

        return;
      }

      /*
       * Android:
       * Open Google's OAuth page in the system browser.
       */
      if (isNativeApp && data?.url) {
        await Browser.open({
          url: data.url,
        });
      }
    } catch (error) {
      console.error('Google login error:', error);

      setAuthError({
        type: 'login_error',
        message: error.message || 'Google login failed',
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};