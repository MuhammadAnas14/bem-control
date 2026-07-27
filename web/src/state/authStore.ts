const TOKEN_KEY = 'bem_control_token';
const ORG_KEY = 'bem_control_selected_org';

// Plain (non-React) accessors so the API client's request interceptor can
// read the current token without needing a React context - the interceptor
// runs outside any component's render cycle.
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getSelectedOrgId(): string | null {
  return localStorage.getItem(ORG_KEY);
}

export function setSelectedOrgId(orgId: string | null) {
  if (orgId) localStorage.setItem(ORG_KEY, orgId);
  else localStorage.removeItem(ORG_KEY);
}
