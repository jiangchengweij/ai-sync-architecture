import { MappingStrategy, MappingContext, FileFunction, CodeMapping } from './types';

/**
 * Strategy that matches functions by structural fingerprint.
 * Functions with identical fingerprints have the same structure
 * (param count, return type, async flag, etc.) even if names differ.
 *
 * Priority: 2 (runs after exact name matching)
 * Confidence: 0.85
 */
export class FingerprintMappingStrategy implements MappingStrategy {
  readonly name = 'fingerprint';
  readonly priority = 2;

  canHandle(_context: MappingContext): boolean {
    // Always applicable - fingerprint matching is always valuable
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

      // Find fingerprint match
      const fpMatch = variantFuncs.find(
        (vf) =>
          vf.fingerprint === bf.fingerprint &&
          !context.mappedVariantKeys.has(vf.key),
      );

      if (fpMatch) {
        matches.push({
          baseFunctionKey: bf.key,
          variantFunctionKey: fpMatch.key,
          baseFilePath: bf.filePath,
          variantFilePath: fpMatch.filePath,
          baseFunctionName: bf.func.name,
          variantFunctionName: fpMatch.func.name,
          confidence: 0.85,
          matchType: 'fingerprint',
        });

        // Update context
        context.mappedBaseKeys.add(bf.key);
        context.mappedVariantKeys.add(fpMatch.key);
      }
    }

    return matches;
  }
}
