"use client";

/**
 * ContextControlsBar - Shared component for persona and customer selection
 *
 * Used by: Chat, Collateral, Projects, Contract Review
 *
 * Features:
 * - Persona/instruction preset selector
 * - Customer selector with segment filters
 * - Optional call mode toggle
 * - Extensible with left/right content slots
 */

import { useState, useMemo } from "react";
import { User, Users, Building2, Star, Filter, X, ChevronDown, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";
import type { Customer } from "@/types/v2";
import { useSelectionStore } from "@/stores/selection-store";
import { usePersonas } from "@/hooks/use-personas";
import type { PersonaItem } from "@/hooks/use-personas";

// Legacy type - now mapped to PersonaItem from V2 API
export type InstructionPreset = PersonaItem;

type SegmentFilter = {
  tier?: string;
  industry?: string;
};

export interface ContextControlsBarProps {
  // Persona props
  selectedPresetId: string | null;
  onPresetChange: (preset: InstructionPreset | null) => void;
  onUserInstructionsChange: (instructions: string) => void;
  // Call mode props (optional - only shown in chat context)
  callMode?: boolean;
  onCallModeChange?: (enabled: boolean) => void;
  // Customer props
  customers: Customer[];
  selectedCustomerId: string | null;
  onCustomerSelect: (customerId: string | null) => void;
  customersLoading?: boolean;
  customerDisabled?: boolean; // Disable customer selection (e.g., when session is active)
  customerDisabledReason?: string; // Tooltip text when disabled
  // Skills props for auto-selection based on persona categories
  skills?: Array<{ id: string; categories: string[] }>;
  onSkillsAutoSelected?: (selectedCount: number, categories: string[]) => void;
  // Optional left content (e.g., title)
  leftContent?: React.ReactNode;
  // Optional right content (e.g., action buttons)
  rightContent?: React.ReactNode;
}

export function ContextControlsBar({
  selectedPresetId,
  onPresetChange,
  onUserInstructionsChange,
  callMode,
  onCallModeChange,
  customers,
  selectedCustomerId,
  onCustomerSelect,
  customersLoading,
  customerDisabled,
  customerDisabledReason,
  skills,
  onSkillsAutoSelected,
  leftContent,
  rightContent,
}: ContextControlsBarProps) {
  // Fetch personas from V2 API
  const { personas, loading: presetsLoading, error: presetsError } = usePersonas({ enabled: true });

  // Selection store for skill auto-selection
  const selectSkillsByCategories = useSelectionStore((state) => state.selectSkillsByCategories);

  // Customer filter state
  const [segmentFilters, setSegmentFilters] = useState<SegmentFilter>({});

  // Safely handle preset selection with error recovery
  const handlePresetSelectSafe = (preset: PersonaItem | null) => {
    try {
      handlePresetSelect(preset);
    } catch (error) {
      console.error('Error selecting preset:', error);
      // Fall back to default if error occurs
      onPresetChange(null);
      onUserInstructionsChange(DEFAULTS.USER_INSTRUCTIONS);
    }
  };

  const handlePresetSelect = (preset: PersonaItem | null) => {
    onPresetChange(preset as InstructionPreset);
    if (preset) {
      onUserInstructionsChange(preset.content);
      localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, preset.content);

      // Auto-select skills by category if persona has defaultCategories
      const attrs = preset.attributes || {};
      if (attrs.defaultCategories?.length && skills?.length) {
        const selectedIds = selectSkillsByCategories(skills, attrs.defaultCategories);
        onSkillsAutoSelected?.(selectedIds.length, attrs.defaultCategories);
      }
    } else {
      onUserInstructionsChange(DEFAULTS.USER_INSTRUCTIONS);
      localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, DEFAULTS.USER_INSTRUCTIONS);
    }
  };

  // Group personas by approval status
  const orgPersonas = personas.filter((p) => {
    const attrs = p.attributes || {};
    return attrs.shareStatus === "APPROVED";
  });
  const myPersonas = personas.filter((p) => {
    const attrs = p.attributes || {};
    return attrs.shareStatus === "PRIVATE" || !attrs.shareStatus;
  });
  const selectedPreset = personas.find((p) => p.id === selectedPresetId) as PersonaItem | undefined;

  // Extract unique segment values from customers
  const segmentOptions = useMemo(() => {
    const tiers = new Set<string>();
    const industries = new Set<string>();

    customers.forEach((c) => {
      if (c.tier) tiers.add(c.tier);
      if (c.industry) industries.add(c.industry);
    });

    return {
      tiers: Array.from(tiers).sort(),
      industries: Array.from(industries).sort(),
    };
  }, [customers]);

  const hasActiveFilters = Object.values(segmentFilters).some(Boolean);

  const filteredCustomers = useMemo(() => {
    if (!hasActiveFilters) return customers;

    return customers.filter((c) => {
      if (segmentFilters.tier && c.tier !== segmentFilters.tier) return false;
      if (segmentFilters.industry && c.industry !== segmentFilters.industry) return false;
      return true;
    });
  }, [customers, segmentFilters, hasActiveFilters]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const activeFilterCount = Object.values(segmentFilters).filter(Boolean).length;

  const clearFilters = () => setSegmentFilters({});
  const setFilter = (key: keyof SegmentFilter, value: string | undefined) => {
    setSegmentFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  };

  const isLoading = presetsLoading || customersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center gap-6 px-4 py-2 border-b border-border bg-muted/30">
        {leftContent}
        <span className="text-sm text-muted-foreground">Loading...</span>
        {rightContent && <div className="ml-auto flex items-center gap-2">{rightContent}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-muted/30">
      {/* Left content (e.g., title) */}
      {leftContent}

      {/* Assistant Persona Section */}
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Assistant Persona:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[180px] justify-between">
              <span className="truncate">
                {selectedPreset ? selectedPreset.title : "Default Assistant"}
              </span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            <DropdownMenuItem onClick={() => handlePresetSelectSafe(null)}>
              <div className="flex flex-col">
                <span>Default Assistant</span>
                <span className="text-xs text-muted-foreground">Standard AI assistant behavior</span>
              </div>
            </DropdownMenuItem>

            {presetsError && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-destructive">
                  Error loading personas. Using defaults.
                </div>
              </>
            )}

            {orgPersonas.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Organization Personas
                </div>
                {orgPersonas.map((persona) => {
                  const attrs = persona.attributes || {};
                  return (
                    <DropdownMenuItem key={persona.id} onClick={() => handlePresetSelectSafe(persona)}>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2">
                          {persona.title}
                          {attrs.isDefault && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              default
                            </span>
                          )}
                        </span>
                        {persona.summary && (
                          <span className="text-xs text-muted-foreground">{persona.summary}</span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}

            {myPersonas.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  My Personas
                </div>
                {myPersonas.map((persona) => (
                  <DropdownMenuItem key={persona.id} onClick={() => handlePresetSelectSafe(persona)}>
                    <div className="flex flex-col">
                      <span>{persona.title}</span>
                      {persona.summary && (
                        <span className="text-xs text-muted-foreground">{persona.summary}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Call Mode Toggle - only shown when props are provided */}
      {onCallModeChange && (
        <>
          <Button
            variant={callMode ? "default" : "outline"}
            size="sm"
            onClick={() => onCallModeChange(!callMode)}
            className={`gap-2 ${callMode ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
          >
            <Phone className="h-4 w-4" />
            Call Mode {callMode ? "On" : "Off"}
          </Button>

          {/* Divider */}
          <div className="h-5 w-px bg-border" />
        </>
      )}

      {/* Divider (when no call mode) */}
      {!onCallModeChange && <div className="h-5 w-px bg-border" />}

      {/* Customer Focus Section */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Customer Focus:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={customerDisabled}>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 min-w-[180px] justify-between"
              disabled={customerDisabled}
              title={customerDisabled ? customerDisabledReason : undefined}
            >
              <span className="truncate">
                {selectedCustomer ? selectedCustomer.company : "Select customer..."}
              </span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[320px] max-h-[400px] overflow-y-auto">
            <DropdownMenuItem onClick={() => onCustomerSelect(null)}>
              <span className="text-muted-foreground">No customer selected</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {filteredCustomers.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No customers match current filters
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <DropdownMenuItem
                  key={customer.id}
                  onClick={() => onCustomerSelect(customer.id)}
                  className="flex flex-col items-start gap-1"
                >
                  <span className="font-medium">{customer.company}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {customer.industry && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {customer.industry}
                      </span>
                    )}
                    {customer.tier && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {customer.tier}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Segment Filters */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            {segmentOptions.tiers.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Tier
                </div>
                {segmentOptions.tiers.map((tier) => (
                  <DropdownMenuCheckboxItem
                    key={tier}
                    checked={segmentFilters.tier === tier}
                    onCheckedChange={() => setFilter("tier", tier)}
                  >
                    {tier}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {segmentOptions.industries.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Industry
                </div>
                {segmentOptions.industries.map((industry) => (
                  <DropdownMenuCheckboxItem
                    key={industry}
                    checked={segmentFilters.industry === industry}
                    onCheckedChange={() => setFilter("industry", industry)}
                  >
                    {industry}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}

            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-destructive">
                  <X className="h-4 w-4 mr-2" />
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right content (e.g., action buttons) - pushed to the right */}
      {rightContent && (
        <div className="flex items-center gap-2 ml-auto">
          {rightContent}
        </div>
      )}
    </div>
  );
}
