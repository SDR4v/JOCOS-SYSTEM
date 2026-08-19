"use client";

import {
  Combobox,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxIcon,
  ComboboxClear,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

export type EmployeeOption = { id: string; name: string; officeAssignment: string };

function employeeLabel(employee: EmployeeOption): string {
  return `${employee.name} — ${employee.officeAssignment}`;
}

export function EmployeeCombobox({
  employees,
  value,
  onValueChange,
  placeholder = "Search employee...",
  className,
  id,
}: {
  employees: EmployeeOption[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const selected = employees.find((e) => e.id === value) ?? null;

  return (
    <Combobox
      items={employees}
      value={selected}
      onValueChange={(next) => onValueChange(next ? next.id : "")}
      itemToStringLabel={employeeLabel}
      isItemEqualToValue={(item, val) => item.id === val.id}
    >
      <ComboboxInputGroup className={className}>
        <ComboboxInput id={id} placeholder={placeholder} />
        <ComboboxClear />
        <ComboboxIcon />
      </ComboboxInputGroup>
      <ComboboxPopup>
        <ComboboxEmpty>No employees found.</ComboboxEmpty>
        <ComboboxList>
          {(item: EmployeeOption) => (
            <ComboboxItem key={item.id} value={item}>
              {employeeLabel(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
