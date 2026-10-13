/**
 * RexaCloud Shared Variable Validation & Parsing
 * Authoritatively parses Pterodactyl Fractal response structures,
 * extracts Egg variable relationships, and validates server environment payloads
 * against Egg definitions and Laravel validation rules.
 * Shared between frontend and backend.
 */

import { EggVariable } from './types.js';

export interface EnvironmentValidationResult {
  valid: boolean;
  environment: Record<string, string>;
  missingRequired: Array<{ name: string; key: string }>;
  errors: string[];
}

/**
 * Checks if a candidate object has the signature of a real Pterodactyl egg variable.
 */
export function isEggVariableCandidate(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const a = item.attributes || item;
  if (!a || typeof a !== 'object') return false;

  const envVar = a.env_variable || a.envVariable || a.variable;
  if (typeof envVar !== 'string' || !envVar.trim()) return false;

  // Must follow standard environment variable naming convention
  if (!/^[A-Za-z0-9_]+$/.test(envVar.trim())) return false;

  // Real Pterodactyl variables carry at least one characteristic attribute
  return (
    typeof a.name === 'string' ||
    typeof a.rules === 'string' ||
    a.default_value !== undefined ||
    a.defaultValue !== undefined ||
    a.user_viewable !== undefined ||
    a.user_editable !== undefined ||
    item.object === 'egg_variable'
  );
}

/**
 * Helper to safely interpret boolean or boolean-like values from PHP / JSON.
 */
function toBoolean(val: any): boolean {
  if (val === true || val === 1 || val === '1' || val === 'true') return true;
  return false;
}

/**
 * Normalizes a raw Pterodactyl variable object into a strongly typed EggVariable.
 * Uses only authentic defaults from the Egg definition without blind guesswork.
 */
export function parseEggVariable(item: any): EggVariable | null {
  if (!item) return null;
  const a = item.attributes || item;
  const envVar = a.env_variable || a.envVariable || a.variable;
  if (!envVar || typeof envVar !== 'string') return null;

  const rules = typeof a.rules === 'string' ? a.rules.trim() : '';
  const isRequired =
    toBoolean(a.required) ||
    toBoolean(a.is_required) ||
    rules.split('|').some((r: string) => r.trim().toLowerCase() === 'required');

  const trimmedEnv = envVar.trim();

  // Read authentic Egg default value without arbitrary guessing
  let rawDefault = '';
  if (a.default_value !== null && a.default_value !== undefined) {
    rawDefault = String(a.default_value).trim();
  } else if (a.defaultValue !== null && a.defaultValue !== undefined) {
    rawDefault = String(a.defaultValue).trim();
  }

  return {
    id: Number(a.id) || 0,
    name: (a.name && typeof a.name === 'string' && a.name.trim()) ? a.name.trim() : trimmedEnv,
    description: (a.description && typeof a.description === 'string') ? a.description.trim() : '',
    envVariable: trimmedEnv,
    defaultValue: rawDefault,
    userViewable: Boolean(a.user_viewable ?? a.userViewable ?? true),
    userEditable: Boolean(a.user_editable ?? a.userEditable ?? true),
    rules,
    isRequired,
  };
}

/**
 * Safely extracts raw variable items from any Pterodactyl egg payload
 * regardless of Fractal serialization nesting or API version.
 * De-duplicates variables safely by environment variable name.
 */
export function extractVariablesFromEggData(data: any): any[] {
  if (!data) return [];

  const rawCandidates: any[] = [];

  // Helper to collect variable items from an array
  function collectFromArray(arr: any[]) {
    for (const item of arr) {
      if (isEggVariableCandidate(item)) {
        rawCandidates.push(item);
      } else if (item && typeof item === 'object') {
        const nested = extractVariablesFromEggData(item);
        for (const n of nested) {
          rawCandidates.push(n);
        }
      }
    }
  }

  if (Array.isArray(data)) {
    collectFromArray(data);
  } else if (typeof data === 'object') {
    // Path 1: data.attributes.relationships.variables.data (standard Pterodactyl Fractal Item)
    if (Array.isArray(data.attributes?.relationships?.variables?.data)) {
      collectFromArray(data.attributes.relationships.variables.data);
    }
    // Path 2: data.relationships.variables.data
    else if (Array.isArray(data.relationships?.variables?.data)) {
      collectFromArray(data.relationships.variables.data);
    }
    // Path 3: data.attributes.relationships.variables (direct array)
    else if (Array.isArray(data.attributes?.relationships?.variables)) {
      collectFromArray(data.attributes.relationships.variables);
    }
    // Path 4: data.relationships.variables (direct array)
    else if (Array.isArray(data.relationships?.variables)) {
      collectFromArray(data.relationships.variables);
    }
    // Path 5: data.attributes.relationships.egg_variables.data
    else if (Array.isArray(data.attributes?.relationships?.egg_variables?.data)) {
      collectFromArray(data.attributes.relationships.egg_variables.data);
    }
    // Path 6: data.relationships.egg_variables.data
    else if (Array.isArray(data.relationships?.egg_variables?.data)) {
      collectFromArray(data.relationships.egg_variables.data);
    }
    // Path 7: data.attributes.variables.data
    else if (Array.isArray(data.attributes?.variables?.data)) {
      collectFromArray(data.attributes.variables.data);
    }
    // Path 8: data.attributes.variables (direct array)
    else if (Array.isArray(data.attributes?.variables)) {
      collectFromArray(data.attributes.variables);
    }
    // Path 9: data.variables.data
    else if (Array.isArray(data.variables?.data)) {
      collectFromArray(data.variables.data);
    }
    // Path 10: data.variables (direct array)
    else if (Array.isArray(data.variables)) {
      collectFromArray(data.variables);
    }
    // Path 11: data.data unwrap
    else if (data.data && typeof data.data === 'object') {
      const unwrapRes = extractVariablesFromEggData(data.data);
      collectFromArray(unwrapRes);
    }
    // Path 12: data.attributes unwrap
    else if (data.attributes && typeof data.attributes === 'object') {
      const attrRes = extractVariablesFromEggData(data.attributes);
      collectFromArray(attrRes);
    }

    // Path 13: Targeted recursive discovery if structured paths yielded nothing
    if (rawCandidates.length === 0) {
      function deepFindVariables(obj: any, depth = 0) {
        if (!obj || depth > 4 || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            if (isEggVariableCandidate(item)) {
              rawCandidates.push(item);
            } else if (item && typeof item === 'object') {
              deepFindVariables(item, depth + 1);
            }
          }
          return;
        }
        for (const key of Object.keys(obj)) {
          // Skip unrelated keys
          if (key === 'servers' || key === 'nest' || key === 'meta' || key === 'pagination') continue;
          const val = obj[key];
          if (val && typeof val === 'object') {
            deepFindVariables(val, depth + 1);
          }
        }
      }

      deepFindVariables(data);
    }
  }

  // De-duplicate candidates safely by normalized uppercase env_variable key
  const deduplicatedMap = new Map<string, any>();
  for (const item of rawCandidates) {
    const a = item.attributes || item;
    const key = (a.env_variable || a.envVariable || a.variable || '').trim().toUpperCase();
    if (!key) continue;

    if (!deduplicatedMap.has(key)) {
      deduplicatedMap.set(key, item);
    } else {
      // If we already have this variable, prefer candidate with more complete attributes or valid default
      const existing = deduplicatedMap.get(key);
      const existingAttr = existing.attributes || existing;
      const existingHasValue = existingAttr.default_value !== null && existingAttr.default_value !== undefined && String(existingAttr.default_value).trim() !== '';
      const newHasValue = a.default_value !== null && a.default_value !== undefined && String(a.default_value).trim() !== '';
      const hasBetterDefault = !existingHasValue && newHasValue;
      const hasBetterRules = !existingAttr.rules && Boolean(a.rules);
      if (hasBetterDefault || hasBetterRules) {
        deduplicatedMap.set(key, item);
      }
    }
  }

  return Array.from(deduplicatedMap.values());
}

/**
 * Validates a value against a variable's Laravel validation rules string.
 */
export function validateVariableAgainstRules(
  value: string,
  rulesStr: string,
  varName: string,
  envVar: string,
  isRequired: boolean
): string[] {
  const errors: string[] = [];
  const trimmedVal = value.trim();

  if (isRequired && !trimmedVal) {
    errors.push(`The ${varName} variable field (${envVar}) is required.`);
    return errors;
  }

  // If not required (or nullable) and empty, remaining rules do not fail
  if (!trimmedVal) {
    return errors;
  }

  if (!rulesStr) return errors;

  const rules = rulesStr.split('|').map((r) => r.trim()).filter(Boolean);

  for (const rule of rules) {
    const lower = rule.toLowerCase();

    if (lower === 'required' || lower === 'nullable') {
      continue;
    }

    if (lower === 'numeric' || lower === 'integer') {
      const isNum = lower === 'integer' ? /^-?\d+$/.test(trimmedVal) : /^-?\d+(\.\d+)?$/.test(trimmedVal);
      if (!isNum) {
        errors.push(`The ${varName} (${envVar}) field must be a valid ${lower}. Received: "${trimmedVal}".`);
      }
    } else if (lower === 'boolean') {
      const isBool = ['true', 'false', '0', '1', 'yes', 'no'].includes(trimmedVal.toLowerCase());
      if (!isBool) {
        errors.push(`The ${varName} (${envVar}) field must be true or false.`);
      }
    } else if (lower.startsWith('max:')) {
      const maxLimit = parseInt(rule.substring(4), 10);
      if (!isNaN(maxLimit) && trimmedVal.length > maxLimit) {
        errors.push(`The ${varName} (${envVar}) field cannot exceed ${maxLimit} characters.`);
      }
    } else if (lower.startsWith('min:')) {
      const minLimit = parseInt(rule.substring(4), 10);
      if (!isNaN(minLimit) && trimmedVal.length < minLimit) {
        errors.push(`The ${varName} (${envVar}) field must be at least ${minLimit} characters.`);
      }
    } else if (lower.startsWith('between:')) {
      const parts = rule.substring(8).split(',').map((p) => parseInt(p.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        if (trimmedVal.length < parts[0] || trimmedVal.length > parts[1]) {
          errors.push(`The ${varName} (${envVar}) must be between ${parts[0]} and ${parts[1]} characters.`);
        }
      }
    } else if (lower.startsWith('in:')) {
      const allowed = rule.substring(3).split(',').map((s) => s.trim().toLowerCase());
      if (!allowed.includes(trimmedVal.toLowerCase())) {
        errors.push(`The ${varName} (${envVar}) must be one of: ${allowed.join(', ')}.`);
      }
    } else if (lower.startsWith('regex:')) {
      const rawPattern = rule.substring(6).trim();
      let regex: RegExp | null = null;
      try {
        if (rawPattern.startsWith('/') && rawPattern.lastIndexOf('/') > 0) {
          const lastSlash = rawPattern.lastIndexOf('/');
          const pattern = rawPattern.substring(1, lastSlash);
          const flags = rawPattern.substring(lastSlash + 1);
          regex = new RegExp(pattern, flags);
        } else {
          regex = new RegExp(rawPattern);
        }
      } catch {
        regex = null;
      }
      if (regex && !regex.test(trimmedVal)) {
        errors.push(`The ${varName} (${envVar}) format is invalid according to Egg rule "${rule}".`);
      }
    }
  }

  return errors;
}

/**
 * Validates user-supplied environment variables against the selected Egg's definitions.
 * Preserves administrator-entered values, falls back to genuine Egg defaults when available,
 * and enforces required status and rule compliance without blind injection.
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
    // Priority 1: Administrator entered value (non-empty)
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      val = String(rawVal).trim();
    }
    // Priority 2: Genuine Egg default value
    else if (v.defaultValue !== undefined && v.defaultValue !== null && String(v.defaultValue).trim() !== '') {
      val = String(v.defaultValue).trim();
    }

    // Check required status
    if (v.isRequired && !val) {
      missingRequired.push({ name: v.name, key });
      errors.push(`The ${v.name} variable field (${key}) is required.`);
    }

    // Validate against Egg validation rules if value is present
    if (val && v.rules) {
      const ruleErrors = validateVariableAgainstRules(val, v.rules, v.name, key, v.isRequired);
      for (const err of ruleErrors) {
        if (!errors.includes(err)) {
          errors.push(err);
        }
      }
    }

    // Include the resolved value in the final environment map
    finalEnvironment[key] = val;
  }

  return {
    valid: missingRequired.length === 0 && errors.length === 0,
    environment: finalEnvironment,
    missingRequired,
    errors,
  };
}
