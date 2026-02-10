// Salesforce API Client
// Uses OAuth 2.0 with refresh token flow for server-side access

import { circuitBreakers } from "./circuitBreaker";
import { getSecret } from "./secrets";

export type SalesforceConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  instanceUrl: string; // e.g., https://yourcompany.salesforce.com
};

export type SalesforceTokenResponse = {
  access_token: string;
  instance_url: string;
  token_type: string;
  issued_at: string;
};

export type SalesforceAccount = {
  Id: string;
  Name: string;
  Industry?: string;
  Website?: string;
  Description?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingCountry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Type?: string; // Customer, Prospect, Partner, etc.
  OwnerId?: string;
  Owner?: {
    Name?: string;
    Email?: string;
  };
  CreatedDate?: string;
  LastModifiedDate?: string;
  // Custom fields can be added here
  [key: string]: unknown;
};

export type SalesforceQueryResult<T> = {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
};

// Cache for access token (in-memory, resets on server restart)
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedConfig: SalesforceConfig | null = null;

async function getConfig(): Promise<SalesforceConfig> {
  // Return cached config to avoid repeated secret lookups
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const clientId = await getSecret("salesforce-client-id", "SALESFORCE_CLIENT_ID");
    const clientSecret = await getSecret("salesforce-client-secret", "SALESFORCE_CLIENT_SECRET");
    const refreshToken = await getSecret("salesforce-refresh-token", "SALESFORCE_REFRESH_TOKEN");
    const instanceUrl = await getSecret("salesforce-instance-url", "SALESFORCE_INSTANCE_URL");

    cachedConfig = { clientId, clientSecret, refreshToken, instanceUrl };
    return cachedConfig;
  } catch {
    throw new Error(
      "Salesforce not configured. Set SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_REFRESH_TOKEN, and SALESFORCE_INSTANCE_URL in AWS Secrets Manager or environment variables."
    );
  }
}

export async function isSalesforceConfigured(): Promise<boolean> {
  try {
    await getSecret("salesforce-client-id", "SALESFORCE_CLIENT_ID");
    return true;
  } catch {
    return false;
  }
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const config = await getConfig();

  const response = await circuitBreakers.salesforce.execute(() =>
    fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
      }),
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Salesforce token: ${errorText}`);
  }

  const data = (await response.json()) as SalesforceTokenResponse;

  // Cache token for ~1 hour (Salesforce tokens typically last 2 hours)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return data.access_token;
}

export async function salesforceQuery<T>(soql: string): Promise<SalesforceQueryResult<T>> {
  const config = await getConfig();
  const accessToken = await getAccessToken();

  const response = await circuitBreakers.salesforce.execute(() =>
    fetch(
      `${config.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    )
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce query failed: ${errorText}`);
  }

  return response.json() as Promise<SalesforceQueryResult<T>>;
}

export async function fetchAllAccounts(
  modifiedSince?: Date,
  accountTypes?: string[]
): Promise<SalesforceAccount[]> {
  let whereClause = "";
  const conditions: string[] = [];

  if (modifiedSince) {
    conditions.push(`LastModifiedDate >= ${modifiedSince.toISOString()}`);
  }

  if (accountTypes && accountTypes.length > 0) {
    const typeList = accountTypes.map((t) => `'${t}'`).join(", ");
    conditions.push(`Type IN (${typeList})`);
  }

  if (conditions.length > 0) {
    whereClause = ` WHERE ${conditions.join(" AND ")}`;
  }

  const soql = `
    SELECT
      Id, Name, Industry, Website, Description,
      BillingCity, BillingState, BillingCountry,
      NumberOfEmployees, AnnualRevenue, Type,
      OwnerId, Owner.Name, Owner.Email,
      CreatedDate, LastModifiedDate
    FROM Account
    ${whereClause}
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `.trim();

  const result = await salesforceQuery<SalesforceAccount>(soql);
  return result.records;
}

export async function fetchAccountById(accountId: string): Promise<SalesforceAccount | null> {
  const config = await getConfig();
  const accessToken = await getAccessToken();

  const response = await circuitBreakers.salesforce.execute(() =>
    fetch(
      `${config.instanceUrl}/services/data/v59.0/sobjects/Account/${accountId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    )
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Salesforce account: ${errorText}`);
  }

  return response.json() as Promise<SalesforceAccount>;
}

// Search accounts by name (useful for linking)
export async function searchAccounts(searchTerm: string): Promise<SalesforceAccount[]> {
  // Escape special SOSL characters
  const escapedTerm = searchTerm.replace(/['"\\]/g, "\\$&");

  const config = await getConfig();
  const accessToken = await getAccessToken();

  const sosl = `FIND {${escapedTerm}} IN NAME FIELDS RETURNING Account(Id, Name, Industry, Website, Type) LIMIT 20`;

  const response = await circuitBreakers.salesforce.execute(() =>
    fetch(
      `${config.instanceUrl}/services/data/v59.0/search?q=${encodeURIComponent(sosl)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    )
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce search failed: ${errorText}`);
  }

  const data = (await response.json()) as { searchRecords: SalesforceAccount[] };
  return data.searchRecords || [];
}

// Static fields from Salesforce (read-only in app)
export type SalesforceStaticFields = {
  salesforceId: string;
  name: string;
  industry: string | null;
  website: string | null;
  region: string | null;
  tier: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  accountType: string | null;
  billingLocation: string | null;
};

// Map Salesforce Account to CustomerProfile static fields
export function mapAccountToStaticFields(account: SalesforceAccount): SalesforceStaticFields {
  // Build billing location from components
  const billingLocation = [account.BillingCity, account.BillingState, account.BillingCountry]
    .filter(Boolean)
    .join(", ") || null;

  // Region can come from a custom field or be derived from BillingCountry
  // This is a placeholder - customize based on your Salesforce schema
  const region = (account as Record<string, unknown>).Region__c as string | undefined ||
    deriveRegionFromCountry(account.BillingCountry) || null;

  // Tier can come from a custom field
  // This is a placeholder - customize based on your Salesforce schema
  const tier = (account as Record<string, unknown>).Tier__c as string | undefined ||
    (account as Record<string, unknown>).Account_Tier__c as string | undefined || null;

  return {
    salesforceId: account.Id,
    name: account.Name,
    industry: account.Industry || null,
    website: account.Website || null,
    region,
    tier,
    employeeCount: account.NumberOfEmployees || null,
    annualRevenue: account.AnnualRevenue || null,
    accountType: account.Type || null,
    billingLocation,
  };
}

// Helper to derive region from country (customize as needed)
function deriveRegionFromCountry(country?: string): string | null {
  if (!country) return null;

  const countryLower = country.toLowerCase();

  // North America
  if (["united states", "usa", "us", "canada", "mexico"].some(c => countryLower.includes(c))) {
    return "NA";
  }

  // EMEA
  if (["united kingdom", "uk", "germany", "france", "spain", "italy", "netherlands",
       "sweden", "norway", "denmark", "finland", "ireland", "belgium", "switzerland",
       "austria", "poland", "czech", "portugal", "israel", "south africa", "uae",
       "saudi arabia", "egypt", "nigeria", "kenya"].some(c => countryLower.includes(c))) {
    return "EMEA";
  }

  // APAC
  if (["australia", "japan", "china", "india", "singapore", "hong kong", "korea",
       "taiwan", "indonesia", "malaysia", "thailand", "vietnam", "philippines",
       "new zealand"].some(c => countryLower.includes(c))) {
    return "APAC";
  }

  // LATAM
  if (["brazil", "argentina", "chile", "colombia", "peru", "costa rica",
       "panama", "puerto rico"].some(c => countryLower.includes(c))) {
    return "LATAM";
  }

  return null;
}

// Legacy function - kept for backwards compatibility
// Map Salesforce Account to CustomerProfile fields (including legacy keyFacts)
export function mapAccountToProfile(account: SalesforceAccount): {
  name: string;
  industry: string | null;
  website: string | null;
  overview: string;
  keyFacts: { label: string; value: string }[];
  salesforceId: string;
  // Static fields
  region: string | null;
  tier: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  accountType: string | null;
  billingLocation: string | null;
} {
  const staticFields = mapAccountToStaticFields(account);

  const keyFacts: { label: string; value: string }[] = [];

  if (account.NumberOfEmployees) {
    keyFacts.push({ label: "Employees", value: account.NumberOfEmployees.toLocaleString() });
  }
  if (account.AnnualRevenue) {
    keyFacts.push({
      label: "Annual Revenue",
      value: `$${(account.AnnualRevenue / 1000000).toFixed(1)}M`,
    });
  }
  if (staticFields.billingLocation) {
    keyFacts.push({ label: "Location", value: staticFields.billingLocation });
  }
  if (account.Type) {
    keyFacts.push({ label: "Account Type", value: account.Type });
  }

  // Build overview from description or generate placeholder
  const overview =
    account.Description ||
    `${account.Name} is a ${account.Industry || "company"} based in ${
      account.BillingCountry || "unknown location"
    }.`;

  return {
    name: staticFields.name,
    industry: staticFields.industry,
    website: staticFields.website,
    overview,
    keyFacts,
    salesforceId: staticFields.salesforceId,
    region: staticFields.region,
    tier: staticFields.tier,
    employeeCount: staticFields.employeeCount,
    annualRevenue: staticFields.annualRevenue,
    accountType: staticFields.accountType,
    billingLocation: staticFields.billingLocation,
  };
}
