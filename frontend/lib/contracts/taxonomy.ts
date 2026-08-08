/**
 * Taxonomy & schema — not a documented endpoint response in docs/api.md's Track A list
 * (schemas are read via `GET /admin/schemas`, Track B), but the fixture generator needs
 * a typed shape for the five PVF classes and their attribute definitions
 * (docs/domain/pvf-reference.md §2-3, docs/04-data-model.md §3.2). Domain-only; not
 * wire-parsed from an HTTP response in F0.5.
 */
import { RISK_TIERS, type RiskTier } from "./attribute-value";

export interface AttributeDefinition {
  code: string;
  name: string;
  datatype: string;
  unitDimension: string | null;
  allowedValues: string[] | null;
  isMandatory: boolean;
  riskTier: RiskTier;
}

export interface TaxonomyClass {
  id: string;
  code: string;
  name: string;
  attributes: AttributeDefinition[];
}

export { RISK_TIERS };
