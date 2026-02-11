"use client";

import TransparencyModalBase, {
  type TransparencyConfig,
  type TransparencySection,
} from "@/components/TransparencyModal";

export interface TransparencyData {
  systemPrompt: string;
  baseSystemPrompt?: string;
  knowledgeContext: string;
  customerContext?: string;
  documentContext?: string;
  urlContext?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface TransparencyModalProps {
  open: boolean;
  onClose: () => void;
  data: TransparencyData;
  isPreview?: boolean;
}

export function TransparencyModal({
  open,
  onClose,
  data,
  isPreview = false,
}: TransparencyModalProps) {
  const configs: TransparencyConfig[] = [
    { label: "Model", value: data.model, color: "blue" },
    { label: "Max Tokens", value: data.maxTokens, color: "yellow" },
    { label: "Temperature", value: data.temperature, color: "green" },
  ];

  const sections: TransparencySection[] = [
    data.knowledgeContext && {
      id: "knowledge",
      title: "Knowledge Context",
      content: data.knowledgeContext,
      defaultExpanded: true,
      copyLabel: "knowledge",
      showCharCount: true,
      maxHeight: 256,
    },
    data.customerContext && {
      id: "customer",
      title: "Customer Context",
      content: data.customerContext,
      defaultExpanded: false,
      copyLabel: "customer",
      showCharCount: true,
      maxHeight: 256,
    },
    data.documentContext && {
      id: "document",
      title: "Document Context",
      content: data.documentContext,
      defaultExpanded: false,
      copyLabel: "document",
      showCharCount: true,
      maxHeight: 256,
    },
    data.urlContext && {
      id: "url",
      title: "URL Context",
      content: data.urlContext,
      defaultExpanded: false,
      copyLabel: "url",
      showCharCount: true,
      maxHeight: 256,
    },
  ].filter(Boolean) as TransparencySection[];

  return (
    <TransparencyModalBase
      open={open}
      onClose={onClose}
      title={isPreview ? "System Prompt Preview" : "Prompt Transparency"}
      subtitle={
        isPreview
          ? "This is the system prompt that will be sent with your message"
          : "See exactly what was sent to the AI model"
      }
      headerColor="gray"
      configs={configs}
      systemPrompt={data.baseSystemPrompt || data.systemPrompt}
      sections={sections}
    />
  );
}
