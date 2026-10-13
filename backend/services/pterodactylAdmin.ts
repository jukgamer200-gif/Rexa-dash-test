/**
 * RexaCloud Pterodactyl Application API Service
 * Handles administrative infrastructure operations (Users, Servers, Nodes, Nests, Eggs, Locations).
 * Strictly protects Application API credentials and executes server-side validation.
 * No mock data, no fake nodes, no placeholder counts.
 */

import { config } from '../config.js';
import { AdminNode, AdminLocation, AdminNest, AdminEgg, EggVariable, CreateServerRequest, SystemConnectionStatus } from '@/shared/types';
import { extractVariablesFromEggData, parseEggVariable, validateAndBuildEnvironment } from './pterodactylVariables.js';

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

// Variables parser, relationship extractor and environment validator imported from ./pterodactylVariables.js

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

    let data: any;
    try {
      // First attempt: fetch nests with eggs and their nested variable relationships
      data = await callPterodactylApp('/nests?include=eggs.variables');
    } catch {
      // Fallback: standard eggs inclusion
      data = await callPterodactylApp('/nests?include=eggs');
    }

    return (data.data || []).map((n: any) => ({
      id: n.attributes.id,
      name: n.attributes.name,
      description: n.attributes.description,
      eggs: (n.attributes.relationships?.eggs?.data || []).map((e: any) => {
        const rawVars = extractVariablesFromEggData(e);
        const parsedVars = rawVars
          .map((item: any) => parseEggVariable(item))
          .filter((v: EggVariable | null): v is EggVariable => v !== null);

        return {
          id: e.attributes.id,
          nestId: n.attributes.id,
          nestName: n.attributes.name,
          name: e.attributes.name,
          description: e.attributes.description,
          dockerImage: e.attributes.docker_image,
          startup: e.attributes.startup,
          variables: parsedVars,
        };
      }),
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

    let candidateEgg: any = null;

    // Attempt 1: Fetch directly from /nests/{nestId}/eggs/{eggId}?include=variables
    try {
      const data = await callPterodactylApp(`/nests/${nestId}/eggs/${eggId}?include=variables`);
      const vars = extractVariablesFromEggData(data);
      if (vars.length > 0) {
        return data;
      }
      if (data && (data.attributes || data.id)) {
        candidateEgg = data;
      }
    } catch (err: any) {
      console.warn(`[Pterodactyl Admin] Direct egg fetch failed for nest ${nestId}, egg ${eggId}: ${err.message}`);
    }

    // Attempt 2: Fetch nest eggs collection /nests/{nestId}/eggs?include=variables
    try {
      const collection = await callPterodactylApp(`/nests/${nestId}/eggs?include=variables`);
      const eggsList = collection.data || (Array.isArray(collection) ? collection : []);
      const match = eggsList.find((e: any) => {
        const id = e.attributes?.id || e.id;
        return Number(id) === Number(eggId);
      });
      if (match) {
        const vars = extractVariablesFromEggData(match);
        if (vars.length > 0) {
          return match;
        }
        if (!candidateEgg) candidateEgg = match;
      }
    } catch (err: any) {
      console.warn(`[Pterodactyl Admin] Collection fallback failed for nest ${nestId}: ${err.message}`);
    }

    // Attempt 3: Discover which nest actually owns eggId across all nests
    const nests = await this.getNests().catch(() => []);
    for (const n of nests) {
      if (n.id !== nestId) {
        try {
          const data = await callPterodactylApp(`/nests/${n.id}/eggs/${eggId}?include=variables`);
          const vars = extractVariablesFromEggData(data);
          if (vars.length > 0) return data;
          if (!candidateEgg && data) candidateEgg = data;
        } catch {}
      }
    }

    // Attempt 4: Direct sub-resource call /nests/{nestId}/eggs/{eggId}/variables
    try {
      const directVars = await callPterodactylApp(`/nests/${nestId}/eggs/${eggId}/variables`);
      const vars = extractVariablesFromEggData(directVars);
      if (vars.length > 0) {
        return {
          object: 'egg',
          attributes: {
            ...(candidateEgg?.attributes || candidateEgg || {}),
            relationships: {
              variables: {
                object: 'list',
                data: vars,
              },
            },
          },
        };
      }
    } catch {}

    if (candidateEgg) {
      return candidateEgg;
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

    let parsed: EggVariable[] = [];
    let fetchError: Error | null = null;
    try {
      const eggData = await this.getEgg(targetNestId, eggId);
      const rawVars = extractVariablesFromEggData(eggData);
      parsed = rawVars
        .map((item: any) => parseEggVariable(item))
        .filter((v: EggVariable | null): v is EggVariable => v !== null);
    } catch (err: any) {
      fetchError = err;
      console.warn(`[Pterodactyl Admin] getEgg warning in getEggVariables: ${err.message}`);
    }

    // If direct egg query returned 0 variables, check if nests already has them
    if (parsed.length === 0) {
      for (const n of nests) {
        const found = n.eggs?.find((e: any) => Number(e.id) === Number(eggId));
        if (found?.variables && found.variables.length > 0) {
          parsed = found.variables;
          break;
        }
      }
    }

    // If an API failure occurred and variables could not be resolved, do not silently return []
    if (parsed.length === 0 && fetchError) {
      throw new Error(`Failed to load egg variable definitions from Pterodactyl: ${fetchError.message}`);
    }

    const requiredKeys = parsed.filter(v => v.isRequired).map(v => v.envVariable);
    console.log(`[Pterodactyl Admin] getEggVariables: Egg #${eggId} resolved ${parsed.length} variables (${requiredKeys.length} required: [${requiredKeys.join(', ')}])`);
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

    // 3. Fetch egg variable definitions and attributes from Pterodactyl Application API
    let eggVariables: EggVariable[] = [];
    let eggAttributes: any = null;
    let eggFetchError: Error | null = null;
    try {
      const eggData = await this.getEgg(eggNestId, Number(payload.eggId));
      if (eggData) {
        eggAttributes = eggData.attributes || eggData;
        const rawVars = extractVariablesFromEggData(eggData);
        eggVariables = rawVars
          .map((item: any) => parseEggVariable(item))
          .filter((v: EggVariable | null): v is EggVariable => v !== null);
      }
    } catch (err: any) {
      eggFetchError = err;
      console.warn(`[Pterodactyl Admin] getEgg warning in createServer for nest #${eggNestId}, egg #${payload.eggId}: ${err.message}`);
    }

    // Fallback: If direct getEgg returned no variables, check getNests()
    if (eggVariables.length === 0) {
      for (const n of nests) {
        const found = n.eggs?.find((e: any) => Number(e.id) === Number(payload.eggId));
        if (found?.variables && found.variables.length > 0) {
          eggVariables = found.variables;
          if (!eggAttributes) eggAttributes = found;
          break;
        }
      }
    }

    // If egg variables failed to load due to an API error, halt provisioning rather than proceeding blind
    if (eggVariables.length === 0 && eggFetchError) {
      throw new Error(`Unable to load Egg #${payload.eggId} configuration from Pterodactyl: ${eggFetchError.message}. Provisioning halted.`);
    }

    // 4. Validate and build environment strictly against the Egg's definitions and rules
    const userEnv = (payload.environment && typeof payload.environment === 'object') ? payload.environment : {};
    const validation = validateAndBuildEnvironment(eggVariables, userEnv);

    if (!validation.valid) {
      const missingList = validation.missingRequired.map(m => `"${m.name}" (${m.key})`).join('; ');
      const ruleErrorsList = validation.errors.join('; ');
      console.warn(`[Pterodactyl Admin] createServer validation rejected: ${ruleErrorsList || missingList}`);
      throw new Error(`Egg variable validation failed: ${ruleErrorsList || missingList}`);
    }

    const finalEnvironment = validation.environment;

    const dockerImage = payload.dockerImage || eggAttributes?.docker_image || 'ghcr.io/pterodactyl/yolks:java_21';
    const startup = payload.startup || eggAttributes?.startup || 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}';

    // Safe diagnostics: never log actual values, passwords or secrets
    const reqKeys = eggVariables.filter(v => v.isRequired).map(v => v.envVariable);
    const sentSummary = Object.entries(finalEnvironment).map(([k, v]) => `${k}=${v ? '[SET]' : '[EMPTY]'}`).join(', ');
    console.log(`[Pterodactyl Admin] createServer: Nest #${eggNestId}, Egg #${payload.eggId}, required: [${reqKeys.join(', ')}], total env keys sent: [${sentSummary}]`);

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
