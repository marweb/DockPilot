import { forwardRef, useState, useEffect, useCallback, InputHTMLAttributes } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showClearButton?: boolean;
  autoFocus?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      debounce = 300,
      loading = false,
      placeholder = 'Search...',
      className,
      inputClassName,
      showClearButton = true,
      autoFocus = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(value);
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const debouncedOnChange = useCallback(
      (newValue: string) => {
        onChange(newValue);
      },
      [onChange]
    );

    useEffect(() => {
      const timer = setTimeout(() => {
        if (internalValue !== debouncedValue) {
          setDebouncedValue(internalValue);
          debouncedOnChange(internalValue);
        }
      }, debounce);

      return () => clearTimeout(timer);
    }, [internalValue, debounce, debouncedOnChange, debouncedValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
    };

    const handleClear = () => {
      setInternalValue('');
      onChange('');
    };

    const showClear = showClearButton && internalValue.length > 0 && !loading;

    return (
      <div className={clsx('relative', className)}>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>

        <input
          ref={ref}
          type="text"
          value={internalValue}
          onChange={handleChange}
          disabled={disabled}
          autoFocus={autoFocus}
          className={clsx(
            'block w-full pl-10 pr-10 py-2',
            'bg-white dark:bg-gray-800',
            'border border-gray-300 dark:border-gray-600',
            'rounded-lg',
            'text-sm text-gray-900 dark:text-gray-100',
            'placeholder-gray-400 dark:placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200',
            inputClassName
          )}
          placeholder={placeholder}
          {...props}
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {loading && <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />}
          {showClear && (
            <button
              type="button"
              onClick={handleClear}
              className={clsx(
                'p-0.5 rounded-full',
                'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                'transition-colors'
              )}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
