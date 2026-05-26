import { useState } from 'react';
import { Filter, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';

import { Button } from '../Button';
import { Input } from '../Input';
import { FilterBar } from '../ui/Page';
import { Select } from '../ui/Select';
import type { Product } from '../../lib/product-api';

export type TransactionSortOption = 'newest' | 'oldest' | 'quantity_desc' | 'quantity_asc';

type TransactionsFiltersProps = {
  products: Product[];
  warehouses: string[];
  query: string;
  productId: string;
  movementType: string;
  warehouse: string;
  userQuery: string;
  sortBy: TransactionSortOption;
  activeFilterCount: number;
  onQueryChange: (value: string) => void;
  onProductChange: (value: string) => void;
  onMovementTypeChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onUserQueryChange: (value: string) => void;
  onSortChange: (value: TransactionSortOption) => void;
  onClear: () => void;
};

function FilterFields({
  products,
  warehouses,
  query,
  productId,
  movementType,
  warehouse,
  userQuery,
  sortBy,
  onQueryChange,
  onProductChange,
  onMovementTypeChange,
  onWarehouseChange,
  onUserQueryChange,
  onSortChange,
}: TransactionsFiltersProps) {
  return (
    <>
      <label className="relative min-w-0 flex-1 lg:min-w-[260px]">
        <span className="sr-only">Search transactions</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 pl-9"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search product, SKU, or notes"
        />
      </label>

      <label className="min-w-0 md:w-[min(100%,220px)]">
        <span className="sr-only">Product</span>
        <Select value={productId} onChange={(event) => onProductChange(event.target.value)} className="h-11">
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.product_name}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-0 md:w-[min(100%,170px)]">
        <span className="sr-only">Movement type</span>
        <Select value={movementType} onChange={(event) => onMovementTypeChange(event.target.value)} className="h-11">
          <option value="">All movements</option>
          <option value="STOCK_IN">Stock in</option>
          <option value="STOCK_OUT">Stock out</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </Select>
      </label>

      <label className="min-w-0 md:w-[min(100%,190px)]">
        <span className="sr-only">Warehouse</span>
        <Select value={warehouse} onChange={(event) => onWarehouseChange(event.target.value)} className="h-11">
          <option value="">All locations</option>
          {warehouses.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-0 md:w-[min(100%,180px)]">
        <span className="sr-only">User</span>
        <Input
          value={userQuery}
          onChange={(event) => onUserQueryChange(event.target.value)}
          placeholder="User ID or System"
          className="h-11"
        />
      </label>

      <label className="min-w-0 md:w-[min(100%,170px)]">
        <span className="sr-only">Sort transactions</span>
        <Select value={sortBy} onChange={(event) => onSortChange(event.target.value as TransactionSortOption)} className="h-11">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="quantity_desc">Qty high to low</option>
          <option value="quantity_asc">Qty low to high</option>
        </Select>
      </label>
    </>
  );
}

export function TransactionsFilters(props: TransactionsFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasFilters = props.activeFilterCount > 0;

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <Button
          type="button"
          className="h-11 flex-1 bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filters
          {hasFilters ? (
            <span className="ml-2 rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-white">
              {props.activeFilterCount}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          className="h-11 bg-white px-3 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          onClick={props.onClear}
          disabled={!hasFilters}
          aria-label="Clear filters"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {mobileOpen ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Filter className="h-4 w-4 text-slate-500" />
              Transaction filters
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
              onClick={props.onClear}
              disabled={!hasFilters}
            >
              Clear
            </button>
          </div>
          <div className="grid gap-2">
            <FilterFields {...props} />
          </div>
        </div>
      ) : null}

      <FilterBar className="hidden items-stretch md:flex">
        <FilterFields {...props} />
        <Button
          type="button"
          className="h-11 bg-white px-3 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          onClick={props.onClear}
          disabled={!hasFilters}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </FilterBar>
    </div>
  );
}
