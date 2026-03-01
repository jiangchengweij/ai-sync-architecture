import { MappingStrategy, MappingContext, FileFunction, CodeMapping } from './types';

/**
 * Strategy that matches functions by exact file path and function name.
 * This is the highest confidence match - functions with the same location and name
 * are almost certainly the same logical entity.
 *
 * Priority: 1 (highest - runs first)
 * Confidence: 0.98
 */
export class ExactNameMappingStrategy implements MappingStrategy {
  readonly name = 'exact_name';
  readonly priority = 1;

  canHandle(_context: MappingContext): boolean {
    // Always applicable - exact name matching is always valuable
    return true;
  }

  async findMatches(
    baseFuncs: FileFunction[],
    variantFuncs: FileFunction[],
    context: MappingContext,
  ): Promise<CodeMapping[]> {
    const matches: CodeMapping[] = [];

    for (const bf of baseFuncs) {
      // Skip if already mapped
      if (context.mappedBaseKeys.has(bf.key)) continue;

      // Find exact match: same file path + function name
      const exactMatch = variantFuncs.find(
        (vf) =>
          vf.filePath === bf.filePath &&
          vf.func.name === bf.func.name &&
          !context.mappedVariantKeys.has(vf.key),
      );

      if (exactMatch) {
        matches.push({
          baseFunctionKey: bf.key,
          variantFunctionKey: exactMatch.key,
          baseFilePath: bf.filePath,
          variantFilePath: exactMatch.filePath,
          baseFunctionName: bf.func.name,
          variantFunctionName: exactMatch.func.name,
          confidence: 0.98,
          matchType: 'exact_name',
        });

        // Update context
        context.mappedBaseKeys.add(bf.key);
        context.mappedVariantKeys.add(exactMatch.key);
      }
    }

    return matches;
  }
}
