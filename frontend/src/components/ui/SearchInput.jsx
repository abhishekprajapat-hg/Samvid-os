import React from "react";
import { Search, X } from "lucide-react";
import Input from "./Input";
import { cn } from "./utils";

const SearchInput = ({ value, onChange, onClear, placeholder = "Search...", className, ...props }) => (
  <Input
    type="search"
    value={value}
    onChange={(event) => onChange?.(event.target.value)}
    placeholder={placeholder}
    leftIcon={Search}
    className={cn(className)}
    rightSlot={
      value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => (onClear ? onClear() : onChange?.(""))}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <X aria-hidden="true" size={13} />
        </button>
      ) : null
    }
    {...props}
  />
);

export default SearchInput;
