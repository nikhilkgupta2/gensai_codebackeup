import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, SectionCard, SectionHeader } from '../components/ui/Page';
import { createProduct, getProduct, type Product, updateProduct } from '../lib/product-api';

const schema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().optional(),
  brand: z.string().optional(),
  quantity: z.number().min(0, 'Quantity must be zero or higher').optional(),
  price: z.number().min(0, 'Price must be zero or higher').optional(),
  supplier: z.string().optional(),
  warehouse_location: z.string().optional(),
  description: z.string().optional(),
});

type ProductFormData = z.infer<typeof schema>;

export function ProductFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { productId } = useParams<{ productId: string }>();
  const isEdit = Boolean(productId);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_name: '',
      sku: '',
      category: undefined,
      brand: undefined,
      quantity: 0,
      price: undefined,
      supplier: undefined,
      warehouse_location: undefined,
      description: undefined,
    },
  });

  const { data: product, isLoading: isFetching } = useQuery<Product>({
    queryKey: ['product', productId],
    queryFn: () => getProduct(String(productId)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (product) {
      form.reset({
        product_name: product.product_name,
        sku: product.sku,
        category: product.category ?? undefined,
        brand: product.brand ?? undefined,
        quantity: product.quantity,
        price: product.price ?? undefined,
        supplier: product.supplier ?? undefined,
        warehouse_location: product.warehouse_location ?? undefined,
        description: product.description ?? undefined,
      });
    }
  }, [product, form]);

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ProductFormData) => updateProduct(String(productId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });

  const onSubmit = (values: ProductFormData) => {
    const payload = {
      ...values,
      quantity: values.quantity ?? 0,
      price: values.price ?? undefined,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Page>
      <SectionCard className="mx-auto max-w-5xl">
        <SectionHeader
          title={isEdit ? 'Edit product' : 'New product'}
          description={isEdit ? 'Update product details, stock settings, and warehouse attributes.' : 'Add a catalog item with stock, pricing, and location metadata.'}
          actions={
          <Link to="/products" className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
            Back to products
          </Link>
          }
        />

        {(createMutation.isError || updateMutation.isError) && (
          <p className="m-5 mb-0 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> Something went wrong while saving the product.
          </p>
        )}

        {isFetching ? (
          <div className="p-5">
            <LoadingState label="Loading product..." />
          </div>
        ) : (
          <form className="space-y-6 p-5" onSubmit={form.handleSubmit(onSubmit)}>
            <section>
              <h2 className="text-sm font-semibold text-slate-900">Core details</h2>
              <p className="mt-1 text-sm text-slate-500">Naming, SKU, and classification for fast lookup.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                <span>Name</span>
                <Input {...form.register('product_name')} />
                {form.formState.errors.product_name ? (
                  <span className="block text-xs font-normal text-red-600">
                    {form.formState.errors.product_name.message}
                  </span>
                ) : null}
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>SKU</span>
                <Input {...form.register('sku')} />
                {form.formState.errors.sku ? (
                  <span className="block text-xs font-normal text-red-600">
                    {form.formState.errors.sku.message}
                  </span>
                ) : null}
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                <span>Category</span>
                <Input {...form.register('category')} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Brand</span>
                <Input {...form.register('brand')} />
              </label>
            </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-900">Stock and location</h2>
              <p className="mt-1 text-sm text-slate-500">Operational fields used by warehouse teams and reporting.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                <span>Quantity</span>
                <Input
                  type="number"
                  {...form.register('quantity', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
                {form.formState.errors.quantity ? (
                  <span className="block text-xs font-normal text-red-600">
                    {form.formState.errors.quantity.message}
                  </span>
                ) : null}
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Price</span>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('price', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
                {form.formState.errors.price ? (
                  <span className="block text-xs font-normal text-red-600">
                    {form.formState.errors.price.message}
                  </span>
                ) : null}
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                <span>Supplier</span>
                <Input {...form.register('supplier')} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Warehouse location</span>
                <Input {...form.register('warehouse_location')} />
              </label>
            </div>
            </section>

            <label className="block space-y-2 text-sm font-medium">
              <span>Description</span>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                {...form.register('description')}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link
                to="/products"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <Button type="submit" disabled={createMutation.status === 'pending' || updateMutation.status === 'pending'}>
                {isEdit
                  ? updateMutation.status === 'pending'
                    ? 'Saving...'
                    : 'Save changes'
                  : createMutation.status === 'pending'
                    ? 'Creating...'
                    : 'Create product'}
              </Button>
            </div>
          </form>
        )}
      </SectionCard>
    </Page>
  );
}
