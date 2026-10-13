/**
 * RexaCloud Pterodactyl Egg Variable Parser & Validator
 * Authoritatively parses Pterodactyl Fractal response structures,
 * extracts Egg variable relationships, and validates server environment payloads.
 */

import { EggVariable } from '@/shared/types';

export interface EnvironmentValidationResult {
  valid: boolean;
  environment: Record<string, string>;
  missingRequired: Array<{ name: string; key: string }>;
  errors: string[];
}

/**
 * Safely extracts raw variable items from any Pterodactyl egg payload
 * regardless of Fractal serialization nesting or API version.
 */
export function extractVariablesFromEggData(data: any): any[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    // If it's an array of variable items directly
    if (data.length > 0 && (data[0]?.attributes?.env_variable || data[0]?.env_variable || data[0]?.attributes?.envVariable)) {
      return data;
    }
    // If it's an array containing an egg object, extract from the first element
    if (data.length > 0 && (data[0]?.attributes?.relationships || data[0]?.relationships || data[0]?.attributes)) {
      return extractVariablesFromEggData(data[0]);
    }
    return data;
  }

  // Path 1: data.attributes.relationships.variables.data (standard Pterodactyl Fractal Item)
  if (Array.isArray(data.attributes?.relationships?.variables?.data)) {
    return data.attributes.relationships.variables.data;
  }

  // Path 2: data.relationships?.variables?.data (Fractal relationship outside attributes)
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

  // Path 5: data.attributes?.relationships?.egg_variables?.data (some custom forks)
  if (Array.isArray(data.attributes?.relationships?.egg_variables?.data)) {
    return data.attributes.relationships.egg_variables.data;
  }

  // Path 6: data.relationships?.egg_variables?.data
  if (Array.isArray(data.relationships?.egg_variables?.data)) {
    return data.relationships.egg_variables.data;
  }

  // Path 7: data.attributes?.variables?.data
  if (Array.isArray(data.attributes?.variables?.data)) {
    return data.attributes.variables.data;
  }

  // Path 8: data.attributes?.variables (direct array)
  if (Array.isArray(data.attributes?.variables)) {
    return data.attributes.variables;
  }

  // Path 9: data.variables?.data (direct variables object with data array)
  if (Array.isArray(data.variables?.data)) {
    return data.variables.data;
  }

  // Path 10: data.variables (direct array)
  if (Array.isArray(data.variables)) {
    return data.variables;
  }

  // Path 11: unwrap data.data if it contains an object or array
  if (data.data && typeof data.data === 'object') {
    const unwrapRes = extractVariablesFromEggData(data.data);
    if (unwrapRes.length > 0) return unwrapRes;
  }

  // Path 12: unwrap data.attributes if relationships didn't match directly
  if (data.attributes && typeof data.attributes === 'object') {
    const attrRes = extractVariablesFromEggData(data.attributes);
    if (attrRes.length > 0) return attrRes;
  }

  // Path 13: Deep recursive traversal fallback to discover variable arrays in non-standard wrappers
  function deepFindVariables(obj: any, depth = 0): any[] | null {
    if (!obj || depth > 4 || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
      if (obj.length > 0 && (obj[0]?.attributes?.env_variable || obj[0]?.env_variable || obj[0]?.attributes?.envVariable)) {
        return obj;
      }
      for (const item of obj) {
        const found = deepFindVariables(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        const found = deepFindVariables(val, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  const deepResult = deepFindVariables(data);
  if (deepResult && deepResult.length > 0) {
    return deepResult;
  }

  return [];
}

/**
 * Normalizes a raw Pterodactyl variable object into a strongly typed EggVariable.
 */
export function parseEggVariable(item: any): EggVariable | null {
  if (!item) return null;
  const a = item.attributes || item;
  const envVar = a.env_variable || a.envVariable || a.env || a.variable;
  if (!envVar || typeof envVar !== 'string') return null;

  const rules = typeof a.rules === 'string' ? a.rules : '';
  const isRequired =
    Boolean(a.required || a.is_required) ||
    rules.split('|').some((r: string) => r.trim().toLowerCase() === 'required');

  const trimmedEnv = envVar.trim();
  let rawDefault =
    a.default_value !== null && a.default_value !== undefined
      ? String(a.default_value)
      : a.defaultValue !== null && a.defaultValue !== undefined
      ? String(a.defaultValue)
      : '';

  // Apply safe canonical defaults when Pterodactyl definition has an empty default_value
  if (!rawDefault || rawDefault.trim() === '') {
    if (trimmedEnv === 'SERVER_JARFILE') {
      rawDefault = 'server.jar';
    } else if (trimmedEnv === 'BUILD_NUMBER' || trimmedEnv === 'SERVER_VERSION' || trimmedEnv === 'VANILLA_VERSION' || trimmedEnv === 'MINECRAFT_VERSION') {
      rawDefault = 'latest';
    }
  }

  return {
    id: Number(a.id) || 0,
    name: a.name || trimmedEnv,
    description: a.description || '',
    envVariable: trimmedEnv,
    defaultValue: rawDefault,
    userViewable: Boolean(a.user_viewable ?? a.userViewable ?? true),
    userEditable: Boolean(a.user_editable ?? a.userEditable ?? true),
    rules,
    isRequired,
  };
}

/**
 * Validates user-supplied environment variables against the selected Egg's definitions.
 * Preserves user-supplied values, falls back to defined defaults when empty, and enforces
 * required fields before external dispatch.
 */
export function validateAndBuildEnvironment(
  eggVariables: EggVariable[],
  userEnvironment: Record<string, any> = {}
): EnvironmentValidationResult {
  const finalEnvironment: Record<string, string> = {};
  const missingRequired: Array<{ name: string; key: string }> = [];
  const errors: string[] = [];

  for (const v of eggVariables) {
    const key = v.envVariable;
    const rawVal = userEnvironment[key];

    let val = '';
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      val = String(rawVal).trim();
    } else if (v.defaultValue !== undefined && v.defaultValue !== null && String(v.defaultValue).trim() !== '') {
      val = String(v.defaultValue).trim();
    } else {
      if (key === 'SERVER_JARFILE') val = 'server.jar';
      else if (key === 'BUILD_NUMBER' || key === 'SERVER_VERSION' || key === 'VANILLA_VERSION' || key === 'MINECRAFT_VERSION') {
        val = 'latest';
      }
    }

    if (v.isRequired && (!val || val === '')) {
      missingRequired.push({ name: v.name, key });
      errors.push(`The ${v.name} variable field (${key}) is required.`);
    }

    // Include all defined egg variables in the environment map
    finalEnvironment[key] = val;
  }

  // Preserve any additional custom environment variables provided by caller
  for (const [k, v] of Object.entries(userEnvironment)) {
    if (!(k in finalEnvironment) && v !== undefined && v !== null) {
      finalEnvironment[k] = String(v).trim();
    }
  }

  // Safety net: ensure critical Minecraft variables never evaluate to empty strings
  if ((!finalEnvironment['SERVER_JARFILE'] || finalEnvironment['SERVER_JARFILE'].trim() === '') && (userEnvironment['SERVER_JARFILE'] !== undefined || eggVariables.some(v => v.envVariable === 'SERVER_JARFILE'))) {
    finalEnvironment['SERVER_JARFILE'] = 'server.jar';
  }
  if ((!finalEnvironment['BUILD_NUMBER'] || finalEnvironment['BUILD_NUMBER'].trim() === '') && (userEnvironment['BUILD_NUMBER'] !== undefined || eggVariables.some(v => v.envVariable === 'BUILD_NUMBER'))) {
    finalEnvironment['BUILD_NUMBER'] = 'latest';
  }
  if ((!finalEnvironment['SERVER_VERSION'] || finalEnvironment['SERVER_VERSION'].trim() === '') && (userEnvironment['SERVER_VERSION'] !== undefined || eggVariables.some(v => v.envVariable === 'SERVER_VERSION'))) {
    finalEnvironment['SERVER_VERSION'] = 'latest';
  }

  return {
    valid: missingRequired.length === 0,
    environment: finalEnvironment,
    missingRequired,
    errors,
  };
}
