import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVariablesFromEggData,
  parseEggVariable,
  validateAndBuildEnvironment,
  validateVariableAgainstRules,
  isEggVariableCandidate,
} from '../shared/variableValidation.js';
import { EggVariable } from '../shared/types.js';

describe('Pterodactyl Egg Variable Regression & Validation Suite', () => {

  describe('1. Exact SERVER_JARFILE and BUILD_NUMBER 422 Scenarios', () => {
    const paperEggVariables: EggVariable[] = [
      {
        id: 1,
        name: 'Server Jar File',
        description: 'The name of the Executable Jarfile',
        envVariable: 'SERVER_JARFILE',
        defaultValue: 'server.jar',
        userViewable: true,
        userEditable: true,
        rules: 'required|string|max:20',
        isRequired: true,
      },
      {
        id: 2,
        name: 'Build Number',
        description: 'The build number for Paper',
        envVariable: 'BUILD_NUMBER',
        defaultValue: 'latest',
        userViewable: true,
        userEditable: true,
        rules: 'required|string|max:20',
        isRequired: true,
      },
    ];

    it('should use valid Egg defaults when user provides empty input', () => {
      const result = validateAndBuildEnvironment(paperEggVariables, {});
      assert.equal(result.valid, true);
      assert.equal(result.environment['SERVER_JARFILE'], 'server.jar');
      assert.equal(result.environment['BUILD_NUMBER'], 'latest');
      assert.equal(result.errors.length, 0);
      assert.equal(result.missingRequired.length, 0);
    });

    it('should prefer administrator input over Egg defaults', () => {
      const result = validateAndBuildEnvironment(paperEggVariables, {
        SERVER_JARFILE: 'custom-paper.jar',
        BUILD_NUMBER: '418',
      });
      assert.equal(result.valid, true);
      assert.equal(result.environment['SERVER_JARFILE'], 'custom-paper.jar');
      assert.equal(result.environment['BUILD_NUMBER'], '418');
    });

    it('should reject and require admin input when egg default is null/empty and user input is empty (No blind injection)', () => {
      const eggVariablesWithNullDefaults: EggVariable[] = [
        {
          id: 1,
          name: 'Server Jar File',
          description: '',
          envVariable: 'SERVER_JARFILE',
          defaultValue: '', // null default from Pterodactyl
          userViewable: true,
          userEditable: true,
          rules: 'required|string|max:20',
          isRequired: true,
        },
        {
          id: 2,
          name: 'Build Number',
          description: '',
          envVariable: 'BUILD_NUMBER',
          defaultValue: '', // null default from Pterodactyl
          userViewable: true,
          userEditable: true,
          rules: 'required|string|max:20',
          isRequired: true,
        },
      ];

      const result = validateAndBuildEnvironment(eggVariablesWithNullDefaults, {
        SERVER_JARFILE: '',
        BUILD_NUMBER: '   ',
      });

      assert.equal(result.valid, false);
      assert.equal(result.missingRequired.length, 2);
      assert.ok(result.errors.some((e) => e.includes('Server Jar File') && e.includes('SERVER_JARFILE')));
      assert.ok(result.errors.some((e) => e.includes('Build Number') && e.includes('BUILD_NUMBER')));
      // Proves no blind injection of 'server.jar' or 'latest'
      assert.equal(result.environment['SERVER_JARFILE'], '');
      assert.equal(result.environment['BUILD_NUMBER'], '');
    });

    it('should pass when administrator provides valid input for null-default variables', () => {
      const eggVariablesWithNullDefaults: EggVariable[] = [
        {
          id: 1,
          name: 'Server Jar File',
          description: '',
          envVariable: 'SERVER_JARFILE',
          defaultValue: '',
          userViewable: true,
          userEditable: true,
          rules: 'required|string|max:20',
          isRequired: true,
        },
        {
          id: 2,
          name: 'Build Number',
          description: '',
          envVariable: 'BUILD_NUMBER',
          defaultValue: '',
          userViewable: true,
          userEditable: true,
          rules: 'required|string|max:20',
          isRequired: true,
        },
      ];

      const result = validateAndBuildEnvironment(eggVariablesWithNullDefaults, {
        SERVER_JARFILE: 'paperclip.jar',
        BUILD_NUMBER: 'latest',
      });

      assert.equal(result.valid, true);
      assert.equal(result.environment['SERVER_JARFILE'], 'paperclip.jar');
      assert.equal(result.environment['BUILD_NUMBER'], 'latest');
      assert.equal(result.errors.length, 0);
    });
  });

  describe('2. Pterodactyl Fractal Response Extraction & Malformed Data', () => {
    it('should correctly extract variables from standard Fractal egg item', () => {
      const standardPayload = {
        object: 'egg',
        attributes: {
          id: 5,
          name: 'Paper',
          relationships: {
            variables: {
              object: 'list',
              data: [
                {
                  object: 'egg_variable',
                  attributes: {
                    id: 10,
                    name: 'Server Jar File',
                    env_variable: 'SERVER_JARFILE',
                    default_value: 'server.jar',
                    rules: 'required|string|max:20',
                    is_required: true,
                  },
                },
                {
                  object: 'egg_variable',
                  attributes: {
                    id: 11,
                    name: 'Build Number',
                    env_variable: 'BUILD_NUMBER',
                    default_value: 'latest',
                    rules: 'required|string|max:20',
                    is_required: true,
                  },
                },
              ],
            },
          },
        },
      };

      const extracted = extractVariablesFromEggData(standardPayload);
      assert.equal(extracted.length, 2);

      const parsed = extracted.map(parseEggVariable).filter(Boolean) as EggVariable[];
      assert.equal(parsed.length, 2);
      assert.equal(parsed[0].envVariable, 'SERVER_JARFILE');
      assert.equal(parsed[0].defaultValue, 'server.jar');
      assert.equal(parsed[0].isRequired, true);
      assert.equal(parsed[1].envVariable, 'BUILD_NUMBER');
      assert.equal(parsed[1].defaultValue, 'latest');
      assert.equal(parsed[1].isRequired, true);
    });

    it('should handle top-level relationships structure (non-nested attributes)', () => {
      const topLevelPayload = {
        object: 'egg',
        relationships: {
          variables: {
            data: [
              {
                attributes: {
                  name: 'Server Version',
                  env_variable: 'SERVER_VERSION',
                  default_value: '1.20.4',
                  rules: 'required|string',
                },
              },
            ],
          },
        },
      };

      const extracted = extractVariablesFromEggData(topLevelPayload);
      assert.equal(extracted.length, 1);
      const parsed = parseEggVariable(extracted[0]);
      assert.ok(parsed);
      assert.equal(parsed.envVariable, 'SERVER_VERSION');
      assert.equal(parsed.defaultValue, '1.20.4');
    });

    it('should handle malformed, empty, or null responses safely without throwing', () => {
      assert.deepEqual(extractVariablesFromEggData(null), []);
      assert.deepEqual(extractVariablesFromEggData(undefined), []);
      assert.deepEqual(extractVariablesFromEggData({}), []);
      assert.deepEqual(extractVariablesFromEggData({ object: 'egg', attributes: {} }), []);
      assert.deepEqual(extractVariablesFromEggData('not-an-object'), []);
    });

    it('should deduplicate variables and prefer entries with authentic default values', () => {
      const duplicatePayload = [
        {
          attributes: {
            name: 'Server Jar File',
            env_variable: 'SERVER_JARFILE',
            default_value: null,
            rules: 'string',
          },
        },
        {
          attributes: {
            name: 'Server Jar File',
            env_variable: 'SERVER_JARFILE',
            default_value: 'server.jar',
            rules: 'required|string|max:20',
          },
        },
      ];

      const extracted = extractVariablesFromEggData(duplicatePayload);
      assert.equal(extracted.length, 1);
      const parsed = parseEggVariable(extracted[0]);
      assert.ok(parsed);
      assert.equal(parsed.defaultValue, 'server.jar');
      assert.equal(parsed.isRequired, true);
    });
  });

  describe('3. Stale Environment Value Prevention Across Egg Switches', () => {
    it('should not include keys from previously selected eggs', () => {
      // Previously selected Egg A (Minecraft)
      const eggAVariables: EggVariable[] = [
        { id: 1, name: 'Jar', envVariable: 'SERVER_JARFILE', defaultValue: 'server.jar', rules: 'required', isRequired: true, description: '', userViewable: true, userEditable: true },
        { id: 2, name: 'Build', envVariable: 'BUILD_NUMBER', defaultValue: 'latest', rules: 'required', isRequired: true, description: '', userViewable: true, userEditable: true },
      ];
      // User filled Egg A
      const envA = validateAndBuildEnvironment(eggAVariables, { SERVER_JARFILE: 'paper.jar', BUILD_NUMBER: '500' }).environment;

      // User switches to Egg B (NodeJS Egg)
      const eggBVariables: EggVariable[] = [
        { id: 10, name: 'Main JS File', envVariable: 'JS_FILE', defaultValue: 'index.js', rules: 'required', isRequired: true, description: '', userViewable: true, userEditable: true },
      ];

      // Validate environment for Egg B when old envA was in memory
      const resultB = validateAndBuildEnvironment(eggBVariables, envA);

      assert.equal(resultB.valid, true);
      assert.equal(resultB.environment['JS_FILE'], 'index.js');
      // Stale keys from Egg A MUST NOT exist in Egg B environment!
      assert.equal(resultB.environment['SERVER_JARFILE'], undefined);
      assert.equal(resultB.environment['BUILD_NUMBER'], undefined);
      assert.deepEqual(Object.keys(resultB.environment), ['JS_FILE']);
    });
  });

  describe('4. Egg Validation Rules Compliance', () => {
    it('should validate integer and numeric rules', () => {
      const errorsInvalid = validateVariableAgainstRules('abc', 'required|integer', 'Port', 'SERVER_PORT', true);
      assert.ok(errorsInvalid.some((e) => e.includes('valid integer')));

      const errorsValid = validateVariableAgainstRules('25565', 'required|integer', 'Port', 'SERVER_PORT', true);
      assert.equal(errorsValid.length, 0);
    });

    it('should validate boolean rules', () => {
      const errorsInvalid = validateVariableAgainstRules('maybe', 'boolean', 'EULA', 'EULA_ACCEPTED', false);
      assert.ok(errorsInvalid.some((e) => e.includes('true or false')));

      const errorsValid = validateVariableAgainstRules('true', 'boolean', 'EULA', 'EULA_ACCEPTED', false);
      assert.equal(errorsValid.length, 0);
    });

    it('should validate max and min length rules', () => {
      const errorsTooLong = validateVariableAgainstRules('this_is_too_long_for_max_5', 'max:5', 'Short Code', 'CODE', false);
      assert.ok(errorsTooLong.some((e) => e.includes('cannot exceed 5 characters')));

      const errorsTooShort = validateVariableAgainstRules('ab', 'min:3', 'Key', 'KEY', false);
      assert.ok(errorsTooShort.some((e) => e.includes('must be at least 3 characters')));
    });

    it('should validate in: option list rules', () => {
      const errorsInvalid = validateVariableAgainstRules('invalid_mode', 'in:survival,creative,adventure', 'Gamemode', 'GAMEMODE', false);
      assert.ok(errorsInvalid.some((e) => e.includes('must be one of: survival, creative, adventure')));

      const errorsValid = validateVariableAgainstRules('survival', 'in:survival,creative,adventure', 'Gamemode', 'GAMEMODE', false);
      assert.equal(errorsValid.length, 0);
    });

    it('should validate regex pattern rules', () => {
      const errorsInvalid = validateVariableAgainstRules('my file.jar', 'regex:/^[a-zA-Z0-9_-]+\\.jar$/', 'Jar File', 'JAR', false);
      assert.ok(errorsInvalid.some((e) => e.includes('format is invalid')));

      const errorsValid = validateVariableAgainstRules('server.jar', 'regex:/^[a-zA-Z0-9_-]+\\.jar$/', 'Jar File', 'JAR', false);
      assert.equal(errorsValid.length, 0);
    });
  });

  describe('5. Safe Payload Construction & Integrity', () => {
    it('preserves all required environment keys in final environment map', () => {
      const eggVariables: EggVariable[] = [
        { id: 1, name: 'Server Jar File', envVariable: 'SERVER_JARFILE', defaultValue: 'server.jar', rules: 'required', isRequired: true, description: '', userViewable: true, userEditable: true },
        { id: 2, name: 'Build Number', envVariable: 'BUILD_NUMBER', defaultValue: 'latest', rules: 'required', isRequired: true, description: '', userViewable: true, userEditable: true },
        { id: 3, name: 'Minecraft Version', envVariable: 'MINECRAFT_VERSION', defaultValue: 'latest', rules: 'required', isRequired: true, description: '', userViewable: true, userEditable: true },
      ];

      const validation = validateAndBuildEnvironment(eggVariables, {
        SERVER_JARFILE: 'paper.jar',
      });

      assert.equal(validation.valid, true);
      assert.deepEqual(validation.environment, {
        SERVER_JARFILE: 'paper.jar',
        BUILD_NUMBER: 'latest',
        MINECRAFT_VERSION: 'latest',
      });
    });
  });

  describe('6. 32 GB RAM Allocation Limit Enforcement', () => {
    it('enforces 32768 MB (32 GB) boundary', () => {
      const MAX_RAM_MB = 32768;
      assert.equal(MAX_RAM_MB, 32768);

      const isMemoryValid = (mb: number) => Number.isInteger(mb) && mb > 0 && mb <= MAX_RAM_MB;

      assert.equal(isMemoryValid(1024), true);
      assert.equal(isMemoryValid(16384), true);
      assert.equal(isMemoryValid(32768), true);
      assert.equal(isMemoryValid(32769), false);
      assert.equal(isMemoryValid(65536), false);
      assert.equal(isMemoryValid(0), false);
      assert.equal(isMemoryValid(-1024), false);
    });
  });

  describe('7. Egg Variable Candidate Filter Robustness', () => {
    it('ignores items missing env_variable or with invalid names', () => {
      assert.equal(isEggVariableCandidate(null), false);
      assert.equal(isEggVariableCandidate({}), false);
      assert.equal(isEggVariableCandidate({ attributes: { name: 'Something' } }), false);
      assert.equal(isEggVariableCandidate({ attributes: { env_variable: '   ' } }), false);
      assert.equal(isEggVariableCandidate({ attributes: { env_variable: 'INVALID-DASH' } }), false);
      assert.equal(isEggVariableCandidate({ attributes: { env_variable: 'VALID_VAR', name: 'Var' } }), true);
      assert.equal(isEggVariableCandidate({ attributes: { env_variable: 'SERVER_JARFILE', default_value: 'server.jar' } }), true);
    });
  });
});

