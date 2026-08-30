# Source provenance

The initial versions of `src/index.ts`, `tests/index.test.ts`, and `tests/plugin-types.ts` in this package were migrated on 2026-08-30 from:

- Local source repository: `/Users/rinesh/Documents/GameProjects/KaplayWebMCP`
- Source commit: `f57aa9a2cd1d247367de09c89d007c9a752c24b0`
- Source commit date: 2026-08-27
- Source author: Rinesh Thomas

The consumer type fixture was derived from the same commit, with references to the retired standalone KAPLAYGROUND entry point removed.

This migration includes only the generic running-game WebMCP bridge. It deliberately excludes `src/kaplayground.ts`, `integrations/kaplayground`, the KAPLAYGROUND-shaped editor demo, deployment workers, and hosting configuration. The KAPLAYGROUND application owns the newer editor-native WebMCP integration, so importing the older copy would create two competing implementations.

The package is distributed under the KAPLAYGROUND repository's MIT license.
