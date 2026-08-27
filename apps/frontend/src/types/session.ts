export interface SessionItem {
  id: string;
  user_id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  user_agent: string | null;
  last_activity_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionListParams {
  page?: number;
  limit?: number;
}

export interface SessionListResult {
  items: SessionItem[];
}