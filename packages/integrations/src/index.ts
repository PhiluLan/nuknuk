export interface AdapterCapability {
  actionClass: string;
  reversible: boolean;
  requiresApproval: boolean;
}
export interface IntegrationAdapter {
  name: string;
  capabilities: readonly AdapterCapability[];
}
