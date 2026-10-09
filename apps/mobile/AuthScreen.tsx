import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { ResponsiveText as Text, useResponsive } from "./utils/responsive";
import { MaterialCommunityIcons } from "./NativeIcon";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as WebBrowser from "expo-web-browser";
import googleServices from "./google-services.json";
import { enText } from "../frontend/src/locales/en";
import { idText } from "../frontend/src/locales/id";
import {
  ApiError,
  authApi,
  clearAuthTokens,
  getAuthenticatedUser,
  saveAuthTokens,
  type AuthTokens,
  type AuthUser,
} from "./services/api-client";
import type { MobileLanguage } from "./mobile-locale";

WebBrowser.maybeCompleteAuthSession();

type AuthRoute = "login" | "register" | "forgot-password" | "reset-password";
type AuthScreenProps = {
  darkMode: boolean;
  language: MobileLanguage;
  initialReset?: { token: string; id: string } | null;
  initialError?: string | null;
  onAuthenticated: (user: AuthUser) => void;
  onPasswordReset: () => void;
  onDeepLink: (url: string) => void;
};
type AuthText = typeof idText.auth;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const authRedirectUri = "neraca://auth/callback";
const googleServerClientId = googleServices.client
  .flatMap((client) => client.oauth_client)
  .find((client) => client.client_type === 3)?.client_id;

function responseMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const data = error.data;
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
      if (Array.isArray(message)) {
        const messages = message.filter(
          (item): item is string => typeof item === "string",
        );
        if (messages.length) return messages.join("\n");
      }
    }
    return error.message || fallback;
  }
  return fallback;
}

function isEmailVerificationError(error: unknown) {
  return (
    error instanceof ApiError &&
    typeof error.data === "object" &&
    error.data !== null &&
    "errorCode" in error.data &&
    (error.data as { errorCode?: unknown }).errorCode ===
      "ERR_EMAIL_NOT_VERIFIED"
  );
}

function getAuthTokens(data: unknown): AuthTokens | null {
  if (typeof data !== "object" || data === null) return null;
  const value = data as Record<string, unknown>;
  return typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string"
    ? { accessToken: value.accessToken, refreshToken: value.refreshToken }
    : null;
}

export function AuthScreen({
  darkMode,
  language,
  initialReset,
  initialError,
  onAuthenticated,
  onPasswordReset,
  onDeepLink,
}: AuthScreenProps) {
  const { scale, moderateScale } = useResponsive();
  const text = (language === "en" ? enText.auth : idText.auth) as AuthText;
  const [route, setRoute] = useState<AuthRoute>(
    initialReset ? "reset-password" : "login",
  );
  const [resetToken, setResetToken] = useState(initialReset?.token ?? "");
  const [resetId, setResetId] = useState(initialReset?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<
    "google" | "github" | null
  >(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const colors = darkMode
    ? {
        background: "#020202",
        surface: "#171717",
        input: "#111111",
        text: "#FFFFFF",
        mutedText: "#A1A1AA",
        border: "#2A2A2A",
        accent: "#B2D5E5",
        accentText: "#101010",
        danger: "#F87171",
        success: "#4ADE80",
      }
    : {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        input: "#FFFFFF",
        text: "#18181B",
        mutedText: "#71717A",
        border: "#E4E4E7",
        accent: "#0A6CBA",
        accentText: "#FFFFFF",
        danger: "#DC2626",
        success: "#15803D",
      };

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
    setEmailNotVerified(false);
  }, []);

  const finishAuthentication = useCallback(
    async (tokens: AuthTokens, authenticatedUser?: AuthUser) => {
      await saveAuthTokens(tokens);
      try {
        const user =
          typeof authenticatedUser?.has_manual_password === "boolean"
            ? authenticatedUser
            : await getAuthenticatedUser();
        onAuthenticated(user);
      } catch (authenticationError) {
        await clearAuthTokens();
        throw authenticationError;
      }
    },
    [onAuthenticated],
  );

  const handleLogin = async () => {
    clearMessages();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError(text.loginRequired);
      return;
    }
    setSubmitting(true);
    try {
      const response = await authApi.login(normalizedEmail, password);
      const tokens = getAuthTokens(response.data);
      if (!response.success || !tokens) {
        setError(text.loginInvalidCredentials);
        return;
      }
      await finishAuthentication(tokens, response.user);
    } catch (loginError) {
      if (isEmailVerificationError(loginError)) {
        setEmailNotVerified(true);
        setError(text.emailNotVerified);
      } else {
        setError(responseMessage(loginError, text.genericError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    clearMessages();
    if (!fullName.trim()) {
      setError(text.fullNameRequired);
      return;
    }
    if (fullName.trim().length < 2) {
      setError(text.fullNameShort);
      return;
    }
    if (!email.trim() || !emailPattern.test(email.trim())) {
      setError(text.forgotInvalidEmail);
      return;
    }
    if (!password) {
      setError(text.passwordRequired);
      return;
    }
    if (password.length < 8) {
      setError(text.passwordMinLength);
      return;
    }
    if (password !== confirmPassword) {
      setError(text.passwordMismatch);
      return;
    }

    setSubmitting(true);
    try {
      const response = await authApi.register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      if (!response.success) {
        setError(response.message ?? text.registerFailed);
        return;
      }
      setVerificationEmailSent(response.verificationEmailSent !== false);
      setSuccess(text.registerSuccess);
    } catch (registerError) {
      setError(responseMessage(registerError, text.registerFailed));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();
    const normalizedEmail = email.trim();
    if (!emailPattern.test(normalizedEmail)) {
      setError(text.forgotInvalidEmail);
      return;
    }
    setSubmitting(true);
    try {
      const response = await authApi.forgotPassword(normalizedEmail);
      if (!response.success) {
        setError(response.message ?? text.forgotRequestFailed);
        return;
      }
      setEmail("");
      setSuccess(text.forgotSuccess);
    } catch (forgotError) {
      setError(responseMessage(forgotError, text.forgotRequestFailed));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    clearMessages();
    if (!resetToken || !resetId) {
      setError(text.resetInvalidToken);
      return;
    }
    if (!password) {
      setError(text.resetPasswordRequired);
      return;
    }
    if (password.length < 8) {
      setError(text.resetPasswordMinLength);
      return;
    }
    if (password !== confirmPassword) {
      setError(text.resetPasswordMismatch);
      return;
    }
    setSubmitting(true);
    try {
      const response = await authApi.resetPassword(
        resetToken,
        resetId,
        password,
      );
      if (!response.success) {
        setError(response.message ?? text.resetFailed);
        return;
      }
      await clearAuthTokens();
      setSuccess(text.resetSuccess);
      onPasswordReset();
      setRoute("login");
      setShowPassword(false);
      setPassword("");
      setConfirmPassword("");
      setResetToken("");
      setResetId("");
    } catch (resetError) {
      setError(responseMessage(resetError, text.resetInvalidToken));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    clearMessages();
    try {
      const response = await authApi.sendVerification(email.trim());
      if (!response.success) {
        setError(response.message ?? text.verificationEmailFailed);
      } else {
        setSuccess(text.verificationEmailSent);
      }
    } catch (resendError) {
      setError(responseMessage(resendError, text.verificationEmailFailed));
    } finally {
      setResending(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    clearMessages();
    setOauthProvider(provider);
    try {
      const browserResult = await WebBrowser.openAuthSessionAsync(
        await authApi.oauthRedirectUrl(provider, authRedirectUri),
        authRedirectUri,
      );
      if (browserResult.type === "success") {
        onDeepLink(browserResult.url);
      }
    } catch (oauthError) {
      setError(
        responseMessage(
          oauthError,
          provider === "google"
            ? text.oauthUnavailable
            : text.githubOauthUnavailable,
        ),
      );
    } finally {
      setOauthProvider(null);
    }
  };

  const handleNativeGoogleOAuth = async () => {
    clearMessages();
    setOauthProvider("google");
    let stage = "account_selection";
    try {
      if (!googleServerClientId) {
        throw new Error("Google Sign-In is missing its server client ID.");
      }

      GoogleSignin.configure({
        webClientId: googleServerClientId,
        scopes: ["email", "profile"],
      });
      const signInResult = await GoogleSignin.signIn();
      if (signInResult.type === "cancelled") return;

      stage = "access_token";
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) {
        throw new Error("Google Sign-In returned no access token.");
      }

      stage = "backend_authentication";
      const response = await authApi.googleNative(accessToken);
      const tokens = getAuthTokens(response.data);
      if (!response.success || !tokens) {
        console.error(
          "[Google Sign-In] Backend returned no valid session tokens.",
          {
            success: response.success,
            hasData: response.data !== undefined,
            hasAccessToken: Boolean(tokens?.accessToken),
            hasRefreshToken: Boolean(tokens?.refreshToken),
          },
        );
        setError(
          `Google Sign-In failed during ${stage}: ${response.message ?? text.oauthError}`,
        );
        return;
      }

      stage = "saving_session";
      await finishAuthentication(tokens, response.user);
    } catch (oauthError) {
      const nativeErrorCode =
        typeof oauthError === "object" &&
        oauthError !== null &&
        "code" in oauthError &&
        typeof oauthError.code === "string"
          ? oauthError.code
          : undefined;
      const nativeErrorMessage =
        oauthError instanceof Error
          ? oauthError.message
          : typeof oauthError === "object" &&
              oauthError !== null &&
              "message" in oauthError &&
              typeof oauthError.message === "string"
            ? oauthError.message
            : String(oauthError);
      console.error("[Google Sign-In] Authentication failed.", {
        stage,
        httpStatus:
          oauthError instanceof ApiError ? oauthError.status : undefined,
        nativeErrorCode,
        nativeErrorMessage,
      });
      const codeLabel = nativeErrorCode ? ` (${nativeErrorCode})` : "";
      const errorMessage =
        oauthError instanceof ApiError
          ? responseMessage(oauthError, nativeErrorMessage)
          : nativeErrorMessage;
      setError(
        `Google Sign-In failed during ${stage}${codeLabel}: ${errorMessage}`,
      );
    } finally {
      setOauthProvider(null);
    }
  };

  const handleOAuthPress = async (provider: "google" | "github") => {
    if (provider === "google" && Platform.OS === "android") {
      await handleNativeGoogleOAuth();
      return;
    }
    await handleOAuth(provider);
  };

  const setAuthRoute = (nextRoute: AuthRoute) => {
    clearMessages();
    setShowPassword(false);
    setPassword("");
    setConfirmPassword("");
    setRoute(nextRoute);
  };
  const isLogin = route === "login";
  const isRegister = route === "register";
  const isForgotPassword = route === "forgot-password";
  const isResetPassword = route === "reset-password";
  const title = isLogin
    ? text.loginTitle
    : isRegister
      ? text.registerTitle
      : isForgotPassword
        ? text.forgotTitle
        : text.resetTitle;
  const subtitle = isLogin
    ? text.loginSubtitle
    : isRegister
      ? text.registerSubtitle
      : isForgotPassword
        ? text.forgotSubtitle
        : text.resetSubtitle;
  const cardDescription = isLogin
    ? text.loginCardDescription
    : isRegister
      ? text.registerDescription
      : isForgotPassword
        ? text.forgotDescription
        : text.resetDescription;
  const passwordLabel = isResetPassword ? text.newPassword : text.password;
  const submitLabel = isLogin
    ? text.loginAction
    : isRegister
      ? text.registerAction
      : isForgotPassword
        ? text.forgotAction
        : text.resetAction;

  const renderField = (
    label: string,
    field: string,
    value: string,
    onChangeText: (value: string) => void,
    options: {
      placeholder?: string;
      secure?: boolean;
      keyboardType?: "default" | "email-address";
      autoComplete?: "name" | "email" | "current-password" | "new-password";
      autoCapitalize?: "none" | "words";
    } = {},
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        maxFontSizeMultiplier={1.2}
        value={value}
        onChangeText={onChangeText}
        placeholder={options.placeholder ?? label}
        placeholderTextColor={colors.mutedText}
        secureTextEntry={options.secure}
        keyboardType={options.keyboardType ?? "default"}
        autoComplete={options.autoComplete}
        autoCapitalize={options.autoCapitalize ?? "sentences"}
        autoCorrect={false}
        editable={!submitting}
        onFocus={() => setFocusedField(field)}
        onBlur={() =>
          setFocusedField((current) => (current === field ? null : current))
        }
        selectionColor={options.secure ? "transparent" : colors.accent}
        style={[
          styles.input,
          { height: scale(46), fontSize: moderateScale(16) },
          {
            color: options.secure ? "transparent" : colors.text,
            backgroundColor: colors.input,
            borderColor: focusedField === field ? colors.accent : colors.border,
          },
        ]}
      />
      {options.secure && value.length > 0 && (
        <Text
          accessible={false}
          pointerEvents="none"
          style={[styles.passwordMask, { color: colors.text }]}
        >
          {"•".repeat(value.length)}
        </Text>
      )}
    </View>
  );

  const handleSubmit = () => {
    if (isLogin) void handleLogin();
    else if (isRegister) void handleRegister();
    else if (isForgotPassword) void handleForgotPassword();
    else void handleResetPassword();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.brandBlock}>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel="Neraca"
            >
              <Svg width={scale(142)} height={scale(50)} viewBox="0 0 340 120">
                <Rect width="120" height="120" rx="28" fill="#0B2A4A" />
                <Circle
                  cx="45"
                  cy="60"
                  r="25"
                  fill="none"
                  stroke="#14B8A6"
                  strokeWidth="7"
                />
                <Circle
                  cx="75"
                  cy="60"
                  r="25"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="7"
                />
                <SvgText
                  x="150"
                  y="78"
                  fontFamily="Plus Jakarta Sans, Inter, Helvetica, Arial, sans-serif"
                  fontSize="54"
                  fontWeight="500"
                  letterSpacing="1"
                  fill={darkMode ? "#FFFFFF" : "#0B2A4A"}
                >
                  neraca
                </SvgText>
              </Svg>
            </View>
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              {isResetPassword && (
                <View
                  style={[
                    styles.securityIcon,
                      { width: scale(48), height: scale(48), backgroundColor: colors.accent },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={moderateScale(22)}
                    color={colors.accentText}
                  />
                </View>
              )}
              {!isLogin && !isRegister && (
                <Text style={[styles.title, { color: colors.text }]}>
                  {title}
                </Text>
              )}
              {!isLogin && !isRegister && (
                <Text style={[styles.description, { color: colors.mutedText }]}>
                  {cardDescription}
                </Text>
              )}
            </View>

            <View style={styles.form}>
              {isRegister &&
                renderField(text.fullName, "fullName", fullName, setFullName, {
                  autoComplete: "name",
                  autoCapitalize: "words",
                })}
              {(isLogin || isRegister || isForgotPassword) &&
                renderField(text.email, "email", email, setEmail, {
                  keyboardType: "email-address",
                  autoComplete: "email",
                  autoCapitalize: "none",
                })}
              {(isLogin || isRegister || isResetPassword) && (
                <View style={styles.field}>
                  <View style={styles.passwordHeading}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      {passwordLabel}
                    </Text>
                    {isLogin && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setAuthRoute("forgot-password")}
                        style={styles.inlineLink}
                      >
                        <Text
                          style={[styles.smallLink, { color: colors.accent }]}
                        >
                          {text.forgotPassword}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View>
                    <TextInput
                      accessibilityLabel={passwordLabel}
                      maxFontSizeMultiplier={1.2}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={
                        isLogin
                          ? text.loginPasswordPlaceholder
                          : text.passwordPlaceholder
                      }
                      placeholderTextColor={colors.mutedText}
                      secureTextEntry={!showPassword}
                      selectionColor={
                        showPassword ? colors.accent : "transparent"
                      }
                      autoComplete={
                        isLogin ? "current-password" : "new-password"
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!submitting}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() =>
                        setFocusedField((current) =>
                          current === "password" ? null : current,
                        )
                      }
                      onSubmitEditing={isLogin ? handleSubmit : undefined}
                      returnKeyType={isLogin ? "go" : "next"}
                      style={[
                        styles.input,
                        styles.passwordInput,
                        { height: scale(46), fontSize: moderateScale(16) },
                        {
                          color: showPassword ? colors.text : "transparent",
                          backgroundColor: colors.input,
                          borderColor:
                            focusedField === "password"
                              ? colors.accent
                              : colors.border,
                        },
                      ]}
                    />
                    {!showPassword && password.length > 0 && (
                      <Text
                        accessible={false}
                        pointerEvents="none"
                        style={[
                          styles.passwordMask,
                          styles.passwordMaskWithEye,
                          { color: colors.text },
                        ]}
                      >
                        {"•".repeat(password.length)}
                      </Text>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? text.hidePassword : text.showPassword
                      }
                      onPress={() => setShowPassword((visible) => !visible)}
                      style={[styles.visibilityButton, { width: scale(44), height: scale(44) }]}
                    >
                      <MaterialCommunityIcons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={moderateScale(19)}
                        color={colors.mutedText}
                      />
                    </Pressable>
                  </View>
                </View>
              )}
              {(isRegister || isResetPassword) &&
                renderField(
                  isRegister ? text.confirmPassword : text.confirmNewPassword,
                  "confirmPassword",
                  confirmPassword,
                  setConfirmPassword,
                  {
                    placeholder: isRegister
                      ? text.confirmPasswordPlaceholder
                      : text.confirmNewPasswordPlaceholder,
                    secure: !showPassword,
                    autoComplete: "new-password",
                    autoCapitalize: "none",
                  },
                )}

              {error && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.feedback, { color: colors.danger }]}
                >
                  {error}
                </Text>
              )}
              {success && (
                <Text
                  accessibilityRole="text"
                  style={[styles.feedback, { color: colors.success }]}
                >
                  {success}
                </Text>
              )}
              {isRegister && success && !verificationEmailSent && (
                <Text style={[styles.helpText, { color: colors.mutedText }]}>
                  {text.verificationEmailFailed}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  { minHeight: scale(46) },
                  {
                    backgroundColor: colors.accent,
                    opacity: submitting ? 0.65 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.accentText} />
                ) : (
                  <Text
                    style={[styles.submitText, { color: colors.accentText }]}
                  >
                    {submitLabel}
                  </Text>
                )}
              </Pressable>

              {emailNotVerified && (
                <Pressable
                  accessibilityRole="button"
                  disabled={resending}
                  onPress={() => void handleResendVerification()}
                  style={[styles.secondaryAction, { minHeight: scale(44) }]}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[styles.smallLink, { color: colors.accent }]}>
                      {text.resendVerification}
                    </Text>
                  )}
                </Pressable>
              )}
              {isRegister && success && (
                <Pressable
                  accessibilityRole="button"
                  disabled={resending}
                  onPress={() => void handleResendVerification()}
                  style={[styles.secondaryAction, { minHeight: scale(44) }]}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[styles.smallLink, { color: colors.accent }]}>
                      {text.resendVerification}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            {(isLogin || isRegister) && (
              <>
                <View style={styles.separator}>
                  <View
                    style={[
                      styles.separatorLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <Text
                    style={[styles.separatorText, { color: colors.mutedText }]}
                  >
                    {text.or}
                  </Text>
                  <View
                    style={[
                      styles.separatorLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>
                <View style={styles.oauthButtons}>
                  {(["google", "github"] as const).map((provider) => (
                    <Pressable
                      key={provider}
                      accessibilityRole="button"
                      disabled={oauthProvider !== null || submitting}
                      onPress={() => void handleOAuthPress(provider)}
                      style={({ pressed }) => [
                        styles.oauthButton,
                        { minHeight: scale(46) },
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          opacity:
                            oauthProvider && oauthProvider !== provider
                              ? 0.55
                              : pressed
                                ? 0.78
                                : 1,
                        },
                      ]}
                    >
                      {oauthProvider === provider ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : provider === "google" ? (
                        <Svg width={scale(19)} height={scale(19)} viewBox="0 0 48 48">
                          <Path
                            fill="#4285F4"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <Path
                            fill="#34A853"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.96 46.98 31.7 46.98 24.55z"
                          />
                          <Path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-3-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <Path
                            fill="#EA4335"
                            d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </Svg>
                      ) : (
                        <MaterialCommunityIcons
                          name="github"
                          size={moderateScale(19)}
                          color={darkMode ? "#FFFFFF" : "#181717"}
                        />
                      )}
                      <Text style={[styles.oauthText, { color: colors.text }]}>
                        {provider === "google"
                          ? text.continueGoogle
                          : text.continueGithub}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={styles.footer}>
            {isLogin ? (
              <Text style={[styles.footerText, { color: colors.mutedText }]}>
                {text.registerPrompt}{" "}
                <Text
                  style={{ color: colors.accent, fontWeight: "600" }}
                  onPress={() => setAuthRoute("register")}
                >
                  {text.registerLink}
                </Text>
              </Text>
            ) : (
              <Text style={[styles.footerText, { color: colors.mutedText }]}>
                {text.alreadyHaveAccountPrompt}{" "}
                <Text
                  style={{ color: colors.accent, fontWeight: "600" }}
                  onPress={() => setAuthRoute("login")}
                >
                  {text.loginInstead}
                </Text>
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  container: { width: "100%", maxWidth: 448, alignSelf: "center", gap: 28 },
  brandBlock: { alignItems: "center", gap: 10 },
  subtitle: { fontSize: 14, textAlign: "center" },
  card: { borderWidth: 0, borderRadius: 0, padding: 0 },
  cardHeader: { alignItems: "flex-start", gap: 7, marginBottom: 24 },
  securityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 26, fontWeight: "700", textAlign: "left" },
  description: { fontSize: 14, lineHeight: 20, textAlign: "left" },
  form: { gap: 18 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    height: 46,
    paddingHorizontal: 12,
  },
  passwordInput: { paddingRight: 44 },
  passwordMask: {
    position: "absolute",
    left: 13,
    right: 12,
    top: 0,
    bottom: 0,
    fontSize: 16,
    textAlignVertical: "center",
  },
  passwordMaskWithEye: { right: 44 },
  passwordHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  visibilityButton: {
    position: "absolute",
    right: 8,
    top: 1,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineLink: { minHeight: 36, justifyContent: "center", paddingLeft: 8 },
  smallLink: { fontSize: 13, fontWeight: "500", textAlign: "center" },
  feedback: { fontSize: 13, lineHeight: 19 },
  helpText: { fontSize: 13, lineHeight: 19 },
  submitButton: {
    minHeight: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  submitText: { fontSize: 15, fontWeight: "600" },
  secondaryAction: {
    alignSelf: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
  },
  separatorLine: { height: StyleSheet.hairlineWidth, flex: 1 },
  separatorText: { fontSize: 12 },
  oauthButtons: { gap: 10 },
  oauthButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  oauthText: { fontSize: 14, fontWeight: "500" },
  footer: { alignItems: "center", paddingTop: 2 },
  footerText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
