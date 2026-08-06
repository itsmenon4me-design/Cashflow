export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}
