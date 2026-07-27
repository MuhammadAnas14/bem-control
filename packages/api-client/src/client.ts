import axios, { AxiosInstance } from 'axios';
import type {
  AuthResponse,
  Command,
  CommandType,
  CurrentUser,
  Device,
  DeviceProvisioningResult,
  OrganizationMembership,
  TelemetryReading,
} from './types';

export interface BemControlClientOptions {
  baseUrl: string;
  /**
   * Token storage differs by platform (localStorage on web, SecureStore/
   * AsyncStorage on mobile) - the client stays storage-agnostic and just
   * asks for the current token on every request.
   */
  getToken?: () => string | null | Promise<string | null>;
}

export interface TelemetryQuery {
  metric?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export class BemControlClient {
  private readonly http: AxiosInstance;

  constructor(options: BemControlClientOptions) {
    this.http = axios.create({ baseURL: options.baseUrl });

    this.http.interceptors.request.use(async (config) => {
      const token = await options.getToken?.();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // --- Auth -----------------------------------------------------------

  async signup(input: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
  }): Promise<AuthResponse> {
    const { data } = await this.http.post<AuthResponse>('/api/auth/signup', input);
    return data;
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const { data } = await this.http.post<AuthResponse>('/api/auth/login', input);
    return data;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const { data } = await this.http.get<CurrentUser>('/api/auth/me');
    return data;
  }

  // --- Organizations ----------------------------------------------------

  async listOrganizations(): Promise<OrganizationMembership[]> {
    const { data } = await this.http.get<OrganizationMembership[]>('/api/orgs');
    return data;
  }

  // --- Devices ----------------------------------------------------------

  async listDevices(orgId: string): Promise<Device[]> {
    const { data } = await this.http.get<Device[]>(`/api/orgs/${orgId}/devices`);
    return data;
  }

  async getDevice(orgId: string, deviceId: string): Promise<Device> {
    const { data } = await this.http.get<Device>(`/api/orgs/${orgId}/devices/${deviceId}`);
    return data;
  }

  async provisionDevice(
    orgId: string,
    input: { name: string; latitude?: number; longitude?: number }
  ): Promise<DeviceProvisioningResult> {
    const { data } = await this.http.post<DeviceProvisioningResult>(
      `/api/orgs/${orgId}/devices`,
      input
    );
    return data;
  }

  async updateDevice(
    orgId: string,
    deviceId: string,
    input: {
      name?: string;
      desiredConfig?: Record<string, unknown>;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<Device> {
    const { data } = await this.http.patch<Device>(
      `/api/orgs/${orgId}/devices/${deviceId}`,
      input
    );
    return data;
  }

  async disableDevice(orgId: string, deviceId: string): Promise<Device> {
    const { data } = await this.http.delete<Device>(`/api/orgs/${orgId}/devices/${deviceId}`);
    return data;
  }

  // --- Telemetry ----------------------------------------------------------

  async getTelemetryHistory(
    orgId: string,
    deviceId: string,
    query: TelemetryQuery = {}
  ): Promise<TelemetryReading[]> {
    const { data } = await this.http.get<TelemetryReading[]>(
      `/api/orgs/${orgId}/devices/${deviceId}/telemetry`,
      { params: query }
    );
    return data;
  }

  // --- Commands ----------------------------------------------------------

  async createCommand(
    orgId: string,
    deviceId: string,
    input: { type: CommandType; payload?: Record<string, unknown> }
  ): Promise<Command> {
    const { data } = await this.http.post<Command>(
      `/api/orgs/${orgId}/devices/${deviceId}/commands`,
      input
    );
    return data;
  }

  async listCommands(orgId: string, deviceId: string): Promise<Command[]> {
    const { data } = await this.http.get<Command[]>(
      `/api/orgs/${orgId}/devices/${deviceId}/commands`
    );
    return data;
  }

  // --- Push notifications -------------------------------------------------

  async registerPushToken(token: string): Promise<void> {
    await this.http.post('/api/push-tokens', { token });
  }
}
