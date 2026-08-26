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
  ADMINAPIUSERSCREATE: `${API}/admin/api/users/create`,
  ADMINAPIUSERSAVAILABILITY: `${API}/admin/api/users/check-availability`,
  ADMINAPIUSERSBYID: (id: string) => `${API}/admin/api/users/${id}`,
  ADMINAPIUSERDISABLE: (id: string) => `${API}/admin/api/users/${id}/disable`,
  ADMINAPIUSERENABLE: (id: string) => `${API}/admin/api/users/${id}/enable`,
  ADMINAPIUSERREVOKE: (id: string) => `${API}/admin/api/users/${id}/revoke-sessions`,
  ADMINAPIUSERUNLOCK: (id: string) => `${API}/admin/api/users/${id}/unlock`,
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
  ADMINAPIROLESCREATE: `${API}/admin/api/roles`,
  ADMINAPIROLESBYID: (id: string) => `${API}/admin/api/roles/${id}`,
  ADMINAPIPERMISSIONS: `${API}/admin/api/permissions`,

  // Message tag removal
  ADMINAPIMESSAGETAGDELETE: (messageId: string, tagId: string) =>
    `${API}/admin/api/messages/${messageId}/tags/${tagId}`,

  // Trash
  ADMINAPIMESSAGETRASH: (id: string) => `${API}/admin/api/messages/${id}/trash`,
  ADMINAPIMESSAGESTRASHBULK: `${API}/admin/api/messages/bulk/trash`,
  ADMINAPIMESSAGEBULKACTION: `${API}/admin/api/messages/bulk`,
  ADMINAPITRASH: `${API}/admin/api/trash`,
  ADMINAPITRASHBYID: (id: string) => `${API}/admin/api/trash/${id}`,
  ADMINAPITRASHRESTORE: (id: string) => `${API}/admin/api/trash/${id}/restore`,
  ADMINAPITRASHPERMANENT: (id: string) => `${API}/admin/api/trash/${id}`,
  ADMINAPITRASHBULKRESTORE: `${API}/admin/api/trash/bulk/restore`,
  ADMINAPITRASHBULKDELETE: `${API}/admin/api/trash/bulk/delete`,
  ADMINAPITRASHEMPTY: `${API}/admin/api/trash/empty`,
} as const;
