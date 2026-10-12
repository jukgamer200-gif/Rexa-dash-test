/**
 * RexaCloud Pterodactyl Application API Service
 * Handles administrative infrastructure operations (Users, Servers, Nodes, Nests, Eggs, Locations).
 * Strictly protects Application API credentials and executes server-side validation.
 * No mock data, no fake nodes, no placeholder counts.
 */

import { config } from '../config.js';
import { AdminNode, AdminLocation, AdminNest, AdminEgg, EggVariable, CreateServerRequest, SystemConnectionStatus } from '@/shared/types';

// Helper to call official Application API
async function callPterodactylApp(endpoint: string, method = 'GET', body?: any) {
  if (!config.pterodactylUrl || !config.applicationApiKey) {
    throw new Error('Pterodactyl Application API credentials are not configured. Please enter your Panel URL and Application API Key in Settings.');
  }

  const url = `${config.pterodactylUrl}/api/application${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.applicationApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.errors && parsed.errors.length > 0) {
        detail = parsed.errors.map((e: any) => e.detail || e.code).join('; ');
      }
    } catch {}
    throw new Error(`Pterodactyl Application API error (${response.status}): ${detail}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

// Safely extracts variables array from Pterodactyl egg payload regardless of Fractal nesting
function extractVariablesFromEggData(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  // Path 1: data.attributes.relationships.variables.data
  if (Array.isArray(data.attributes?.relationships?.variables?.data)) {
    return data.attributes.relationships.variables.data;
  }
  // Path 2: data.relationships?.variables?.data
  if (Array.isArray(data.relationships?.variables?.data)) {
    return data.relationships.variables.data;
  }
  // Path 3: data.attributes?.relationships?.variables (direct array)
  if (Array.isArray(data.attributes?.relationships?.variables)) {
    return data.attributes.relationships.variables;
  }
  // Path 4: data.relationships?.variables (direct array)
  if (Array.isArray(data.relationships?.variables)) {
    return data.relationships.variables;
  }
  // Path 5: data.attributes?.variables?.data
  if (Array.isArray(data.attributes?.variables?.data)) {
    return data.attributes.variables.data;
  }
  // Path 6: data.attributes?.variables (direct array)
  if (Array.isArray(data.attributes?.variables)) {
    return data.attributes.variables;
  }
  // Path 7: data.variables (direct array)
  if (Array.isArray(data.variables)) {
    return data.variables;
  }
  // Path 8: unwrap data.data
  if (data.data && typeof data.data === 'object') {
    return extractVariablesFromEggData(data.data);
  }
  return [];
}

// Parses a single raw variable object into a normalized EggVariable
function parseEggVariable(item: any): EggVariable | null {
  if (!item) return null;
  const a = item.attributes || item;
  const envVar = a.env_variable || a.envVariable;
  if (!envVar || typeof envVar !== 'string') return null;

  const rules = typeof a.rules === 'string' ? a.rules : '';
  const isRequired = rules.split('|').some((r: string) => r.trim().toLowerCase() === 'required');
  return {
    id: Number(a.id) || 0,
    name: a.name || envVar,
    description: a.description || '',
    envVariable: envVar.trim(),
    defaultValue:
      a.default_value !== null && a.default_value !== undefined
        ? String(a.default_value)
        : a.defaultValue !== null && a.defaultValue !== undefined
        ? String(a.defaultValue)
        : '',
    userViewable: Boolean(a.user_viewable ?? a.userViewable ?? true),
    userEditable: Boolean(a.user_editable ?? a.userEditable ?? true),
    rules,
    isRequired,
  };
}

export const pterodactylAdmin = {
  isConfigured(): boolean {
    return !!(config.pterodactylUrl && config.applicationApiKey);
  },

  async getNodes(): Promise<AdminNode[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/nodes?include=allocations,location,servers');
    return (data.data || []).map((item: any) => {
      const a = item.attributes;
      return {
        id: a.id,
        name: a.name,
        description: a.description || '',
        locationId: a.location_id,
        locationName: `Location #${a.location_id}`,
        fqdn: a.fqdn,
        scheme: a.scheme,
        daemonListen: a.daemon_listen,
        memory: a.memory,
        memoryAllocated: a.allocated_resources?.memory || 0,
        disk: a.disk,
        diskAllocated: a.allocated_resources?.disk || 0,
        serversCount: a.servers_count || 0,
        maintenanceMode: a.maintenance_mode,
        status: a.maintenance_mode ? 'maintenance' : 'online',
        allocations: (a.relationships?.allocations?.data || []).map((alloc: any) => ({
          id: alloc.attributes.id,
          ip: alloc.attributes.ip,
          alias: alloc.attributes.ip_alias,
          port: alloc.attributes.port,
          assigned: alloc.attributes.assigned ?? false,
        })),
      };
    });
  },

  async getNodeAllocations(nodeId: number): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const data = await callPterodactylApp(`/nodes/${nodeId}/allocations`);
    return (data.data || []).map((item: any) => ({
      id: item.attributes.id,
      ip: item.attributes.ip,
      alias: item.attributes.ip_alias,
      port: item.attributes.port,
      assigned: item.attributes.assigned ?? false,
    }));
  },

  async createLocation(location: { short: string; long: string }): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp('/locations', 'POST', location);
  },

  async checkNodeReadiness(nodeId: number): Promise<any> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        node: null,
        wingsOnline: false,
        totalAllocations: 0,
        availableAllocations: 0,
        allocations: [],
        readinessStatus: 'UNCONFIGURED',
        message: 'Pterodactyl Application API is not configured.',
      };
    }

    try {
      const nodeData = await callPterodactylApp(`/nodes/${nodeId}?include=allocations,servers`);
      const attr = nodeData.attributes;
      const rawAllocs = attr.relationships?.allocations?.data || [];
      const allocations = rawAllocs.map((a: any) => ({
        id: a.attributes.id,
        ip: a.attributes.ip,
        port: a.attributes.port,
        assigned: a.attributes.assigned ?? false,
      }));
      const available = allocations.filter((a: any) => !a.assigned);

      // Probe Wings daemon
      let wingsOnline = false;
      try {
        const daemonUrl = `${attr.scheme}://${attr.fqdn}:${attr.daemon_listen}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const pingResp = await fetch(daemonUrl, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeout);
        if (pingResp) {
          wingsOnline = true;
        }
      } catch {
        wingsOnline = false;
      }

      let readinessStatus: 'READY' | 'NO_ALLOCATIONS' | 'MAINTENANCE' | 'OFFLINE' | 'UNCONFIGURED' = 'READY';
      let message = 'Node is online and ready for server provisioning.';

      if (attr.maintenance_mode) {
        readinessStatus = 'MAINTENANCE';
        message = 'Node is currently in maintenance mode.';
      } else if (allocations.length === 0 || available.length === 0) {
        readinessStatus = 'NO_ALLOCATIONS';
        message = 'Node has no available IP/port allocations. Add an allocation in Pterodactyl first.';
      } else if (!wingsOnline) {
        readinessStatus = 'OFFLINE';
        message = `Wings daemon is not responding at ${attr.fqdn}:${attr.daemon_listen}. Check that the Wings daemon service is running.`;
      }

      return {
        configured: true,
        node: {
          id: attr.id,
          name: attr.name,
          fqdn: attr.fqdn,
          scheme: attr.scheme,
          daemonListen: attr.daemon_listen,
          memory: attr.memory,
          disk: attr.disk,
          maintenanceMode: attr.maintenance_mode,
        },
        wingsOnline,
        totalAllocations: allocations.length,
        availableAllocations: available.length,
        allocations: available,
        readinessStatus,
        message,
      };
    } catch (err: any) {
      return {
        configured: true,
        node: null,
        wingsOnline: false,
        totalAllocations: 0,
        availableAllocations: 0,
        allocations: [],
        readinessStatus: 'OFFLINE',
        message: 'Failed to inspect node: ' + err.message,
      };
    }
  },

  async getLocations(): Promise<AdminLocation[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/locations');
    return (data.data || []).map((item: any) => ({
      id: item.attributes.id,
      short: item.attributes.short,
      long: item.attributes.long,
      nodesCount: 0,
      serversCount: 0,
    }));
  },

  async getNests(): Promise<AdminNest[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/nests?include=eggs');
    return (data.data || []).map((n: any) => ({
      id: n.attributes.id,
      name: n.attributes.name,
      description: n.attributes.description,
      eggs: (n.attributes.relationships?.eggs?.data || []).map((e: any) => ({
        id: e.attributes.id,
        nestId: n.attributes.id,
        nestName: n.attributes.name,
        name: e.attributes.name,
        description: e.attributes.description,
        dockerImage: e.attributes.docker_image,
        startup: e.attributes.startup,
      })),
    }));
  },

  async getEggs(nestId: number): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp(`/nests/${nestId}/eggs?include=variables`);
    return data.data || [];
  },

  async getEgg(nestId: number, eggId: number): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }

    // Attempt 1: Fetch directly from /nests/{nestId}/eggs/{eggId}?include=variables
    try {
      const data = await callPterodactylApp(`/nests/${nestId}/eggs/${eggId}?include=variables`);
      const vars = extractVariablesFromEggData(data);
      if (vars.length > 0 || data.attributes) {
        return data;
      }
    } catch (err: any) {
      console.warn(`[Pterodactyl Admin] Direct egg fetch failed for nest ${nestId}, egg ${eggId}: ${err.message}`);
    }

    // Attempt 2: Fetch nest eggs collection /nests/{nestId}/eggs?include=variables
    try {
      const collection = await callPterodactylApp(`/nests/${nestId}/eggs?include=variables`);
      const eggsList = collection.data || collection || [];
      const match = eggsList.find((e: any) => {
        const id = e.attributes?.id || e.id;
        return Number(id) === Number(eggId);
      });
      if (match) {
        return match;
      }
    } catch (err: any) {
      console.warn(`[Pterodactyl Admin] Collection fallback failed for nest ${nestId}: ${err.message}`);
    }

    // Attempt 3: Discover which nest actually owns eggId across all nests
    const nests = await this.getNests().catch(() => []);
    for (const n of nests) {
      if (n.id !== nestId && n.eggs?.some((e) => e.id === Number(eggId))) {
        try {
          const data = await callPterodactylApp(`/nests/${n.id}/eggs/${eggId}?include=variables`);
          if (data) return data;
        } catch {}
      }
    }

    throw new Error(`Unable to load egg #${eggId} from Pterodactyl nest #${nestId}.`);
  },

  async getEggVariables(nestId: number, eggId: number): Promise<EggVariable[]> {
    if (!this.isConfigured()) {
      return [];
    }

    // Discover the true nest ID if mismatched
    let targetNestId = Number(nestId);
    const nests = await this.getNests().catch(() => []);
    const matchingNest = nests.find((n) => n.eggs?.some((e) => e.id === Number(eggId)));
    if (matchingNest) {
      targetNestId = matchingNest.id;
    }

    console.log(`[Pterodactyl Admin] getEggVariables: querying Nest #${targetNestId}, Egg #${eggId}`);
    const eggData = await this.getEgg(targetNestId, eggId);
    const rawVars = extractVariablesFromEggData(eggData);
    const parsed = rawVars
      .map((item: any) => parseEggVariable(item))
      .filter((v: EggVariable | null): v is EggVariable => v !== null);

    console.log(`[Pterodactyl Admin] getEggVariables: found ${parsed.length} variables for Egg #${eggId}: [${parsed.map(v => `${v.name} (${v.envVariable}, req=${v.isRequired}, default="${v.defaultValue}")`).join(', ')}]`);
    return parsed;
  },

  async listAllServers(): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/servers');
    return data.data || [];
  },

  async createServer(payload: CreateServerRequest) {
    // 1. Enforce strict 32 GB RAM limit (32768 MB)
    const MAX_RAM_MB = 32768;
    const memory = Number(payload.limits?.memory);
    if (!Number.isInteger(memory) || memory <= 0) {
      throw new Error('Memory limit must be a positive integer in MB.');
    }
    if (memory > MAX_RAM_MB) {
      throw new Error(`Maximum server RAM allocation is 32 GB (${MAX_RAM_MB} MB). Requested: ${memory} MB.`);
    }

    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }

    // Resolve allocation ID
    const defaultAlloc = payload.allocationId || (typeof payload.allocation === 'object' ? payload.allocation?.default : payload.allocation);
    if (!defaultAlloc || isNaN(Number(defaultAlloc))) {
      throw new Error('An eligible allocation ID is required to create a server.');
    }

    // 2. Discover or verify the exact nest ID that owns this egg
    let eggNestId = Number(payload.nestId);
    const nests = await this.getNests().catch(() => []);
    const matchingNest = nests.find((n) => n.eggs?.some((e) => e.id === Number(payload.eggId)));
    if (matchingNest) {
      eggNestId = matchingNest.id;
    }

    console.log(`[Pterodactyl Admin] createServer: target nest #${eggNestId}, egg #${payload.eggId}, server "${payload.name}"`);

    // 3. Fetch egg variable definitions and attributes from Pterodactyl Application API
    let eggVariables: EggVariable[] = [];
    let eggAttributes: any = null;
    if (eggNestId && payload.eggId) {
      try {
        const eggData = await this.getEgg(eggNestId, Number(payload.eggId));
        eggAttributes = eggData.attributes || eggData;
        const rawVars = extractVariablesFromEggData(eggData);
        eggVariables = rawVars
          .map((item: any) => parseEggVariable(item))
          .filter((v: EggVariable | null): v is EggVariable => v !== null);
        console.log(`[Pterodactyl Admin] createServer: loaded ${eggVariables.length} egg variables from Pterodactyl: [${eggVariables.map(v => `${v.name} (${v.envVariable}, req=${v.isRequired})`).join(', ')}]`);
      } catch (err: any) {
        console.warn(`[Pterodactyl Admin] createServer: could not load egg variables for nest ${eggNestId}, egg ${payload.eggId}: ${err.message}`);
      }
    }

    // 4. Construct and validate environment variables against the egg's definitions
    const userEnv = payload.environment || {};
    console.log(`[Pterodactyl Admin] createServer: received environment keys from client: [${Object.keys(userEnv).join(', ')}]`);

    const finalEnvironment: Record<string, string> = { ...userEnv };

    for (const v of eggVariables) {
      const key = v.envVariable;
      let val = userEnv[key];

      // If user did not provide a non-empty value, check egg's default_value
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        if (v.defaultValue !== undefined && v.defaultValue !== null && String(v.defaultValue).trim() !== '') {
          val = String(v.defaultValue).trim();
        }
      }

      // If required, confirm it has a valid non-empty value
      if (v.isRequired) {
        if (val === undefined || val === null || String(val).trim() === '') {
          console.warn(`[Pterodactyl Admin] createServer validation failed: missing required variable "${v.name}" (${key})`);
          throw new Error(`The ${v.name} variable field (${key}) is required.`);
        }
      }

      if (val !== undefined && val !== null) {
        finalEnvironment[key] = String(val);
      }
    }

    console.log(`[Pterodactyl Admin] createServer: finalEnvironment keys to Pterodactyl: [${Object.keys(finalEnvironment).map(k => `${k}=${finalEnvironment[k] ? '[SET]' : '[EMPTY]'}`).join(', ')}]`);

    const dockerImage = payload.dockerImage || eggAttributes?.docker_image || 'ghcr.io/pterodactyl/yolks:java_21';
    const startup = payload.startup || eggAttributes?.startup || 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}';

    // Call official Pterodactyl Application API /servers endpoint
    const body = {
      name: payload.name.trim(),
      description: payload.description || '',
      user: Number(payload.userId) || 1,
      egg: Number(payload.eggId),
      docker_image: dockerImage,
      startup: startup,
      environment: finalEnvironment,
      limits: {
        memory: memory,
        swap: payload.limits.swap || 0,
        disk: Number(payload.limits.disk) || 10240,
        io: payload.limits.io || 500,
        cpu: Number(payload.limits.cpu) || 100,
      },
      feature_limits: {
        databases: payload.featureLimits?.databases || 0,
        allocations: payload.featureLimits?.allocations || 1,
        backups: payload.featureLimits?.backups || 0,
      },
      allocation: {
        default: Number(defaultAlloc),
      },
    };

    return callPterodactylApp('/servers', 'POST', body);
  },

  async deleteServer(id: string | number) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp(`/servers/${id}`, 'DELETE');
  },

  async suspendServer(id: string | number) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp(`/servers/${id}/suspend`, 'POST');
  },

  async unsuspendServer(id: string | number) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp(`/servers/${id}/unsuspend`, 'POST');
  },

  async getPterodactylUsers(): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const data = await callPterodactylApp('/users');
    return data.data || [];
  },

  async createPterodactylUser(userData: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    password?: string;
  }) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp('/users', 'POST', userData);
  },

  async testConnection(): Promise<SystemConnectionStatus> {
    const configured = !!(config.pterodactylUrl && (config.clientApiKey || config.applicationApiKey));
    if (!configured) {
      return {
        configured: false,
        clientApiConnected: false,
        appApiConnected: false,
        isDemoMode: false,
        latencyMs: 0,
        panelUrl: config.pterodactylUrl || '',
        pterodactylUrl: config.pterodactylUrl || '',
        errorMessage: 'Pterodactyl Panel credentials not configured in settings or environment.',
      };
    }

    let clientOk = false;
    let appOk = false;
    let latency = 0;
    const errors: string[] = [];

    const startTime = Date.now();

    // Probe Client API if key provided
    if (config.clientApiKey) {
      try {
        const resp = await fetch(`${config.pterodactylUrl}/api/client`, {
          headers: {
            Authorization: `Bearer ${config.clientApiKey}`,
            Accept: 'application/json',
          },
        });
        clientOk = resp.ok;
        if (!resp.ok) {
          errors.push(`Client API returned HTTP ${resp.status}`);
        }
      } catch (err: any) {
        errors.push(`Client API unreachable: ${err.message}`);
      }
    }

    // Probe Application API if key provided
    if (config.applicationApiKey) {
      try {
        const resp = await fetch(`${config.pterodactylUrl}/api/application/nodes`, {
          headers: {
            Authorization: `Bearer ${config.applicationApiKey}`,
            Accept: 'application/json',
          },
        });
        appOk = resp.ok;
        if (!resp.ok) {
          errors.push(`Application API returned HTTP ${resp.status}`);
        }
      } catch (err: any) {
        errors.push(`Application API unreachable: ${err.message}`);
      }
    }

    latency = Date.now() - startTime;

    return {
      configured: true,
      clientApiConnected: clientOk,
      appApiConnected: appOk,
      isDemoMode: false,
      latencyMs: latency,
      panelUrl: config.pterodactylUrl,
      pterodactylUrl: config.pterodactylUrl,
      lastChecked: new Date().toISOString(),
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
    };
  },
};
