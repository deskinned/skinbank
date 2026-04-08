#!/usr/bin/env bash
#! Auto-detect installed editors and configure .skin file support
#! Usage: curl -fsSL https://gitsk.in/setup | sh
#! Or: ./tooling/setup.sh (from repo root)
set -euo pipefail

SCHEMA_URL="https://skinbank.gitsk.in/v1/theme-schema.json"

echo "GitSkin Editor Setup"
echo "===================="
echo ""

# Stub — full implementation will auto-detect editors and configure:
# - .skin → YAML file association
# - JSON Schema for autocompletion + validation
# - Schema URL: $SCHEMA_URL

echo "Not yet implemented. Check https://gitsk.in/docs/authoring for manual setup."
