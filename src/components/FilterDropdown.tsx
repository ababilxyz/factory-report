import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DropdownOption<T> {
  value: T
  label: string
}

interface Props<T> {
  title: string
  selectedLabel: string
  options: DropdownOption<T>[]
  onSelect: (value: T) => void
  isHighlighted?: boolean
}

/**
 * Tombol pemilih ringkas 44px, cermin `FilterDropdownButton.kt`: menampilkan
 * nilai terpilih dan panah ke bawah, membuka daftar saat diketuk. Menggantikan
 * deretan chip horizontal yang memakan ruang vertikal.
 */
export default function FilterDropdown<T extends string | null>({
  title,
  selectedLabel,
  options,
  onSelect,
  isHighlighted = false,
}: Props<T>) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={title}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 w-full items-center justify-between rounded-[12px] border bg-[#222429] px-3.5 text-xs transition-colors ${
          isHighlighted ? 'border-[#F4F5F7]' : 'border-[#2F3238]'
        }`}
      >
        <span className={isHighlighted ? 'text-[#F4F5F7] font-semibold' : 'text-[#A8AEBC]'}>
          {selectedLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''} ${
            isHighlighted ? 'text-[#F4F5F7]' : 'text-[#8E929B]'
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-[12px] border border-[#2F3238] bg-[#222429] shadow-2xl"
        >
          {options.map((option) => (
            <li key={String(option.value)}>
              <button
                type="button"
                role="option"
                aria-selected={option.label === selectedLabel}
                onClick={() => {
                  onSelect(option.value)
                  setOpen(false)
                }}
                className={`w-full px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-white/5 ${
                  option.label === selectedLabel
                    ? 'font-bold text-[#F4F5F7] bg-white/5'
                    : 'text-[#A8AEBC]'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
