"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { parseApiData } from "@/lib/apiClient";
import { InlineError, InlineSuccess } from "@/components/ui/status-display";

type CustomerOption = {
  id: string;
  name: string;
};

// The analysis prompt shown to the AI - keeping this visible for transparency
const ANALYSIS_PROMPT = `You are a security and compliance expert reviewing customer contracts. Your task is to analyze security-related clauses and assess whether the organization can meet the requirements based on their documented capabilities.

ANALYSIS CATEGORIES:
- data_protection: Data handling, privacy, GDPR, personal data requirements
- security_controls: Technical security measures, encryption, access controls
- certifications: SOC 2, ISO 27001, PCI DSS, HIPAA compliance requirements
- incident_response: Breach notification, incident handling, response times
- audit_rights: Customer audit rights, third-party assessments, penetration testing
- subprocessors: Third-party/subcontractor requirements and approvals
- data_retention: Data storage duration, deletion requirements
- insurance: Cyber liability, professional liability coverage requirements
- liability: Limitation of liability, indemnification related to security
- confidentiality: NDA terms, information handling
- other: Other security or compliance related items

RATING SCALE:
- can_comply: The organization fully meets this requirement based on their documented capabilities
- partial: The organization partially meets this; may need adjustments or clarification
- gap: The organization does not currently support this requirement
- risk: This clause poses a potential risk or unreasonable obligation
- info_only: Informational clause, no specific action needed

YOUR CAPABILITIES (use these to assess compliance):
[Your Skills/Knowledge Base is injected here]

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "overallRating": "compliant" | "mostly_compliant" | "needs_review" | "high_risk",
  "summary": "Executive summary of the contract analysis (2-3 paragraphs)",
  "findings": [
    {
      "category": "category_name",
      "clauseText": "The exact or summarized clause text from the contract",
      "rating": "can_comply" | "partial" | "gap" | "risk" | "info_only",
      "rationale": "Why this rating was given, referencing your capabilities",
      "suggestedResponse": "Optional: How to respond or negotiate if needed"
    }
  ]
}

GUIDELINES:
1. Focus on security, privacy, and compliance clauses
2. Extract 5-20 key findings (don't list every clause, focus on important ones)
3. Be specific about which of your capabilities support each finding
4. For gaps or risks, suggest concrete responses or negotiation points
5. The overall rating should reflect the aggregate risk level
6. Return ONLY valid JSON, no markdown or explanatory text`;

const CONTRACT_TYPES = [
  "MSA (Master Service Agreement)",
  "DPA (Data Processing Agreement)",
  "SaaS Agreement",
  "NDA (Non-Disclosure Agreement)",
  "Security Addendum",
  "Vendor Agreement",
  "Other",
];

const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "24px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginBottom: "6px",
    color: "#374151",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    marginBottom: "16px",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    marginBottom: "16px",
    backgroundColor: "#fff",
  },
  dropZone: {
    border: "2px dashed #d1d5db",
    borderRadius: "10px",
    padding: "40px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.2s",
    backgroundColor: "#fafafa",
  },
  dropZoneActive: {
    border: "2px dashed #3b82f6",
    backgroundColor: "#eff6ff",
  },
  button: {
    padding: "12px 24px",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "14px",
  },
    modal: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "800px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  },
  promptPreview: {
    backgroundColor: "var(--surface-secondary)",
    padding: "16px",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#334155",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    maxHeight: "60vh",
    overflow: "auto",
    border: "1px solid var(--border)",
  },
};

export default function ContractUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [contractType, setContractType] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);

  // Fetch customers on mount
  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch("/api/customers");
        if (res.ok) {
          const json = await res.json();
          setCustomers(json.data?.profiles || json.profiles || []);
        }
      } catch {
        // Silently fail - customers are optional
      } finally {
        setCustomersLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext || "")) {
      setError("Please upload a PDF or Word document (.pdf, .docx, .doc)");
      return;
    }
    setError(null);
    setFile(f);
    if (!name) {
      setName(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name.replace(/\.[^.]+$/, ""));
      if (customerId) formData.append("customerId", customerId);
      if (selectedCustomer) formData.append("customerName", selectedCustomer.name);
      if (contractType) formData.append("contractType", contractType);

      const response = await fetch("/api/contracts", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = typeof data.error === 'object' ? data.error?.message : data.error;
        throw new Error(errorMessage || "Upload failed");
      }

      const json = await response.json();
      const data = parseApiData<{ id: string; contract?: { id: string } }>(json);
      setUploadedId(data.contract?.id || data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedId) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`/api/contracts/${uploadedId}/analyze`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = typeof data.error === 'object' ? data.error?.message : data.error;
        throw new Error(errorMessage || "Analysis failed");
      }

      // Navigate to the review page
      router.push(`/contracts/${uploadedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setName("");
    setCustomerId("");
    setContractType("");
    setUploadedId(null);
    setError(null);
  };

  return (
    <div style={styles.container}>
      <h1>Upload Contract</h1>
      <p style={{ color: "var(--muted-foreground)", marginBottom: "24px" }}>
        Upload customer contracts to analyze security clauses against your knowledge base.
        Get alignment ratings and suggested responses for negotiations.
      </p>

      {error && <InlineError message={error} onDismiss={() => setError(null)} />}

      {!uploadedId ? (
        <>
          <div style={styles.card}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Upload Contract</h3>

            <div
              style={{
                ...styles.dropZone,
                ...(isDragging ? styles.dropZoneActive : {}),
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              {file ? (
                <div>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
                  <div style={{ fontWeight: 600, color: "#1f2937" }}>{file.name}</div>
                  <div style={{ color: "#6b7280", fontSize: "14px" }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    style={{
                      marginTop: "12px",
                      padding: "6px 12px",
                      backgroundColor: "var(--surface-secondary)",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📁</div>
                  <div style={{ fontWeight: 600, color: "#1f2937" }}>
                    Drop your contract here
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>
                    or click to browse (PDF, DOCX)
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Contract Details</h3>

            <label style={styles.label}>Contract Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acme Corp MSA 2024"
              style={styles.input}
            />

            <label style={styles.label}>Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={styles.select}
              disabled={customersLoading}
            >
              <option value="">{customersLoading ? "Loading customers..." : "Select customer (optional)"}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            {customers.length === 0 && !customersLoading && (
              <p style={{ color: "var(--muted-foreground)", fontSize: "13px", marginTop: "-12px", marginBottom: "16px" }}>
                No customer profiles yet.{" "}
                <Link href="/customers" style={{ color: "#3b82f6" }}>
                  Create one
                </Link>
              </p>
            )}

            <label style={styles.label}>Contract Type</label>
            <select
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              style={styles.select}
            >
              <option value="">Select type...</option>
              {CONTRACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || isUploading}
              style={{
                ...styles.button,
                backgroundColor: !file || isUploading ? "#d1d5db" : "#3b82f6",
                color: "#fff",
                width: "100%",
                cursor: !file || isUploading ? "not-allowed" : "pointer",
              }}
            >
              {isUploading ? "Uploading..." : "Upload Contract"}
            </button>
          </div>
        </>
      ) : (
        <div style={styles.card}>
          <InlineSuccess message="Contract uploaded successfully! Ready for analysis." />

          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
            {name || file?.name}
          </h3>

          {selectedCustomer && (
            <p style={{ color: "#6b7280", margin: "4px 0" }}>
              <strong>Customer:</strong> {selectedCustomer.name}
            </p>
          )}
          {contractType && (
            <p style={{ color: "#6b7280", margin: "4px 0" }}>
              <strong>Type:</strong> {contractType}
            </p>
          )}

          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              style={{
                ...styles.button,
                backgroundColor: isAnalyzing ? "#d1d5db" : "#22c55e",
                color: "#fff",
                flex: 1,
                cursor: isAnalyzing ? "not-allowed" : "pointer",
              }}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Security Clauses"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isAnalyzing}
              style={{
                ...styles.button,
                backgroundColor: "var(--surface-secondary)",
                color: "#374151",
                border: "1px solid #d1d5db",
              }}
            >
              Upload Different
            </button>
          </div>

          {isAnalyzing && (
            <div style={{ marginTop: "24px" }}>
              <LoadingSpinner
                title="Analyzing contract..."
                subtitle="Extracting security clauses and comparing against your capabilities. This may take 30-60 seconds."
              />
            </div>
          )}
        </div>
      )}

      {/* View Prompt Button */}
      <div style={{ ...styles.card, backgroundColor: "var(--surface-secondary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: "4px", color: "var(--muted-foreground)" }}>
              Analysis Prompt
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)" }}>
              See exactly what the AI is instructed to analyze in your contracts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            style={{
              ...styles.button,
              backgroundColor: "var(--surface-secondary)",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            View Prompt
          </button>
        </div>
      </div>

      {/* Prompt Modal */}
      {showPromptModal && (
        <div style={styles.modal} onClick={() => setShowPromptModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: 600 }}>
                    Contract Analysis Prompt
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)" }}>
                    This is the system prompt sent to the AI when analyzing contracts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                    color: "var(--muted-foreground)",
                    padding: "4px",
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ padding: "24px" }}>
              <div style={styles.promptPreview}>
                {ANALYSIS_PROMPT}
              </div>
              <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--muted-foreground)" }}>
                  Your{" "}
                  <Link href="/knowledge" style={{ color: "#3b82f6" }}>
                    Skills/Knowledge Base
                  </Link>{" "}
                  is injected into this prompt to provide context about your capabilities.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  style={{
                    ...styles.button,
                    backgroundColor: "var(--surface-secondary)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
