import { useState } from "preact/hooks";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: preact.ComponentChild;
}

export function CollapsibleSection({ 
  title, 
  defaultOpen = true, 
  children 
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div class="collapsible-section">
      <div 
        class="collapsible-section__header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span class={`collapsible-section__arrow ${isOpen ? "open" : ""}`}>
          ▶
        </span>
        <span class="collapsible-section__title">{title}</span>
      </div>
      {isOpen && (
        <div class="collapsible-section__body">
          {children}
        </div>
      )}
    </div>
  );
}
