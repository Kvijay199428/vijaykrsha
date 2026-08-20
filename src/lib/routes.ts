const API = "/api";

export const ROUTES = {
  CONTACT: `${API}/vks/api/contact`,

  ADMINAPIAUTHLOGIN: `${API}/admin/api/auth/login`,
  ADMINAPIAUTHLOGINTOTP: `${API}/admin/api/auth/login-totp`,
  ADMINAPIAUTHLOGINOTPSEND: `${API}/admin/api/auth/login-otp-send`,
  ADMINAPIAUTHLOGINOTPVERIFY: `${API}/admin/api/auth/login-otp-verify`,
  ADMINAPIAUTHLOGOUT: `${API}/admin/api/auth/logout`,
  ADMINAPIAUTHME: `${API}/admin/api/auth/me`,
  ADMINAPISETUPREQUIRED: `${API}/admin/api/auth/setup-required`,
  ADMINAPISETUPCREATE: `${API}/admin/api/auth/setup-create`,
  ADMINAPIPASSWORDFORGOTVERIFY: `${API}/admin/api/auth/password/forgot-verify`,
  ADMINAPIPASSWORDFORGOTRESET: `${API}/admin/api/auth/password/forgot-reset`,

  ADMINAPISTATS: `${API}/admin/api/stats`,
  ADMINAPIMESSAGES: `${API}/admin/api/messages`,
  ADMINAPISETTINGS: `${API}/admin/api/settings`,
  ADMINAPIAUDITLOGS: `${API}/admin/api/audit-logs`,
  ADMINAPICHANGEPASSWORD: `${API}/admin/api/settings/change-password`,

  // User management
  ADMINAPIUSERS: `${API}/admin/api/users`,
  ADMINAPIUSERSBYID: (id: string) => `${API}/admin/api/users/${id}`,
  ADMINAPIUSERDISABLE: (id: string) => `${API}/admin/api/users/${id}/disable`,
  ADMINAPIUSERENABLE: (id: string) => `${API}/admin/api/users/${id}/enable`,
  ADMINAPIUSERREVOKE: (id: string) => `${API}/admin/api/users/${id}/revoke-sessions`,
  ADMINAPIUSERRESETPW: (id: string) => `${API}/admin/api/users/${id}/reset-password`,

  // Per-user TOTP
  ADMINAPIUSERTOTPSETUP: (id: string) => `${API}/admin/api/users/${id}/totp/setup`,
  ADMINAPIUSERTOTPENABLE: (id: string) => `${API}/admin/api/users/${id}/totp/enable`,
  ADMINAPIUSERTOTPDISABLE: (id: string) => `${API}/admin/api/users/${id}/totp/disable`,
  ADMINAPIUSERTOTPRESET: (id: string) => `${API}/admin/api/users/${id}/totp/reset`,

  // Global TOTP (owner's own settings)
  ADMINAPITOTPSETUP: `${API}/admin/api/settings/totp/setup`,
  ADMINAPITOTPENABLE: `${API}/admin/api/settings/totp/enable`,
  ADMINAPITOTPDISABLE: `${API}/admin/api/settings/totp/disable`,

  // Roles & permissions
  ADMINAPIROLES: `${API}/admin/api/roles`,
  ADMINAPIPERMISSIONS: `${API}/admin/api/permissions`,
} as const;
